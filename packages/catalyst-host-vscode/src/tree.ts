import type { ChainModel, ChainNode } from "catalyst-core";

/**
 * The sidebar tree's top-level sections — one per chain-model layer.
 * "rule-of-rules" isn't its own `NodeKind` in the model (an `rr`-prefixed
 * rule is still `kind: "rule"`), but the roadmap's "four layers" framing
 * calls it out as its own tree section, so it's split out here for
 * display only. Dev-artifact nodes are likewise split by their own
 * `artifactType` (`requirement`/`bug`/`house-keeping`) into three
 * separate sections rather than one merged "Dev Artifacts" bucket, each
 * getting its own entity-type identity (icon, tooltip). Work items are
 * omitted entirely: no project-management plugin is active in this
 * deployment, so the model never has any.
 */
export type TreeSectionKind =
  | "requirement"
  | "bug"
  | "house-keeping"
  | "rule"
  | "rule-of-rules"
  | "domain"
  | "feature";

export interface TreeSection {
  kind: TreeSectionKind;
  label: string;
  nodes: ChainNode[];
}

const SECTION_LABELS: Record<TreeSectionKind, string> = {
  requirement: "Requirements",
  bug: "Bugs",
  "house-keeping": "House-keeping",
  rule: "Rules",
  "rule-of-rules": "Rules of Rules",
  domain: "Domains",
  feature: "Features",
};

const SECTION_ORDER: TreeSectionKind[] = [
  "requirement",
  "bug",
  "house-keeping",
  "rule",
  "rule-of-rules",
  "domain",
  "feature",
];

function sectionKindOf(node: ChainNode): TreeSectionKind | null {
  if (node.kind === "rule")
    return node.docPrefix === "rr" ? "rule-of-rules" : "rule";
  if (node.kind === "dev-artifact") return node.artifactType;
  if (node.kind === "work-item") return null;
  if (node.kind === "roadmap") return null; // own section — see roadmaps.ts
  return node.kind;
}

/** Groups a chain model's nodes into the sidebar tree's sections, sorted by id within each. */
export function buildTreeSections(model: ChainModel): TreeSection[] {
  const byKind = new Map<TreeSectionKind, ChainNode[]>();

  for (const node of model.nodes.values()) {
    const kind = sectionKindOf(node);
    if (kind === null) continue;
    const list = byKind.get(kind) ?? [];
    list.push(node);
    byKind.set(kind, list);
  }

  for (const list of byKind.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }

  return SECTION_ORDER.map((kind) => ({
    kind,
    label: SECTION_LABELS[kind],
    nodes: byKind.get(kind) ?? [],
  }));
}
