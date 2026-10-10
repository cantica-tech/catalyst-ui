import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildChainModel } from "../graph.js";
import type { CatalystGraph } from "../catalyst-source.js";
import { catalystEdges, compareModel } from "../parity.js";
import { parseCorpus } from "../parser.js";
import type { ChainModel, ChainNode } from "../types.js";

/** The chain model against catalyst's own graph (REQ-000018). */

function node(id: string, extra: Partial<ChainNode> & Record<string, unknown> = {}): ChainNode {
  return {
    id,
    kind: "dev-artifact",
    title: id,
    location: { file: "x.md", line: 1 },
    references: [],
    targets: [],
    ...extra,
  } as ChainNode;
}

function model(nodes: ChainNode[], edges: [string, string][]): ChainModel {
  const m: ChainModel = { nodes: new Map(), edges: new Map(), reverseEdges: new Map(), definitionsById: new Map() };
  for (const n of nodes) m.nodes.set(n.id, n);
  for (const [a, b] of edges) {
    if (!m.edges.has(a)) m.edges.set(a, new Set());
    m.edges.get(a)!.add(b);
  }
  return m;
}

const RULE = "br-AUTH-000001-Abcd1234";
const REQ = "REQ-000001-Abcd1234";

const graph: CatalystGraph = {
  rules: [
    { id: RULE, title: "r", status: "✅", file: "rules/r.md", line: 3, retired: false, domain: "AUTH", mentions: [] },
  ],
  domains: [{ code: "AUTH", file: null, title: "" }],
  artifacts: [
    {
      id: REQ,
      type: "REQ",
      title: "r",
      file: "requirements/r.md",
      Status: "Active",
      links: { Targets: [RULE] },
      mentions: [],
    },
    {
      id: "BUG-000001-Abcd1234",
      type: "BUG",
      title: "b",
      file: "development/bugs/b.md",
      Status: "Open",
      links: { Targets: ["REQ-000001"] },
      mentions: [],
    },
  ],
  types: {},
};

describe("compareModel", () => {
  it("resolves catalyst's links like the model does, short forms included", () => {
    expect([...catalystEdges(graph)].sort()).toEqual(
      [`BUG-000001-Abcd1234\u0000${REQ}`, `${REQ}\u0000${RULE}`, `${RULE}\u0000AUTH`].sort(),
    );
  });

  it("reports nodes, statuses and edges each way", () => {
    const m = model(
      [
        node(RULE, { kind: "rule", status: "✅ working", domain: "AUTH" }),
        node("AUTH", { kind: "domain" }),
        node(REQ, { status: "Draft" }),
        node("README"),
      ],
      [
        [RULE, "AUTH"],
        [REQ, "README"],
      ],
    );
    const r = compareModel(m, graph, { ok: true, errors: ["chain dangling-ref: x", "structure: y"], warnings: [] });
    expect(r.nodes.onlyModel).toEqual(["README"]);
    expect(r.nodes.onlyCatalyst).toEqual(["BUG-000001-Abcd1234"]);
    expect(r.statuses).toEqual([{ id: REQ, model: "Draft", catalyst: "Active" }]);
    expect(r.edges.both).toBe(1);
    expect(r.edges.missingInModel).toEqual([
      ["BUG-000001-Abcd1234", REQ],
      [REQ, RULE],
    ]);
    expect(r.edges.onlyModel).toEqual([[REQ, "README"]]);
    expect(r.validation.catalystChain).toEqual({ "dangling-ref": 1 });
  });

  it("takes a retired rule's 🗑 status as retired", () => {
    const m = model([node(RULE, { kind: "rule", status: "🗑 retired — x", domain: "AUTH" })], []);
    expect(compareModel(m, graph).statuses).toEqual([{ id: RULE, model: "🗑 retired — x", catalyst: "not retired" }]);
  });
});

// The kernel from a catalyst checkout beside this repository, as in kernel-parity.test.ts.
const here = fileURLToPath(new URL(".", import.meta.url));
const kernelScripts = join(
  process.env.CATALYST_KERNEL_DIR ?? resolve(here, "..", "..", "..", "..", "..", "catalyst"),
  "scripts",
);
const fixture = join(here, "fixtures", "parity", "corpus");
const hasGraph =
  existsSync(join(kernelScripts, "catalyst", "views.py")) &&
  spawnSync("python3", ["-c", "import catalyst.views as v; v.graph"], {
    env: { ...process.env, PYTHONPATH: kernelScripts },
  }).status === 0;

describe.skipIf(!hasGraph)("parity with kernel `catalyst graph --json` on the parity fixture", () => {
  it("the model and catalyst's graph hold the same rules and artifacts", () => {
    const res = spawnSync("python3", ["-m", "catalyst", "--working-copy", fixture, "graph", "--json"], {
      env: { ...process.env, PYTHONPATH: kernelScripts },
      encoding: "utf8",
    });
    const g = JSON.parse(res.stdout) as CatalystGraph;
    const parsed = parseCorpus(fixture);
    expect(parsed).not.toBeNull();
    const r = compareModel(buildChainModel(parsed!), g);
    expect(r.nodes.onlyCatalyst).toEqual([]);
    expect(r.statuses).toEqual([]);
    const domains = new Set(g.domains.map((d) => d.code));
    expect(r.edges.missingInModel.filter(([, to]) => !domains.has(to))).toEqual([]);
  });
});
