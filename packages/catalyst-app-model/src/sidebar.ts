/**
 * The Instances sidebar (`REQ-000123-UVqkd7cL`): a deployment's entities
 * arranged by the question a reader asks — what needs me, what is the work,
 * what governs it, what was recorded — then by type, then by where each one
 * stands. Every part comes from catalyst's own declarations (a type's
 * `grounding`, its fields, its states); nothing here names a module type
 * (catalyst roadmap R6.7). Pure, so it is unit-tested without a host.
 */
import type { ChainModel, ChainNode, ModuleType, RowNode } from "catalyst-core";

import { buildRowSections, type RowSection } from "./rows.js";
import { buildTreeSections, getNodeStatusGlyph, typeLabel, type RuleTypeSection } from "./tree.js";
import { orderTypes } from "./type-order.js";

/** Where an entity stands: under way (⏳), not started (…), or done or dropped (✅ / 🗑). */
export type Phase = "under-way" | "not-started" | "done";

/** The phases in the order the sidebar lists them, with their labels and marks. */
export const PHASES: readonly { phase: Phase; label: string; glyph: string }[] = [
  { phase: "under-way", label: "Under way", glyph: "⏳" },
  { phase: "not-started", label: "Not started", glyph: "…" },
  { phase: "done", label: "Done", glyph: "✅" },
];

/** An artifact's phase, from its status mark (`getNodeStatusGlyph`, catalyst roadmap R6.7). */
export function phaseOf(node: ChainNode, type?: ModuleType): Phase {
  const glyph = getNodeStatusGlyph(node, type).trim();
  if (glyph === "⏳") return "under-way";
  if (glyph === "…" || glyph === "") return "not-started";
  return "done";
}

/** Which group a type is listed in: the work, what governs it, or what records it. */
export type TypeRole = "work" | "governance" | "record";

/**
 * Each type's group, from its declaration: a type grounded in the rules
 * (`grounding` `required` or `inherited`) is work, and so is any type work
 * rests on (a single reference to it, such as a requirement's `Feature`);
 * a type that is not work but cites rules (a field targeting `rule`, such
 * as a decision's `Rules`) governs; every other type, and a prefix the
 * module does not declare, is a record.
 */
export function typeRoles(
  prefixes: Iterable<string>,
  typeOf: (prefix: string) => ModuleType | undefined,
): Map<string, TypeRole> {
  const all = [...new Set(prefixes)];
  const work = new Set(
    all.filter((p) => {
      const grounding = typeOf(p)?.grounding;
      return grounding === "required" || grounding === "inherited";
    }),
  );
  // what work rests on is work too, transitively
  for (let grew = true; grew;) {
    grew = false;
    for (const p of [...work]) {
      for (const field of typeOf(p)?.fields ?? []) {
        if (field.kind !== "ref" || !field.target_type) continue;
        for (const t of field.target_type.split("|").map((x) => x.trim())) {
          if (t !== p && all.includes(t) && !work.has(t)) {
            work.add(t);
            grew = true;
          }
        }
      }
    }
  }
  const roles = new Map<string, TypeRole>();
  for (const p of all) {
    if (work.has(p)) roles.set(p, "work");
    else if ((typeOf(p)?.fields ?? []).some((f) => f.target_type?.split("|").includes("rule")))
      roles.set(p, "governance");
    else roles.set(p, "record");
  }
  return roles;
}

/** One entity in the sidebar, with the entities whose grounding it carries listed under it. */
export interface EntityEntry {
  node: ChainNode;
  children: EntityEntry[];
}

/** The entities of one type in one phase. */
export interface PhaseFolder {
  phase: Phase;
  label: string;
  glyph: string;
  entries: EntityEntry[];
}

/** One type's entities, by phase (only the phases that hold any). */
export interface TypeFolder {
  typePrefix: string;
  label: string;
  /** How many entities the folder lists at its top level (not those nested under them). */
  count: number;
  phases: PhaseFolder[];
}

/** One thing waiting for a person, as catalyst's inbox reports it. */
export interface AttentionItem {
  kind: string;
  id: string;
  title: string;
  /** The entity the item is about, when the model has it: opening the item opens that entity. */
  entityId?: string;
}

/** The sidebar of one deployment. */
export interface Sidebar {
  /** What waits for a person: references to entities, never a second node of one. */
  needsYou: AttentionItem[];
  work: { rows: RowSection[]; types: TypeFolder[] };
  governance: { rules: RuleTypeSection[]; domains: ChainNode[]; types: TypeFolder[] };
  record: { types: TypeFolder[] };
}

/** What the sidebar reads of catalyst's inbox (`GET /v1/inbox`). */
export interface InboxLike {
  items: readonly { kind: string; id: string; title: string; evidence?: { entity?: string | null } }[];
}

