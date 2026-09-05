import type { ChainModel, ChainNode, NodeDetailPayload } from "catalyst-core";

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
 * it's justified by (upstream, its resolved references) and what it
 * produces (downstream, whatever resolves a reference back to it).
 * Returns null for an unknown id rather than throwing — the tree and the
 * model it's built from can only ever hand back ids that exist, but a
 * stale command invocation after a corpus change is still possible.
 */
export function buildNodeDetail(
  model: ChainModel,
  nodeId: string,
): NodeDetailPayload | null {
  const node = model.nodes.get(nodeId);
  if (!node) return null;

  return {
    node,
    upstream: resolveAll(model, model.edges.get(nodeId)),
    downstream: resolveAll(model, model.reverseEdges.get(nodeId)),
  };
}
