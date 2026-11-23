/** Tests of the Instances sidebar's model (`REQ-000123-UVqkd7cL`). */
import { describe, expect, it } from "vitest";

import type { ChainModel, ChainNode, ModuleType } from "catalyst-core";

import { buildSidebar, childrenByParent, healthLine, phaseOf, typeRoles } from "../sidebar.js";

type Field = ModuleType["fields"][number];

function ref(name: string, target: string, kind = "ref"): Field {
  return { name, kind, required: false, target_type: target };
}

function type(
  prefix: string,
  plural: string,
  grounding: string,
  fields: Field[] = [],
  groundingField: string | null = null,
): ModuleType {
  return {
    prefix,
    name: plural.slice(0, -1),
    plural_name: plural,
    states: ["new", "doing", "done", "dropped"],
    initial: "new",
    closed_states: ["done", "dropped"],
    fields,
    grounding,
    grounding_field: groundingField,
  };
}

/** A software-engineering-like module, as catalyst declares it. */
const TYPES: ModuleType[] = [
  type("REQ", "Requirements", "required", [
    ref("Targets", "rule", "ref-list"),
    ref("Feature", "FEAT"),
    ref("Steps", "STEP", "ref-list"),
  ]),
  type("BUG", "Bugs", "required", [ref("Targets", "rule", "ref-list"), ref("Steps", "STEP", "ref-list")]),
  type("STEP", "Steps", "inherited", [ref("Parent", "REQ|BUG")], "Parent"),
  type("FEAT", "Features", "none", [ref("Requirement(s)", "REQ", "ref-list")]),
  type("ADR", "Decisions", "none", [ref("Rules", "rule", "ref-list")]),
  type("ANALYSIS", "Analyses", "none"),
];

function art(id: string, status: string, links: Record<string, string[]> = {}, closed = false): ChainNode {
  return {
    id,
    kind: "artifact",
    typePrefix: id.split("-")[0],
    title: id,
    location: { file: "f.md", line: 1 },
    references: [],
    status,
    closed,
    links,
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
    domain: "X",
    status: "",
    registeredInRulesIndex: true,
    description: "",
  };
}

function modelOf(nodes: ChainNode[], types: ModuleType[] = TYPES): ChainModel {
  return {
    nodes: new Map(nodes.map((n) => [n.id, n])),
    edges: new Map(),
    reverseEdges: new Map(),
    definitionsById: new Map(),
    types: new Map(types.map((t) => [t.prefix, t])),
  };
}

const typeOf = (p: string) => TYPES.find((t) => t.prefix === p);

describe("phaseOf", () => {
  it("reads the status mark: under way, not started, done or dropped", () => {
    const req = typeOf("REQ");
    expect(phaseOf(art("REQ-000001", "doing"), req)).toBe("under-way");
    expect(phaseOf(art("REQ-000002", "new"), req)).toBe("not-started");
    expect(phaseOf(art("REQ-000003", ""), req)).toBe("not-started");
    expect(phaseOf(art("REQ-000004", "done", {}, true), req)).toBe("done");
    expect(phaseOf(art("REQ-000005", "dropped", {}, true), req)).toBe("done");
  });
});

describe("typeRoles", () => {
  it("makes grounded types work, what work rests on work, rule-citing types governance, the rest records", () => {
    const roles = typeRoles(TYPES.map((t) => t.prefix).concat("NOTE"), typeOf);
    expect(Object.fromEntries(roles)).toEqual({
      REQ: "work",
      BUG: "work",
      STEP: "work",
      FEAT: "work",
      ADR: "governance",
      ANALYSIS: "record",
      NOTE: "record",
    });
  });
});

describe("childrenByParent", () => {
  it("lists an inherited-grounding entity under the entity its grounding field names", () => {
    const model = modelOf([
      art("REQ-000001", "doing"),
      art("STEP-000002", "new", { Parent: ["REQ-000001"] }),
      art("STEP-000001", "new", { Parent: ["REQ-000001"] }),
      art("STEP-000003", "new", { Parent: ["REQ-000404"] }),
    ]);
    const byParent = childrenByParent(model);
    expect([...byParent.keys()]).toEqual(["REQ-000001"]);
    expect(byParent.get("REQ-000001")?.map((n) => n.id)).toEqual(["STEP-000001", "STEP-000002"]);
  });
});

