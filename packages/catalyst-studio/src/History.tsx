import { ActionForm } from "./ActionForm.js";
import type { HistoryEntry } from "./client.js";
import { useState } from "react";

import { diffStat, hunks, lineDiff, sideBySide, type DiffLine } from "./diff.js";
import { useHost } from "./host.js";

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

const MARK: Record<DiffLine["kind"], { sign: string; said: string }> = {
  same: { sign: " ", said: "" },
  del: { sign: "−", said: "removed: " },
  add: { sign: "+", said: "added: " },
};

/**
 * A file's change as a line diff: each changed run with two lines of
 * context, a removed line marked "−" and in the removal colour, an added
 * one "+" and in the addition colour, and either said in words for a
 * screen reader.
 */
export function DiffView({ before, after, label }: { before: string | null; after: string | null; label: string }) {
  const [side, setSide] = useState(false);
  const lines = lineDiff(before, after);
  const runs = hunks(lines);
  const { removed, added } = diffStat(lines);
  if (runs.length === 0) return <p className="muted">The file did not change.</p>;
  return (
    <figure className="diff">
      <figcaption className="muted">
        {label}: {plural(removed, "line")} removed, {plural(added, "line")} added{" "}
        <span className="theme-switch" role="group" aria-label="How the change is shown">
          <button
            type="button"
            aria-pressed={!side}
            onClick={() => {
              setSide(false);
            }}
          >
            Inline
          </button>
          <button
            type="button"
            aria-pressed={side}
            onClick={() => {
              setSide(true);
            }}
          >
            Side by side
          </button>
        </span>
      </figcaption>
      {side && runs.map((h, i) => <SideBySide key={i} lines={h.lines} />)}
      {!side &&
        runs.map((h, i) => (
          <pre key={i} className="diff-hunk">
            {h.lines.map((l, k) => (
              <span key={k} className={`diff-line diff-${l.kind}`}>
                <span className="diff-num" aria-hidden="true">
                  {l.kind === "add" ? "" : String(l.before ?? "")}
                </span>
                <span className="diff-num" aria-hidden="true">
                  {l.kind === "del" ? "" : String(l.after ?? "")}
                </span>
                <span aria-hidden="true">{MARK[l.kind].sign} </span>
                {l.kind !== "same" && <span className="visually-hidden">{MARK[l.kind].said}</span>}
                {l.text}
                {"\n"}
              </span>
            ))}
          </pre>
        ))}
    </figure>
  );
}

function intentOf(e: { intent?: string | string[] | null }): string {
  return Array.isArray(e.intent) ? e.intent.join("; ") : (e.intent ?? "");
}

function Cell({ line, side }: { line?: DiffLine; side: "before" | "after" }) {
  if (!line) return <td className="diff-empty" />;
  const changed = line.kind !== "same";
  return (
    <td className={`diff-${line.kind}`}>
      <span className="diff-num" aria-hidden="true">
        {String((side === "before" ? line.before : line.after) ?? "")}
      </span>
      {changed && <span className="visually-hidden">{MARK[line.kind].said}</span>}
      {line.text}
    </td>
  );
}

/** One hunk as a two-column table: the file before on the left, after on the right. */
function SideBySide({ lines }: { lines: DiffLine[] }) {
  return (
    <table className="diff-side">
      <thead>
        <tr>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {sideBySide(lines).map((r, i) => (
          <tr key={i}>
            <Cell line={r.left} side="before" />
            <Cell line={r.right} side="after" />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Any two versions of an entity compared (R6.37): those catalyst still
 * holds, each named by its place in the history and its date.
 */
export function CompareVersions({ entries }: { entries: HistoryEntry[] }) {
  const versions = entries
    .map((e, i) => ({ n: i + 1, e }))
    .filter(({ e }) => !e.redacted && e.after !== null && e.content_after !== null);
  const [from, setFrom] = useState(versions.length >= 2 ? versions[versions.length - 2].n : 0);
  const [to, setTo] = useState(versions.length >= 1 ? versions[versions.length - 1].n : 0);
  if (versions.length < 2) return null;
  const pick = (n: number) => versions.find((v) => v.n === n)?.e.content_after ?? null;
  const option = (v: { n: number; e: HistoryEntry }) => (
    <option key={v.n} value={v.n}>
      #{v.n} · {v.e.timestamp}
    </option>
  );
  return (
    <section aria-labelledby="compare-versions">
      <h4 id="compare-versions">Compare two versions</h4>
      <p className="filters">
        <label>
          From{" "}
          <select
            value={from}
            onChange={(e) => {
              setFrom(Number(e.target.value));
            }}
          >
            {versions.map(option)}
          </select>
        </label>{" "}
        <label>
          to{" "}
          <select
            value={to}
            onChange={(e) => {
              setTo(Number(e.target.value));
            }}
          >
            {versions.map(option)}
          </select>
        </label>
      </p>
      <DiffView before={pick(from)} after={pick(to)} label={`From #${String(from)} to #${String(to)}`} />
    </section>
  );
}

/** What one change did to the file, in a word. */
export function changeKind(e: HistoryEntry): string {
  if (e.before === null && e.after !== null) return "created";
  if (e.after === null && e.before !== null) return "removed";
  return "changed";
}

/** One change's content, or why it cannot be shown. */
function ChangeBody({ entry }: { entry: HistoryEntry }) {
  if (entry.redacted) return <p className="muted">Its content was redacted (catalyst journal redact): not shown.</p>;
  const missing =
    (entry.before !== null && entry.content_before === null) || (entry.after !== null && entry.content_after === null);
  if (missing) return <p className="muted">catalyst no longer holds this version of the file.</p>;
  return <DiffView before={entry.content_before} after={entry.content_after} label="The change" />;
}

/**
 * An entity's history (studio-SHELL-000007): every change to its file,
 * newest first, each opening to what it changed. Reverting is a new change
 * made through catalyst, never here.
 */
export function EntityHistory({ entries, id }: { entries: HistoryEntry[]; id?: string }) {
  const host = useHost();
  if (entries.length === 0) return <p className="muted">No entry changed its file.</p>;
  const last = entries.length;
  return (
    <>
      <CompareVersions entries={entries} />
      <ol className="history">
        {[...entries].reverse().map((e, i) => {
          const n = last - i; // its position in the history, from the first change: `#n`
          const restorable = id && host?.act && n < last && !e.redacted && e.after !== null && e.content_after !== null;
          return (
            <li key={`${e.timestamp ?? ""}-${String(i)}`}>
              <details>
                <summary>
                  <time>{e.timestamp}</time> {e.actor} · {e.action ?? e.command} · {changeKind(e)}
                  {e.tier && <span className="muted"> ({e.tier})</span>}: {intentOf(e)}
                </summary>
                <ChangeBody entry={e} />
                {restorable && (
                  <ActionForm
                    host={host}
                    label="Restore this version"
                    action={{ verb: "restore", id, to: `#${String(n)}` }}
                  />
                )}
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}
