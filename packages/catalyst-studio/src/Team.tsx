import { useEffect, useState } from "react";

import type { Graph, JournalEntry, StudioClient, User } from "./client.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

/** What one person did in the journal's window. */
export interface Activity {
  actor: string;
  entries: number;
  last: string | null;
  /** The entities they touched most, with how often. */
  top: [string, number][];
  latest: JournalEntry[];
}

const ENTITY_ID = /^[A-Za-z][A-Za-z0-9]*-[A-Z0-9.]*-?\d{3,6}(-[A-Za-z0-9]{8})?$/;

/** Each actor's activity in `entries` (oldest first, as the journal gives them). */
export function activity(entries: JournalEntry[], latest = 3, top = 5): Map<string, Activity> {
  const out = new Map<string, Activity>();
  for (const e of entries) {
    const actor = e.actor ?? "unknown";
    const a = out.get(actor) ?? { actor, entries: 0, last: null, top: [], latest: [] };
    a.entries++;
    a.last = e.timestamp ?? a.last;
    a.latest = [e, ...a.latest].slice(0, latest);
    out.set(actor, a);
  }
  for (const a of out.values()) {
    const counts = new Map<string, number>();
    for (const e of entries)
      if ((e.actor ?? "unknown") === a.actor && e.artifact && ENTITY_ID.test(e.artifact))
        counts.set(e.artifact, (counts.get(e.artifact) ?? 0) + 1);
    a.top = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, top);
  }
  return out;
}

/** One open entity a person is named in, as its type's `user` field (an assignee) names them. */
export interface OpenItem {
  id: string;
  type: string;
  title: string;
  status: string;
  field: string;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^`|`$/g, "") : "";
}

/**
 * The open work of each person (R6.48): every entity not in a closed state
 * whose type's `user` or `user-list` fields name them, by the name written
 * (a registered user's name or git username). No field is named here: the
 * types say which fields hold a person.
 */
export function openWork(graph: Graph): Map<string, OpenItem[]> {
  const out = new Map<string, OpenItem[]>();
  for (const a of graph.artifacts) {
    const type = (graph.types as Record<string, Graph["types"][string] | undefined>)[a.type];
    if (!type) continue;
    const fields = (a.fields && typeof a.fields === "object" ? a.fields : a) as Record<string, unknown>;
    const status = clean(fields.Status);
    if (type.closed_states.includes(status)) continue;
    for (const f of type.fields.filter((x) => x.kind === "user" || x.kind === "user-list")) {
      const raw = clean(fields[f.name]);
      if (!raw || raw.startsWith("*(")) continue;
      for (const name of (f.kind === "user-list" ? raw.split(",") : [raw]).map((n) => n.trim().replace(/^`|`$/g, ""))) {
        if (!name) continue;
        const list = out.get(name) ?? [];
        list.push({ id: a.id, type: a.type, title: clean(a.title) || a.id, status, field: f.name });
        out.set(name, list);
      }
    }
  }
  for (const list of out.values()) list.sort((x, y) => x.id.localeCompare(y.id));
  return out;
}

/** A person's open work, by their name or their git username. */
export function workOf(work: Map<string, OpenItem[]>, name: string, user?: User): OpenItem[] {
  const keys = new Set([name, user?.git_username].filter((k): k is string => Boolean(k)));
  const seen = new Set<string>();
  return [...keys].flatMap((k) => work.get(k) ?? []).filter((w) => !seen.has(w.id) && Boolean(seen.add(w.id))); // one entity once, however many fields name them
}

function intentOf(e: JournalEntry): string {
  return Array.isArray(e.intent) ? e.intent.join("; ") : (e.intent ?? "");
}

