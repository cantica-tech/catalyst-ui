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
});
