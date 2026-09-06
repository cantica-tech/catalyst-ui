import { afterEach, describe, expect, it } from "vitest";

import { buildChainModel } from "../graph.js";
import { parseCorpus } from "../parser.js";
import { openProposalsByTarget, parseProposals } from "../proposals.js";
import { validate } from "../validator.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("proposal loop (fix-only), end-to-end against a real orphan", () => {
  it("flags a real orphan as an open proposal target once a proposal targets it", () => {
    // Seed a genuine orphaned artifact (no Targets rule) — a real,
    // validator-detected issue, not a hand-built ValidationIssue — plus a
    // proposal fixing it, and confirm the two sides of the loop agree.
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Orphan", targets: [] }],
      proposals: [
        {
          id: "PROP-000001",
          status: "proposed",
          intent: "REQ-000001 has no Targets rule.",
          targets: ["REQ-000001"],
          expectations: ["REQ-000001 has a resolvable Targets field."],
        },
      ],
    });

    const model = buildChainModel(parseCorpus(root)!);
    const report = validate(model);

    // The orphan is a real, detected issue — this is what a "Propose fix"
    // Quick Fix would actually be offered against.
    expect(
      report.issues.some(
        (i) => i.kind === "orphaned-artifact" && i.nodeId === "REQ-000001",
      ),
    ).toBe(true);

    // The proposal targeting it is discoverable as open (pending) — the
    // same lookup a duplicate-Quick-Fix refusal check and a pending-badge
    // render both key off.
    const proposals = parseProposals(root);
    const openByTarget = openProposalsByTarget(proposals);
    expect(openByTarget.get("REQ-000001")?.map((p) => p.id)).toEqual([
      "PROP-000001",
    ]);
  });

  it("stops flagging a target once its only proposal is applied", () => {
    root = createFixtureCorpus({
      requirements: [
        { id: "REQ-000001", title: "Fixed", targets: ["env-RUNTIME-001"] },
      ],
      proposals: [
        { id: "PROP-000001", status: "applied", targets: ["REQ-000001"] },
      ],
    });

    const openByTarget = openProposalsByTarget(parseProposals(root));
    expect(openByTarget.has("REQ-000001")).toBe(false);
  });
});
