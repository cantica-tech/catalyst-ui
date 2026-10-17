import { useEffect, useId, useState } from "react";

import type { JournalEntry, StudioClient } from "./client.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

/** An entity's ID, as a journal entry labels it (`REQ-000001-Ab3xR9pQ`, a rule ID); not a free label. */
const ENTITY_ID = /^[A-Za-z][A-Za-z0-9]*-[A-Z0-9.]*-?\d{3,6}(-[A-Za-z0-9]{8})?$/;

function intentOf(e: JournalEntry): string {
  return Array.isArray(e.intent) ? e.intent.join("; ") : (e.intent ?? "");
}

/** How an entry changed a file, from its blobs before and after. */
export function fileKind(f: { before?: string | null; after?: string | null }): string {
  if (!f.before && f.after) return "added";
  if (f.before && !f.after) return "removed";
  return "changed";
}

/** The entries a filter keeps: by actor, then every word in the actor, entity, command, intent or a file path. */
export function filterJournal(entries: JournalEntry[], actor: string, words: string): JournalEntry[] {
  const ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => {
    if (actor && e.actor !== actor) return false;
    const hay = [e.actor, e.artifact, e.command, e.action, intentOf(e), ...(e.files ?? []).map((f) => f.path)]
      .join(" ")
      .toLowerCase();
    return ws.every((w) => hay.includes(w));
  });
}

/** The entries by day, newest day and entry first. */
export function byDay(entries: JournalEntry[]): { day: string; entries: JournalEntry[] }[] {
  return groupJournal(entries, "day").map((g) => ({ day: g.key, entries: g.entries }));
}

export type Grouping = "day" | "type" | "tier";

/** The entity type an entry is labelled with: its ID's prefix, or "other" for a free label. */
function typeOf(e: JournalEntry): string {
  const a = e.artifact ?? "";
  return ENTITY_ID.test(a) ? a.split("-")[0] : "other";
}

/** The entries in groups (R6.38): by day, by entity type or by tier; newest entry first in each. */
export function groupJournal(entries: JournalEntry[], by: Grouping): { key: string; entries: JournalEntry[] }[] {
  const key = (e: JournalEntry): string =>
    by === "day" ? (e.timestamp ?? "").slice(0, 10) || "undated" : by === "type" ? typeOf(e) : (e.tier ?? "no tier");
  const groups = new Map<string, JournalEntry[]>();
  for (const e of [...entries].reverse()) groups.set(key(e), [...(groups.get(key(e)) ?? []), e]);
  const out = [...groups.entries()].map(([k, list]) => ({ key: k, entries: list }));
  return by === "day" ? out : out.sort((a, b) => b.entries.length - a.entries.length || a.key.localeCompare(b.key));
}

function Entry({ entry }: { entry: JournalEntry }) {
  const navigate = useNavigate();
  const files = entry.files ?? [];
  const artifact = entry.artifact ?? "";
  return (
    <li>
      <time>{(entry.timestamp ?? "").slice(11, 16)}</time> <strong>{entry.actor}</strong> ·{" "}
      {entry.action ?? entry.command}
      {artifact &&
        (ENTITY_ID.test(artifact) ? (
          <>
            {" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                navigate("artifacts", artifact);
              }}
            >
              <code>{artifact}</code>
            </button>
          </>
        ) : (
          <> {artifact}</>
        ))}
      {entry.tier && <span className="muted"> ({entry.tier})</span>}: {intentOf(entry)}
      {files.length > 0 && (
        <details>
          <summary className="muted">
            {files.length} file{files.length === 1 ? "" : "s"}
          </summary>
          <ul>
            {files.map((f) => (
              <li key={f.path}>
                <code>{f.path}</code> <span className="muted">{fileKind(f)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** The journal as a timeline, filtered (studio-SHELL-000007). */
export function JournalTimeline({
  entries,
  since,
  onEarlier,
}: {
  entries: JournalEntry[];
  since: string;
  onEarlier?: () => void;
}) {
  const [actor, setActor] = useState("");
  const [words, setWords] = useState("");
  const [grouping, setGrouping] = useState<Grouping>("day");
  const groupId = useId();
  const actorId = useId();
  const wordsId = useId();
  const actors = [...new Set(entries.map((e) => e.actor ?? "").filter(Boolean))].sort();
  const kept = filterJournal(entries, actor, words);
  return (
    <>
      <h2>Journal</h2>
      <div className="filters" role="search">
        <label htmlFor={actorId}>Who</label>{" "}
        <select
          id={actorId}
          value={actor}
          onChange={(event) => {
            setActor(event.target.value);
          }}
        >
          <option value="">Everyone</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>{" "}
        <label htmlFor={wordsId}>Words</label>{" "}
        <input
          id={wordsId}
          type="search"
          value={words}
          onChange={(event) => {
            setWords(event.target.value);
          }}
        />{" "}
        <label htmlFor={groupId}>Group by</label>{" "}
        <select
          id={groupId}
          value={grouping}
          onChange={(event) => {
            setGrouping(event.target.value as Grouping);
          }}
        >
          <option value="day">day</option>
          <option value="type">entity type</option>
          <option value="tier">tier</option>
        </select>
      </div>
      <p className="muted" aria-live="polite">
        {kept.length} of {entries.length} entries since {since}
      </p>
      {groupJournal(kept, grouping).map((d) => (
        <section key={d.key} aria-labelledby={`group-${d.key}`}>
          <h3 id={`group-${d.key}`}>
            {d.key} <span className="muted">({d.entries.length})</span>
          </h3>
          <ol className="journal">
            {d.entries.map((e) => (
              <Entry key={e.at} entry={e} />
            ))}
          </ol>
        </section>
      ))}
      {onEarlier && (
        <p>
          <button type="button" onClick={onEarlier}>
            Earlier
          </button>
        </p>
      )}
    </>
  );
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

type Load = { state: "loading" } | { state: "ready"; entries: JournalEntry[] } | { state: "failed"; message: string };

/** The Journal view: the last two weeks, further back on request, reloaded after each change. */
export function Journal({ client }: { client: StudioClient }) {
  const [days, setDays] = useState(14);
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
    client.journal(daysAgo(days)).then(
      (entries) => {
        if (live) setLoad({ state: "ready", entries });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, days, batch]);

  if (load.state !== "ready") {
    return (
      <>
        <h2>Journal</h2>
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
  return (
    <JournalTimeline
      entries={load.entries}
      since={daysAgo(days)}
      onEarlier={() => {
        setDays((d) => d + 30);
      }}
    />
  );
}
