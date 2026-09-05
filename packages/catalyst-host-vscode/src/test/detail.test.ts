import * as assert from "assert";

import type { ChainModel, ChainNode } from "catalyst-core";

import { buildNodeDetail } from "../detail.js";

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
    assert.strictEqual(buildNodeDetail(model, "nowhere"), null);
  });

  it("resolves upstream and downstream from the model's edges", () => {
    const req = node({ id: "REQ-000002", kind: "dev-artifact" });
    const rule = node({
      id: "vscode-INSPECTOR-001",
      kind: "rule",
      docPrefix: "vscode",
      domain: "INSPECTOR",
    });

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
    assert.strictEqual(reqDetail.node.id, "REQ-000002");
    assert.deepStrictEqual(
      reqDetail.upstream.map((n) => n.id),
      ["vscode-INSPECTOR-001"],
    );
    assert.deepStrictEqual(reqDetail.downstream, []);

    const ruleDetail = buildNodeDetail(model, rule.id)!;
    assert.deepStrictEqual(ruleDetail.upstream, []);
    assert.deepStrictEqual(
      ruleDetail.downstream.map((n) => n.id),
      ["REQ-000002"],
    );
  });
});
