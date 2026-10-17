import type { ActionResult } from "./host.js";
import { Status } from "./Status.js";

/** One `check` finding a try adds or clears. */
export interface TryFinding {
  level: "error" | "warning";
  text: string;
  entity: string | null;
}

/** What `catalyst try --json` prints (catalyst >= 0.82.0, `spec/try.schema.json`). */
export interface TryReport {
  change: string;
  ok: boolean;
  refused: string | null;
  files: { path: string; before: string | null; after: string | null }[];
  check: { added: TryFinding[]; cleared: TryFinding[] };
  gates: { id: string; gate: string; missing: number }[];
}

/** The report in a host's answer, or null when catalyst gave none (an older catalyst, a refused field). */
export function tryReport(result: ActionResult): TryReport | null {
  try {
    const parsed = JSON.parse(result.output) as Partial<TryReport> | null;
    return parsed && typeof parsed.change === "string" && Array.isArray(parsed.files) ? (parsed as TryReport) : null;
  } catch {
    return null;
  }
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * What an action would do (studio-SHELL-000020), from `catalyst try` on a
 * scratch copy: its refusal, or the files, findings and approvals.
 */
export function TryOutcome({ result }: { result: ActionResult }) {
  const report = tryReport(result);
  if (!report) {
    return (
      <Status
        tone="error"
        label={`Not tried: ${result.error || "catalyst gave no report (catalyst 0.82.0 or later)"}`}
      />
    );
  }
  if (!report.ok) {
    return <Status tone="warn" label={`It would be refused: ${report.refused ?? "catalyst refused it"}`} />;
  }
  const { added, cleared } = report.check;
  return (
    <div className="try-outcome">
      <Status
        tone={added.some((f) => f.level === "error") ? "warn" : "ok"}
        label={`Tried: ${plural(report.files.length, "file")} written, ${plural(added.length, "finding")} added, ${plural(cleared.length, "finding")} cleared`}
      />{" "}
      <span className="muted">On a scratch copy; nothing changed.</span>
      {(added.length > 0 || cleared.length > 0 || report.gates.length > 0) && (
        <ul>
          {added.map((f) => (
            <li key={`+${f.text}`}>
              <Status tone={f.level === "error" ? "error" : "warn"} label={`Adds ${f.level}`} /> {f.text}
            </li>
          ))}
          {cleared.map((f) => (
            <li key={`-${f.text}`}>
              <Status tone="ok" label={`Clears ${f.level}`} /> {f.text}
            </li>
          ))}
          {report.gates.map((g) => (
            <li key={`${g.id}:${g.gate}`}>
              <Status tone="warn" label="Waits for approval" /> <code>{g.id}</code> under gate <code>{g.gate}</code>:{" "}
              {plural(g.missing, "approval")} missing
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
