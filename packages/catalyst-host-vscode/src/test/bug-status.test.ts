import * as assert from "assert";

import {
  bugStatusCommands,
  bugTransition,
  closeTarget,
  permissionSuffix,
  refusalReason,
  reopenTarget,
  statusPermission,
} from "../bug-status.js";
import { entityContextValue } from "../entity-items.js";
import { artifact, BUG, domain, REQ, rule } from "./fixtures-entities.js";

/** Close Bug and Reopen Bug in the Instances tree (REQ-000077-UVqkd7cL). */

const ID = "BUG-000047-UVqkd7cL";

describe("an entity node's context value (REQ-000077-UVqkd7cL)", () => {
  it("names a bug open or closed by its type's closed states, and whether the signer may change it", () => {
    for (const status of ["Open", "Under Review", "Fixed"])
      assert.strictEqual(entityContextValue(artifact(ID, BUG, status), BUG), "catalystEntity.bug.open.allowed");
    for (const status of ["Closed", "WontFix"])
      assert.strictEqual(
        entityContextValue(artifact(ID, BUG, status), BUG, "denied"),
        "catalystEntity.bug.closed.denied",
      );
  });

  it("names other types, rules and domains so no bug menu matches them", () => {
    assert.strictEqual(
      entityContextValue(artifact("REQ-000001-UVqkd7cL", REQ, "Completed"), REQ),
      "catalystEntity.requirement.closed.allowed",
    );
    assert.strictEqual(entityContextValue(rule("vscode-X-000001", "t", "✅"), undefined), "catalystEntity.rule");
    assert.strictEqual(entityContextValue(domain("AGENT", "t"), undefined), "catalystEntity.domain");
  });
});

