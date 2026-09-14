import type { ChainModel, ChainNode } from "catalyst-core";

export function formatNodeLabel(node: ChainNode): string {
  const displayName = node.name ?? node.title;
  // Strip 8-character userid suffix (e.g. -yCNjAMXO) if present
  const idWithoutUserid = node.id.replace(
    /-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8}$/,
    "",
  );
  let user = "";
  if (node.kind === "dev-artifact" || node.kind === "feature") {
    user = node.signedOffBy ?? "";
  } else if (node.kind === "roadmap") {
    user = node.signedOffBy;
  }
  const userSuffix = user ? ` - _${user}_` : "";
  return `${displayName} [${idWithoutUserid}${userSuffix}]`;
}

/**
 * The sidebar tree's top-level sections — one per chain-model layer.
 * "rule-of-rules" isn't its own `NodeKind` in the model (an `rr`-prefixed
 * rule is still `kind: "rule"`), but the roadmap's "four layers" framing
 * calls it out as its own tree section, so it's split out here for
 * display only. Dev-artifact nodes are grouped under one "Dev Artifacts"
 * parent folder, itself split by the node's own `artifactType`
 * (`requirement`/`bug`/`house-keeping`) into three sub-sections, each
 * getting its own entity-type identity (icon, tooltip). Work items are
 * omitted entirely: no project-management plugin is active in this
 * deployment, so the model never has any.
 */
export type DevArtifactSectionKind = "requirement" | "bug" | "house-keeping";
export type TreeSectionKind =
  DevArtifactSectionKind | "rule" | "rule-of-rules" | "domain" | "feature";

export interface TreeSection {
  kind: TreeSectionKind;
  label: string;
  nodes: ChainNode[];
}

/** The "Dev Artifacts" parent folder, wrapping its three artifactType sub-sections. */
export interface DevArtifactGroup {
  label: string;
  sections: TreeSection[];
}

export interface TreeSections {
  devArtifacts: DevArtifactGroup;
  sections: TreeSection[];
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

const DEV_ARTIFACT_SECTION_ORDER: DevArtifactSectionKind[] = [
  "requirement",
  "bug",
  "house-keeping",
];

const SECTION_ORDER: TreeSectionKind[] = [
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
export function buildTreeSections(model: ChainModel): TreeSections {
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

  const devArtifacts: DevArtifactGroup = {
    label: "Dev Artifacts",
    sections: DEV_ARTIFACT_SECTION_ORDER.map((kind) => ({
      kind,
      label: SECTION_LABELS[kind],
      nodes: byKind.get(kind) ?? [],
    })),
  };

  const sections = SECTION_ORDER.map((kind) => ({
    kind,
    label: SECTION_LABELS[kind],
    nodes: byKind.get(kind) ?? [],
  }));

  return { devArtifacts, sections };
}
