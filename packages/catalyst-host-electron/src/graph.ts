import type { ChainModel, NodeKind } from "catalyst-core";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  title: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const COLUMN_ORDER: NodeKind[] = ["work-item", "dev-artifact", "rule", "domain", "feature"];
const COLUMN_WIDTH = 220;
const ROW_HEIGHT = 60;

/**
 * Deterministic, non-physics layout: one column per node kind (in chain
 * order), rows within a column sorted and evenly spaced by id. A
 * force-directed layout is non-deterministic and much harder to
 * meaningfully unit test; "room to breathe" only needs nodes not
 * cramming into a single dense mass, not real physics.
 */
export function computeGraphLayout(model: ChainModel): GraphLayout {
  const nodes: GraphNode[] = [];

  COLUMN_ORDER.forEach((kind, columnIndex) => {
    const kindNodes = Array.from(model.nodes.values())
      .filter((node) => node.kind === kind)
      .sort((a, b) => a.id.localeCompare(b.id));

    kindNodes.forEach((node, rowIndex) => {
      nodes.push({
        id: node.id,
        kind: node.kind,
        title: node.title,
        x: columnIndex * COLUMN_WIDTH,
        y: rowIndex * ROW_HEIGHT,
      });
    });
  });

  const edges: GraphEdge[] = [];
  for (const [from, tos] of model.edges) {
    for (const to of tos) edges.push({ from, to });
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  return { nodes, edges };
}
