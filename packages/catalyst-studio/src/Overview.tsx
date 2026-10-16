import { useEffect, useState } from "react";

import { type CheckReport, type InboxReport, type StudioClient } from "./client.js";
import { Status } from "./Status.js";

const INBOX_LABELS: Record<string, string> = {
  "unrecorded-commit": "Commits made outside catalyst",
  "unrecorded-change": "Changes made outside catalyst",
  reconciliation: "Reconciliation cases to decide",
  analysis: "Analyses awaiting a decision",
};

export interface OverviewData {
  check: CheckReport;
  inbox: InboxReport;
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** The project's health and what waits for a person, as catalyst reports them. */
export function OverviewView({ data }: { data: OverviewData }) {
  const { check, inbox } = data;
  const waiting = Object.entries(inbox.counts).filter(([, n]) => n > 0);
  const total = waiting.reduce((sum, [, n]) => sum + n, 0);
  return (
    <>
      <h2>Overview</h2>
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
      </section>
      <section aria-labelledby="waiting">
        <h3 id="waiting">Waiting for you</h3>
        {total === 0 ? (
          <p>
            <Status tone="ok" label="Nothing waiting" />
          </p>
        ) : (
          <>
            <p>
              <Status tone="warn" label={`${plural(total, "decision")} to take`} />
            </p>
            <ul>
              {waiting.map(([kind, n]) => (
                <li key={kind}>
                  {INBOX_LABELS[kind] ?? kind}: {n}
                </li>
              ))}
            </ul>
            <p className="muted">
              To see and settle them: <code>catalyst inbox</code>
            </p>
          </>
        )}
      </section>
    </>
  );
}

type Load = { state: "loading" } | { state: "ready"; data: OverviewData } | { state: "failed"; message: string };

/** Loads the overview, then again after each change catalyst announces. */
export function Overview({ client }: { client: StudioClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    const abort = new AbortController();
    const refresh = async () => {
      try {
        const [check, inbox] = await Promise.all([client.check(), client.inbox()]);
        if (!abort.signal.aborted) setLoad({ state: "ready", data: { check, inbox } });
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
    <div aria-live="polite">
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
      {load.state === "ready" && <OverviewView data={load.data} />}
    </div>
  );
}
