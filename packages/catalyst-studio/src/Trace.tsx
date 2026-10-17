import { useState } from "react";

import type { Impact, Reached } from "./client.js";
import { useImpact } from "./impact.js";
import { TraceGraph } from "./TraceGraph.js";

export interface TraceNode {
  reached: Reached;
  children: TraceNode[];
  /** Kept only as the way to an entity of a shown type (R6.36). */
  dim?: boolean;
}

/**
 * The tree with only the shown types: an entity of another type stays,
 * dimmed, only when an entity of a shown type lies beyond it.
 */
export function pruneTree(nodes: TraceNode[], shown: Set<string>): TraceNode[] {
  return nodes.flatMap((n) => {
    const children = pruneTree(n.children, shown);
    if (shown.has(n.reached.type)) return [{ ...n, children }];
    return children.length > 0 ? [{ ...n, children, dim: true }] : [];
  });
}

/**
 * The reached entities as a tree: each under the one nearer that reached it
 * (`via.id`), the roots under the entity asked about; siblings by id.
 */
export function traceTree(root: string, reached: Reached[]): TraceNode[] {
  const byParent = new Map<string, Reached[]>();
  for (const r of reached) byParent.set(r.via.id, [...(byParent.get(r.via.id) ?? []), r]);
  const seen = new Set<string>([root]);
  const build = (parent: string): TraceNode[] =>
    (byParent.get(parent) ?? [])
      .filter((r) => !seen.has(r.id) && seen.add(r.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((r) => ({ reached: r, children: build(r.id) }));
  return build(root);
}

function Branch({ nodes, onOpen }: { nodes: TraceNode[]; onOpen: (id: string) => void }) {
  return (
    <ul className="trace">
      {nodes.map((n) => (
        <li key={n.reached.id} className={n.dim ? "trace-dim" : undefined}>
          <span className="muted">{n.reached.via.field} → </span>
          <button
            type="button"
            className="link-button"
            onClick={() => {
              onOpen(n.reached.id);
            }}
          >
            <code>{n.reached.id}</code>
          </button>{" "}
          {n.reached.title}
          {n.reached.status ? <span className="muted"> ({n.reached.status})</span> : null}
          {n.children.length > 0 && <Branch nodes={n.children} onOpen={onOpen} />}
        </li>
      ))}
    </ul>
  );
}

/** An entity traced both ways, as trees; prose-only citations apart, not followed. */
export function Trace({ impact, onOpen }: { impact: Impact; onOpen: (id: string) => void }) {
  const types = [...new Set([...(impact.upstream ?? []), ...(impact.downstream ?? [])].map((r) => r.type))].sort();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const shown = new Set(types.filter((t) => !hidden.has(t)));
  const marks = useImpact();
  const reach = [...new Set((impact.downstream ?? []).map((r) => r.id))];
  const up = pruneTree(traceTree(impact.id, impact.upstream ?? []), shown);
  const down = pruneTree(traceTree(impact.id, impact.downstream ?? []), shown);
  const prose = [...new Set([...impact.mentions, ...impact.mentioned_by])].sort();
  return (
    <section aria-labelledby="trace">
      <h3 id="trace">Trace</h3>
      {types.length > 1 && (
        <fieldset className="filters">
          <legend>Show</legend>
          {types.map((t) => (
            <label key={t}>
              <input
                type="checkbox"
                checked={!hidden.has(t)}
                onChange={(e) => {
                  setHidden((h) => {
                    const next = new Set(h);
                    if (e.target.checked) next.delete(t);
                    else next.add(t);
                    return next;
                  });
                }}
              />{" "}
              {t}
            </label>
          ))}
        </fieldset>
      )}
      {reach.length > 0 && (
        <p>
          <button
            type="button"
            onClick={() => {
              marks.mark(impact.id, reach);
            }}
          >
            Mark what a change would reach ({reach.length})
          </button>{" "}
          <span className="muted">on the board and in the lists, until cleared</span>
        </p>
      )}
      <h4>Rests on</h4>
      {up.length === 0 ? (
        <p className="muted">Nothing: it rests on no other entity.</p>
      ) : (
        <Branch nodes={up} onOpen={onOpen} />
      )}
      <h4>Rests on it</h4>
      {down.length === 0 ? <p className="muted">Nothing rests on it.</p> : <Branch nodes={down} onOpen={onOpen} />}
      <TraceGraph impact={impact} onOpen={onOpen} />
      {prose.length > 0 && (
        <>
          <h4>Cited in prose only</h4>
          <p>
            {prose.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    onOpen(id);
                  }}
                >
                  <code>{id}</code>
                </button>
              </span>
            ))}
          </p>
        </>
      )}
    </section>
  );
}
