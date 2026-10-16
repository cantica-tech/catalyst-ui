import { useEffect, useState } from "react";

import type { JournalEntry, StudioClient, User } from "./client.js";
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

function intentOf(e: JournalEntry): string {
  return Array.isArray(e.intent) ? e.intent.join("; ") : (e.intent ?? "");
}

function Person({ name, user, act }: { name: string; user?: User; act?: Activity }) {
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
export function TeamView({ users, entries, since }: { users: User[]; entries: JournalEntry[]; since: string }) {
  const acts = activity(entries);
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
        <Person key={u.userid} name={u.name} user={u} act={acts.get(u.name)} />
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
  | { state: "ready"; users: User[]; entries: JournalEntry[] }
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
    Promise.all([client.users(), client.journal(daysAgo(WINDOW))]).then(
      ([users, entries]) => {
        if (live) setLoad({ state: "ready", users, entries });
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
  return <TeamView users={load.users} entries={load.entries} since={daysAgo(WINDOW)} />;
}
