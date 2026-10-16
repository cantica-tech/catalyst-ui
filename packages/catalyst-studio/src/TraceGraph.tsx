import type { ElkNode } from "elkjs/lib/elk-api.js";
import { useEffect, useState } from "react";

import type { Impact } from "./client.js";
import { ELK } from "./elk.js";

export interface PlacedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** The entity asked about, or the side it was reached on. */
  role: "focus" | "upstream" | "downstream";
}

export interface PlacedEdge {
  id: string;
  field: string;
  points: { x: number; y: number }[];
}

export interface TraceLayout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}

const NODE_W = 170;
const NODE_H = 36;

/**
 * The trace laid out by elkjs (Studio decision 4), left to right: what the
 * entity rests on, the entity, what rests on it. Each edge points from the
 * entity that carries the reference field to the one it cites.
 */
export async function layoutTrace(impact: Impact): Promise<TraceLayout> {
  const nodes = new Map<string, PlacedNode["role"]>([[impact.id, "focus"]]);
  for (const r of impact.upstream ?? []) if (!nodes.has(r.id)) nodes.set(r.id, "upstream");
  for (const r of impact.downstream ?? []) if (!nodes.has(r.id)) nodes.set(r.id, "downstream");
  // left to right: an upstream entity points to the nearer one citing it, the
  // nearer one to a downstream entity; each edge keeps its reference field
  const edges = [
    ...(impact.upstream ?? []).map((r) => ({ source: r.id, target: r.via.id, field: r.via.field })),
    ...(impact.downstream ?? []).map((r) => ({ source: r.via.id, target: r.id, field: r.via.field })),
  ].filter((e) => nodes.has(e.source) && nodes.has(e.target) && e.source !== e.target);
  const input: ElkNode = {
    id: "trace",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "16",
      "elk.layered.spacing.nodeNodeBetweenLayers": "48",
    },
    children: [...nodes.keys()].map((id) => ({ id, width: NODE_W, height: NODE_H })),
    edges: edges.map((e, i) => ({ id: `e${String(i)}`, sources: [e.source], targets: [e.target] })),
  };
  const graph = await new ELK().layout(input);
  const placed = (graph.children ?? []).map((c) => ({
    id: c.id,
    label: c.id.replace(/-[A-Za-z0-9]{8}$/, ""),
    x: c.x ?? 0,
    y: c.y ?? 0,
    width: c.width ?? NODE_W,
    height: c.height ?? NODE_H,
    role: nodes.get(c.id) ?? "downstream",
  }));
  const lines = (graph.edges ?? []).map((e, i) => {
    const s = e.sections?.[0];
    return {
      id: e.id,
      field: edges[i]?.field ?? "",
      points: s ? [s.startPoint, ...(s.bendPoints ?? []), s.endPoint] : [],
    };
  });
  return { width: graph.width ?? 0, height: graph.height ?? 0, nodes: placed, edges: lines };
}

/** The laid-out trace as SVG: each entity a focusable button that opens its page. */
export function TraceGraphView({ layout, onOpen }: { layout: TraceLayout; onOpen: (id: string) => void }) {
  const pad = 8;
  return (
    <svg
      className="trace-graph"
      width={layout.width + pad * 2}
      height={layout.height + pad * 2}
      role="group"
      aria-label="The trace as a graph"
    >
      <g transform={`translate(${String(pad)} ${String(pad)})`}>
        {layout.edges.map((e) => (
          <polyline
            key={e.id}
            className="trace-edge"
            points={e.points.map((p) => `${String(p.x)},${String(p.y)}`).join(" ")}
          >
            <title>{e.field}</title>
          </polyline>
        ))}
        {layout.nodes.map((n) => (
          <g
            key={n.id}
            className={`trace-node trace-node-${n.role}`}
            transform={`translate(${String(n.x)} ${String(n.y)})`}
            role="button"
            tabIndex={0}
            aria-label={`Open ${n.id}`}
            onClick={() => {
              onOpen(n.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen(n.id);
              }
            }}
          >
            <rect width={n.width} height={n.height} rx={6} />
            <text x={n.width / 2} y={n.height / 2} dominantBaseline="middle" textAnchor="middle">
              {n.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Lays the trace out, then draws it; the trees above stay the text equivalent. */
export function TraceGraph({ impact, onOpen }: { impact: Impact; onOpen: (id: string) => void }) {
  const [layout, setLayout] = useState<TraceLayout | null>(null);
  useEffect(() => {
    let live = true;
    layoutTrace(impact).then(
      (value) => {
        if (live) setLayout(value);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [impact]);
  if (!layout || layout.nodes.length < 2) return null;
  return (
    <figure className="trace-figure">
      <TraceGraphView layout={layout} onOpen={onOpen} />
      <figcaption className="muted">What it rests on, left; what rests on it, right.</figcaption>
    </figure>
  );
}
