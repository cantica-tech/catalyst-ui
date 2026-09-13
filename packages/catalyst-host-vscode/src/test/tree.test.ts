import * as assert from "assert";

import type { ChainModel, ChainNode } from "catalyst-core";

import { buildTreeSections } from "../tree.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    artifactType: "requirement",
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
  it("returns all seven sections in order, even when empty", () => {
    const sections = buildTreeSections(modelOf([]));
    assert.deepStrictEqual(
      sections.map((s) => s.kind),
      [
        "requirement",
        "bug",
        "house-keeping",
        "rule",
        "rule-of-rules",
        "domain",
        "feature",
      ],
    );
    assert.ok(sections.every((s) => s.nodes.length === 0));
  });

  it("splits dev-artifact nodes into separate sections by their artifactType", () => {
    const model = modelOf([
      node({
        id: "REQ-000001",
        kind: "dev-artifact",
        artifactType: "requirement",
      }),
      node({ id: "BUG-000001", kind: "dev-artifact", artifactType: "bug" }),
      node({
        id: "HK-000001",
        kind: "dev-artifact",
        artifactType: "house-keeping",
      }),
    ]);

    const sections = buildTreeSections(model);
    const requirements = sections.find((s) => s.kind === "requirement")!;
    const bugs = sections.find((s) => s.kind === "bug")!;
    const houseKeeping = sections.find((s) => s.kind === "house-keeping")!;

    assert.deepStrictEqual(
      requirements.nodes.map((n) => n.id),
      ["REQ-000001"],
    );
    assert.deepStrictEqual(
      bugs.nodes.map((n) => n.id),
      ["BUG-000001"],
    );
    assert.deepStrictEqual(
      houseKeeping.nodes.map((n) => n.id),
      ["HK-000001"],
    );
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
      (s) => s.kind === "requirement",
    )!;
    assert.deepStrictEqual(
      section.nodes.map((n) => n.id),
      ["REQ-000001", "REQ-000002"],
    );
  });

  it("excludes roadmap nodes from all seven sections — they get their own Roadmaps section instead", () => {
    const model = modelOf([
      node({
        id: "RM-000001",
        kind: "roadmap",
        roadmapName: "product",
        roadmapRetired: false,
        status: "Not triaged",
        signedOffBy: "alice",
        notes: "",
      }),
    ]);

    const sections = buildTreeSections(model);
    assert.ok(sections.every((s) => s.nodes.length === 0));
  });
});
