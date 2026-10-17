import { useEffect, useId, useState } from "react";

import type { Graph, StudioClient } from "./client.js";
import { DriftBadge } from "./drift.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

/** One thing the search can find. */
export interface Findable {
  id: string;
  /** The group it is shown under: its type's plural name, or "Rules". */
  group: string;
  title: string;
  status: string;
  /** Every other text it holds, lower-cased. */
  text: string;
  /** Whether it has a page (a table row has none). */
  page: boolean;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^`|`$/g, "") : "";
}

/** Everything in the project the search can find, from `graph`. */
export function findables(graph: Graph): Findable[] {
  const artifacts = graph.artifacts.map((a) => {
    const fields =
      a.fields && typeof a.fields === "object" ? (a.fields as Record<string, unknown>) : (a as Record<string, unknown>);
    return {
      id: a.id,
      group: a.type in graph.types ? graph.types[a.type].plural_name : a.type,
      title: clean(fields.Title) || clean(a.title) || a.id,
      status: clean(fields.Status),
      text: Object.values(fields)
        .filter((v): v is string => typeof v === "string")
        .join(" ")
        .toLowerCase(),
      page: !a.row,
    };
  });
  const rules = (graph.rules ?? []).map((r) => ({
    id: r.id,
    group: "Rules",
    title: r.title.replace(/^🗑\s*/, ""),
    status: r.retired ? "Retired" : r.status,
    text: `${r.domain ?? ""} ${r.status}`.toLowerCase(),
    page: true,
  }));
  return [...artifacts, ...rules];
}

/**
 * What a query finds: every word must appear in the ID, title, status or
 * text; an ID match ranks first, then a title match, then the rest.
 */
export function search(items: Findable[], query: string, limit = 200): Findable[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const rank = (f: Findable): number => {
    const id = f.id.toLowerCase();
    const title = f.title.toLowerCase();
    const all = `${id} ${title} ${f.status.toLowerCase()} ${f.text}`;
    if (!words.every((w) => all.includes(w))) return -1;
    if (words.every((w) => id.includes(w))) return 0;
    if (words.every((w) => title.includes(w) || id.includes(w))) return 1;
    return 2;
  };
  return items
    .map((f) => ({ f, r: rank(f) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.f.id.localeCompare(b.f.id))
    .slice(0, limit)
    .map((x) => x.f);
}

/** The id of the query box: the shell focuses it on Ctrl/⌘+/. */
export const SEARCH_ID = "studio-search";

/** The search over a graph (studio-SHELL-000013). */
export function SearchView({ graph }: { graph: Graph }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const hint = useId();
  const items = findables(graph);
  const found = search(items, query);
  const groups = new Map<string, Findable[]>();
  for (const f of found) groups.set(f.group, [...(groups.get(f.group) ?? []), f]);
  return (
    <>
      <h2>Search</h2>
      <div role="search">
        <label htmlFor={SEARCH_ID}>Find in this project</label>{" "}
        <input
          id={SEARCH_ID}
          type="search"
          aria-describedby={hint}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <p id={hint} className="muted">
          An ID, a title, a status or any word of a field; every word must match.
        </p>
      </div>
      <p className="muted" aria-live="polite">
        {query.trim()
          ? `${String(found.length)} found among ${String(items.length)}`
          : `${String(items.length)} entities`}
      </p>
      {[...groups.entries()].map(([group, list]) => (
        <section key={group} aria-labelledby={`found-${group}`}>
          <h3 id={`found-${group}`}>
            {group} ({list.length})
          </h3>
          <ul className="artifact-list">
            {list.map((f) => (
              <li key={f.id}>
                {f.page ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      navigate("artifacts", f.id);
                    }}
                  >
                    <code>{f.id}</code> {f.title}
                  </button>
                ) : (
                  <>
                    <code>{f.id}</code> {f.title}
                  </>
                )}
                {f.status && <span className="muted"> · {f.status.slice(0, 60)}</span>} <DriftBadge id={f.id} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

type Load = { state: "loading" } | { state: "ready"; graph: Graph } | { state: "failed"; message: string };

/** The Search view: the graph loaded once per visit. */
export function Search({ client }: { client: StudioClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

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
  }, [client]);

  if (load.state === "ready") return <SearchView graph={load.graph} />;
  return (
    <>
      <h2>Search</h2>
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
