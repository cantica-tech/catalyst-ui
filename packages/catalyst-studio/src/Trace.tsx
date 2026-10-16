import type { Impact, Reached } from "./client.js";
import { TraceGraph } from "./TraceGraph.js";

export interface TraceNode {
  reached: Reached;
  children: TraceNode[];
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
        <li key={n.reached.id}>
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
  const up = traceTree(impact.id, impact.upstream ?? []);
  const down = traceTree(impact.id, impact.downstream ?? []);
  const prose = [...new Set([...impact.mentions, ...impact.mentioned_by])].sort();
  return (
    <section aria-labelledby="trace">
      <h3 id="trace">Trace</h3>
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
