import type { ChainNode, ModuleType } from "catalyst-core";

import { SHOW_DETAIL_COMMAND } from "./constants.js";

/**
 * Catalyst: Search Items (REQ-000076-UVqkd7cL): a QuickPick over every entity the Instances tree holds, every
 * deployment, built from the tree's own model — no catalyst call while the person types. Matching and its
 * highlights are QuickPick's own, on the label, the description (the status) and the detail (the deployment).
 */

/** One entity node of the tree, with the deployment it belongs to. */
export interface SearchEntry {
  corpusRoot: string;
  /** The deployment's name, as the tree's top-level entry shows it. */
  deployment: string;
  node: ChainNode;
  type?: ModuleType;
}

/** One QuickPick item; `corpusRoot` and `id` say which node it reveals. */
export interface SearchItem {
  label: string;
  description: string;
  detail?: string;
  corpusRoot: string;
  id: string;
}

/** The QuickPick's options: a status, a type or a deployment typed filters too. */
export const SEARCH_OPTIONS = {
  title: "Search Items",
  placeHolder: "Search the items of the Instances view: an ID, a name, a status or a type",
  matchOnDescription: true,
  matchOnDetail: true,
} as const;

/** What the search says when there is nothing to search. */
export const NO_DEPLOYMENT = "Catalyst: no catalyst deployment is open in this workspace — nothing to search.";

/** An ID without its creator's userid suffix, as the tree shows it: `REQ-000076-UVqkd7cL` → `REQ-000076`. */
export function shortId(id: string): string {
  return id.replace(/-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8}$/, "");
}

/** A title without the ID it may repeat at its start (a domain's "`AGENT` — Run …"). */
function bareTitle(node: ChainNode): string {
  const title = (node.title || (node.name ?? "")).trim();
  const id = node.kind === "domain" ? node.code : node.id;
  const stripped = title.replace(new RegExp(`^\`?(${escape(id)}|${escape(shortId(id))})\`?\\s*(—|-|:)?\\s*`), "");
  return stripped || title;
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A rule's status is its first words (`✅ working`), never its whole parenthesised history. */
function statusOf(node: ChainNode): string {
  if (node.kind === "artifact" || node.kind === "row") return node.status.trim() || "(no status)";
  if (node.kind === "rule") {
    const first = node.status.split(/[(.;]/)[0].trim();
    return first || node.status.trim();
  }
  return "";
}

/** The type a person reads: the module type's name, else `Rule`, `Domain`. */
function typeName(entry: SearchEntry): string {
  const { node } = entry;
  if (node.kind === "artifact" || node.kind === "row") return entry.type?.name ?? node.typePrefix;
  if (node.kind === "rule") return "Rule";
  if (node.kind === "domain") return "Domain";
  return "Work item";
}

/**
 * The QuickPick's items: label `<ID> · <title>`, description the status and the type, detail the deployment —
 * only when more than one deployment is open. Each entity once, in the tree's order.
 */
export function buildSearchItems(entries: readonly SearchEntry[]): SearchItem[] {
  const deployments = new Set(entries.map((e) => e.corpusRoot));
  const seen = new Set<string>();
  const items: SearchItem[] = [];
  for (const entry of entries) {
    const key = `${entry.corpusRoot}\0${entry.node.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const id = entry.node.kind === "domain" ? entry.node.code : shortId(entry.node.id);
    const title = bareTitle(entry.node);
    const status = statusOf(entry.node);
    items.push({
      label: title && title !== id ? `${id} · ${title}` : id,
      description: [status, typeName(entry)].filter(Boolean).join(" · "),
      ...(deployments.size > 1 ? { detail: entry.deployment } : {}),
      corpusRoot: entry.corpusRoot,
      id: entry.node.id,
    });
  }
  return items;
}

/**
 * What choosing an item does: select and focus its one node in the tree (its sections expanded by the reveal),
 * then open its document as a click on the node does — the node's own command and arguments.
 */
export function searchSelection(item: Pick<SearchItem, "corpusRoot" | "id">): {
  reveal: { corpusRoot: string; id: string };
  revealOptions: { select: true; focus: true; expand: false };
  open: { command: string; args: [string, string] };
} {
  return {
    reveal: { corpusRoot: item.corpusRoot, id: item.id },
    revealOptions: { select: true, focus: true, expand: false },
    open: { command: SHOW_DETAIL_COMMAND, args: [item.corpusRoot, item.id] },
  };
}
