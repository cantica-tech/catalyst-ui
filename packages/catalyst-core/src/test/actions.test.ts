import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionError, actionArgs, describeAction, runAction, tryArgs } from "../actions.js";

describe("actionArgs (studio-SHELL-000016)", () => {
  it("builds each allow-listed verb's arguments, options as --name=value", () => {
    expect(
      actionArgs({ verb: "status-set", id: "REQ-000001-Ab3xR9pQ", state: "Under Review", intent: "Ready" }),
    ).toEqual(["status", "set", "REQ-000001-Ab3xR9pQ", "Under Review", "--intent=Ready", "--json"]);
    expect(
      actionArgs({
        verb: "journal-adopt",
        commit: "abc1234",
        intent: "A hotfix",
        tier: "fix",
        target: "br-AUTH-000001",
      }),
    ).toEqual(["journal", "adopt", "abc1234", "--intent=A hotfix", "--tier=fix", "--target=br-AUTH-000001", "--json"]);
    expect(actionArgs({ verb: "journal-append", path: "src/a.py", intent: "why", tier: "chore" })).toEqual([
      "journal",
      "append",
      "--command=/adopt",
      "--action=update",
      "--artifact=src/a.py",
      "--file=src/a.py",
      "--intent=why",
      "--tier=chore",
      "--json",
    ]);
    expect(
      actionArgs({ verb: "reconcile", case: "RECON-000001", decision: "propose", intent: "x", text: "Use B" }),
    ).toEqual(["reconcile", "RECON-000001", "propose", "--intent=x", "--text=Use B"]);
  });

  it("restores an entity to one change of its history, or to a time", () => {
    expect(actionArgs({ verb: "restore", id: "REQ-000001-Ab3xR9pQ", to: "#2", intent: "Undo" })).toEqual([
      "restore",
      "REQ-000001-Ab3xR9pQ",
      "--to=#2",
      "--intent=Undo",
      "--json",
    ]);
    expect(actionArgs({ verb: "restore", id: "REQ-000001", to: "2026-10-16T08:00:00Z", intent: "x" })).toContain(
      "--to=2026-10-16T08:00:00Z",
    );
    for (const to of ["#0", "2", "yesterday", "#2; rm", "--force"])
      expect(() => actionArgs({ verb: "restore", id: "REQ-000001", to, intent: "x" })).toThrow("to:");
  });

  it("decides one finding of an analysis, an accepted one naming what it became (catalyst >= 0.44.0)", () => {
    expect(
      actionArgs({
        verb: "analysis-decide",
        id: "ANALYSIS-000001-Ab3xR9pQ",
        finding: "F2",
        verdict: "accept",
        artifact: "br-AUTH-000001-Ab3xR9pQ",
        intent: "The code does check it",
      }),
    ).toEqual([
      "analysis",
      "decide",
      "ANALYSIS-000001-Ab3xR9pQ",
      "F2",
      "accept",
      "--artifact=br-AUTH-000001-Ab3xR9pQ",
      "--reason=The code does check it",
    ]);
    expect(
      actionArgs({
        verb: "analysis-decide",
        id: "ANALYSIS-000001-Ab3xR9pQ",
        finding: "F3",
        verdict: "accept",
        artifact: "AUTH",
        intent: "A domain",
      }),
    ).toContain("--artifact=AUTH");
    expect(() =>
      actionArgs({
        verb: "analysis-decide",
        id: "ANALYSIS-000001-Ab3xR9pQ",
        finding: "F2",
        verdict: "accept",
        intent: "x",
      }),
    ).toThrow(/artifact/);
    expect(() =>
      actionArgs({
        verb: "analysis-decide",
        id: "ANALYSIS-000001-Ab3xR9pQ",
        finding: "--all",
        verdict: "reject",
        intent: "x",
      }),
    ).toThrow(/finding/);
    expect(() =>
      actionArgs({
        verb: "analysis-decide",
        id: "ANALYSIS-000001-Ab3xR9pQ",
        finding: "F2",
        verdict: "maybe",
        intent: "x",
      }),
    ).toThrow(/verdict/);
  });

  it("approves an entity's current version under a gate (catalyst >= 0.80.0)", () => {
    expect(
      actionArgs({ verb: "approve", id: "br-AUTH-000001-Ab3xR9pQ", gate: "auth-rules", intent: "Reviewed" }),
    ).toEqual(["approve", "br-AUTH-000001-Ab3xR9pQ", "--gate=auth-rules", "--intent=Reviewed", "--json"]);
    for (const gate of ["", "Auth", "a b", "--force", "x;rm"])
      expect(() => actionArgs({ verb: "approve", id: "REQ-000001", gate, intent: "x" })).toThrow("gate:");
    expect(() => actionArgs({ verb: "approve", id: "-x", gate: "g", intent: "x" })).toThrow("id:");
  });

  it("tries the same arguments with catalyst try (studio-SHELL-000020)", () => {
    expect(tryArgs({ verb: "status-set", id: "REQ-000001", state: "Done", intent: "x" })).toEqual([
      "try",
      "--json",
      "status",
      "set",
      "REQ-000001",
      "Done",
      "--intent=x",
      "--json",
    ]);
    expect(() => tryArgs({ verb: "rm" })).toThrow(ActionError);
  });

  it("journals a status set's slash command when one is given (REQ-000077-UVqkd7cL)", () => {
    expect(
      actionArgs({
        verb: "status-set",
        id: "BUG-000001-Ab3xR9pQ",
        state: "Closed",
        intent: "Fixed upstream",
        tier: "fix",
        command: "/status",
      }),
    ).toEqual([
      "status",
      "set",
      "BUG-000001-Ab3xR9pQ",
      "Closed",
      "--intent=Fixed upstream",
      "--tier=fix",
      "--command=/status",
      "--json",
    ]);
    for (const command of ["status", "/status --force", "/Status", "--force"])
      expect(() => actionArgs({ verb: "status-set", id: "BUG-000001", state: "Closed", intent: "x", command })).toThrow(
        "command",
      );
  });

  it("keeps a reason that looks like an option a value", () => {
    expect(actionArgs({ verb: "status-set", id: "REQ-000001", state: "Done", intent: "--force" })).toContain(
      "--intent=--force",
    );
  });

  it("refuses anything outside the allow-list, or a field that is not what it says", () => {
    const bad: [unknown, string][] = [
      [{ verb: "rm", path: "x" }, "not an action"],
      [{ verb: "status-set", id: "--force", state: "Done", intent: "x" }, "id"],
      [{ verb: "status-set", id: "REQ-000001", state: "-x", intent: "x" }, "state"],
      [{ verb: "status-set", id: "REQ-000001", state: "Done", intent: "" }, "intent"],
      [{ verb: "journal-adopt", commit: "HEAD; rm -rf", intent: "x", tier: "fix" }, "commit"],
      [{ verb: "journal-adopt", commit: "abc1234", intent: "x", tier: "FIX!" }, "tier"],
      [{ verb: "journal-append", path: "../etc/passwd", intent: "x", tier: "chore" }, "path"],
      [{ verb: "journal-append", path: "/etc/passwd", intent: "x", tier: "chore" }, "path"],
      [{ verb: "journal-append", path: "C:\\x", intent: "x", tier: "chore" }, "path"],
      [{ verb: "journal-append", path: "-rf", intent: "x", tier: "chore" }, "path"],
      [{ verb: "reconcile", case: "RECON-000001", decision: "merge", intent: "x" }, "decision"],
      [{ verb: "reconcile", case: "RECON-000001", decision: "propose", intent: "x" }, "text"],
    ];
    for (const [action, name] of bad) expect(() => actionArgs(action), name).toThrow(ActionError);
    for (const [action, name] of bad) expect(() => actionArgs(action)).toThrow(name);
  });

  it("shows the command as the person reads it", () => {
    expect(describeAction(["status", "set", "REQ-000001", "Under Review", "--intent=Ready now"])).toBe(
      'catalyst status set REQ-000001 "Under Review" "--intent=Ready now"',
    );
  });
});

