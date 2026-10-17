import type { ElkNode } from "elkjs/lib/elk-api.js";
import { useEffect, useState } from "react";

import type { Graph, StudioClient } from "./client.js";
import { ELK } from "./elk.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

/** One box of the map: a declared type, or the kernel's rules and domains, with its counts. */
export interface MapNode {
  id: string;
  label: string;
  open: number;
  closed: number;
  /** Whether a board can show it (a type with states and artifacts). */
  board: boolean;
}

/** One arrow: a reference field, from the type carrying it to the type it names. */
export interface MapEdge {
  from: string;
  to: string;
  field: string;
}

const RULE = "rule";
const DOMAIN = "domain";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^`|`$/g, "") : "";
}

/** The map's nodes and edges, from the module's types as `graph` declares them. */
export function typeMap(graph: Graph): { nodes: MapNode[]; edges: MapEdge[] } {
  const nodes: MapNode[] = Object.entries(graph.types).map(([prefix, t]) => {
    const mine = graph.artifacts.filter((a) => a.type === prefix);
    const closed = mine.filter((a) => t.closed_states.includes(text(a.Status))).length;
    return {
      id: prefix,
      label: t.plural_name,
      open: mine.length - closed,
      closed,
      board: t.states.length > 0 && mine.some((a) => !a.row),
    };
  });
  const edges: MapEdge[] = [];
  for (const [prefix, t] of Object.entries(graph.types))
    for (const f of t.fields)
      for (const to of (f.target_type ?? "").split("|").filter(Boolean))
        edges.push({ from: prefix, to, field: f.name });
  const named = new Set(edges.map((e) => e.to));
  const rules = graph.rules ?? [];
  if (named.has(RULE))
    nodes.push({
      id: RULE,
      label: "Rules",
      open: rules.filter((r) => !r.retired).length,
      closed: rules.filter((r) => r.retired).length,
      board: false,
    });
  if (named.has(DOMAIN))
    nodes.push({ id: DOMAIN, label: "Domains", open: (graph.domains ?? []).length, closed: 0, board: false });
  const ids = new Set(nodes.map((n) => n.id));
  return {
    nodes: nodes.sort((a, b) => a.label.localeCompare(b.label)),
    edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  };
}

export interface PlacedMap {
  width: number;
  height: number;
  nodes: (MapNode & { x: number; y: number; width: number; height: number })[];
  edges: (MapEdge & { id: string; points: { x: number; y: number }[]; label?: { x: number; y: number } })[];
}

const NODE_W = 170;
const NODE_H = 48;

/** The map laid out by elkjs, top to bottom, each arrow's label placed by the layout. */
export async function layoutMap(map: { nodes: MapNode[]; edges: MapEdge[] }): Promise<PlacedMap> {
  const input: ElkNode = {
    id: "map",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": "32",
      "elk.layered.spacing.nodeNodeBetweenLayers": "56",
      "elk.edgeLabels.inline": "true",
    },
    children: map.nodes.map((n) => ({ id: n.id, width: NODE_W, height: NODE_H })),
    edges: map.edges.map((e, i) => ({
      id: `e${String(i)}`,
      sources: [e.from],
      targets: [e.to],
      labels: [{ text: e.field, width: e.field.length * 7, height: 14 }],
    })),
  };
  const graph = await new ELK().layout(input);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  return {
    width: graph.width ?? 0,
    height: graph.height ?? 0,
    nodes: (graph.children ?? []).flatMap((c) => {
      const n = byId.get(c.id);
      return n ? [{ ...n, x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? NODE_W, height: c.height ?? NODE_H }] : [];
    }),
    edges: (graph.edges ?? []).map((e, i) => {
      const s = e.sections?.[0];
      const l = e.labels?.[0];
      return {
        ...map.edges[i],
        id: e.id,
        points: s ? [s.startPoint, ...(s.bendPoints ?? []), s.endPoint] : [],
        label: l ? { x: (l.x ?? 0) + (l.width ?? 0) / 2, y: (l.y ?? 0) + (l.height ?? 0) / 2 } : undefined,
      };
    }),
  };
}

/** A type's tint (R6.35): none open, some open, or most of its work open. */
export function tint(n: MapNode): "map-tint-none" | "map-tint-some" | "map-tint-most" {
  const all = n.open + n.closed;
  if (all === 0 || n.open === 0) return "map-tint-none";
  return n.open / all > 0.5 ? "map-tint-most" : "map-tint-some";
}

function counts(n: MapNode): string {
  return n.closed > 0 ? `${String(n.open)} open · ${String(n.closed)} closed` : String(n.open);
}

