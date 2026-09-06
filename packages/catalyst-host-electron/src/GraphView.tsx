import type { GraphLayout } from "./graph.js";

export interface GraphViewProps {
  layout: GraphLayout;
  onSelectNode?: (id: string) => void;
}

const NODE_RADIUS = 6;
const PADDING = 40;

/**
 * Plain SVG rendering of a precomputed layout — no charting/graph
 * library, consistent with this project's minimal-dependency pattern.
 * Presentational only, same split as `catalyst-ui`'s `NodeDetail`: this
 * component does no layout math itself, `computeGraphLayout` already did.
 */
export function GraphView({ layout, onSelectNode }: GraphViewProps) {
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const width = Math.max(0, ...layout.nodes.map((n) => n.x)) + PADDING * 2;
  const height = Math.max(0, ...layout.nodes.map((n) => n.y)) + PADDING * 2;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <g transform={`translate(${PADDING}, ${PADDING})`}>
        {layout.edges.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}->${edge.to}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="currentColor"
              strokeOpacity={0.3}
            />
          );
        })}
        {layout.nodes.map((node) => (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onClick={() => onSelectNode?.(node.id)}
            style={{ cursor: onSelectNode ? "pointer" : "default" }}
          >
            <circle r={NODE_RADIUS} />
            <text x={NODE_RADIUS + 4} y={4}>
              {node.id}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
