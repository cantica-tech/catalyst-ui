import type { RunEvent } from "./host.js";
import { Status } from "./Status.js";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  return typeof v === "number" ? v : 0;
}

/** How a run ended, in one line: turns, tokens and cost (what R5.5 measures). */
export function runSummary(end: RunEvent): string {
  const u = (end.usage ?? {}) as Record<string, unknown>;
  const cost = typeof end.cost_usd === "number" ? `, $${end.cost_usd.toFixed(4)}` : "";
  return `${String(num(end.turns))} turn${num(end.turns) === 1 ? "" : "s"}; tokens ${String(num(u.input))} in, ${String(num(u.output))} out, cache ${String(num(u.cache_read))} read, ${String(num(u.cache_write))} written${cost}`;
}

/** A run as it happens (studio-SHELL-000015): what the agent says and does, then how it ended. */
export function RunConsole({ events, declined }: { events: RunEvent[]; declined: boolean }) {
  const end = events.find((e) => e.event === "end");
  const denied = Array.isArray(end?.denied) ? (end.denied as string[]) : [];
  const status = declined ? (
    <Status tone="info" label="Not run: you declined" />
  ) : !end ? (
    <Status tone="info" label="Running" />
  ) : end.ok ? (
    <Status tone="ok" label={`Done in ${runSummary(end)}`} />
  ) : (
    <Status tone="error" label={`Failed after ${runSummary(end)}`} />
  );
  return (
    <section aria-labelledby="run-console" className="run-console">
      <h3 id="run-console">Run</h3>
      <p aria-live="polite">{status}</p>
      <ol className="run-log">
        {events.map((e, i) => {
          if (e.event === "start")
            return (
              <li key={i} className="muted">
                /{str(e.command)} {str(e.arguments)} → {str(e.agent)}
              </li>
            );
          if (e.event === "session")
            return (
              <li key={i} className="muted">
                model {str(e.model)}
              </li>
            );
          if (e.event === "text")
            return (
              <li key={i} className="section-text">
                {str(e.text)}
              </li>
            );
          if (e.event === "tool")
            return (
              <li key={i}>
                <span aria-hidden="true">⚙ </span>
                <code>{str(e.name)}</code> <span className="muted">{str(e.input)}</span>
              </li>
            );
          if (e.event === "tool_result" && e.ok === false)
            return (
              <li key={i}>
                <Status tone="error" label={`${str(e.name)} failed`} />
              </li>
            );
          return null;
        })}
      </ol>
      {denied.length > 0 && (
        <p>
          <Status tone="warn" label={`Denied by your agent settings: ${denied.join(", ")}`} />{" "}
          <span className="muted">Allow them there for a run to use them; catalyst widens no permission.</span>
        </p>
      )}
      {end && !end.ok && str(end.result) && <p className="muted">{str(end.result)}</p>}
    </section>
  );
}
