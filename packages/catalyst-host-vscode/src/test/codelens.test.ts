import * as assert from "assert";

import type { ChainModel, ChainNode } from "catalyst-core";

import { buildCodeLensesForFile } from "../codelens.js";

function node(
  overrides: Partial<ChainNode> & { id: string; file: string; line: number },
): ChainNode {
  return {
    kind: "dev-artifact",
    title: overrides.id,
    references: [],
    ...overrides,
    location: { file: overrides.file, line: overrides.line },
  } as ChainNode;
}

describe("buildCodeLensesForFile", () => {
  it("summarizes both directions for a node with upstream and downstream links", () => {
    const req = node({ id: "REQ-000001", file: "req.md", line: 5 });
    const rule = node({ id: "core-CONTRACT-001", file: "rules.md", line: 1 });

    const model: ChainModel = {
      nodes: new Map([
        [req.id, req],
        [rule.id, rule],
      ]),
      edges: new Map([[req.id, new Set([rule.id])]]),
      reverseEdges: new Map([[rule.id, new Set([req.id])]]),
      definitionsById: new Map(),
    };

    const reqLenses = buildCodeLensesForFile(model, "req.md");
    assert.strictEqual(reqLenses.length, 1);
    assert.strictEqual(reqLenses[0].title, "Links to core-CONTRACT-001");
    assert.strictEqual(reqLenses[0].targetNodeId, "REQ-000001");

    const ruleLenses = buildCodeLensesForFile(model, "rules.md");
    assert.strictEqual(ruleLenses.length, 1);
    assert.strictEqual(ruleLenses[0].title, "Linked from REQ-000001");
  });

  it("produces no lens for a node with no links either way", () => {
    const domain = node({
      id: "RUNTIME",
      kind: "domain",
      file: "domains.md",
      line: 1,
    } as Partial<ChainNode> & { id: string; file: string; line: number });
    const model: ChainModel = {
      nodes: new Map([[domain.id, domain]]),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };

    assert.deepStrictEqual(buildCodeLensesForFile(model, "domains.md"), []);
  });

  it("only includes nodes actually defined in the requested file", () => {
    const inFile = node({ id: "REQ-000001", file: "req.md", line: 1 });
    const elsewhere = node({ id: "REQ-000002", file: "other.md", line: 1 });
    const model: ChainModel = {
      nodes: new Map([
        [inFile.id, inFile],
        [elsewhere.id, elsewhere],
      ]),
      edges: new Map([[inFile.id, new Set([elsewhere.id])]]),
      reverseEdges: new Map([[elsewhere.id, new Set([inFile.id])]]),
      definitionsById: new Map(),
    };

    // Both nodes have real links, but only `inFile` is defined in the
    // requested file — `elsewhere` must not produce a lens here even
    // though it's a valid, linked node in the same model.
    const lenses = buildCodeLensesForFile(model, "req.md");
    assert.strictEqual(lenses.length, 1);
    assert.strictEqual(lenses[0].targetNodeId, "REQ-000001");
  });

  it("sorts lenses by line", () => {
    const a = node({ id: "REQ-000002", file: "f.md", line: 20 });
    const b = node({ id: "REQ-000001", file: "f.md", line: 5 });
    const target = node({ id: "core-CONTRACT-001", file: "rules.md", line: 1 });

    const model: ChainModel = {
      nodes: new Map([
        [a.id, a],
        [b.id, b],
        [target.id, target],
      ]),
      edges: new Map([
        [a.id, new Set([target.id])],
        [b.id, new Set([target.id])],
      ]),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };

    const lenses = buildCodeLensesForFile(model, "f.md");
    assert.deepStrictEqual(
      lenses.map((l) => l.targetNodeId),
      ["REQ-000001", "REQ-000002"],
    );
  });
});
