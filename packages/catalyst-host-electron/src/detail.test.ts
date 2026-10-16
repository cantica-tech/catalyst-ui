import type { ChainModel, ChainNode } from "catalyst-core";
import { describe, expect, it } from "vitest";

import { buildNodeDetail } from "./detail.js";

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
    expect(buildNodeDetail(model, "nowhere")).toBeNull();
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

    const reqDetail = buildNodeDetail(model, req.id)!;
    expect(reqDetail.upstream.map((n) => n.id)).toEqual([rule.id]);
    expect(reqDetail.downstream).toEqual([]);

    const ruleDetail = buildNodeDetail(model, rule.id)!;
    expect(ruleDetail.upstream).toEqual([]);
    expect(ruleDetail.downstream.map((n) => n.id)).toEqual([req.id]);
  });
});
