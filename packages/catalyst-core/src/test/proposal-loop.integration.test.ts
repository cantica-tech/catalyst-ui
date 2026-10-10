import { afterEach, describe, expect, it } from "vitest";

import { modelFromGraph, reportFromCheck } from "../catalyst-source.js";
import { openProposalsByTarget, parseProposals } from "../proposals.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("proposal loop (fix-only), end-to-end against a real orphan", () => {
  it("flags an orphan catalyst reports as an open proposal target once a proposal targets it", () => {
    // An orphaned requirement (no Targets rule), as catalyst's graph and
    // check report it, plus a proposal fixing it: the finding names the
    // node its file defines, and the proposal is open against that node.
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
    const file = "requirements/REQ-000001-orphan.md";
    const model = modelFromGraph(
      {
        rules: [],
        domains: [],
        artifacts: [{ id: "REQ-000001", type: "REQ", title: "Orphan", file, Status: "Draft", links: {}, mentions: [] }],
        types: {},
      },
      root,
    );
    const report = reportFromCheck(
      { ok: false, errors: [`chain ungrounded: .criterion/${file}: cites no rule`], warnings: [] },
      root,
      model,
    );

    // The orphan is a detected issue naming its node — what a "Propose fix"
    // Quick Fix is offered against.
    expect(report.issues.some((i) => i.kind === "orphaned-artifact" && i.nodeId === "REQ-000001")).toBe(true);

    // The proposal targeting it is discoverable as open (pending) — the
    // same lookup a duplicate-Quick-Fix refusal check and a pending-badge
    // render both key off.
    const proposals = parseProposals(root);
    const openByTarget = openProposalsByTarget(proposals);
    expect(openByTarget.get("REQ-000001")?.map((p) => p.id)).toEqual(["PROP-000001"]);
  });

  it("stops flagging a target once its only proposal is applied", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Fixed", targets: ["env-RUNTIME-001"] }],
      proposals: [{ id: "PROP-000001", status: "applied", targets: ["REQ-000001"] }],
    });

    const openByTarget = openProposalsByTarget(parseProposals(root));
    expect(openByTarget.has("REQ-000001")).toBe(false);
  });
});