function Person({ name, user, act, work = [] }: { name: string; user?: User; act?: Activity; work?: OpenItem[] }) {
  const navigate = useNavigate();
  const open = (id: string) => {
    navigate("artifacts", id);
  };
  return (
    <article className="person" aria-labelledby={`person-${name}`}>
      <h3 id={`person-${name}`}>{name}</h3>
      <p>
        {user ? (
          <>
            {user.roles.join(", ") || "No role"} · <code>{user.userid}</code>
            {user.registered && <> · registered {user.registered}</>}{" "}
            {user.active ? <Status tone="ok" label="Active" /> : <Status tone="info" label="Inactive" />}
          </>
        ) : (
          <Status tone="warn" label="Not registered" />
        )}
      </p>
      {work.length > 0 && (
        <section aria-label={`${name}'s open work`}>
          <p>
            <span className="muted">Open work ({work.length}): </span>
            {work.map((w, i) => (
              <span key={`${w.id}-${w.field}`}>
                {i > 0 && ", "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    open(w.id);
                  }}
                >
                  <code>{w.id}</code>
                </button>{" "}
                <span className="muted">{w.status}</span>
              </span>
            ))}
          </p>
        </section>
      )}
      {act ? (
        <>
          <p>
            {act.entries} entr{act.entries === 1 ? "y" : "ies"}, the last <time>{act.last}</time>
          </p>
          {act.top.length > 0 && (
            <p>
              <span className="muted">Most touched: </span>
              {act.top.map(([id, n], i) => (
                <span key={id}>
                  {i > 0 && ", "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      open(id);
                    }}
                  >
                    <code>{id}</code>
                  </button>{" "}
                  <span className="muted">({n})</span>
                </span>
              ))}
            </p>
          )}
          <ol className="journal">
            {act.latest.map((e) => (
              <li key={e.at}>
                <time>{e.timestamp}</time> · {e.action ?? e.command}
                {e.artifact ? ` ${e.artifact}` : ""}: {intentOf(e)}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="muted">Nothing in the journal in this window.</p>
      )}
    </article>
  );
}

/** The team (studio-SHELL-000012): every registered user with their recent work; unregistered actors apart. */
export function TeamView({
  users,
  entries,
  since,
  graph,
}: {
  users: User[];
  entries: JournalEntry[];
  since: string;
  graph?: Graph;
}) {
  const acts = activity(entries);
  const work = graph ? openWork(graph) : new Map<string, OpenItem[]>();
  const registered = new Set(users.map((u) => u.name));
  const strangers = [...acts.keys()].filter((a) => !registered.has(a)).sort();
  const sorted = [...users].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
  return (
    <>
      <h2>Team</h2>
      <p className="muted">
        {users.length} registered user{users.length === 1 ? "" : "s"}; the journal since {since}. Users and roles change
        through <code>/user</code> and <code>/role</code>.
      </p>
      {sorted.map((u) => (
        <Person key={u.userid} name={u.name} user={u} act={acts.get(u.name)} work={workOf(work, u.name, u)} />
      ))}
      {strangers.length > 0 && (
        <section aria-labelledby="strangers">
          <h3 id="strangers">In the journal, not registered</h3>
          {strangers.map((a) => (
            <Person key={a} name={a} act={acts.get(a)} />
          ))}
        </section>
      )}
    </>
  );
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

type Load =
  | { state: "loading" }
  | { state: "ready"; users: User[]; entries: JournalEntry[]; graph?: Graph }
  | { state: "failed"; message: string };

const WINDOW = 14;

/** The Team view, reloaded after each change catalyst announces. */
export function Team({ client }: { client: StudioClient }) {
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
    Promise.all([
      client.users(),
      client.journal(daysAgo(WINDOW)),
      client.graph().catch(() => undefined), // without the graph, the activity still shows
    ]).then(
      ([users, entries, graph]) => {
        if (live) setLoad({ state: "ready", users, entries, graph });
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
        <h2>Team</h2>
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
  return <TeamView users={load.users} entries={load.entries} since={daysAgo(WINDOW)} graph={load.graph} />;
}
