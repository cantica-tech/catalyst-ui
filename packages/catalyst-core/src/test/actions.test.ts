import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ActionError, actionArgs, describeAction, runAction } from "../actions.js";

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