/** The drawn map: each type a box, a type with a board a keyboard-operable button opening it. */
export function TypeMapDrawing({ placed, onOpen }: { placed: PlacedMap; onOpen: (prefix: string) => void }) {
  const pad = 8;
  const [focus, setFocus] = useState<string | null>(null);
  const edgeClass = (e: { from: string; to: string }) =>
    focus === null
      ? "trace-edge"
      : e.from === focus || e.to === focus
        ? "trace-edge map-edge-on"
        : "trace-edge map-edge-off";
  const hover = (id: string) => ({
    onMouseEnter: () => {
      setFocus(id);
    },
    onMouseLeave: () => {
      setFocus(null);
    },
    onFocus: () => {
      setFocus(id);
    },
    onBlur: () => {
      setFocus(null);
    },
  });
  return (
    <svg
      className="type-map"
      width={placed.width + pad * 2}
      height={placed.height + pad * 2}
      role="group"
      aria-label="The types as a map"
    >
      <defs>
        <marker id="map-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" className="map-arrowhead" />
        </marker>
      </defs>
      <g transform={`translate(${String(pad)} ${String(pad)})`}>
        {placed.edges.map((e) => (
          <g key={e.id}>
            <polyline
              className={edgeClass(e)}
              markerEnd="url(#map-arrow)"
              points={e.points.map((p) => `${String(p.x)},${String(p.y)}`).join(" ")}
            />
            {e.label && (
              <text className="map-label" x={e.label.x} y={e.label.y} textAnchor="middle" dominantBaseline="middle">
                {e.field}
              </text>
            )}
          </g>
        ))}
        {placed.nodes.map((n) => {
          const body = (
            <>
              <rect width={n.width} height={n.height} rx={6} />
              <text x={n.width / 2} y={18} textAnchor="middle">
                {n.label}
              </text>
              <text x={n.width / 2} y={36} textAnchor="middle" className="map-count">
                {counts(n)}
              </text>
            </>
          );
          return n.board ? (
            <g
              key={n.id}
              className={`trace-node map-node ${tint(n)}`}
              transform={`translate(${String(n.x)} ${String(n.y)})`}
              {...hover(n.id)}
              role="button"
              tabIndex={0}
              aria-label={`Open the board of ${n.label}`}
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
              {body}
            </g>
          ) : (
            <g
              key={n.id}
              className={`trace-node map-node map-node-static ${tint(n)}`}
              transform={`translate(${String(n.x)} ${String(n.y)})`}
              {...hover(n.id)}
            >
              {body}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** The map's text equivalent: each type, its counts and the types it references. */
export function TypeMapTable({
  map,
  onOpen,
}: {
  map: { nodes: MapNode[]; edges: MapEdge[] };
  onOpen: (prefix: string) => void;
}) {
  const label = new Map(map.nodes.map((n) => [n.id, n.label]));
  return (
    <table>
      <caption className="muted">The types, their artifacts and what each references</caption>
      <thead>
        <tr>
          <th scope="col">Type</th>
          <th scope="col">Open</th>
          <th scope="col">Closed</th>
          <th scope="col">References</th>
        </tr>
      </thead>
      <tbody>
        {map.nodes.map((n) => (
          <tr key={n.id}>
            <th scope="row">
              {n.board ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    onOpen(n.id);
                  }}
                >
                  {n.label}
                </button>
              ) : (
                n.label
              )}
            </th>
            <td>{n.open}</td>
            <td>{n.closed}</td>
            <td>
              {map.edges
                .filter((e) => e.from === n.id)
                .map((e) => `${e.field} → ${label.get(e.to) ?? e.to}`)
                .join(", ") || <span className="muted">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Load =
  | { state: "loading" }
  | { state: "ready"; graph: Graph; placed: PlacedMap | null }
  | { state: "failed"; message: string };

/** The Map view (studio-SHELL-000010), reloaded after each change catalyst announces. */
export function TypeMap({ client }: { client: StudioClient }) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [batch, setBatch] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    client
      .events(() => {
        setBatch((b) => b + 1);
      }, abort.signal)
      .catch(() => undefined);
    return () => {
      abort.abort();
    };
  }, [client]);

  useEffect(() => {
    let live = true;
    client.graph().then(
      async (graph) => {
        const placed = await layoutMap(typeMap(graph)).catch(() => null); // the table stands without the drawing
        if (live) setLoad({ state: "ready", graph, placed });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, batch]);

  const open = (prefix: string) => {
    navigate("board", prefix);
  };
  return (
    <>
      <h2>Map</h2>
      {load.state === "loading" && <Status tone="info" label="Loading" />}
      {load.state === "failed" && (
        <p>
          <Status tone="error" label="catalyst did not answer" /> <span className="muted">{load.message}</span>
        </p>
      )}
      {load.state === "ready" && (
        <>
          {load.placed && (
            <figure className="trace-figure">
              <TypeMapDrawing placed={load.placed} onOpen={open} />
              <figcaption className="muted">
                Each arrow is a reference field, from the type that carries it; pointing at a type lights its arrows.
                Tint: <span className="map-key map-tint-most">most work open</span>{" "}
                <span className="map-key map-tint-some">some open</span>{" "}
                <span className="map-key map-tint-none">none open</span>
              </figcaption>
            </figure>
          )}
          <TypeMapTable map={typeMap(load.graph)} onOpen={open} />
        </>
      )}
    </>
  );
}
