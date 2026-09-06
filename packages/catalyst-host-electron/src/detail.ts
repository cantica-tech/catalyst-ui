import type {
  ChainModel,
  ChainNode,
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
 * Builds one node's detail payload for the renderer's `NodeDetail`
 * mount: itself, upstream/downstream (resolved chain-model edges), and
 * any open proposal targeting it. Same shape and behavior as
 * `catalyst-host-vscode`'s own `buildNodeDetail` — kept as a local,
 * independent copy rather than a cross-host import, matching how
 * neither host package exposes its adapter logic for the other to
 * import today.
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
