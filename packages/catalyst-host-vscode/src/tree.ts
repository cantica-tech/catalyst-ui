import { cleanRuleTitle, type ChainModel, type ChainNode } from "catalyst-core";

export function getNodeUser(node: ChainNode): string | undefined {
  let user: string | undefined;
  if (
    node.kind === "dev-artifact" ||
    node.kind === "feature" ||
    node.kind === "rule" ||
    node.kind === "step"
  ) {
    user = node.signedOffBy || undefined;
  } else if (node.kind === "roadmap") {
    user = node.signedOffBy || undefined;
  }
  if (!user) return undefined;
  return user.replace(/^_+|_+$/g, "") || undefined;
}

export function getNodeStatusGlyph(node: ChainNode): string {
  const isBug =
    (node.kind === "dev-artifact" && node.artifactType === "bug") ||
    node.id.startsWith("BUG-");

  if (isBug) {
    const s = (
      "status" in node && typeof node.status === "string" ? node.status : ""
    )
      .toLowerCase()
      .trim();
    const isClosed =
      s.includes("fixed") ||
      s.includes("closed") ||
      s.includes("wontfix") ||
      s.includes("won't fix") ||
      s.includes("duplicate") ||
      s.includes("resolved") ||
      s.includes("done") ||
      s.includes("✅") ||
      s.includes("🗑");

    if (!isClosed) {
      return "🐛 ";
    }
  }

  const isTest =
    (node.kind === "dev-artifact" && node.artifactType === "test") ||
    node.id.startsWith("TEST-");
  if (isTest) {
    const s = (
      "status" in node && typeof node.status === "string" ? node.status : ""
    )
      .toLowerCase()
      .trim();
    if (s.includes("passing")) return "✅ ";
    if (s.includes("failing")) return "❌ ";
    if (s.includes("blocked")) return "⚠️ ";
    return "∅ "; // proposed, or unrecognized
  }

  const isRoadmap = node.kind === "roadmap" || node.id.startsWith("RM-");
  if (isRoadmap) {
    const s = (
      "status" in node && typeof node.status === "string" ? node.status : ""
    )
      .toLowerCase()
      .trim();

    const isDone =
      s.includes("done") ||
      s.includes("finished") ||
      s.includes("completed") ||
      s.includes("closed") ||
      s.includes("fixed") ||
      s.includes("✅");

    if (isDone) {
      return "✅ ";
    }

    const isInProgress =
      s.includes("in progress") ||
      s.includes("in-progress") ||
      s.includes("in_progress") ||
      s.includes("progress") ||
      s.includes("⏳");

    if (isInProgress) {
      return "⏳ ";
    }

    return "∅ ";
  }

  if (node.kind === "step") {
    switch (node.status) {
      case "done":
        return "✅ ";
      case "in-progress":
        return "⏳ ";
      case "abandoned":
        return "🗑 ";
      default:
        return "∅ ";
    }
  }

  if ("status" in node && typeof node.status === "string" && node.status) {
    if (node.status.includes("❌")) return "❌ ";
    if (node.status.includes("🗑")) return "🗑 ";
    if (node.status.includes("⚠️")) return "⚠️ ";
    const s = node.status.toLowerCase();
    if (
      s.includes("not implemented") ||
      s.includes("unimplemented") ||
      s.includes("not-implemented") ||
      s.includes("incomplete") ||
      s.includes("buggy") ||
      s.includes("partially fixed") ||
      s.includes("untested") ||
      s.includes("broken") ||
      s.includes("failed")
    ) {
      return "❌ ";
    }
    if (
      s.includes("working") ||
      s.includes("implemented") ||
      s.includes("fixed") ||
      node.status.includes("✅")
    ) {
      return "✅ ";
    }
  }

  const titleLower = (
    (node.name ?? "") +
    " " +
    (node.title ?? "")
  ).toLowerCase();
  if (
    titleLower.includes("not implemented") ||
    titleLower.includes("unimplemented") ||
    titleLower.includes("not-implemented") ||
    titleLower.includes("incomplete") ||
    titleLower.includes("buggy") ||
    titleLower.includes("untested")
  ) {
    return "❌ ";
  }

  if (node.kind === "rule") {
    return "✅ ";
  }
  return "";
}

export function formatNodeLabel(node: ChainNode): string {
  const idRegex =
    /^([a-z]+-[A-Z0-9_]+-\d{3,6}(?:-\d+)?|[A-Z0-9_]+-\d{3,6}(?:-\d+)?)(?:-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8})?(?:-(.*))?$/;
  const match = node.id.match(idRegex);

  let idWithoutUserid = node.id;
  let slugFromId: string | undefined;

  if (match) {
    idWithoutUserid = match[1];
    slugFromId = match[2];
  } else {
    idWithoutUserid = node.id.replace(
      /-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8}$/,
      "",
    );
  }

  let rawName = node.name ?? node.title;
  const cleanedName = cleanRuleTitle(rawName);

  if (
    !rawName ||
    !cleanedName ||
    rawName === node.id ||
    rawName.startsWith(node.id) ||
    cleanedName === node.id ||
    cleanedName.startsWith(node.id) ||
    /^(?:working|not implemented|not-implemented|unimplemented|implemented|fixed)$/i.test(
      rawName.trim(),
    ) ||
    /^(?:working|not implemented|not-implemented|unimplemented|implemented|fixed)$/i.test(
      cleanedName.trim(),
    )
  ) {
    rawName = slugFromId ? slugFromId.replace(/-/g, " ") : idWithoutUserid;
  } else {
    rawName = cleanedName;
  }

  if (match && slugFromId) {
    const fullPrefix = node.id.slice(0, node.id.length - slugFromId.length - 1);
    if (rawName.startsWith(fullPrefix + "-")) {
      rawName = rawName.slice(fullPrefix.length + 1);
    } else if (rawName.startsWith(idWithoutUserid + "-")) {
      rawName = rawName.slice(idWithoutUserid.length + 1);
    }
  }

  const displayName = rawName.replace(/-/g, " ").replace(/\s+/g, " ").trim();

  const user = getNodeUser(node);
  const userSuffix = user ? ` - ${user}` : "";
  const statusPrefix = getNodeStatusGlyph(node);
  return `${statusPrefix}${displayName} [${idWithoutUserid}${userSuffix}]`;
}

