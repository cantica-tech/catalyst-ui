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

  const addEdge = (from: string, to: string) => {
    if (from === to) return;
    if (!nodes.has(from) || !nodes.has(to)) return;
    if (!edges.has(from)) edges.set(from, new Set());
    edges.get(from)!.add(to);
    if (!reverseEdges.has(to)) reverseEdges.set(to, new Set());
    reverseEdges.get(to)!.add(from);
  };

  for (const node of nodes.values()) {
    for (const ref of node.references) {
      addEdge(node.id, ref);
    }
    if (node.kind === "rule" && node.domain) {
      addEdge(node.id, node.domain);
    }
    if (node.kind === "dev-artifact") {
      if (node.feature) addEdge(node.id, node.feature);
      for (const t of node.targets) addEdge(node.id, t);
    }
    if (node.kind === "roadmap" && node.linked) {
      addEdge(node.id, node.linked);
    }
  }

  return { nodes, edges, reverseEdges, definitionsById };
}
