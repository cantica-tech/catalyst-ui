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
  it("returns the Dev Artifacts group, Rules group, and the two other sections, even when empty", () => {
    const { devArtifacts, rules, sections } = buildTreeSections(modelOf([]));
    assert.strictEqual(devArtifacts.label, "Dev Artifacts");
    assert.deepStrictEqual(
      devArtifacts.sections.map((s) => s.kind),
      ["requirement", "bug", "house-keeping", "step", "test"],
    );
    assert.ok(devArtifacts.sections.every((s) => s.nodes.length === 0));
    assert.strictEqual(rules.label, "Rules");
    assert.strictEqual(rules.sections.length, 0);
    assert.deepStrictEqual(
      sections.map((s) => s.kind),
      ["domain", "feature"],
    );
    assert.ok(sections.every((s) => s.nodes.length === 0));
  });

  it("groups step nodes into their own Steps sub-section, under Dev Artifacts", () => {
    const stepNode: ChainNode = {
      id: "STEP-000001",
      kind: "step",
      title: "STEP-000001",
      location: { file: "f.md", line: 1 },
      references: [],
      parent: "REQ-000001",
      status: "done",
      registered: true,
      fileExists: true,
      description: "",
      content: "",
    };

    const { devArtifacts } = buildTreeSections(modelOf([stepNode, node({ id: "REQ-000001" })]));
    const stepSection = devArtifacts.sections.find((s) => s.kind === "step")!;
    assert.strictEqual(stepSection.label, "Steps");
    assert.deepStrictEqual(
      stepSection.nodes.map((n) => n.id),
      ["STEP-000001"],
    );
  });

  it("splits dev-artifact nodes into separate sub-sections by their artifactType", () => {
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

    const { devArtifacts } = buildTreeSections(model);
    const requirements = devArtifacts.sections.find((s) => s.kind === "requirement")!;
    const bugs = devArtifacts.sections.find((s) => s.kind === "bug")!;
    const houseKeeping = devArtifacts.sections.find((s) => s.kind === "house-keeping")!;

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

  it("splits a test into its own Tests sub-section, alongside requirement/bug/house-keeping", () => {
    const model = modelOf([
      node({
        id: "REQ-000001",
        kind: "dev-artifact",
        artifactType: "requirement",
      }),
      node({ id: "TEST-000001", kind: "dev-artifact", artifactType: "test" }),
    ]);

    const { devArtifacts } = buildTreeSections(model);
    const tests = devArtifacts.sections.find((s) => s.kind === "test")!;
    assert.strictEqual(tests.label, "Tests");
    assert.deepStrictEqual(
      tests.nodes.map((n) => n.id),
      ["TEST-000001"],
    );
  });

  it("groups rules into rule-type sections with Rules of Rules (rr) first", () => {
    const model = modelOf([
      node({
        id: "ui-BOOT-001",
        kind: "rule",
        docPrefix: "ui",
        domain: "BOOT",
      }),
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

    const { rules } = buildTreeSections(model);
    assert.deepStrictEqual(
      rules.sections.map((s) => s.prefix),
      ["rr", "env", "ui"],
    );

    const rrSection = rules.sections.find((s) => s.prefix === "rr")!;
    assert.strictEqual(rrSection.label, "Rules of Rules");
    assert.deepStrictEqual(
      rrSection.nodes.map((n) => n.id),
      ["rr-META-003"],
    );

    const uiSection = rules.sections.find((s) => s.prefix === "ui")!;
    assert.strictEqual(uiSection.label, "UI Rules");
    assert.deepStrictEqual(
      uiSection.nodes.map((n) => n.id),
      ["ui-BOOT-001"],
    );
  });

  it("sorts nodes within a section by id", () => {
    const model = modelOf([
      node({ id: "REQ-000002", kind: "dev-artifact" }),
      node({ id: "REQ-000001", kind: "dev-artifact" }),
    ]);

    const { devArtifacts } = buildTreeSections(model);
    const section = devArtifacts.sections.find((s) => s.kind === "requirement")!;
    assert.deepStrictEqual(
      section.nodes.map((n) => n.id),
      ["REQ-000001", "REQ-000002"],
    );
  });

  it("sorts by numeric sequence even once every id carries a userid suffix (Rules-of-Rules.md §20)", () => {
    const model = modelOf([
      node({ id: "REQ-000002-Zz9kM2wT", kind: "dev-artifact" }),
      node({ id: "REQ-000001-Ab3xR9pQ", kind: "dev-artifact" }),
    ]);

    const { devArtifacts } = buildTreeSections(model);
    const section = devArtifacts.sections.find((s) => s.kind === "requirement")!;
    assert.deepStrictEqual(
      section.nodes.map((n) => n.id),
      ["REQ-000001-Ab3xR9pQ", "REQ-000002-Zz9kM2wT"],
    );
  });

  it("excludes roadmap nodes from every section — they get their own Roadmaps section instead", () => {
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

    const { devArtifacts, sections } = buildTreeSections(model);
    assert.ok(devArtifacts.sections.every((s) => s.nodes.length === 0));
    assert.ok(sections.every((s) => s.nodes.length === 0));
  });
});
