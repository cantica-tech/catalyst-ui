import * as assert from "assert";

import type { AgentRun, RunEvent } from "catalyst-core";

import { StudioRuns, type HostMessage } from "../studio-runs.js";

function harness(answer: boolean) {
  const posted: HostMessage[] = [];
  const asked: string[] = [];
  const started: { command: string; args: string }[] = [];
  const cancelled: string[] = [];
  let emit: (event: RunEvent) => void = () => undefined;
  let finish: (event: RunEvent) => void = () => undefined;
  const runs = new StudioRuns({
    confirm: (q) => {
      asked.push(q);
      return Promise.resolve(answer);
    },
    start: (command, args, onEvent): AgentRun => {
      started.push({ command, args });
      emit = onEvent;
      return {
        cancel: () => cancelled.push(command),
        done: new Promise<RunEvent>((resolve) => {
          finish = resolve;
        }),
      };
    },
    post: (m) => posted.push(m),
  });
  return {
    runs,
    posted,
    asked,
    started,
    cancelled,
    emit: (e: RunEvent) => {
      emit(e);
    },
    finish: (e: RunEvent) => {
      finish(e);
    },
  };
}

describe("StudioRuns (studio-SHELL-000015)", () => {
  it("says it runs, when the Studio asks", async () => {
    const h = harness(true);
    await h.runs.handle({ catalyst: "studio", type: "hello" });
    assert.deepStrictEqual(h.posted, [{ catalyst: "host", type: "hello", runs: true, actions: false, tries: false }]); // no `act`: no actions
  });

  it("asks the person, then runs and streams each event back under the run's id", async () => {
    const h = harness(true);
    await h.runs.handle({ catalyst: "studio", type: "run", id: "r1", command: "check-rules", arguments: " a.md " });
    assert.deepStrictEqual(h.asked, [
      "Run /check-rules a.md with your agent? It works in this project under your agent's own settings, and uses tokens.",
    ]);
    assert.deepStrictEqual(h.started, [{ command: "check-rules", args: "a.md" }]);
    h.emit({ event: "text", text: "hi" });
    assert.deepStrictEqual(h.posted, [
      { catalyst: "host", type: "run-event", id: "r1", event: { event: "text", text: "hi" } },
    ]);
    await h.runs.handle({ catalyst: "studio", type: "cancel", id: "r1" });
    assert.deepStrictEqual(h.cancelled, ["check-rules"]);
  });

  it("runs nothing the person declines, and says so", async () => {
    const h = harness(false);
    await h.runs.handle({ catalyst: "studio", type: "run", id: "r2", command: "help", arguments: "" });
    assert.deepStrictEqual(h.started, []);
    assert.deepStrictEqual(h.posted, [{ catalyst: "host", type: "run-declined", id: "r2" }]);
  });

  it("ignores what is not the Studio's, or names no command", async () => {
    const h = harness(true);
    for (const m of [
      null,
      "run",
      { type: "run", id: "x", command: "help" },
      { catalyst: "studio", type: "run", id: "x", command: "--help" },
      { catalyst: "studio", type: "run", id: "x", command: "../../bin/sh" },
      { catalyst: "studio", type: "run", command: "help" },
    ])
      await h.runs.handle(m);
    assert.deepStrictEqual(h.asked, []);
    assert.deepStrictEqual(h.started, []);
  });

  it("stops every run still going when the panel closes", async () => {
    const h = harness(true);
    await h.runs.handle({ catalyst: "studio", type: "run", id: "r3", command: "help", arguments: "" });
    h.runs.dispose();
    assert.deepStrictEqual(h.cancelled, ["help"]);
  });
});

describe("StudioRuns actions (studio-SHELL-000016)", () => {
  function actHarness(answer: boolean, result = { ok: true, output: '{"id":"REQ-000001"}', error: "" }) {
    const posted: HostMessage[] = [];
    const asked: string[] = [];
    const ran: string[][] = [];
    const runs = new StudioRuns({
      confirm: (q) => {
        asked.push(q);
        return Promise.resolve(answer);
      },
      start: () => ({ cancel: () => undefined, done: new Promise<RunEvent>(() => undefined) }),
      post: (m) => posted.push(m),
      act: (args) => {
        ran.push(args);
        return Promise.resolve(result);
      },
    });
    return { runs, posted, asked, ran };
  }

  it("says it acts when it can, and asks with the exact command before running it", async () => {
    const h = actHarness(true);
    await h.runs.handle({ catalyst: "studio", type: "hello" });
    assert.deepStrictEqual(h.posted[0], { catalyst: "host", type: "hello", runs: true, actions: true, tries: true });
    await h.runs.handle({
      catalyst: "studio",
      type: "action",
      id: "a1",
      action: { verb: "status-set", id: "REQ-000001", state: "Done", intent: "Shipped" },
    });
    assert.deepStrictEqual(h.asked, [
      "Run this in the project?\n\ncatalyst status set REQ-000001 Done --intent=Shipped --json",
    ]);
    assert.deepStrictEqual(h.ran, [["status", "set", "REQ-000001", "Done", "--intent=Shipped", "--json"]]);
    assert.deepStrictEqual(h.posted[1], {
      catalyst: "host",
      type: "action-result",
      id: "a1",
      ok: true,
      output: '{"id":"REQ-000001"}',
      error: "",
    });
  });

  it("runs nothing the person declines, nor an action that fails its checks", async () => {
    const h = actHarness(false);
    await h.runs.handle({
      catalyst: "studio",
      type: "action",
      id: "a2",
      action: { verb: "status-set", id: "REQ-000001", state: "Done", intent: "x" },
    });
    await h.runs.handle({ catalyst: "studio", type: "action", id: "a3", action: { verb: "rm", path: "/" } });
    assert.deepStrictEqual(h.ran, []);
    assert.strictEqual(h.asked.length, 1); // the refused action never reaches the dialog
    assert.deepStrictEqual(h.posted, [
      { catalyst: "host", type: "action-result", id: "a2", ok: false, output: "", error: "", declined: true },
      {
        catalyst: "host",
        type: "action-result",
        id: "a3",
        ok: false,
        output: "",
        error: "Not done: not an action the Studio may ask for",
      },
    ]);
  });
});

