import type { ChainModel, ChainNode, Proposal } from "catalyst-core";
import { describe, expect, it } from "vitest";

import { buildNodeDetail } from "./detail.js";

const noProposals = new Map<string, Proposal[]>();

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

describe("buildNodeDetail", () => {
  it("returns null for an id not in the model", () => {
    const model: ChainModel = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };
    expect(buildNodeDetail(model, "nowhere", noProposals)).toBeNull();
  });

  it("resolves upstream and downstream from the model's edges", () => {
    const req = node({ id: "REQ-000006" });
    const rule = node({ id: "electron-DESKTOP-001", kind: "rule" });

    const model: ChainModel = {
      nodes: new Map([
        [req.id, req],
        [rule.id, rule],
      ]),
      edges: new Map([[req.id, new Set([rule.id])]]),
      reverseEdges: new Map([[rule.id, new Set([req.id])]]),
      definitionsById: new Map(),
    };

    const reqDetail = buildNodeDetail(model, req.id, noProposals)!;
    expect(reqDetail.upstream.map((n) => n.id)).toEqual([rule.id]);
    expect(reqDetail.downstream).toEqual([]);

    const ruleDetail = buildNodeDetail(model, rule.id, noProposals)!;
    expect(ruleDetail.upstream).toEqual([]);
    expect(ruleDetail.downstream.map((n) => n.id)).toEqual([req.id]);
  });

  it("includes any open proposal targeting the node", () => {
    const req = node({ id: "REQ-000006" });
    const model: ChainModel = {
      nodes: new Map([[req.id, req]]),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };
    const proposal: Proposal = {
      id: "PROP-000001",
      status: "proposed",
      intent: "Fix it",
      targets: [req.id],
      expectations: [],
      constraints: [],
      location: { file: "p.md", line: 1 },
    };

    const detail = buildNodeDetail(
      model,
      req.id,
      new Map([[req.id, [proposal]]]),
    )!;
    expect(detail.openProposals).toEqual([proposal]);
  });
});