describe("runAction (studio-SHELL-000016)", () => {
  it("runs catalyst from the project with exactly the arguments, no shell, and returns what it said", async () => {
    const dir = mkdtempSync(join(tmpdir(), "action-"));
    const seen = join(dir, "seen.json");
    const script = join(dir, "catalyst.cjs");
    writeFileSync(
      script,
      `require("fs").writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
console.log('{"id": "REQ-000001"}'); process.exit(0);`,
    );
    const args = actionArgs({ verb: "status-set", id: "REQ-000001", state: "Done", intent: "a; b $(c)" });
    const result = await runAction(dir, args, [process.execPath, script]);
    expect(result).toEqual({ ok: true, output: '{"id": "REQ-000001"}', error: "" });
    const got = JSON.parse(readFileSync(seen, "utf8")) as { argv: string[]; cwd: string };
    expect(got.argv).toEqual(args);
    expect(realpathSync(got.cwd)).toBe(realpathSync(dir));
    const failed = await runAction(dir, ["x"], [process.execPath, "-e", "console.error('refused'); process.exit(1)"]);
    expect(failed).toEqual({ ok: false, output: "", error: "refused" });
  });
});

describe("IAM and share actions (R6.25)", () => {
  it("builds user add, remove and assign-role, names as positionals", () => {
    expect(
      actionArgs({ verb: "user-add", name: "Ada Lovelace", role: "Developer", git_username: "ada", intent: "Joins" }),
    ).toEqual(["user", "add", "Ada Lovelace", "Developer", "--git-username=ada", "--intent=Joins", "--json"]);
    expect(actionArgs({ verb: "user-remove", name: "Ada Lovelace", intent: "Left" })).toEqual([
      "user",
      "remove",
      "Ada Lovelace",
      "--intent=Left",
      "--json",
    ]);
    expect(
      actionArgs({ verb: "user-assign-role", name: "ada", role: "Scrum Master / Delivery Lead", intent: "x" }),
    ).toEqual(["user", "assign-role", "ada", "Scrum Master / Delivery Lead", "--intent=x", "--json"]);
  });

  it("refuses a name read as an option, a control character or a bad git username", () => {
    expect(() => actionArgs({ verb: "user-remove", name: "--all", intent: "x" })).toThrow("name:");
    expect(() => actionArgs({ verb: "user-add", name: "a\nb", role: "Developer", intent: "x" })).toThrow("name:");
    expect(() => actionArgs({ verb: "user-add", name: "a", role: "", intent: "x" })).toThrow("role:");
    expect(() =>
      actionArgs({ verb: "user-add", name: "a", role: "Developer", git_username: "a b", intent: "x" }),
    ).toThrow("git_username:");
  });

  it("pulls, and pushes with the message, the dialog being the person's yes", () => {
    expect(actionArgs({ verb: "share-pull" })).toEqual(["share", "pull"]);
    expect(actionArgs({ verb: "share-push", intent: "Week's work" })).toEqual([
      "share",
      "push",
      "--message=Week's work",
      "--yes",
      "--json",
    ]);
    expect(() => actionArgs({ verb: "share-push", intent: "" })).toThrow("message:");
  });
});

describe("forewarned actions (studio-SHELL-000029, catalyst >= 0.112.0)", () => {
  const move = { verb: "status-set", id: "REQ-000001", state: "Done", intent: "x" } as const;

  it("adds --forewarned to a writing verb's arguments", () => {
    expect(actionArgs({ ...move, forewarned: true }).at(-1)).toBe("--forewarned");
    expect(actionArgs({ ...move, forewarned: false })).not.toContain("--forewarned");
    expect(actionArgs(move)).not.toContain("--forewarned");
  });

  it("never in a try, which is not made", () => {
    expect(tryArgs({ ...move, forewarned: true })).not.toContain("--forewarned");
  });

  it("only to the verbs that write the criterion", () => {
    expect(actionArgs({ verb: "share-push", intent: "x", forewarned: true })).not.toContain("--forewarned");
  });
});
