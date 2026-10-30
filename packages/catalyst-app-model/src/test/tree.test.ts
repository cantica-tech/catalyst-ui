import { describe, it } from "vitest";
import * as assert from "assert";

import type { ChainModel, ChainNode, ModuleType, RowNode } from "catalyst-core";

import { buildRowSections } from "../rows.js";
import { buildTreeSections } from "../tree.js";

function type(prefix: string, plural: string): ModuleType {
  return {
    prefix,
    name: plural.slice(0, -1),
    plural_name: plural,
    states: [],
    initial: null,
    closed_states: [],
    fields: [],
  };
}

function artifact(id: string): ChainNode {
  return {
    id,
    kind: "artifact",
    typePrefix: id.split("-")[0],
    title: id,
    location: { file: "f.md", line: 1 },
    references: [],
    status: "",
    closed: false,
    links: {},
    registered: true,
    fileExists: true,
    description: "",
    content: "",
  };
}

function rule(id: string, docPrefix: string): ChainNode {
  return {
    id,
    kind: "rule",
    title: id,
    location: { file: "f.md", line: 1 },
    references: [],
    docPrefix,
    domain: id.split("-")[1],
    status: "",
    registeredInRulesIndex: true,
    description: "",
  };
}

function row(id: string, table: string): RowNode {
  return {
    id,
    kind: "row",
    typePrefix: "RM",
    title: id,
    location: { file: `${table}.md`, line: 1 },
    references: [],
    table,
    tableRetired: false,
    status: "",
    closed: false,
    fields: {},
    links: {},
    signedOffBy: "",
    description: "",
  };
}

function modelOf(nodes: ChainNode[], types: ModuleType[] = []): ChainModel {
  return {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    edges: new Map(),
    reverseEdges: new Map(),
    definitionsById: new Map(),
    types: new Map(types.map((t) => [t.prefix, t])),
  };
}

describe("buildTreeSections (catalyst roadmap R6.7: the module's types, none named here)", () => {
  it("gives every declared type a section under its plural name, even when empty, in name order", () => {
    const { artifacts, rules, domains } = buildTreeSections(
      modelOf([artifact("BUG-000001")], [type("REQ", "Requirements"), type("BUG", "Bugs")]),
    );
    assert.strictEqual(artifacts.label, "Artifacts");
    assert.deepStrictEqual(
      artifacts.sections.map((s) => [s.typePrefix, s.label, s.nodes.length]),
      [
        ["BUG", "Bugs", 1],
        ["REQ", "Requirements", 0],
      ],
    );
    assert.strictEqual(rules.sections.length, 0);
    assert.deepStrictEqual(domains, []);
  });

  it("keeps a prefix the model has artifacts of but no type for, labelled by the prefix", () => {
    const { artifacts } = buildTreeSections(modelOf([artifact("NOTE-000001")]));
    assert.deepStrictEqual(
      artifacts.sections.map((s) => s.label),
      ["NOTE"],
    );
  });

  it("leaves a type kept as rows out of the artifact sections", () => {
    const { artifacts } = buildTreeSections(
      modelOf([row("RM-000001", "beta")], [type("RM", "Roadmap items"), type("REQ", "Requirements")]),
    );
    assert.deepStrictEqual(
      artifacts.sections.map((s) => s.typePrefix),
      ["REQ"],
    );
  });

  it("sorts by id within a section, userid suffixes included", () => {
    const { artifacts } = buildTreeSections(
      modelOf([artifact("REQ-000002-Zz9kM2wT"), artifact("REQ-000001-Ab3xR9pQ")], [type("REQ", "Requirements")]),
    );
    assert.deepStrictEqual(
      artifacts.sections[0].nodes.map((n) => n.id),
      ["REQ-000001-Ab3xR9pQ", "REQ-000002-Zz9kM2wT"],
    );
  });

  it("places every entity once, in its own type's section, whatever cites it (vscode-INSPECTOR-000002)", () => {
    const req = artifact("REQ-000001");
    const step = { ...artifact("STEP-000001"), links: { Parent: ["REQ-000001"] } };
    const test = { ...artifact("TEST-000001"), links: { Requirements: ["REQ-000001"], Steps: ["STEP-000001"] } };
    const model = modelOf(
      [req, step, test],
      [type("REQ", "Requirements"), type("STEP", "Steps"), type("TEST", "Tests")],
    );
    model.reverseEdges.set("REQ-000001", new Set(["STEP-000001", "TEST-000001"]));
    model.reverseEdges.set("STEP-000001", new Set(["TEST-000001"]));
    const { artifacts } = buildTreeSections(model);
    const placed = artifacts.sections.flatMap((s) => s.nodes.map((n) => `${s.typePrefix}:${n.id}`));
    assert.deepStrictEqual(placed.sort(), ["REQ:REQ-000001", "STEP:STEP-000001", "TEST:TEST-000001"]);
  });

  it("groups rules into rule-type sections with Rules of Rules (rr) first", () => {
    const { rules } = buildTreeSections(
      modelOf([rule("ui-BOOT-001", "ui"), rule("env-RUNTIME-001", "env"), rule("rr-META-003", "rr")]),
    );
    assert.deepStrictEqual(
      rules.sections.map((s) => [s.prefix, s.label]),
      [
        ["rr", "Rules of Rules"],
        ["env", "ENV Rules"],
        ["ui", "UI Rules"],
      ],
    );
  });
});

describe("buildRowSections", () => {
  it("groups each row type's rows by table file, under the type's plural name", () => {
    const sections = buildRowSections(
      [row("RM-000002", "beta"), row("RM-000001", "beta"), row("RM-000003", "alpha")],
      new Map([["RM", type("RM", "Roadmap items")]]),
    );
    assert.deepStrictEqual(
      sections.map((s) => s.label),
      ["Roadmap items (2)"],
    );
    assert.deepStrictEqual(
      sections[0].groups.map((g) => [g.name, g.items.map((i) => i.id)]),
      [
        ["alpha", ["RM-000003"]],
        ["beta", ["RM-000001", "RM-000002"]],
      ],
    );
  });
});
