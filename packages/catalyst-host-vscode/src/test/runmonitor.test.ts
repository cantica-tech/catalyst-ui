import * as assert from "assert";

import type { Run } from "catalyst-core";

import { buildRunSection, formatRunLabel, formatStepLabel } from "../runmonitor.js";

function run(overrides: Partial<Run> & { id: string }): Run {
  return {
    status: "running",
    command: "fixture command",
    started: "2026-01-01T00:00:00Z",
    steps: [],
    ledger: [],
    location: { file: "r.md", line: 1 },
    ...overrides,
  };
}

describe("buildRunSection", () => {
  it("labels the section with the run count and carries them through", () => {
    const runs = [run({ id: "RUN-000001" }), run({ id: "RUN-000002" })];
    const section = buildRunSection(runs);
    assert.strictEqual(section.label, "Runs (2)");
    assert.deepStrictEqual(section.runs, runs);
  });

  it("handles an empty list", () => {
    assert.strictEqual(buildRunSection([]).label, "Runs (0)");
  });

  it("appends a drift marker to the label when any run has drift", () => {
    const runs = [
      run({ id: "RUN-000001" }),
      run({
        id: "RUN-000002",
        steps: [{ status: "drift", text: "Unexpected orphan" }],
      }),
    ];
    assert.strictEqual(buildRunSection(runs).label, "Runs (2) ⚠️");
  });
});

describe("formatRunLabel", () => {
  it("shows id and status with no drift marker when nothing drifted", () => {
    assert.strictEqual(formatRunLabel(run({ id: "RUN-000001", status: "completed" })), "RUN-000001 — completed");
  });

  it("appends a drift marker when any step is drift", () => {
    assert.strictEqual(
      formatRunLabel(
        run({
          id: "RUN-000001",
          steps: [{ status: "drift", text: "x" }],
        }),
      ),
      "RUN-000001 — running ⚠️",
    );
  });
});

describe("formatStepLabel", () => {
  it("renders the glyph matching each step status", () => {
    assert.strictEqual(formatStepLabel({ status: "done", text: "Ran tests" }), "✅ Ran tests");
    assert.strictEqual(formatStepLabel({ status: "failed", text: "Build broke" }), "❌ Build broke");
    assert.strictEqual(formatStepLabel({ status: "pending", text: "Waiting" }), "⏳ Waiting");
    assert.strictEqual(formatStepLabel({ status: "drift", text: "Found an orphan" }), "⚠️ Found an orphan");
  });
});
