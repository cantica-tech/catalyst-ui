import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseJournal, queryJournal } from "../journal.js";
import type { JournalEntry } from "../types.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("parseJournal", () => {
  it("returns an empty list when journal.jsonl doesn't exist", () => {
    root = createFixtureCorpus({});
    expect(parseJournal(root)).toEqual([]);
  });

  it("parses one JSON object per line", () => {
    root = createFixtureCorpus({
      journal: [
        {
          timestamp: "2026-08-23T19:00:00Z",
          actor: "alice",
          command: "/create-req",
          action: "create",
          artifact: "REQ-000001",
          targets: ["fw-STRUCTURE-003"],
          intent: ["Track the new parser."],
        },
      ],
    });

    expect(parseJournal(root)).toEqual([
      {
        timestamp: "2026-08-23T19:00:00Z",
        actor: "alice",
        command: "/create-req",
        action: "create",
        artifact: "REQ-000001",
        targets: ["fw-STRUCTURE-003"],
        intent: ["Track the new parser."],
        files: [],
      },
    ]);
  });

  it("skips a line that fails to parse rather than failing the whole read", () => {
    root = createFixtureCorpus({
      journal: [
        {
          timestamp: "2026-08-23T19:00:00Z",
          actor: "alice",
          artifact: "REQ-000001",
        },
      ],
    });
    appendFileSync(join(root, "development", "journal.jsonl"), "{ this is not valid json\n");
    appendFileSync(
      join(root, "development", "journal.jsonl"),
      `${JSON.stringify({ timestamp: "2026-08-24T00:00:00Z", actor: "bob", artifact: "REQ-000002" })}\n`,
    );

    expect(parseJournal(root).map((e) => e.artifact)).toEqual(["REQ-000001", "REQ-000002"]);
  });

  it("skips an entry missing a required field", () => {
    root = createFixtureCorpus({});
    mkdirSync(join(root, "development"), { recursive: true });
    writeFileSync(
      join(root, "development", "journal.jsonl"),
      `${JSON.stringify({ timestamp: "2026-08-23T19:00:00Z", actor: "alice" })}\n`,
    );

    expect(parseJournal(root)).toEqual([]);
  });
});

describe("queryJournal", () => {
  const entries: JournalEntry[] = [
    {
      timestamp: "2026-08-01T00:00:00Z",
      actor: "alice",
      command: "/create-req",
      action: "create",
      artifact: "REQ-000001",
      targets: ["fw-STRUCTURE-003"],
      intent: ["First."],
      files: [],
    },
    {
      timestamp: "2026-08-15T00:00:00Z",
      actor: "bob",
      command: "/create-bug",
      action: "create",
      artifact: "BUG-000001",
      targets: ["fw-STRUCTURE-004"],
      intent: ["Second."],
      files: [],
    },
    {
      timestamp: "2026-08-10T00:00:00Z",
      actor: "alice",
      command: "/status",
      action: "status-change",
      artifact: "REQ-000001",
      targets: ["fw-STRUCTURE-003"],
      intent: ["Third."],
      files: [],
    },
  ];

  it("sorts newest-first with no filters", () => {
    expect(queryJournal(entries, {}).map((e) => e.intent[0])).toEqual(["Second.", "Third.", "First."]);
  });

  it("filters by since", () => {
    expect(queryJournal(entries, { since: "2026-08-10T00:00:00Z" }).map((e) => e.artifact)).toEqual([
      "BUG-000001",
      "REQ-000001",
    ]);
  });

  it("filters by actor", () => {
    expect(queryJournal(entries, { actor: "alice" }).map((e) => e.intent[0])).toEqual(["Third.", "First."]);
  });

  it("filters by artifact", () => {
    expect(queryJournal(entries, { artifact: "REQ-000001" }).map((e) => e.intent[0])).toEqual(["Third.", "First."]);
  });

  it("filters by rule membership in targets", () => {
    expect(queryJournal(entries, { rule: "fw-STRUCTURE-004" }).map((e) => e.artifact)).toEqual(["BUG-000001"]);
  });

  it("combines filters", () => {
    expect(queryJournal(entries, { actor: "alice", artifact: "REQ-000001" }).map((e) => e.intent[0])).toEqual([
      "Third.",
      "First.",
    ]);
  });
});
