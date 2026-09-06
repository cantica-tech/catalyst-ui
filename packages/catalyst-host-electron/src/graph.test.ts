import type { ChainModel, ChainNode } from "catalyst-core";
import { describe, expect, it } from "vitest";

import { computeGraphLayout } from "./graph.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

describe("computeGraphLayout", () => {
  it("returns empty nodes/edges for an empty model", () => {
    const model: ChainModel = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };
    expect(computeGraphLayout(model)).toEqual({ nodes: [], edges: [] });
  });

  it("groups nodes into columns by kind, in chain order", () => {
    const rule = node({ id: "env-RUNTIME-001", kind: "rule" });
    const req = node({ id: "REQ-000001", kind: "dev-artifact" });
    const domain = node({ id: "RUNTIME", kind: "domain" });

    const model: ChainModel = {
      nodes: new Map([
        [rule.id, rule],
        [req.id, req],
        [domain.id, domain],
      ]),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };

    const layout = computeGraphLayout(model);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));

    expect(byId.get(req.id)!.x).toBeLessThan(byId.get(rule.id)!.x);
    expect(byId.get(rule.id)!.x).toBeLessThan(byId.get(domain.id)!.x);
  });

  it("gives every node a deterministic, non-overlapping position", () => {
    const a = node({ id: "REQ-000001", kind: "dev-artifact" });
    const b = node({ id: "REQ-000002", kind: "dev-artifact" });

    const model: ChainModel = {
      nodes: new Map([
        [a.id, a],
        [b.id, b],
      ]),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };

    const first = computeGraphLayout(model);
    const second = computeGraphLayout(model);
    expect(first).toEqual(second);

    const positions = first.nodes.map((n) => `${n.x},${n.y}`);
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("carries every model edge through, sorted", () => {
    const a = node({ id: "REQ-000002", kind: "dev-artifact" });
    const b = node({ id: "REQ-000001", kind: "dev-artifact" });

    const model: ChainModel = {
      nodes: new Map([
        [a.id, a],
        [b.id, b],
      ]),
      edges: new Map([[a.id, new Set([b.id])]]),
      reverseEdges: new Map([[b.id, new Set([a.id])]]),
      definitionsById: new Map(),
    };

    expect(computeGraphLayout(model).edges).toEqual([{ from: a.id, to: b.id }]);
  });
});
