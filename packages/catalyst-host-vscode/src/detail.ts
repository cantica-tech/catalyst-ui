import type {
  ChainModel,
  ChainNode,
  IamRole,
  IamUser,
  NodeDetailPayload,
  Proposal,
} from "catalyst-core";

function resolveAll(
  model: ChainModel,
  ids: Set<string> | undefined,
): ChainNode[] {
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
export function buildIamUserDetail(
  user: IamUser,
  allRoles: IamRole[],
): { user: IamUser; roles: IamRole[] } {
  const names = new Set(user.roles);
  return {
    user,
    roles: allRoles
      .filter((r) => names.has(r.name))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** Builds a role's detail payload: itself plus every user whose `roles` array names it. */
export function buildIamRoleDetail(
  role: IamRole,
  allUsers: IamUser[],
): { role: IamRole; users: IamUser[] } {
  return {
    role,
    users: allUsers
      .filter((u) => u.roles.includes(role.name))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
