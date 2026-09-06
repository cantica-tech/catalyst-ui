import { afterEach, describe, expect, it } from "vitest";

import {
  nextProposalId,
  openProposalsByTarget,
  parseProposals,
} from "../proposals.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("parseProposals", () => {
  it("returns an empty list when no proposals/ directory exists", () => {
    root = createFixtureCorpus({});
    expect(parseProposals(root)).toEqual([]);
  });

  it("parses id, status, intent, targets, expectations, and constraints", () => {
    root = createFixtureCorpus({
      proposals: [
        {
          id: "PROP-000001",
          status: "proposed",
          intent: "Fix the orphaned requirement.",
          targets: ["REQ-000001"],
          expectations: ["REQ-000001 has a resolvable Targets field."],
          constraints: ["CODE-OF-CONDUCT.md §1"],
        },
      ],
    });

    const proposals = parseProposals(root);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      id: "PROP-000001",
      status: "proposed",
      intent: "Fix the orphaned requirement.",
      targets: ["REQ-000001"],
      expectations: ["REQ-000001 has a resolvable Targets field."],
      constraints: ["CODE-OF-CONDUCT.md §1"],
    });
  });

  it("defaults to 'proposed' for a missing or unrecognized status", () => {
    root = createFixtureCorpus({
      proposals: [{ id: "PROP-000001", status: "not-a-real-status" }],
    });
    expect(parseProposals(root)[0].status).toBe("proposed");
  });

  it("sorts by id", () => {
    root = createFixtureCorpus({
      proposals: [{ id: "PROP-000002" }, { id: "PROP-000001" }],
    });
    expect(parseProposals(root).map((p) => p.id)).toEqual([
      "PROP-000001",
      "PROP-000002",
    ]);
  });
});

describe("nextProposalId", () => {
  it("starts at PROP-000001 for an empty list", () => {
    expect(nextProposalId([])).toBe("PROP-000001");
  });

  it("continues from the highest existing id, never reusing one", () => {
    root = createFixtureCorpus({
      proposals: [{ id: "PROP-000001" }, { id: "PROP-000003" }],
    });
    expect(nextProposalId(parseProposals(root))).toBe("PROP-000004");
  });
});

describe("openProposalsByTarget", () => {
  it("groups every non-applied proposal by each id it targets", () => {
    root = createFixtureCorpus({
      proposals: [
        { id: "PROP-000001", status: "proposed", targets: ["REQ-000001"] },
        {
          id: "PROP-000002",
          status: "applying",
          targets: ["REQ-000001", "REQ-000002"],
        },
        { id: "PROP-000003", status: "applied", targets: ["REQ-000003"] },
      ],
    });

    const byTarget = openProposalsByTarget(parseProposals(root));
    expect(
      byTarget
        .get("REQ-000001")
        ?.map((p) => p.id)
        .sort(),
    ).toEqual(["PROP-000001", "PROP-000002"]);
    expect(byTarget.get("REQ-000002")?.map((p) => p.id)).toEqual([
      "PROP-000002",
    ]);
    expect(byTarget.has("REQ-000003")).toBe(false);
  });
});
