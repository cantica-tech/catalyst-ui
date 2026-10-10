import type { JournalEntry } from "catalyst-core";
import { useMemo, useState } from "react";

export interface JournalProps {
  entries: JournalEntry[];
}

/**
 * Mirrors `catalyst-core`'s `queryJournal` filter semantics, duplicated
 * here as a small pure predicate rather than imported: every
 * browser-bundled file in this package imports only types from
 * `catalyst-core`, never a value, because the package's entry point
 * re-exports functions that touch `node:fs`/`node:path`, and this file is
 * bundled with `esbuild --platform=browser`. Exported so it can be unit
 * tested directly without simulating DOM input events.
 */
export function matches(entry: JournalEntry, since: string, actor: string, artifact: string, rule: string): boolean {
  if (since && entry.timestamp < since) return false;
  if (actor && entry.actor !== actor) return false;
  if (artifact && entry.artifact !== artifact) return false;
  if (rule && !entry.targets.includes(rule)) return false;
  return true;
}

function JournalFilters({
  since,
  actor,
  artifact,
  rule,
  onSince,
  onActor,
  onArtifact,
  onRule,
}: {
  since: string;
  actor: string;
  artifact: string;
  rule: string;
  onSince: (value: string) => void;
  onActor: (value: string) => void;
  onArtifact: (value: string) => void;
  onRule: (value: string) => void;
}) {
  return (
    <div>
      <label>
        Since{" "}
        <input
          value={since}
          onChange={(e) => {
            onSince(e.target.value);
          }}
          placeholder="2026-01-01T00:00:00Z"
        />
      </label>
      <label>
        Actor{" "}
        <input
          value={actor}
          onChange={(e) => {
            onActor(e.target.value);
          }}
        />
      </label>
      <label>
        Artifact{" "}
        <input
          value={artifact}
          onChange={(e) => {
            onArtifact(e.target.value);
          }}
        />
      </label>
      <label>
        Rule{" "}
        <input
          value={rule}
          onChange={(e) => {
            onRule(e.target.value);
          }}
        />
      </label>
    </div>
  );
}

function JournalEntryRow({ entry }: { entry: JournalEntry }) {
  return (
    <li>
      <code>{entry.timestamp}</code> — {entry.actor} {entry.command} ({entry.action}) on <code>{entry.artifact}</code>
      {entry.targets.length > 0 ? <> targets {entry.targets.join(", ")}</> : null}
      {entry.intent.length > 0 ? <p>{entry.intent.join(" ")}</p> : null}
    </li>
  );
}

/**
 * The Chain Inspector's journal panel — the full entry list is sent once
 * as the initial payload (journal size is bounded by project lifetime,
 * not unbounded), and every filter narrows the view reactively in this
 * component, with no host round-trip.
 */
export function Journal({ entries }: JournalProps) {
  const [since, setSince] = useState("");
  const [actor, setActor] = useState("");
  const [artifact, setArtifact] = useState("");
  const [rule, setRule] = useState("");

  const filtered = useMemo(
    () =>
      entries
        .filter((e) => matches(e, since, actor, artifact, rule))
        .slice()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [entries, since, actor, artifact, rule],
  );

  return (
    <div>
      <h1>Journal</h1>
      <JournalFilters
        since={since}
        actor={actor}
        artifact={artifact}
        rule={rule}
        onSince={setSince}
        onActor={setActor}
        onArtifact={setArtifact}
        onRule={setRule}
      />
      <p>
        {filtered.length} of {entries.length} entries
      </p>
      {filtered.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {filtered.map((e, i) => (
            <JournalEntryRow key={`${e.timestamp}-${e.artifact}-${i}`} entry={e} />
          ))}
        </ul>
      )}
    </div>
  );
}
