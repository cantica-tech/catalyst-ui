import { useEffect, useState } from "react";

import { ApiError, type RunRecord, type StudioClient } from "./client.js";
import { Status } from "./Status.js";

function money(v: number): string {
  return `$${v.toFixed(4)}`;
}

/** What each command cost across its runs, most expensive first (R6.22). */
export function costByCommand(runs: RunRecord[]): { command: string; runs: number; cost: number }[] {
  const by = new Map<string, { command: string; runs: number; cost: number }>();
  for (const r of runs) {
    const row = by.get(r.command) ?? { command: r.command, runs: 0, cost: 0 };
    row.runs++;
    row.cost += r.cost_usd ?? 0;
    by.set(r.command, row);
  }
  return [...by.values()].sort((a, b) => b.cost - a.cost || a.command.localeCompare(b.command));
}

/** The person's past agent runs (studio-SHELL-000017): newest first, with tokens and cost, then the totals. */
export function RunHistoryView({ runs }: { runs: RunRecord[] }) {
  const total = runs.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);
  return (
    <section aria-labelledby="run-history">
      <h3 id="run-history">Your runs</h3>
      {runs.length === 0 ? (
        <p className="muted">No agent run yet in this project.</p>
      ) : (
        <>
          <p>
            {runs.length} run{runs.length === 1 ? "" : "s"}, {money(total)} in all.
          </p>
          <table>
            <caption className="muted">Cost per command</caption>
            <thead>
              <tr>
                <th scope="col">Command</th>
                <th scope="col">Runs</th>
                <th scope="col">Cost</th>
              </tr>
            </thead>
            <tbody>
              {costByCommand(runs).map((c) => (
                <tr key={c.command}>
                  <td>
                    <code>/{c.command}</code>
                  </td>
                  <td>{c.runs}</td>
                  <td>{money(c.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ol className="journal" reversed>
            {[...runs].reverse().map((r, i) => (
              <li key={`${r.timestamp}-${String(i)}`}>
                <time>{r.timestamp}</time>{" "}
                {r.ok ? <Status tone="ok" label="ok" /> : <Status tone="error" label="failed" />}{" "}
                <code>
                  /{r.command} {r.arguments}
                </code>{" "}
                <span className="muted">
                  {r.turns} turn{r.turns === 1 ? "" : "s"}, {r.usage.input + r.usage.cache_read + r.usage.cache_write}{" "}
                  in, {r.usage.output} out{r.cost_usd !== null ? `, ${money(r.cost_usd)}` : ""}
                  {r.denied.length > 0 ? `; denied: ${r.denied.join(", ")}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/** The run history, read from catalyst's run log; nothing when the catalyst serving the page keeps none. */
export function RunHistory({ client }: { client: StudioClient }) {
  const [runs, setRuns] = useState<RunRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    client.runs().then(
      (r) => {
        if (live) setRuns(r);
      },
      (err: unknown) => {
        if (live && !(err instanceof ApiError && err.status === 404)) setRuns([]);
      },
    );
    return () => {
      live = false;
    };
  }, [client]);
  return runs ? <RunHistoryView runs={runs} /> : null;
}
