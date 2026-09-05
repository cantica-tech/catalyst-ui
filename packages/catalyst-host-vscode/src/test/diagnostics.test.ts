import * as assert from "assert";

import type { ChainModel, ValidationReport } from "catalyst-core";

import { buildDiagnosticsByFile } from "../diagnostics.js";

function emptyModel(): ChainModel {
  return {
    nodes: new Map(),
    edges: new Map(),
    reverseEdges: new Map(),
    definitionsById: new Map(),
  };
}

describe("buildDiagnosticsByFile", () => {
  it("groups issues with a location by file", () => {
    const report: ValidationReport = {
      issues: [
        {
          kind: "orphaned-artifact",
          severity: "error",
          message: "no targets",
          location: { file: "a.md", line: 3 },
        },
        {
          kind: "dangling-reference",
          severity: "error",
          message: "nowhere",
          location: { file: "a.md", line: 10 },
        },
        {
          kind: "unbacked-rule",
          severity: "error",
          message: "not listed",
          location: { file: "b.md", line: 1 },
        },
      ],
      nodeCount: 0,
      errorCount: 3,
      warningCount: 0,
      durationMs: 0,
    };

    const byFile = buildDiagnosticsByFile(report, emptyModel());
    assert.strictEqual(byFile.get("a.md")?.length, 2);
    assert.strictEqual(byFile.get("b.md")?.length, 1);
    assert.strictEqual(byFile.get("a.md")?.[0].line, 3);
  });

  it("falls back to every definition site for an issue with no location", () => {
    const model: ChainModel = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map([
        [
          "env-RUNTIME-001",
          [
            { file: "a.md", line: 1 },
            { file: "b.md", line: 5 },
          ],
        ],
      ]),
    };
    const report: ValidationReport = {
      issues: [
        {
          kind: "id-reuse",
          severity: "error",
          message: "reused",
          nodeId: "env-RUNTIME-001",
        },
      ],
      nodeCount: 0,
      errorCount: 1,
      warningCount: 0,
      durationMs: 0,
    };

    const byFile = buildDiagnosticsByFile(report, model);
    assert.strictEqual(byFile.get("a.md")?.[0].line, 1);
    assert.strictEqual(byFile.get("b.md")?.[0].line, 5);
  });

  it("drops an issue with neither a location nor a resolvable nodeId, without throwing", () => {
    const report: ValidationReport = {
      issues: [
        {
          kind: "id-reuse",
          severity: "error",
          message: "orphaned issue",
          nodeId: "nowhere",
        },
      ],
      nodeCount: 0,
      errorCount: 1,
      warningCount: 0,
      durationMs: 0,
    };

    const byFile = buildDiagnosticsByFile(report, emptyModel());
    assert.strictEqual(byFile.size, 0);
  });
});