/**
 * The entities whose type inherits its grounding (`grounding: inherited`
 * through `grounding_field`, such as a step's `Parent`), each listed under
 * the first entity that field names, when the model has it. Returns, per
 * parent ID, its children sorted by ID; an entity whose parent is missing
 * stays in its own type's folder.
 */
export function childrenByParent(model: ChainModel): Map<string, ChainNode[]> {
  const byParent = new Map<string, ChainNode[]>();
  for (const node of model.nodes.values()) {
    if (node.kind !== "artifact") continue;
    const type = model.types?.get(node.typePrefix);
    if (type?.grounding !== "inherited" || !type.grounding_field) continue;
    const parentId = (node.links[type.grounding_field] ?? []).find((id) => {
      const parent = model.nodes.get(id);
      return parent?.kind === "artifact" && parent.id !== node.id;
    });
    if (!parentId) continue;
    byParent.set(parentId, [...(byParent.get(parentId) ?? []), node]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.id.localeCompare(b.id));
  return byParent;
}

/** An entity and, recursively, what is listed under it; `seen` breaks a cycle of parents. */
function entryOf(node: ChainNode, byParent: Map<string, ChainNode[]>, seen: Set<string>): EntityEntry {
  seen.add(node.id);
  const children = (byParent.get(node.id) ?? []).filter((c) => !seen.has(c.id)).map((c) => entryOf(c, byParent, seen));
  return { node, children };
}

/**
 * One type's folder: its entities not listed under a parent, by phase —
 * under way and not started oldest first (by ID), done newest first.
 */
function typeFolder(
  model: ChainModel,
  prefix: string,
  nodes: ChainNode[],
  byParent: Map<string, ChainNode[]>,
  nested: Set<string>,
): TypeFolder {
  const type = model.types?.get(prefix);
  const own = nodes.filter((n) => !nested.has(n.id));
  const phases = PHASES.map(({ phase, label, glyph }) => {
    const inPhase = own.filter((n) => phaseOf(n, type) === phase).sort((a, b) => a.id.localeCompare(b.id));
    if (phase === "done") inPhase.reverse();
    return { phase, label, glyph, entries: inPhase.map((n) => entryOf(n, byParent, new Set())) };
  }).filter((f) => f.entries.length > 0);
  return { typePrefix: prefix, label: typeLabel(model, prefix), count: own.length, phases };
}

/**
 * The deployment's sidebar: Needs you (the inbox's items), Work (the
 * roadmaps, then the work types), Governance (the rule documents with Rules
 * of Rules first, the domains, the governing types) and Record (the other
 * types). Types are in reading order (`orderTypes`); a type every one of
 * whose entities is listed under a parent has no folder of its own.
 */
export function buildSidebar(model: ChainModel, inbox?: InboxLike): Sidebar {
  const { artifacts, rules, domains } = buildTreeSections(model);
  const byPrefix = new Map(artifacts.sections.map((s) => [s.typePrefix, s.nodes]));
  const byParent = childrenByParent(model);
  const nested = new Set([...byParent.values()].flat().map((n) => n.id));
  const typeOf = (p: string) => model.types?.get(p);
  const roles = typeRoles(byPrefix.keys(), typeOf);

  const folders = (role: TypeRole): TypeFolder[] =>
    orderTypes(
      [...byPrefix.keys()].filter((p) => roles.get(p) === role),
      typeOf,
    )
      .map((p) => typeFolder(model, p, byPrefix.get(p) ?? [], byParent, nested))
      .filter((f) => f.count > 0 || !(byPrefix.get(f.typePrefix) ?? []).some((n) => nested.has(n.id)));

  const rows = [...model.nodes.values()].filter((n): n is RowNode => n.kind === "row");
  const needsYou: AttentionItem[] = (inbox?.items ?? []).map((item) => {
    const candidate = item.evidence?.entity ?? item.id;
    const entityId = model.nodes.has(candidate) ? candidate : undefined;
    return { kind: item.kind, id: item.id, title: item.title, ...(entityId ? { entityId } : {}) };
  });

  return {
    needsYou,
    work: { rows: buildRowSections(rows, model.types), types: folders("work") },
    governance: { rules: rules.sections, domains, types: folders("governance") },
    record: { types: folders("record") },
  };
}

/** What the deployment's line says of its health: `✅ check passes`, or the errors and warnings it has. */
export function healthLine(report?: { errorCount: number; warningCount: number }, kernel?: string | null): string {
  const parts: string[] = [];
  if (report) {
    if (report.errorCount > 0) parts.push(`❌ ${String(report.errorCount)} error${report.errorCount === 1 ? "" : "s"}`);
    if (report.warningCount > 0)
      parts.push(`⚠️ ${String(report.warningCount)} warning${report.warningCount === 1 ? "" : "s"}`);
    if (parts.length === 0) parts.push("✅ check passes");
  }
  if (kernel) parts.push(`kernel ${kernel}`);
  return parts.join(" · ");
}
