import * as assert from "assert";

import type { ChainModel, ChainNode } from "catalyst-core";

import { resolveDefinitionAt } from "../definitions.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "rule",
    title: overrides.id,
    location: { file: "target.md", line: 42 },
    docPrefix: "env",
    domain: "RUNTIME",
    status: "",
    registeredInRulesIndex: true,
    references: [],
    ...overrides,
  } as ChainNode;
}

function modelOf(nodes: ChainNode[]): ChainModel {
  return {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    edges: new Map(),
    reverseEdges: new Map(),
    definitionsById: new Map(),
  };
}

describe("resolveDefinitionAt", () => {
  const model = modelOf([
    node({ id: "env-RUNTIME-001" }),
    node({ id: "REQ-000001", kind: "dev-artifact" } as Partial<ChainNode> & {
      id: string;
    }),
  ]);

  it("resolves a rule id when the cursor is inside the backtick-quoted token", () => {
    const line = "Targets `env-RUNTIME-001` directly.";
    const character = line.indexOf("env-RUNTIME") + 3;
    const location = resolveDefinitionAt(model, line, character);
    assert.deepStrictEqual(location, { file: "target.md", line: 42 });
  });

  it("resolves a dev-artifact id the same way", () => {
    const line = "Targeted by `REQ-000001`.";
    const character = line.indexOf("REQ-000001") + 2;
    const location = resolveDefinitionAt(model, line, character);
    assert.deepStrictEqual(location, { file: "target.md", line: 42 });
  });

  it("returns null when the cursor is outside any id token", () => {
    const line = "Targets `env-RUNTIME-001` directly.";
    const location = resolveDefinitionAt(model, line, 0);
    assert.strictEqual(location, null);
  });

  it("returns null for a backtick-quoted id that does not resolve to any node", () => {
    const line = "See `env-RUNTIME-999` for details.";
    const character = line.indexOf("env-RUNTIME") + 3;
    const location = resolveDefinitionAt(model, line, character);
    assert.strictEqual(location, null);
  });
});