describe("buildSidebar", () => {
  const model = modelOf([
    art("FEAT-000001", "doing"),
    art("REQ-000001", "done", {}, true),
    art("REQ-000002", "doing"),
    art("REQ-000003", "done", {}, true),
    art("REQ-000004", "new"),
    art("STEP-000001", "done", { Parent: ["REQ-000002"] }, true),
    art("STEP-000002", "doing", { Parent: ["REQ-000002"] }),
    art("BUG-000001", "doing"),
    art("ADR-000001", "new"),
    rule("ui-X-000001", "ui"),
    rule("rr-X-000001", "rr"),
  ]);

  it("groups the types into work, governance and records, in reading order", () => {
    const s = buildSidebar(model);
    expect(s.work.types.map((f) => f.typePrefix)).toEqual(["BUG", "FEAT", "REQ"]);
    expect(s.governance.types.map((f) => f.typePrefix)).toEqual(["ADR"]);
    expect(s.record.types.map((f) => f.typePrefix)).toEqual(["ANALYSIS"]);
  });

  it("lists every entity once: a step under its requirement, its type with no folder when all are", () => {
    const s = buildSidebar(model);
    const req = s.work.types.find((f) => f.typePrefix === "REQ");
    const underWay = req?.phases.find((p) => p.phase === "under-way");
    expect(underWay?.entries.map((e) => [e.node.id, e.children.map((c) => c.node.id)])).toEqual([
      ["REQ-000002", ["STEP-000001", "STEP-000002"]],
    ]);
    expect(s.work.types.some((f) => f.typePrefix === "STEP")).toBe(false);
    const all = [...s.work.types, ...s.governance.types, ...s.record.types].flatMap((f) =>
      f.phases.flatMap((p) => p.entries.flatMap((e) => [e.node.id, ...e.children.map((c) => c.node.id)])),
    );
    expect(all.sort()).toEqual(
      [...model.nodes.values()]
        .filter((n) => n.kind === "artifact")
        .map((n) => n.id)
        .sort(),
    );
  });

  it("keeps an orphan step in its own type's folder", () => {
    const s = buildSidebar(modelOf([art("STEP-000009", "doing", { Parent: ["REQ-000404"] })]));
    expect(s.work.types.find((f) => f.typePrefix === "STEP")?.count).toBe(1);
  });

  it("lists the phases under way, not started, then done, done newest first, and only those holding any", () => {
    const req = buildSidebar(model).work.types.find((f) => f.typePrefix === "REQ");
    expect(req?.count).toBe(4);
    expect(req?.phases.map((p) => [p.phase, p.entries.map((e) => e.node.id)])).toEqual([
      ["under-way", ["REQ-000002"]],
      ["not-started", ["REQ-000004"]],
      ["done", ["REQ-000003", "REQ-000001"]],
    ]);
    expect(
      buildSidebar(model)
        .work.types.find((f) => f.typePrefix === "BUG")
        ?.phases.map((p) => p.phase),
    ).toEqual(["under-way"]);
  });

  it("lists the rule documents under governance, Rules of Rules first", () => {
    const s = buildSidebar(model);
    expect(s.governance.rules.map((r) => r.label)).toEqual(["Rules of Rules", "UI Rules"]);
  });

  it("lists the inbox's items as references to the entities they are about", () => {
    const s = buildSidebar(model, {
      items: [
        { kind: "reconciliation", id: "RECON-000001", title: "a case", evidence: { entity: "REQ-000002" } },
        { kind: "approval", id: "REQ-000004", title: "an approval" },
        { kind: "unrecorded-commit", id: "abc1234", title: "a commit" },
      ],
    });
    expect(s.needsYou).toEqual([
      { kind: "reconciliation", id: "RECON-000001", title: "a case", entityId: "REQ-000002" },
      { kind: "approval", id: "REQ-000004", title: "an approval", entityId: "REQ-000004" },
      { kind: "unrecorded-commit", id: "abc1234", title: "a commit" },
    ]);
    expect(buildSidebar(model).needsYou).toEqual([]);
  });
});

describe("healthLine", () => {
  it("says what the check reports and the kernel", () => {
    expect(healthLine({ errorCount: 2, warningCount: 1 }, "0.125.1")).toBe(
      "❌ 2 errors · ⚠️ 1 warning · kernel 0.125.1",
    );
    expect(healthLine({ errorCount: 0, warningCount: 0 }, null)).toBe("✅ check passes");
    expect(healthLine(undefined, "0.125.1")).toBe("kernel 0.125.1");
    expect(healthLine()).toBe("");
  });
});
