import type {
  ChainModel,
  ChainNode,
  ParseResult,
  SourceLocation,
} from "./types.js";

/**
 * Assembles a full parse pass into one typed chain model: dedupes node
 * definitions (first occurrence wins the canonical node; every occurrence is
 * still recorded in `definitionsById` so id-reuse can be detected), then
 * resolves each node's raw references into traversable edges.
 */
export function buildChainModel(parseResult: ParseResult): ChainModel {
  const nodes = new Map<string, ChainNode>();
  const definitionsById = new Map<string, SourceLocation[]>();

  for (const file of parseResult.files) {
    for (const node of file.nodes) {
      const locations = definitionsById.get(node.id) ?? [];
      locations.push(node.location);
      definitionsById.set(node.id, locations);
      if (!nodes.has(node.id)) nodes.set(node.id, node);
    }
  }

  const edges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();

  for (const node of nodes.values()) {
    for (const ref of node.references) {
      if (!nodes.has(ref)) continue;

      if (!edges.has(node.id)) edges.set(node.id, new Set());
      edges.get(node.id)!.add(ref);

      if (!reverseEdges.has(ref)) reverseEdges.set(ref, new Set());
      reverseEdges.get(ref)!.add(node.id);
    }
  }

  return { nodes, edges, reverseEdges, definitionsById };
}
