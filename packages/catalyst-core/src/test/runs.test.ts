import { afterEach, describe, expect, it } from "vitest";

import { hasDrift, parseRuns } from "../runs.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("parseRuns", () => {
  it("returns an empty list when runs/ doesn't exist", () => {
    root = createFixtureCorpus({});
    expect(parseRuns(root)).toEqual([]);
  });

  it("parses a well-formed run's fields, checklist, and ledger", () => {
    root = createFixtureCorpus({
      runs: [
        {
          id: "RUN-000001",
          status: "running",
          command: "/sync-framework",
          started: "2026-09-06T10:00:00Z",
          checklist: ["✅ Read INVARIANTS.md", "⏳ Apply template diff"],
          ledger: ["Opened PROP-000001 to fix a stale reference."],
        },
      ],
    });

    const runs = parseRuns(root);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      id: "RUN-000001",
      status: "running",
      command: "/sync-framework",
      started: "2026-09-06T10:00:00Z",
      steps: [
        { status: "done", text: "Read INVARIANTS.md" },
        { status: "pending", text: "Apply template diff" },
      ],
      ledger: ["Opened PROP-000001 to fix a stale reference."],
    });
  });

  it("skips a checklist line with no recognized glyph prefix, without throwing", () => {
    root = createFixtureCorpus({
      runs: [
        {
          id: "RUN-000001",
          checklist: ["✅ Recognized step", "- Unrecognized step, no glyph"],
        },
      ],
    });

    const runs = parseRuns(root);
    expect(runs[0].steps).toEqual([{ status: "done", text: "Recognized step" }]);
  });

  it("defaults to running for an unrecognized Status value", () => {
    root = createFixtureCorpus({
      runs: [{ id: "RUN-000001", status: "not-a-real-status" }],
    });
    expect(parseRuns(root)[0].status).toBe("running");
  });

  it("sorts by id", () => {
    root = createFixtureCorpus({
      runs: [{ id: "RUN-000002" }, { id: "RUN-000001" }],
    });
    expect(parseRuns(root).map((r) => r.id)).toEqual(["RUN-000001", "RUN-000002"]);
  });
});

describe("hasDrift", () => {
  it("is false when no step is drift", () => {
    root = createFixtureCorpus({
      runs: [{ id: "RUN-000001", checklist: ["✅ Fine", "⏳ Working on it"] }],
    });
    expect(hasDrift(parseRuns(root)[0])).toBe(false);
  });

  it("is true when any step is drift", () => {
    root = createFixtureCorpus({
      runs: [
        {
          id: "RUN-000001",
          checklist: ["✅ Fine", "⚠️ Found an unexpected orphan"],
        },
      ],
    });
    expect(hasDrift(parseRuns(root)[0])).toBe(true);
  });
});
