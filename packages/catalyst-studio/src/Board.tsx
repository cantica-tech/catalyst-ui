import { isEntity } from "catalyst-core";
import { useEffect, useId, useState } from "react";

import type { GraphArtifactJson } from "catalyst-core";

import type { EntityType, Graph, StudioClient } from "./client.js";
import { ActionForm } from "./ActionForm.js";
import { DriftBadge } from "./drift.js";
import { ImpactBar, ImpactMark } from "./impact.js";
import { clipboardCopy, CopyButton } from "./Copy.js";
import { useHost, type HostRuns } from "./host.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^`|`$/g, "") : "";
}

/** The types a board can show: declared with states, holding artifacts with pages (not table rows). */
export function boardTypes(graph: Graph): { prefix: string; type: EntityType; count: number }[] {
  return Object.entries(graph.types)
    .filter(([, t]) => t.states.length > 0)
    .map(([prefix, type]) => ({
      prefix,
      type,
      count: graph.artifacts.filter((a) => a.type === prefix && !a.row).length,
    }))
    .filter((t) => t.count > 0)
    .sort((a, b) => a.type.plural_name.localeCompare(b.type.plural_name));
}

export interface Column {
  state: string;
  closed: boolean;
  cards: GraphArtifactJson[];
}

/**
 * One column per state, in the type's order; a status the type does not
 * declare gets its own column after them. A closed state with no card is
 * left out.
 */
export function boardColumns(graph: Graph, prefix: string): Column[] {
  const type = graph.types[prefix];
  const cards = graph.artifacts.filter(isEntity).filter((a) => a.type === prefix);
  const statuses = [
    ...type.states,
    ...new Set(cards.map((a) => text(a.Status)).filter((s) => !type.states.includes(s))),
  ];
  return statuses
    .map((state) => ({
      state: state || "No status",
      closed: type.closed_states.includes(state),
      cards: cards.filter((a) => text(a.Status) === state).sort((x, y) => x.id.localeCompare(y.id)),
    }))
    .filter((c) => !c.closed || c.cards.length > 0);
}

/** The states a card may move to, by its type's transitions (all other states when it declares none). */
export function movesFrom(type: EntityType, state: string): string[] {
  if (type.transitions && type.transitions.length > 0)
    return type.transitions.filter((t) => t.from === state).map((t) => t.to);
  return type.states.filter((s) => s !== state);
}

