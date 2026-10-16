import type {
  ChainModel,
  ChainNode,
  IamRole,
  IamUser,
  NodeDetailPayload,
  Proposal,
  ReferenceInfo,
} from "catalyst-core";

function resolveAll(model: ChainModel, ids: Set<string> | undefined): ChainNode[] {
  if (!ids) return [];
  const nodes: ChainNode[] = [];
  for (const id of ids) {
    const node = model.nodes.get(id);
    if (node) nodes.push(node);
  }
  return nodes.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Builds the extension -> webview payload for one node: itself, plus what
 * it's justified by (upstream, its resolved references), what it
 * produces (downstream, whatever resolves a reference back to it), and
 * any open (non-`applied`) proposal targeting it. Returns null for an
 * unknown id rather than throwing — the tree and the model it's built
 * from can only ever hand back ids that exist, but a stale command
 * invocation after a corpus change is still possible.
 */
export function buildNodeDetail(
  model: ChainModel,
  nodeId: string,
  openProposalsByTarget: Map<string, Proposal[]>,
): NodeDetailPayload | null {
  const node = model.nodes.get(nodeId);
  if (!node) return null;

  return {
    node,
    upstream: resolveAll(model, model.edges.get(nodeId)),
    downstream: resolveAll(model, model.reverseEdges.get(nodeId)),
    openProposals: openProposalsByTarget.get(nodeId) ?? [],
  };
}

/** Builds a user's detail payload: itself plus the role objects its `roles` array names (cross-referenced by name, since IAM has no ID-shaped scheme). */
export function buildIamUserDetail(user: IamUser, allRoles: IamRole[]): { user: IamUser; roles: IamRole[] } {
  const names = new Set(user.roles);
  return {
    user,
    roles: allRoles.filter((r) => names.has(r.name)).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Builds a role's detail payload: itself plus every user whose `roles` array names it. */
export function buildIamRoleDetail(role: IamRole, allUsers: IamUser[]): { role: IamRole; users: IamUser[] } {
  return {
    role,
    users: allUsers.filter((u) => u.roles.includes(role.name)).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

const SUMMARY_MAX = 180;

/**
 * A description from an entity's full text, when the parser found none:
 * its `## Description` or `## Summary` section, else the first paragraph
 * after its field table — never the template prose above the table.
 */
export function describeFromContent(content: string): string {
  const lines = content.split("\n");
  for (const heading of ["Description", "Summary"]) {
    const at = lines.findIndex((l) => l.trim() === `## ${heading}`);
    if (at >= 0) {
      const body: string[] = [];
      for (const line of lines.slice(at + 1)) {
        if (line.startsWith("## ")) break;
        body.push(line);
      }
      const text = body.join("\n").trim();
      if (text) return text;
    }
  }
  const tableEnd = lines.reduce((last, l, i) => (l.trim().startsWith("|") ? i : last), -1);
  const paragraph: string[] = [];
  for (const line of lines.slice(tableEnd + 1)) {
    const t = line.trim();
    if (!t) {
      if (paragraph.length) break;
      continue;
    }
    if (t.startsWith("#") || t.startsWith("|")) continue;
    paragraph.push(t);
  }
  return paragraph.join(" ");
}

/**
 * A one-line description of a node for a hover: its own description
 * (`## Description` / `## Summary`, a rule's body, a domain's `## Scope`)
 * with the markdown stripped, cut at the first sentence or SUMMARY_MAX.
 */
export function shortSummary(node: ChainNode): string {
  const raw =
    ("description" in node && node.description) ||
    ("content" in node && node.content ? describeFromContent(node.content) : "");
  const plain = raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(plain)?.[1] ?? plain;
  return sentence.length > SUMMARY_MAX ? `${sentence.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : sentence;
}

function info(node: ChainNode): ReferenceInfo {
  // The readable title (an index row's, a rule's) over the slug-like Name
  // field; never backticks.
  const title = node.title && node.title !== node.id ? node.title : "";
  const name = (title || node.name || node.id).replace(/`/g, "").trim();
  return { id: node.id, kind: node.kind, name, summary: shortSummary(node) };
}

const SHORT_ID = /^([A-Z][A-Z0-9]*-\d{3,6})-[A-Za-z0-9]{8}$/;

/**
 * The entities `texts` cite (`REQ-000014-UVqkd7cL`), keyed by the token
 * that cites them: every node of the model whose full ID occurs in the
 * text, plus a short form (`REQ-000014` for `REQ-000014-UVqkd7cL`) when it
 * occurs and names exactly one node. `exclude` (the panel's own node) is
 * left out. The webview links exactly these tokens.
 */
export function buildReferenceTable(
  model: ChainModel,
  texts: readonly string[],
  exclude?: string,
): Record<string, ReferenceInfo> {
  const text = texts.join("\n");
  const table: Record<string, ReferenceInfo> = {};
  const shortForms = new Map<string, ChainNode | null>();
  for (const node of model.nodes.values()) {
    const short = SHORT_ID.exec(node.id)?.[1];
    if (short) shortForms.set(short, shortForms.has(short) ? null : node);
  }
  const occurs = (token: string): boolean => {
    let from = 0;
    for (;;) {
      const at = text.indexOf(token, from);
      if (at < 0) return false;
      const before = text[at - 1];
      const after = text[at + token.length];
      if (!(before && /[\w-]/.test(before)) && !(after && /[\w-]/.test(after))) return true;
      from = at + 1;
    }
  };
  for (const node of model.nodes.values()) {
    if (node.id !== exclude && occurs(node.id)) table[node.id] = info(node);
  }
  for (const [short, node] of shortForms) {
    if (node && node.id !== exclude && occurs(short)) table[short] = info(node);
  }
  return table;
}

/** The references of a node panel: its content, and its upstream/downstream lists. */
export function referencesForNode(model: ChainModel, payload: NodeDetailPayload): Record<string, ReferenceInfo> {
  const node = payload.node;
  const text = "content" in node && node.content ? node.content : "description" in node ? node.description : "";
  const listed = [...payload.upstream, ...payload.downstream].map((n) => n.id).join(" ");
  return buildReferenceTable(model, [text, listed], node.id);
}
