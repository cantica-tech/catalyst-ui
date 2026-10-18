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

/** One row on the Gantt chart: from its earlier date to its later, or a point when it has one. */
export interface GanttSpan {
  id: string;
  title: string;
  from: string;
  to: string;
  closed: boolean;
}

/**
 * The Gantt chart's spans (owner decision B9): every row with a date, from
 * the earliest of its dates to the latest; no field is named, the dates are
 * the row's own. The range is the table's first and last date.
 */
export function ganttSpans(items: RoadmapItem[]): { spans: GanttSpan[]; first: string; last: string } | null {
  const spans = items
    .filter((i) => i.dates.length > 0)
    .map((i) => {
      const days = i.dates.map(([, v]) => v).sort();
      return { id: i.id, title: i.title, from: days[0], to: days[days.length - 1], closed: i.closed };
    });
  if (spans.length === 0) return null;
  const all = spans.flatMap((x) => [x.from, x.to]).sort();
  return { spans, first: all[0], last: all[all.length - 1] };
}

function dayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / 86_400_000;
}

/** Where a day falls in the range, as a share of it (0 to 100). */
export function position(day: string, first: string, last: string): number {
  const span = dayNumber(last) - dayNumber(first);
  return span <= 0 ? 0 : ((dayNumber(day) - dayNumber(first)) / span) * 100;
}

function Gantt({ items, today }: { items: RoadmapItem[]; today: string }) {
  const g = ganttSpans(items);
  if (!g) return null;
  const now = today >= g.first && today <= g.last ? position(today, g.first, g.last) : null;
  return (
    <figure className="gantt">
      <figcaption className="muted">
        From <time>{g.first}</time> to <time>{g.last}</time>
        {now !== null && <>; today is marked</>}. {items.length - g.spans.length} row(s) without a date are left out.
      </figcaption>
      <table>
        <tbody>
          {g.spans.map((x) => {
            const left = position(x.from, g.first, g.last);
            const width = Math.max(position(x.to, g.first, g.last) - left, 0.8);
            return (
              <tr key={x.id}>
                <th scope="row">{x.title}</th>
                <td className="gantt-track">
                  {now !== null && (
                    <span className="gantt-today" style={{ left: `${String(now)}%` }} aria-hidden="true" />
                  )}
                  <span
                    className={x.closed ? "gantt-bar gantt-closed" : "gantt-bar"}
                    style={{ left: `${String(left)}%`, width: `${String(width)}%` }}
                    aria-hidden="true"
                  />
                </td>
                <td className="muted">
                  <time>{x.from}</time>
                  {x.to !== x.from && (
                    <>
                      {" "}
                      to <time>{x.to}</time>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}

function tableName(file: string): string {
  return (file.split("/").pop() ?? file).replace(/\.md$/, "");
}

/** The tables' timelines, each linked entity opening its page with its own status. */
export function RoadmapView({
  graph,
  today = new Date().toISOString().slice(0, 10),
}: {
  graph: Graph;
  today?: string;
}) {
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
          <Gantt items={t.items} today={today} />
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
