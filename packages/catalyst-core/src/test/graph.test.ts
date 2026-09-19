import { describe, expect, it } from "vitest";

import { buildChainModel } from "../graph.js";
import type { ChainNode, ParseResult } from "../types.js";

function node(
  overrides: Partial<ChainNode> & Pick<ChainNode, "id" | "kind">,
): ChainNode {
  return {
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

function parseResult(files: ParseResult["files"]): ParseResult {
  return { root: "/fixture", files, durationMs: 0 };
}

describe("buildChainModel", () => {
  it("resolves a reference into forward and reverse edges", () => {
    const a = node({
      id: "REQ-000001",
      kind: "dev-artifact",
      artifactType: "requirement",
      status: "in-progress",
      targets: ["core-CONTRACT-001"],
      registered: true,
      fileExists: true,
      references: ["core-CONTRACT-001"],
    });
    const b = node({
      id: "core-CONTRACT-001",
      kind: "rule",
      docPrefix: "core",
      domain: "CONTRACT",
      status: "",
      registeredInRulesIndex: true,
    });

    const model = buildChainModel(
      parseResult([
        { file: "a.md", mtimeMs: 0, nodes: [a] },
        { file: "b.md", mtimeMs: 0, nodes: [b] },
      ]),
    );

    expect(model.nodes.size).toBe(2);
    expect(model.edges.get("REQ-000001")).toEqual(
      new Set(["core-CONTRACT-001"]),
    );
    expect(model.reverseEdges.get("core-CONTRACT-001")).toEqual(
      new Set(["REQ-000001"]),
    );
  });

  it("does not create an edge for a reference that does not resolve", () => {
    const a = node({
      id: "REQ-000001",
      kind: "dev-artifact",
      artifactType: "requirement",
      status: "in-progress",
      targets: [],
      registered: true,
      fileExists: true,
      references: ["nowhere-001"],
    });

    const model = buildChainModel(
      parseResult([{ file: "a.md", mtimeMs: 0, nodes: [a] }]),
    );

    expect(model.edges.has("REQ-000001")).toBe(false);
    expect(model.reverseEdges.has("nowhere-001")).toBe(false);
  });

  it("keeps the first definition as canonical but records every definition site for reuse detection", () => {
    const first = node({
      id: "env-RUNTIME-001",
      kind: "rule",
      docPrefix: "env",
      domain: "RUNTIME",
      status: "",
      registeredInRulesIndex: true,
      location: { file: "a.md", line: 1 },
    });
    const duplicate = node({
      id: "env-RUNTIME-001",
      kind: "rule",
      docPrefix: "env",
      domain: "RUNTIME",
      status: "",
      registeredInRulesIndex: true,
      location: { file: "b.md", line: 5 },
    });

    const model = buildChainModel(
      parseResult([
        { file: "a.md", mtimeMs: 0, nodes: [first] },
        { file: "b.md", mtimeMs: 0, nodes: [duplicate] },
      ]),
    );

    expect(model.nodes.get("env-RUNTIME-001")!.location.file).toBe("a.md");
    expect(model.definitionsById.get("env-RUNTIME-001")).toEqual([
      { file: "a.md", line: 1 },
      { file: "b.md", line: 5 },
    ]);
  });

  it("resolves a roadmap row's Linked feature and that feature's own back-citation into both directions", () => {
    const roadmap = node({
      id: "RM-000001",
      kind: "roadmap",
      roadmapName: "product",
      roadmapRetired: false,
      status: "Triaged",
      linked: "FEAT-000001",
      signedOffBy: "alice",
      notes: "",
      references: ["FEAT-000001"],
    });
    const feature = node({
      id: "FEAT-000001",
      kind: "feature",
      status: "in-development",
      registered: true,
      fileExists: true,
      references: ["RM-000001"],
    });

    const model = buildChainModel(
      parseResult([
        { file: "roadmap.md", mtimeMs: 0, nodes: [roadmap] },
        { file: "feature.md", mtimeMs: 0, nodes: [feature] },
      ]),
    );

    expect(model.edges.get("RM-000001")).toEqual(new Set(["FEAT-000001"]));
    expect(model.reverseEdges.get("FEAT-000001")).toEqual(
      new Set(["RM-000001"]),
    );
    expect(model.edges.get("FEAT-000001")).toEqual(new Set(["RM-000001"]));
    expect(model.reverseEdges.get("RM-000001")).toEqual(
      new Set(["FEAT-000001"]),
    );
  });

  it("links rule nodes to domain nodes and dev-artifacts to feature nodes", () => {
    const domainNode = node({
      id: "RUNTIME",
      kind: "domain",
      code: "RUNTIME",
      hasDoc: true,
    });
    const ruleNode = node({
      id: "env-RUNTIME-001",
      kind: "rule",
      docPrefix: "env",
      domain: "RUNTIME",
      status: "✅",
    });
    const featNode = node({
      id: "FEAT-000001",
      kind: "feature",
      status: "in-development",
      registered: true,
      fileExists: true,
    });
    const reqNode = node({
      id: "REQ-000001",
      kind: "dev-artifact",
      artifactType: "requirement",
      status: "in-progress",
      targets: ["env-RUNTIME-001"],
      feature: "FEAT-000001",
      registered: true,
      fileExists: true,
    });

    const model = buildChainModel(
      parseResult([
        { file: "domains.md", mtimeMs: 0, nodes: [domainNode] },
        { file: "env.md", mtimeMs: 0, nodes: [ruleNode] },
        { file: "features.md", mtimeMs: 0, nodes: [featNode] },
        { file: "req.md", mtimeMs: 0, nodes: [reqNode] },
      ]),
    );

    expect(model.edges.get("env-RUNTIME-001")).toEqual(new Set(["RUNTIME"]));
    expect(model.reverseEdges.get("RUNTIME")).toEqual(
      new Set(["env-RUNTIME-001"]),
    );
    expect(model.edges.get("REQ-000001")).toEqual(
      new Set(["FEAT-000001", "env-RUNTIME-001"]),
    );
  });

  it("never creates a self-edge, even when a node's raw references include its own id", () => {
    // A node's own `**ID**` field is backtick-quoted like any citation, so
    // the parser's generic scan legitimately puts a node's own id in its
    // own references — the graph must not turn that into a self-loop.
    const a = node({
      id: "REQ-000001",
      kind: "dev-artifact",
      artifactType: "requirement",
      status: "in-progress",
      targets: [],
      registered: true,
      fileExists: true,
      references: ["REQ-000001"],
    });

    const model = buildChainModel(
      parseResult([{ file: "a.md", mtimeMs: 0, nodes: [a] }]),
    );

    expect(model.edges.has("REQ-000001")).toBe(false);
    expect(model.reverseEdges.has("REQ-000001")).toBe(false);
  });

  it("resolves a step's requirement into forward and reverse edges", () => {
    const req = node({
      id: "REQ-000001",
      kind: "dev-artifact",
      artifactType: "requirement",
      status: "in-progress",
      targets: [],
      registered: true,
      fileExists: true,
    });
    const step = node({
      id: "STEP-000001",
      kind: "step",
      requirement: "REQ-000001",
      status: "done",
      registered: true,
      fileExists: true,
      references: ["REQ-000001"],
    });

    const model = buildChainModel(
      parseResult([
        { file: "req.md", mtimeMs: 0, nodes: [req] },
        { file: "step.md", mtimeMs: 0, nodes: [step] },
      ]),
    );

    expect(model.edges.get("STEP-000001")).toEqual(new Set(["REQ-000001"]));
    expect(model.reverseEdges.get("REQ-000001")).toEqual(
      new Set(["STEP-000001"]),
    );
  });
});
