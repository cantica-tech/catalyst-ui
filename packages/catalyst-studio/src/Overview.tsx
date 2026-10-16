import { useEffect, useState } from "react";

import type { Backlog, CheckReport, Head, InboxReport, JournalEntry, StudioClient } from "./client.js";
import { describeEvidence } from "./evidence.js";
import { Status } from "./Status.js";

/** What the dashboard shows, as catalyst reports it (catalyst roadmap R6.5, R6.6). */
export interface OverviewData {
  check: CheckReport;
  inbox: InboxReport;
  backlog?: Backlog;
  head?: Head;
  /** The latest journal entries, newest first. */
  recent?: JournalEntry[];
  /** Type prefix → its plural name, from the module's types. */
  typeNames?: Record<string, string>;
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** Compares dotted versions: negative when `a` is older than `b`. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(/[.+-]/).map((p) => Number.parseInt(p, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function Health({ check }: { check: CheckReport }) {
  return (
    <section aria-labelledby="health">
      <h3 id="health">Health</h3>
      <p>
        {check.errors.length === 0 ? (
          <Status tone="ok" label="No errors" />
        ) : (
          <Status tone="error" label={plural(check.errors.length, "error")} />
        )}{" "}
        {check.warnings.length > 0 && <Status tone="warn" label={plural(check.warnings.length, "warning")} />}
      </p>
      {check.errors.length > 0 && (
        <ul>
          {check.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {check.warnings.length > 0 && (
        <details>
          <summary>The warnings</summary>
          <ul>
            {check.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function Drift({ inbox }: { inbox: InboxReport }) {
  return (
    <section aria-labelledby="drift">
      <h3 id="drift">Waiting for you</h3>
      {inbox.items.length === 0 ? (
        <p>
          <Status tone="ok" label="Nothing waiting" />
        </p>
      ) : (
        <>
          <p>
            <Status tone="warn" label={`${plural(inbox.items.length, "decision")} to take`} />
          </p>
          <ul className="drift">
            {inbox.items.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <strong>{item.title}</strong> <span className="muted">({item.kind})</span>
                {describeEvidence(item) && <div className="muted">{describeEvidence(item)}</div>}
                {item.settle.length > 0 && (
                  <div>
                    Settle with:{" "}
                    {item.settle.map((cmd, i) => (
                      <span key={cmd}>
                        {i > 0 && " or "}
                        <code>{cmd}</code>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function OpenWork({ backlog, typeNames }: { backlog: Backlog; typeNames: Record<string, string> }) {
  const types = Object.entries(backlog.open).filter(([, byStatus]) => Object.keys(byStatus).length > 0);
  return (
    <section aria-labelledby="open-work">
      <h3 id="open-work">Open work</h3>
      {types.length === 0 ? (
        <p>
          <Status tone="ok" label="No open work" />
        </p>
      ) : (
        <table>
          <caption className="muted">Open items by type and status</caption>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Items</th>
            </tr>
          </thead>
          <tbody>
            {types.flatMap(([prefix, byStatus]) =>
              Object.entries(byStatus).map(([status, ids]) => (
                <tr key={`${prefix}:${status}`}>
                  <td>{typeNames[prefix] ?? prefix}</td>
                  <td>{status}</td>
                  <td>{ids.length}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}
      {backlog.missing_links.length > 0 && (
        <p>
          <Status tone="warn" label={plural(backlog.missing_links.length, "missing link")} />{" "}
          <span className="muted">{backlog.missing_links.map((m) => `${m.id} (${m.field})`).join(", ")}</span>
        </p>
      )}
      {backlog.rules_without_open_work.length > 0 && (
        <p className="muted">{plural(backlog.rules_without_open_work.length, "rule")} with no open work.</p>
      )}
    </section>
  );
}

function Versions({ head }: { head: Head }) {
  if (!head.kernel) return null;
  const behind = head.catalyst ? compareVersions(head.kernel, head.catalyst) < 0 : false;
  return (
    <section aria-labelledby="versions">
      <h3 id="versions">Versions</h3>
      <p>
        Kernel {head.kernel}
        {(head.modules ?? []).map((m) => (
          <span key={m.id}>
            {" "}
            · {m.id} {m.version}
          </span>
        ))}
        {head.catalyst && <span className="muted"> · read with catalyst {head.catalyst}</span>}
      </p>
      {behind && (
        <p>
          <Status tone="warn" label="Behind" /> catalyst {head.catalyst} is newer than this deployment&apos;s kernel;
          see <code>catalyst sync plan</code>
        </p>
      )}
    </section>
  );
}

function Activity({ recent }: { recent: JournalEntry[] }) {
  return (
    <section aria-labelledby="activity">
      <h3 id="activity">Recent activity</h3>
      {recent.length === 0 ? (
        <p className="muted">The journal has no entry yet.</p>
      ) : (
        <ol className="journal">
          {recent.map((e) => (
            <li key={e.at}>
              <time>{e.timestamp}</time> {e.actor} · {e.action}
              {e.artifact ? ` ${e.artifact}` : ""}: {Array.isArray(e.intent) ? e.intent.join("; ") : e.intent}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** The dashboard: health, what waits for a person, open work, versions and recent activity. */
export function OverviewView({ data }: { data: OverviewData }) {
  return (
    <>
      <h2>Overview</h2>
      <Health check={data.check} />
      <Drift inbox={data.inbox} />
      {data.backlog && <OpenWork backlog={data.backlog} typeNames={data.typeNames ?? {}} />}
      {data.head && <Versions head={data.head} />}
      {data.recent && <Activity recent={data.recent} />}
    </>
  );
}

type Load =
  { state: "loading" } | { state: "ready"; data: OverviewData; at: string } | { state: "failed"; message: string };

const RECENT = 10;

/** Loads the dashboard, then again after each change catalyst announces. */
export function Overview({ client }: { client: StudioClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    const abort = new AbortController();
    const refresh = async () => {
      try {
        const [check, inbox, backlog, head, journal, graph] = await Promise.all([
          client.check(),
          client.inbox(),
          client.backlog(),
          client.head(),
          client.journal(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
          client.graph(),
        ]);
        const typeNames = Object.fromEntries(Object.entries(graph.types).map(([p, t]) => [p, t.plural_name]));
        const recent = journal.slice(-RECENT).reverse();
        const at = new Date().toLocaleTimeString();
        if (!abort.signal.aborted)
          setLoad({ state: "ready", data: { check, inbox, backlog, head, recent, typeNames }, at });
      } catch (err) {
        if (!abort.signal.aborted) setLoad({ state: "failed", message: String(err) });
      }
    };
    void refresh();
    client
      .events(() => {
        void refresh();
      }, abort.signal)
      .catch(() => undefined); // the page keeps the last state; reloading reconnects
    return () => {
      abort.abort();
    };
  }, [client]);

  return (
    <div>
      {load.state === "loading" && (
        <>
          <h2>Overview</h2>
          <p>
            <Status tone="info" label="Loading" />
          </p>
        </>
      )}
      {load.state === "failed" && (
        <>
          <h2>Overview</h2>
          <p>
            <Status tone="error" label="catalyst did not answer" /> <span className="muted">{load.message}</span>
          </p>
        </>
      )}
      {load.state === "ready" && (
        <>
          <OverviewView data={load.data} />
          {/* only this short line is announced, not the whole page, on each change */}
          <p className="muted" aria-live="polite">
            Updated {load.at}
          </p>
        </>
      )}
    </div>
  );
}
