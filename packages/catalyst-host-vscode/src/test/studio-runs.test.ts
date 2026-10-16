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
    assert.deepStrictEqual(h.posted, [{ catalyst: "host", type: "hello", runs: true }]);
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