/**
 * The sidebar tree's top-level sections — one per chain-model layer.
 * "rule-of-rules" isn't its own `NodeKind` in the model (an `rr`-prefixed
 * rule is still `kind: "rule"`), but the roadmap's "four layers" framing
 * calls it out as its own tree section, so it's split out here for
 * display only. Dev-artifact nodes are grouped under one "Dev Artifacts"
 * parent folder, itself split by the node's own `artifactType`
 * (`requirement`/`bug`/`house-keeping`/`test`) into four sub-sections, each
 * getting its own entity-type identity (icon, tooltip). Work items are
 * omitted entirely: no project-management plugin is active in this
 * deployment, so the model never has any.
 */
export type DevArtifactSectionKind =
  "requirement" | "bug" | "house-keeping" | "test";
export type TreeSectionKind =
  DevArtifactSectionKind | "domain" | "feature" | "step";

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

export interface RuleTypeSection {
  prefix: string;
  label: string;
  nodes: ChainNode[];
}

/** The "Rules" parent folder, wrapping sub-sections per rule type / prefix. */
export interface RuleGroup {
  label: string;
  sections: RuleTypeSection[];
}

export interface TreeSections {
  devArtifacts: DevArtifactGroup;
  rules: RuleGroup;
  sections: TreeSection[];
}

const SECTION_LABELS: Record<TreeSectionKind, string> = {
  requirement: "Requirements",
  bug: "Bugs",
  "house-keeping": "House-keeping",
  test: "Tests",
  domain: "Domains",
  feature: "Features",
  step: "Steps",
};

const DEV_ARTIFACT_SECTION_ORDER: DevArtifactSectionKind[] = [
  "requirement",
  "bug",
  "house-keeping",
  "test",
];

const SECTION_ORDER: TreeSectionKind[] = ["domain", "feature", "step"];

export function ruleTypeLabel(prefix: string): string {
  const p = prefix.toLowerCase();
  if (p === "rr") return "Rules of Rules";
  if (p === "fw" || p === "framework") return "Framework Rules";
  if (p === "ui") return "UI Rules";
  if (p === "br" || p === "business") return "Business Rules";
  if (p === "app") return "App Rules";
  if (p === "hk" || p === "house-keeping") return "House-keeping Rules";
  if (p.length <= 3) return `${prefix.toUpperCase()} Rules`;
  return `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Rules`;
}

/** Groups a chain model's nodes into the sidebar tree's sections, sorted by id within each. */
export function buildTreeSections(model: ChainModel): TreeSections {
  const devArtifactsByKind = new Map<DevArtifactSectionKind, ChainNode[]>();
  const rulesByPrefix = new Map<string, ChainNode[]>();
  const otherByKind = new Map<TreeSectionKind, ChainNode[]>();

  for (const node of model.nodes.values()) {
    if (node.kind === "dev-artifact") {
      const list = devArtifactsByKind.get(node.artifactType) ?? [];
      list.push(node);
      devArtifactsByKind.set(node.artifactType, list);
    } else if (node.kind === "rule") {
      const prefix = node.docPrefix || "rule";
      const list = rulesByPrefix.get(prefix) ?? [];
      list.push(node);
      rulesByPrefix.set(prefix, list);
    } else if (
      node.kind === "domain" ||
      node.kind === "feature" ||
      node.kind === "step"
    ) {
      const list = otherByKind.get(node.kind) ?? [];
      list.push(node);
      otherByKind.set(node.kind, list);
    }
  }

  for (const list of devArtifactsByKind.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  for (const list of rulesByPrefix.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  for (const list of otherByKind.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }

  const devArtifacts: DevArtifactGroup = {
    label: "Dev Artifacts",
    sections: DEV_ARTIFACT_SECTION_ORDER.map((kind) => ({
      kind,
      label: SECTION_LABELS[kind],
      nodes: devArtifactsByKind.get(kind) ?? [],
    })),
  };

  const sortedPrefixes = [...rulesByPrefix.keys()].sort((a, b) => {
    if (a === "rr") return -1;
    if (b === "rr") return 1;
    return ruleTypeLabel(a).localeCompare(ruleTypeLabel(b));
  });

  const rules: RuleGroup = {
    label: "Rules",
    sections: sortedPrefixes.map((prefix) => ({
      prefix,
      label: ruleTypeLabel(prefix),
      nodes: rulesByPrefix.get(prefix) ?? [],
    })),
  };

  const sections = SECTION_ORDER.map((kind) => ({
    kind,
    label: SECTION_LABELS[kind],
    nodes: otherByKind.get(kind) ?? [],
  }));

  return { devArtifacts, rules, sections };
}
