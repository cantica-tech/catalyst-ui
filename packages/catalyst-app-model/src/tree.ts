import { cleanRuleTitle, type ChainModel, type ChainNode, type ModuleType } from "catalyst-core";

export function getNodeUser(node: ChainNode): string | undefined {
  const user = node.kind === "artifact" || node.kind === "row" || node.kind === "rule" ? node.signedOffBy : undefined;
  if (!user) return undefined;
  return user.replace(/^_+|_+$/g, "") || undefined;
}

/** A closed state whose word says the work was dropped rather than done. */
const DROPPED_RE = /\b(abandon\w*|reject\w*|cancel\w*|wont[- ]?fix|won't fix|retired|obsolete|duplicate)\b/i;

/**
 * An artifact's or row's mark, from its type alone (catalyst roadmap R6.7):
 * a closed state is done (✅) or dropped (🗑, when its word says so), the
 * type's initial state or no status is not started (…), any other state is
 * under way (⏳). A rule keeps the marks its own status text carries.
 */
export function getNodeStatusGlyph(node: ChainNode, type?: ModuleType): string {
  if (node.kind === "artifact" || node.kind === "row") {
    const status = node.status.trim();
    if (node.closed) return DROPPED_RE.test(status) ? "🗑 " : "✅ ";
    if (!status || status === type?.initial) return "… ";
    return "⏳ ";
  }
  if (node.kind === "rule") {
    if (node.status.includes("❌")) return "❌ ";
    if (node.status.includes("🗑")) return "🗑 ";
    if (node.status.includes("⚠️")) return "⚠️ ";
    const s = node.status.toLowerCase();
    if (/\b(not[- ]implemented|unimplemented|incomplete|buggy|untested|broken|failed)\b/.test(s)) return "❌ ";
    return "✅ ";
  }
  return "";
}

export function formatNodeLabel(node: ChainNode, type?: ModuleType): string {
  const idRegex =
    /^([a-z]+-[A-Z0-9_]+-\d{3,6}(?:-\d+)?|[A-Z0-9_]+-\d{3,6}(?:-\d+)?)(?:-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8})?(?:-(.*))?$/;
  const match = idRegex.exec(node.id);

  let idWithoutUserid: string;
  let slugFromId: string | undefined;

  if (match) {
    idWithoutUserid = match[1];
    slugFromId = match[2];
  } else {
    idWithoutUserid = node.id.replace(/-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8}$/, "");
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
    /^(?:working|not implemented|not-implemented|unimplemented|implemented|fixed)$/i.test(rawName.trim()) ||
    /^(?:working|not implemented|not-implemented|unimplemented|implemented|fixed)$/i.test(cleanedName.trim())
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

  // An ID shown as the name keeps its dashes; a slug or title reads as words.
  const displayName = rawName === idWithoutUserid ? rawName : rawName.replace(/-/g, " ").replace(/\s+/g, " ").trim();

  const user = getNodeUser(node);
  const userSuffix = user ? ` - ${user}` : "";
  const statusPrefix = getNodeStatusGlyph(node, type);
  // The bracket repeats nothing the label already starts with.
  const bracket = `${idWithoutUserid}${userSuffix}`;
  const same = (s: string) =>
    s
      .replace(/[-\s]+/g, " ")
      .trim()
      .toLowerCase();
  const label = same(displayName);
  if (label.startsWith(same(bracket))) return `${statusPrefix}${displayName}`;
  if (label.startsWith(same(idWithoutUserid))) {
    return user ? `${statusPrefix}${displayName} [${user}]` : `${statusPrefix}${displayName}`;
  }
  return `${statusPrefix}${displayName} [${bracket}]`;
}

/** The artifacts of one module type, under the type's own plural name. */
export interface TypeSection {
  typePrefix: string;
  label: string;
  nodes: ChainNode[];
}

/** The "Artifacts" parent folder: one section per module type that has artifacts kept as files. */
export interface ArtifactGroup {
  label: string;
  sections: TypeSection[];
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
  artifacts: ArtifactGroup;
  rules: RuleGroup;
  domains: ChainNode[];
}

export function ruleTypeLabel(prefix: string): string {
  const p = prefix.toLowerCase();
  if (p === "rr") return "Rules of Rules";
  if (p === "fw" || p === "framework") return "Framework Rules";
  if (p === "ui") return "UI Rules";
  if (p === "br" || p === "business") return "Business Rules";
  if (p === "app") return "App Rules";
  if (p.length <= 3) return `${prefix.toUpperCase()} Rules`;
  return `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} Rules`;
}

/** A type's label: its plural name, or its prefix when the model has no type for it. */
export function typeLabel(model: ChainModel, prefix: string): string {
  return model.types?.get(prefix)?.plural_name ?? prefix;
}

/**
 * Groups a chain model's nodes into the sidebar tree: the module's artifacts
 * by type (every declared type that keeps files, in the order of their
 * plural names, plus any prefix the model has artifacts of but no type for),
 * rules by document prefix, and domains — each sorted by id.
 */
export function buildTreeSections(model: ChainModel): TreeSections {
  const byType = new Map<string, ChainNode[]>();
  const rulesByPrefix = new Map<string, ChainNode[]>();
  const domains: ChainNode[] = [];
  const rowTypes = new Set<string>();

  for (const node of model.nodes.values()) {
    if (node.kind === "artifact") {
      byType.set(node.typePrefix, [...(byType.get(node.typePrefix) ?? []), node]);
    } else if (node.kind === "row") {
      rowTypes.add(node.typePrefix);
    } else if (node.kind === "rule") {
      const prefix = node.docPrefix || "rule";
      rulesByPrefix.set(prefix, [...(rulesByPrefix.get(prefix) ?? []), node]);
    } else if (node.kind === "domain") {
      domains.push(node);
    }
  }
  const byId = (a: ChainNode, b: ChainNode) => a.id.localeCompare(b.id);
  for (const list of byType.values()) list.sort(byId);
  for (const list of rulesByPrefix.values()) list.sort(byId);
  domains.sort(byId);

  const prefixes = new Set([...(model.types?.keys() ?? []), ...byType.keys()]);
  for (const p of rowTypes) if (!byType.has(p)) prefixes.delete(p);
  const ordered = [...prefixes].sort((a, b) => typeLabel(model, a).localeCompare(typeLabel(model, b)));

  const sortedPrefixes = [...rulesByPrefix.keys()].sort((a, b) => {
    if (a === "rr") return -1;
    if (b === "rr") return 1;
    return ruleTypeLabel(a).localeCompare(ruleTypeLabel(b));
  });

  return {
    artifacts: {
      label: "Artifacts",
      sections: ordered.map((typePrefix) => ({
        typePrefix,
        label: typeLabel(model, typePrefix),
        nodes: byType.get(typePrefix) ?? [],
      })),
    },
    rules: {
      label: "Rules",
      sections: sortedPrefixes.map((prefix) => ({
        prefix,
        label: ruleTypeLabel(prefix),
        nodes: rulesByPrefix.get(prefix) ?? [],
      })),
    },
    domains,
  };
}