function Card({
  artifact,
  type,
  state,
  copy,
  selected,
  onSelect,
}: {
  artifact: GraphArtifactJson;
  type: EntityType;
  state: string;
  copy: (text: string) => Promise<void>;
  /** Whether the card is in the selection, when the host can act on several (R6.17). */
  selected?: boolean;
  onSelect?: (on: boolean) => void;
}) {
  const navigate = useNavigate();
  const host = useHost();
  const moves = movesFrom(type, state);
  return (
    <li className="card">
      {onSelect && (
        <input
          type="checkbox"
          aria-label={`Select ${artifact.id}`}
          checked={selected === true}
          onChange={(e) => {
            onSelect(e.target.checked);
          }}
        />
      )}{" "}
      <button
        type="button"
        className="link-button"
        onClick={() => {
          navigate("artifacts", artifact.id);
        }}
      >
        <code>{artifact.id}</code>
      </button>{" "}
      {artifact.title} <DriftBadge id={artifact.id} /> <ImpactMark id={artifact.id} />
      {moves.length > 0 && (
        <details>
          <summary className="muted">Move to…</summary>
          <ul className="settle">
            {moves.map((to) => {
              const command = `catalyst status set ${artifact.id} ${to}`;
              return (
                <li key={to}>
                  {host?.act ? (
                    <ActionForm
                      host={host}
                      label={`Move to ${to}`}
                      action={{ verb: "status-set", id: artifact.id, state: to }}
                    />
                  ) : (
                    <>
                      <code>{command}</code> <CopyButton text={command} copy={copy} />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </li>
  );
}

/**
 * The selected cards moved to one state with one reason (R6.17): one dialog
 * in the host lists each command; each move is its own journaled change, and
 * catalyst checks each against its type's transitions and guards.
 */
export function BatchMove({
  host,
  ids,
  states,
  onDone,
}: {
  host: HostRuns;
  ids: string[];
  states: string[];
  /** Called with what happened, once the host answered; the board says it (the form leaves with the selection). */
  onDone: (said: string) => void;
}) {
  const [to, setTo] = useState(states[0] ?? "");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState("");
  const toId = useId();
  const whyId = useId();
  const actBatch = host.actBatch;
  if (!actBatch) return null;
  return (
    <form
      className="action-form batch"
      aria-label="Move the selected cards"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setSaid("");
        void actBatch(ids.map((id) => ({ verb: "status-set", id, state: to, intent: why.trim() }))).then((r) => {
          setBusy(false);
          if (r.declined) setSaid("Not done: you declined");
          else if (r.error) setSaid(r.error);
          else {
            const failed = r.results.filter((x) => !x.ok);
            onDone(
              failed.length === 0
                ? `${String(r.results.length)} moved; catalyst journaled each`
                : `${String(r.results.length - failed.length)} moved, ${String(failed.length)} refused: ${failed.map((f) => f.error).join("; ")}`,
            );
          }
        });
      }}
    >
      <strong>{ids.length} selected</strong> <label htmlFor={toId}>Move to</label>{" "}
      <select
        id={toId}
        value={to}
        onChange={(e) => {
          setTo(e.target.value);
        }}
      >
        {states.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>{" "}
      <label htmlFor={whyId}>Why</label>{" "}
      <input
        id={whyId}
        type="text"
        required
        maxLength={500}
        value={why}
        onChange={(e) => {
          setWhy(e.target.value);
        }}
      />{" "}
      <button type="submit" disabled={busy || !why.trim()}>
        Move the selected
      </button>{" "}
      <span aria-live="polite">{busy ? "Waiting for your confirmation in the editor" : said}</span>
    </form>
  );
}

/** One type's board (studio-SHELL-000008): a column per state, moves shown as their commands. */
export function BoardView({
  graph,
  copy = clipboardCopy,
  initialType,
}: {
  graph: Graph;
  copy?: (text: string) => Promise<void>;
  initialType?: string;
}) {
  const types = boardTypes(graph);
  const host = useHost();
  const [prefix, setPrefix] = useState(initialType ?? (types.length > 0 ? types[0].prefix : ""));
  const [selection, setSelection] = useState<string[]>([]);
  const [moved, setMoved] = useState("");
  const batchable = host?.actBatch !== undefined;
  const pickId = useId();
  const chosen = types.find((t) => t.prefix === prefix) ?? (types.length > 0 ? types[0] : undefined);
  if (!chosen) {
    return (
      <>
        <h2>Board</h2>
        <p className="muted">No type with states holds any artifact yet.</p>
      </>
    );
  }
  const columns = boardColumns(graph, chosen.prefix);
  return (
    <>
      <h2>Board</h2>
      <p>
        <label htmlFor={pickId}>Type</label>{" "}
        <select
          id={pickId}
          value={chosen.prefix}
          onChange={(event) => {
            setPrefix(event.target.value);
          }}
        >
          {types.map((t) => (
            <option key={t.prefix} value={t.prefix}>
              {t.type.plural_name} ({t.count})
            </option>
          ))}
        </select>
      </p>
      <p className="muted">
        A move is the command shown on its card; catalyst checks the type&apos;s guards when it runs.
      </p>
      {host && batchable && selection.length > 0 && (
        <BatchMove
          host={host}
          ids={selection}
          states={chosen.type.states}
          onDone={(said) => {
            setSelection([]);
            setMoved(said);
          }}
        />
      )}
      <p className="muted" aria-live="polite">
        {moved}
      </p>
      <ImpactBar />
      <div className="board">
        {columns.map((c) => {
          const headingId = `${pickId}-${c.state}`;
          const list = (
            <ul className="cards">
              {c.cards.map((a) => (
                <Card
                  key={a.id}
                  artifact={a}
                  type={chosen.type}
                  state={c.state}
                  copy={copy}
                  selected={selection.includes(a.id)}
                  onSelect={
                    batchable
                      ? (on) => {
                          setSelection((s) => (on ? [...s, a.id] : s.filter((x) => x !== a.id)));
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          );
          return (
            <section key={c.state} className="column" aria-labelledby={headingId}>
              {c.closed ? (
                <details>
                  <summary>
                    <h3 id={headingId}>
                      <Status tone="ok" label={c.state} /> ({c.cards.length})
                    </h3>
                  </summary>
                  {list}
                </details>
              ) : (
                <>
                  <h3 id={headingId}>
                    {c.state} ({c.cards.length})
                  </h3>
                  {c.cards.length === 0 ? <p className="muted">None.</p> : list}
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

type Load = { state: "loading" } | { state: "ready"; graph: Graph } | { state: "failed"; message: string };

/** The Board view, reloaded after each change catalyst announces. */
export function Board({ client, target }: { client: StudioClient; target?: string }) {
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
        <h2>Board</h2>
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
  return <BoardView graph={load.graph} initialType={target} />;
}