describe("a bug's close and reopen (REQ-000077-UVqkd7cL)", () => {
  it("closes to Closed and reopens to the type's initial state, from the definition", () => {
    assert.strictEqual(closeTarget(BUG), "Closed");
    assert.strictEqual(reopenTarget(BUG), "Open");
    assert.strictEqual(closeTarget({ ...BUG, closed_states: ["Done", "Dropped"] }), "Done");
  });

  it("offers Close on an open bug and Reopen on a closed one, nothing else", () => {
    assert.deepStrictEqual(bugTransition(artifact(ID, BUG, "Fixed"), BUG, "close").value, {
      move: "close",
      id: ID,
      state: "Closed",
      verb: "Close Bug",
    });
    assert.deepStrictEqual(bugTransition(artifact(ID, BUG, "WontFix"), BUG, "reopen").value, {
      move: "reopen",
      id: ID,
      state: "Open",
      verb: "Reopen Bug",
    });
    assert.match(bugTransition(artifact(ID, BUG, "Closed"), BUG, "close").problem ?? "", /already Closed/);
    assert.match(bugTransition(artifact(ID, BUG, "Open"), BUG, "reopen").problem ?? "", /not closed/);
    assert.match(
      bugTransition(artifact("REQ-000001-UVqkd7cL", REQ, "Active"), REQ, "close").problem ?? "",
      /not a bug/,
    );
    assert.match(bugTransition(rule("vscode-X-000001", "t", "✅"), undefined, "close").problem ?? "", /not a bug/);
  });

  it("builds the preview and the run through the allow-list: tier fix, /status, never --force", () => {
    const close = bugTransition(artifact(ID, BUG, "Open"), BUG, "close").value;
    assert.ok(close);
    const { preview, run } = bugStatusCommands(close, BUG, "Fixed by 3bbba40");
    assert.deepStrictEqual(run, [
      "status",
      "set",
      ID,
      "Closed",
      "--intent=Fixed by 3bbba40",
      "--tier=fix",
      "--command=/status",
      "--json",
    ]);
    assert.deepStrictEqual(preview, [...run.slice(0, -1), "--preview"]);
    assert.ok(![...run, ...preview].some((arg) => arg.startsWith("--force") || arg.startsWith("--through")));
    const reopen = bugTransition(artifact(ID, BUG, "Closed"), BUG, "reopen").value;
    assert.ok(reopen);
    assert.strictEqual(bugStatusCommands(reopen, BUG, "It came back").run[3], "Open");
  });

  it("accepts exactly a bug's close and reopen targets, and a reason", () => {
    const close = { move: "close", id: ID, state: "Closed", verb: "Close Bug" } as const;
    assert.throws(() => bugStatusCommands({ ...close, state: "WontFix" }, BUG, "x"), /close does not set WontFix/);
    assert.throws(
      () => bugStatusCommands({ ...close, move: "reopen", state: "Closed" }, BUG, "x"),
      /reopen does not set Closed/,
    );
    assert.throws(() => bugStatusCommands({ ...close, id: "REQ-000001-UVqkd7cL" }, BUG, "x"), /not a bug's ID/);
    assert.throws(() => bugStatusCommands(close, REQ, "x"), /not a bug/);
    assert.throws(() => bugStatusCommands({ ...close, id: "BUG--force" }, BUG, "x"), /id/);
    assert.throws(() => bugStatusCommands(close, BUG, "  "), /intent/);
  });

  it("reports catalyst's own reason for a refusal, without its warnings", () => {
    const output = [
      "tried: catalyst status set BUG-000004-UVqkd7cL Closed (on a scratch copy; nothing in the criterion changed)",
      "refused: catalyst: warning: the intent 'x' says too little to tell why",
      "catalyst: no one is logged in: signing as the system account oliviersteck",
      "catalyst: BUG-000004-UVqkd7cL is already Closed",
    ].join("\n");
    assert.strictEqual(refusalReason({ output, error: "" }), "BUG-000004-UVqkd7cL is already Closed");
    assert.strictEqual(
      refusalReason({ output: "", error: "catalyst: STEP-000001 is open: a Bug is Closed only once its Steps are" }),
      "STEP-000001 is open: a Bug is Closed only once its Steps are",
    );
    assert.strictEqual(refusalReason({ output: "", error: "" }), "catalyst gave no reason");
  });
});

describe("who may close or reopen a bug, as catalyst says (REQ-000077-UVqkd7cL)", () => {
  const whoami = (grants: string[], extra: Record<string, unknown> = {}) => ({
    ok: true,
    output: JSON.stringify({ username: "olivier", name: "Olivier", roles: ["Contributor"], grants, ...extra }),
    error: "",
  });

  it("allows a signer granted /status, or everything", () => {
    assert.deepStrictEqual(statusPermission(whoami(["cmd:status"]), undefined), {
      state: "allowed",
      signer: "olivier",
    });
    assert.strictEqual(statusPermission(whoami(["cmd:*"]), undefined).state, "allowed");
  });

  it("denies a signer with no grant for /status, saying why; role_check warn allows it", () => {
    const denied = statusPermission(whoami(["cmd:create", "reconcile:full", "status"]), "enforce");
    assert.ok(denied.state === "denied");
    assert.match(denied.reason, /olivier has no grant that allows \/status/);
    assert.strictEqual(permissionSuffix(denied), "denied");
    assert.deepStrictEqual(statusPermission(whoami([]), "warn"), { state: "allowed", signer: "olivier", warned: true });
  });

  it("with nobody logged in, judges the system account catalyst signs as", () => {
    const system = {
      ok: true,
      output: JSON.stringify({ username: "service-account-catalyst-system", grants: ["cmd:*"] }),
      error: "catalyst: no one is logged in: signing as the system account service-account-catalyst-system",
    };
    assert.deepStrictEqual(statusPermission(system, undefined), {
      state: "allowed",
      signer: "service-account-catalyst-system",
    });
  });

  it("leaves the menu enabled when catalyst cannot say who signs: its guard decides on click", () => {
    const unknown = statusPermission({ ok: false, output: "", error: "catalyst: catalyst-users did not answer" }, "");
    assert.deepStrictEqual(unknown, { state: "unknown", reason: "catalyst-users did not answer" });
    assert.strictEqual(permissionSuffix(unknown), "allowed");
    assert.strictEqual(permissionSuffix(undefined), "allowed");
  });
});