describe("StudioRuns batches (R6.17)", () => {
  function batchHarness(answer: boolean, fail: string[] = []) {
    const posted: HostMessage[] = [];
    const asked: string[] = [];
    const ran: string[][] = [];
    const runs = new StudioRuns({
      confirm: (q) => {
        asked.push(q);
        return Promise.resolve(answer);
      },
      start: () => ({ cancel: () => undefined, done: new Promise<RunEvent>(() => undefined) }),
      post: (m) => posted.push(m),
      act: (args) => {
        ran.push(args);
        const bad = fail.includes(args[2]);
        return Promise.resolve({ ok: !bad, output: bad ? "" : "{}", error: bad ? "refused" : "" });
      },
    });
    return { runs, posted, asked, ran };
  }
  const move = (id: string) => ({ verb: "status-set", id, state: "Done", intent: "Shipped" });

  it("checks all, asks once listing each command, then runs each, a failure not stopping the rest", async () => {
    const h = batchHarness(true, ["REQ-000002"]);
    await h.runs.handle({
      catalyst: "studio",
      type: "batch",
      id: "b1",
      actions: [move("REQ-000001"), move("REQ-000002"), move("REQ-000003")],
    });
    assert.strictEqual(h.asked.length, 1);
    assert.ok(h.asked[0].startsWith("Run these 3 commands in the project, one by one?"));
    assert.ok(h.asked[0].includes("catalyst status set REQ-000003 Done --intent=Shipped --json"));
    assert.deepStrictEqual(
      h.ran.map((a) => a[2]),
      ["REQ-000001", "REQ-000002", "REQ-000003"],
    );
    const reply = h.posted[0];
    assert.ok(reply.type === "batch-result");
    assert.deepStrictEqual(
      reply.results.map((r) => r.ok),
      [true, false, true],
    );
  });

  it("refuses the whole batch when one action fails its checks, before any dialog", async () => {
    const h = batchHarness(true);
    await h.runs.handle({ catalyst: "studio", type: "batch", id: "b2", actions: [move("REQ-000001"), { verb: "rm" }] });
    assert.deepStrictEqual(h.asked, []);
    assert.deepStrictEqual(h.ran, []);
    assert.deepStrictEqual(h.posted, [
      {
        catalyst: "host",
        type: "batch-result",
        id: "b2",
        results: [],
        error: "Not done: action 2: not an action the Studio may ask for",
      },
    ]);
    await h.runs.handle({
      catalyst: "studio",
      type: "batch",
      id: "b3",
      actions: Array.from({ length: 51 }, () => move("REQ-000001")),
    });
    assert.ok(h.posted[1].type === "batch-result" && h.posted[1].error.includes("1 to 50"));
  });

  it("runs nothing the person declines", async () => {
    const h = batchHarness(false);
    await h.runs.handle({ catalyst: "studio", type: "batch", id: "b4", actions: [move("REQ-000001")] });
    assert.deepStrictEqual(h.ran, []);
    assert.deepStrictEqual(h.posted, [
      { catalyst: "host", type: "batch-result", id: "b4", results: [], error: "", declined: true },
    ]);
  });
});

describe("StudioRuns' tries (studio-SHELL-000020)", () => {
  function tryHarness() {
    const posted: HostMessage[] = [];
    const asked: string[] = [];
    const ran: string[][] = [];
    const runs = new StudioRuns({
      confirm: (q) => {
        asked.push(q);
        return Promise.resolve(true);
      },
      start: () => ({ cancel: () => undefined, done: new Promise<RunEvent>(() => undefined) }),
      post: (m) => posted.push(m),
      act: (args) => {
        ran.push(args);
        return Promise.resolve({ ok: true, output: '{"change":"catalyst status set …"}', error: "" });
      },
    });
    return { runs, posted, asked, ran };
  }

  it("tries an action with catalyst try, with no dialog, and returns its report", async () => {
    const h = tryHarness();
    await h.runs.handle({
      catalyst: "studio",
      type: "try",
      id: "t1",
      action: { verb: "status-set", id: "REQ-000001", state: "Done", intent: "Trying it" },
    });
    assert.deepStrictEqual(h.asked, []); // a try changes only a scratch copy
    assert.deepStrictEqual(h.ran, [
      ["try", "--json", "status", "set", "REQ-000001", "Done", "--intent=Trying it", "--json"],
    ]);
    assert.deepStrictEqual(h.posted, [
      {
        catalyst: "host",
        type: "try-result",
        id: "t1",
        ok: true,
        output: '{"change":"catalyst status set …"}',
        error: "",
      },
    ]);
  });

  it("tries nothing whose fields fail the action's own checks", async () => {
    const h = tryHarness();
    await h.runs.handle({ catalyst: "studio", type: "try", id: "t2", action: { verb: "rm", path: "x" } });
    assert.deepStrictEqual(h.ran, []);
    assert.strictEqual((h.posted[0] as { error: string }).error.startsWith("Not tried: "), true);
  });
});
