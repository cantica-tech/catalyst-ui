import { describe, it } from "vitest";
import * as assert from "assert";

import type { ChainModel, ChainNode } from "catalyst-core";

import { buildNodeDetail, buildReferenceTable, describeFromContent, shortSummary } from "../detail.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "artifact",
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
    const req = node({ id: "REQ-000002", kind: "artifact" });
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

  it("includes a requirement's steps in its downstream, resolved from reverseEdges", () => {
    const req = node({ id: "REQ-000001", kind: "artifact" });
    const step: ChainNode = {
      id: "STEP-000001",
      kind: "artifact",
      typePrefix: "STEP",
      title: "STEP-000001",
      location: { file: "f.md", line: 1 },
      references: [],
      links: { Parent: ["REQ-000001"] },
      status: "done",
      closed: true,
      registered: true,
      fileExists: true,
      description: "",
      content: "",
    };
    const model: ChainModel = {
      nodes: new Map([
        [req.id, req],
        [step.id, step],
      ]),
      edges: new Map([[step.id, new Set([req.id])]]),
      reverseEdges: new Map([[req.id, new Set([step.id])]]),
      definitionsById: new Map(),
    };

    const reqDetail = buildNodeDetail(model, req.id)!;
    assert.deepStrictEqual(
      reqDetail.downstream.map((n) => n.id),
      ["STEP-000001"],
    );

    const stepDetail = buildNodeDetail(model, step.id)!;
    assert.deepStrictEqual(
      stepDetail.upstream.map((n) => n.id),
      ["REQ-000001"],
    );
  });

  it("includes a requirement's and a step's tests in their downstream, resolved from reverseEdges", () => {
    const req = node({ id: "REQ-000001", kind: "artifact" });
    const step: ChainNode = {
      id: "STEP-000001",
      kind: "artifact",
      typePrefix: "STEP",
      title: "STEP-000001",
      location: { file: "f.md", line: 1 },
      references: [],
      links: { Parent: ["REQ-000001"] },
      status: "done",
      closed: true,
      registered: true,
      fileExists: true,
      description: "",
      content: "",
    };
    const test = node({
      id: "TEST-000001",
      kind: "artifact",
      typePrefix: "TEST",
      status: "passing",
      closed: false,
      links: { Targets: ["env-RUNTIME-001"], Requirements: ["REQ-000001"], Steps: ["STEP-000001"] },
      registered: true,
      fileExists: true,
      description: "",
      content: "",
    });
    const model: ChainModel = {
      nodes: new Map([
        [req.id, req],
        [step.id, step],
        [test.id, test],
      ]),
      edges: new Map([[test.id, new Set([req.id, step.id])]]),
      reverseEdges: new Map([
        [req.id, new Set([test.id])],
        [step.id, new Set([test.id])],
      ]),
      definitionsById: new Map(),
    };

    const reqDetail = buildNodeDetail(model, req.id)!;
    assert.deepStrictEqual(
      reqDetail.downstream.map((n) => n.id),
      ["TEST-000001"],
    );

    const stepDetail = buildNodeDetail(model, step.id)!;
    assert.deepStrictEqual(
      stepDetail.downstream.map((n) => n.id),
      ["TEST-000001"],
    );

    const testDetail = buildNodeDetail(model, test.id)!;
    assert.deepStrictEqual(
      testDetail.upstream.map((n) => n.id),
      ["REQ-000001", "STEP-000001"],
    );
  });
});

describe("reference table (REQ-000014)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const node = (id: string, extra: Record<string, unknown> = {}): any => ({
    id,
    kind: "artifact",
    title: `${id} title`,
    location: { file: "f.md", line: 1 },
    references: [],
    description: "",
    ...extra,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelOf = (...nodes: any[]): ChainModel => ({
    nodes: new Map(nodes.map((n) => [n.id, n])),
    edges: new Map(),
    reverseEdges: new Map(),
    definitionsById: new Map(),
  });

  it("lists the entities the text cites, with name and summary", () => {
    const model = modelOf(
      node("REQ-000001-Ab3xR9pQ", {
        title: "Login flow",
        name: "`login-flow`",
        description: "Users log in. With a password.",
      }),
      node("REQ-000002-Ab3xR9pQ"),
      node("BUG-000003-Ab3xR9pQ"),
    );
    const table = buildReferenceTable(model, ["Fixes `REQ-000001-Ab3xR9pQ`; see BUG-000003."]);
    assert.deepStrictEqual(Object.keys(table).sort(), ["BUG-000003", "REQ-000001-Ab3xR9pQ"]);
    assert.deepStrictEqual(table["REQ-000001-Ab3xR9pQ"], {
      id: "REQ-000001-Ab3xR9pQ",
      kind: "artifact",
      name: "Login flow",
      summary: "Users log in.",
    });
    assert.strictEqual(table["BUG-000003"].id, "BUG-000003-Ab3xR9pQ");
  });

  it("never matches inside a longer token, an ambiguous short form, or the panel's own node", () => {
    const model = modelOf(node("REQ-000001-Ab3xR9pQ"), node("REQ-000001-Zz9xR9pQ"), node("STEP-000004-Ab3xR9pQ"));
    const table = buildReferenceTable(
      model,
      ["XREQ-000001-Ab3xR9pQ and REQ-000001 and STEP-000004-Ab3xR9pQ"],
      "STEP-000004-Ab3xR9pQ",
    );
    assert.deepStrictEqual(table, {});
  });

  it("summaries drop markdown and stay short", () => {
    assert.strictEqual(
      shortSummary(
        node("X-000001-Ab3xR9pQ", {
          description: "**Bold** `code` [link](http://x) rest",
        }),
      ),
      "Bold code link rest",
    );
    const long = "word ".repeat(80);
    const s = shortSummary(node("X-000001-Ab3xR9pQ", { description: long }));
    assert.ok(s.length <= 180 && s.endsWith("…"));
  });
});

describe("hover descriptions from content (BUG-000001 follow-up)", () => {
  const content =
    "# `REQ-000013-X` — Panels\n\nA requirement stands on its own: boilerplate.\n\n" +
    "| Field | Value |\n|---|---|\n| **ID** | `REQ-000013-X` |\n\n## Description\n\nPanels share a group.\n\n## Acceptance\n\n- one\n";

  it("prefers the Description section, never the template prose above the table", () => {
    assert.strictEqual(describeFromContent(content), "Panels share a group.");
  });

  it("falls back to the first paragraph after the field table", () => {
    assert.strictEqual(
      describeFromContent("Boilerplate.\n\n| **ID** | `X` |\n\nThe real text\ncontinues.\n\nMore."),
      "The real text continues.",
    );
  });

  it("feeds the hover summary when the parser found no description", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node: any = {
      id: "REQ-000013-X",
      kind: "artifact",
      title: "Panels",
      description: "",
      content,
    };
    assert.strictEqual(shortSummary(node), "Panels share a group.");
  });
});
