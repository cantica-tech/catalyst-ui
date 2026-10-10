import { describe, expect, it } from "vitest";

import { coerceJournal, queryJournal } from "../journal.js";
import type { JournalEntry } from "../types.js";

// Reading the journal's files (legacy and shards, in causal order) is
// catalyst's (`GET /v1/journal`); this package takes what catalyst serves.
describe("coerceJournal", () => {
  it("takes nothing from what is not a list", () => {
    expect(coerceJournal(undefined)).toEqual([]);
    expect(coerceJournal({ entries: [] })).toEqual([]);
  });

  it("keeps each well-formed entry, with defaults for the optional fields", () => {
    expect(
      coerceJournal([
        {
          at: "journal/alice@m1/2026-08.jsonl:1",
          timestamp: "2026-08-23T19:00:00Z",
          actor: "alice",
          command: "/create-req",
          action: "create",
          artifact: "REQ-000001",
          targets: ["fw-STRUCTURE-003"],
          intent: ["Track the new parser."],
          writer: "catalyst/0.54.0",
        },
        { timestamp: "2026-08-24T00:00:00Z", actor: "bob", artifact: "REQ-000002" },
      ]),
    ).toEqual([
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
      {
        timestamp: "2026-08-24T00:00:00Z",
        actor: "bob",
        command: "",
        action: "update",
        artifact: "REQ-000002",
        targets: [],
        intent: [],
        files: [],
      },
    ]);
  });

  it("drops an entry missing a required field and sorts the rest oldest first", () => {
    const entries = coerceJournal([
      { timestamp: "2026-10-02T00:00:00Z", actor: "ada", artifact: "A2" },
      { timestamp: "2026-08-23T19:00:00Z", actor: "alice" },
      "not an entry",
      { timestamp: "2026-09-01T00:00:00Z", actor: "ada", artifact: "A1" },
    ]);
    expect(entries.map((e) => e.artifact)).toEqual(["A1", "A2"]);
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
