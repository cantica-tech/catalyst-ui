import { useEffect, useState } from "react";

import type { EntityType, EntityView, Graph, GraphArtifact, Impact, StudioClient } from "./client.js";
import { Status, type StatusTone } from "./Status.js";
import { Trace } from "./Trace.js";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A status as its type sees it: closed states read as done, the initial one as new. */
export function statusTone(type: EntityType | undefined, status: string): StatusTone {
  if (!type || !status) return "info";
  if (type.closed_states.includes(status)) return "ok";
  return "warn";
}

/** An artifact's type, undefined when the module no longer declares it. */
function typeOf(graph: Graph, prefix: string): EntityType | undefined {
  return graph.types[prefix];
}

/** Every artifact, grouped under its type's own plural name, each opening its page. */
export function ArtifactList({ graph, onOpen }: { graph: Graph; onOpen: (id: string) => void }) {
  const byType = new Map<string, GraphArtifact[]>();
  for (const a of graph.artifacts) {
    if (a.row) continue; // a table row (a roadmap item) has no page of its own
    byType.set(a.type, [...(byType.get(a.type) ?? []), a]);
  }
  const prefixes = [...byType.keys()].sort((x, y) =>
    (typeOf(graph, x)?.plural_name ?? x).localeCompare(typeOf(graph, y)?.plural_name ?? y),
  );
  return (
    <>
      <h2>Artifacts</h2>
      {prefixes.length === 0 && <p className="muted">This project has no artifacts yet.</p>}
      {prefixes.map((prefix) => {
        const type = typeOf(graph, prefix);
        const items = byType.get(prefix) ?? [];
        return (
          <section key={prefix} aria-labelledby={`type-${prefix}`}>
            <h3 id={`type-${prefix}`}>
              {type?.plural_name ?? prefix} ({items.length})
            </h3>
            <ul className="artifact-list">
              {items.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      onOpen(a.id);
                    }}
                  >
                    <code>{a.id}</code> {a.title}
                  </button>{" "}
                  {text(a.Status) && <Status tone={statusTone(type, text(a.Status))} label={text(a.Status)} />}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

/** One artifact as its type describes it; read-only, each move shown as the command that makes it. */
export function EntityPage({
  entity,
  type,
  impact,
  onOpen,
  onBack,
}: {
  entity: EntityView;
  type: EntityType | undefined;
  /** The trace, when catalyst serves `impact`; without it, the direct citers. */
  impact?: Impact;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const status = text(entity.Status);
  const fields = (type?.fields ?? []).filter((f) => !["ID", "Status", "Name", "Filename"].includes(f.name));
  const idButton = (id: string) => (
    <button
      key={id}
      type="button"
      className="link-button"
      onClick={() => {
        onOpen(id);
      }}
    >
      <code>{id}</code>
    </button>
  );
  return (
    <article aria-labelledby="entity-title">
      <p>
        <button type="button" className="link-button" onClick={onBack}>
          ← All artifacts
        </button>
      </p>
      <h2 id="entity-title">
        <code>{entity.id}</code> {entity.title}
      </h2>
      <p>
        {type?.name ?? entity.type}
        {status && (
          <>
            {" "}
            · <Status tone={statusTone(type, status)} label={status} />
          </>
        )}
      </p>

      <section aria-labelledby="entity-fields">
        <h3 id="entity-fields">Fields</h3>
        <dl className="fields">
          {fields.map((f) => {
            const cited = entity.links[f.name] as string[] | undefined;
            return (
              <div key={f.name}>
                <dt>{f.name}</dt>
                <dd>
                  {cited && cited.length > 0
                    ? cited.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          {idButton(id)}
                        </span>
                      ))
                    : text(entity[f.name]) || <span className="muted">—</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      {(entity.next ?? []).length > 0 && (
        <section aria-labelledby="entity-next">
          <h3 id="entity-next">Can move to</h3>
          <ul>
            {(entity.next ?? []).map((n) => (
              <li key={n.state}>
                {n.blocked_by.length === 0 ? (
                  <Status tone="ok" label={n.state} />
                ) : (
                  <Status tone="error" label={`${n.state}, blocked`} />
                )}{" "}
                <code>
                  catalyst status set {entity.id} {n.state}
                </code>
                {n.blocked_by.length > 0 && (
                  <ul>
                    {n.blocked_by.map((why) => (
                      <li key={why}>{why}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(entity.sections ?? []).map((s, i) => (
        <section key={`${s.heading}-${String(i)}`} aria-labelledby={`section-${String(i)}`}>
          <h3 id={`section-${String(i)}`}>{s.heading}</h3>
          <div className="section-text">{s.text || <span className="muted">Not written.</span>}</div>
        </section>
      ))}

      {impact ? (
        <Trace impact={impact} onOpen={onOpen} />
      ) : (
        <section aria-labelledby="entity-cited-by">
          <h3 id="entity-cited-by">Cited by</h3>
          {entity.linked_from.length === 0 ? (
            <p className="muted">Nothing cites it.</p>
          ) : (
            <ul>
              {entity.linked_from.map((l) => (
                <li key={`${l.id}-${l.field}`}>
                  {idButton(l.id)} <span className="muted">in {l.field}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="entity-journal">
        <h3 id="entity-journal">Journal</h3>
        {entity.journal.length === 0 ? (
          <p className="muted">No entry names it.</p>
        ) : (
          <ol className="journal">
            {[...entity.journal].reverse().map((e, i) => (
              <li key={`${e.timestamp ?? ""}-${String(i)}`}>
                <time>{e.timestamp}</time> {e.actor} · {e.action}:{" "}
                {Array.isArray(e.intent) ? e.intent.join("; ") : e.intent}
              </li>
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}

type Load<T> = { state: "loading" } | { state: "ready"; value: T } | { state: "failed"; message: string };

/** The Artifacts view: the list, or one artifact's page; reloaded after each change catalyst announces. */
export function Artifacts({ client }: { client: StudioClient }) {
  const [graph, setGraph] = useState<Load<Graph>>({ state: "loading" });
  const [open, setOpen] = useState<string | null>(null);
  const [entity, setEntity] = useState<Load<EntityView> | null>(null);
  const [impact, setImpact] = useState<Impact | undefined>(undefined);
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
      (value) => {
        if (live) setGraph({ state: "ready", value });
      },
      (err: unknown) => {
        if (live) setGraph({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, batch]);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setEntity({ state: "loading" });
    setImpact(undefined);
    client.impact(open).then(
      (value) => {
        if (live) setImpact(value);
      },
      () => undefined, // an older catalyst serves no impact: the page shows the direct citers
    );
    client.view(open).then(
      (value) => {
        if (live) setEntity({ state: "ready", value });
      },
      (err: unknown) => {
        if (live) setEntity({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, open, batch]);

  if (graph.state !== "ready") {
    return (
      <>
        <h2>Artifacts</h2>
        {graph.state === "loading" ? (
          <Status tone="info" label="Loading" />
        ) : (
          <p>
            <Status tone="error" label="catalyst did not answer" /> <span className="muted">{graph.message}</span>
          </p>
        )}
      </>
    );
  }
  if (open && entity?.state === "ready") {
    return (
      <EntityPage
        entity={entity.value}
        type={typeOf(graph.value, entity.value.type)}
        impact={impact}
        onOpen={setOpen}
        onBack={() => {
          setOpen(null);
        }}
      />
    );
  }
  if (open && entity?.state === "failed") {
    return (
      <p>
        <Status tone="error" label={`${open} could not be read`} /> <span className="muted">{entity.message}</span>
      </p>
    );
  }
  return <ArtifactList graph={graph.value} onOpen={setOpen} />;
}
