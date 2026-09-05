import * as assert from "assert";

import type { ChainModel, ChainNode } from "catalyst-core";

import { buildTreeSections } from "../tree.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

function modelOf(nodes: ChainNode[]): ChainModel {
  const map = new Map(nodes.map((n) => [n.id, n]));
  return {
    nodes: map,
    edges: new Map(),
    reverseEdges: new Map(),
    definitionsById: new Map(),
  };
}

describe("buildTreeSections", () => {
  it("returns all five sections in order, even when empty", () => {
    const sections = buildTreeSections(modelOf([]));
    assert.deepStrictEqual(
      sections.map((s) => s.kind),
      ["dev-artifact", "rule", "rule-of-rules", "domain", "feature"],
    );
    assert.ok(sections.every((s) => s.nodes.length === 0));
  });

  it("splits rr-prefixed rules into their own section, separate from other rules", () => {
    const model = modelOf([
      node({
        id: "env-RUNTIME-001",
        kind: "rule",
        docPrefix: "env",
        domain: "RUNTIME",
      }),
      node({
        id: "rr-META-003",
        kind: "rule",
        docPrefix: "rr",
        domain: "META",
      }),
    ]);

    const sections = buildTreeSections(model);
    const rules = sections.find((s) => s.kind === "rule")!;
    const rulesOfRules = sections.find((s) => s.kind === "rule-of-rules")!;

    assert.deepStrictEqual(
      rules.nodes.map((n) => n.id),
      ["env-RUNTIME-001"],
    );
    assert.deepStrictEqual(
      rulesOfRules.nodes.map((n) => n.id),
      ["rr-META-003"],
    );
  });

  it("sorts nodes within a section by id", () => {
    const model = modelOf([
      node({ id: "REQ-000002", kind: "dev-artifact" }),
      node({ id: "REQ-000001", kind: "dev-artifact" }),
    ]);

    const section = buildTreeSections(model).find(
      (s) => s.kind === "dev-artifact",
    )!;
    assert.deepStrictEqual(
      section.nodes.map((n) => n.id),
      ["REQ-000001", "REQ-000002"],
    );
  });
});
