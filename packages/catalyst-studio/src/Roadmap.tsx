import { useEffect, useState } from "react";

import type { Graph, GraphArtifact, StudioClient } from "./client.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^`|`$/g, "") : "";
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** An entity ID inside text, with its signer's suffix if any (catalyst-core's pattern; the Studio stays browser-only). */
const ENTITY_ID_IN_TEXT = /\b[A-Z][A-Z0-9]*-\d{6}(?:-[A-Za-z0-9]{8})?\b/g;

/** One row of a table, as the timeline shows it. */
export interface RoadmapItem {
  id: string;
  title: string;
  status: string;
  closed: boolean;
  description: string;
  /** Fields holding a date, by name. */
  dates: [string, string][];
  /** The entities its reference fields name. */
  linked: string[];
}

export interface RoadmapTable {
  file: string;
  /** The row type's plural name. */
  kind: string;
  items: RoadmapItem[];
  closed: number;
}

/** The fields a row keeps, whether `graph` gives them under `fields` or flat. */
function fieldsOf(a: GraphArtifact): Record<string, unknown> {
  const nested = a.fields;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : a;
}

/** Every table of rows, its items in table order (studio-SHELL-000011). */
export function roadmapTables(graph: Graph): RoadmapTable[] {
  const tables = new Map<string, GraphArtifact[]>();
  for (const a of graph.artifacts) if (a.row) tables.set(a.file, [...(tables.get(a.file) ?? []), a]);
  return [...tables.entries()]
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([file, rows]) => {
      const sorted = [...rows].sort((x, y) => Number(x.line ?? 0) - Number(y.line ?? 0));
      const type = graph.types[sorted[0].type] as (typeof graph.types)[string] | undefined;
      const refFields = new Set((type?.fields ?? []).filter((f) => f.target_type).map((f) => f.name));
      const items = sorted.map((a) => {
        const f = fieldsOf(a);
        const status = clean(f.Status);
        const linked = [...refFields].flatMap((name) => clean(f[name]).match(ENTITY_ID_IN_TEXT) ?? []);
        return {
          id: a.id,
          title: clean(f.Title) || clean(a.title) || a.id,
          status,
          closed: (type?.closed_states ?? []).includes(status),
          description: clean(f.Description),
          dates: Object.entries(f)
            .map(([k, v]) => [k, clean(v)] as [string, string])
            .filter(([, v]) => DATE.test(v)),
          linked: [...new Set(linked)],
        };
      });
      return {
        file,
        kind: type?.plural_name ?? sorted[0].type,
        items,
        closed: items.filter((i) => i.closed).length,
      };
    });
}

function tableName(file: string): string {
  return (file.split("/").pop() ?? file).replace(/\.md$/, "");
}

/** The tables' timelines, each linked entity opening its page with its own status. */
export function RoadmapView({ graph }: { graph: Graph }) {
  const navigate = useNavigate();
  const tables = roadmapTables(graph);
  const statusOf = new Map(graph.artifacts.map((a) => [a.id, clean(fieldsOf(a).Status)]));
  return (
    <>
      <h2>Roadmap</h2>
      {tables.length === 0 && <p className="muted">This deployment keeps no table of rows.</p>}
      {tables.map((t) => (
        <section key={t.file} aria-labelledby={`table-${t.file}`}>
          <h3 id={`table-${t.file}`}>
            {tableName(t.file)} <span className="muted">({t.kind})</span>
          </h3>
          <p>
            <progress value={t.closed} max={t.items.length} aria-label={`${tableName(t.file)}: closed items`} />{" "}
            {t.closed} of {t.items.length} closed
          </p>
          <ol className="timeline">
            {t.items.map((i) => (
              <li key={i.id} className={i.closed ? "timeline-closed" : undefined}>
                <strong>{i.title}</strong> <code className="muted">{i.id}</code>{" "}
                {i.status && <Status tone={i.closed ? "ok" : "warn"} label={i.status} />}
                {i.dates.map(([k, v]) => (
                  <span key={k} className="muted">
                    {" "}
                    · {k} <time>{v}</time>
                  </span>
                ))}
                {i.description && <div>{i.description}</div>}
                {i.linked.length > 0 && (
                  <div>
                    <span className="muted">Linked: </span>
                    {i.linked.map((id, n) => (
                      <span key={id}>
                        {n > 0 && ", "}
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => {
                            navigate("artifacts", id);
                          }}
                        >
                          <code>{id}</code>
                        </button>
                        {statusOf.get(id) && <span className="muted"> ({statusOf.get(id)})</span>}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}

type Load = { state: "loading" } | { state: "ready"; graph: Graph } | { state: "failed"; message: string };

/** The Roadmap view, reloaded after each change catalyst announces. */
export function Roadmap({ client }: { client: StudioClient }) {
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
      (graph) => {
        if (live) setLoad({ state: "ready", graph });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, batch]);

  if (load.state !== "ready") {
    return (
      <>
        <h2>Roadmap</h2>
        {load.state === "loading" ? (
          <Status tone="info" label="Loading" />
        ) : (
          <p>
            <Status tone="error" label="catalyst did not answer" /> <span className="muted">{load.message}</span>
          </p>
        )}
      </>
    );
  }
  return <RoadmapView graph={load.graph} />;
}
