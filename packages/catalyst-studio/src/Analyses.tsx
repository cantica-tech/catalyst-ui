import { useEffect, useId, useState } from "react";

import type { AnalysisFinding, AnalysisReport, AnalysisSummary, StudioClient } from "./client.js";
import { CopyButton } from "./Copy.js";
import { useHost, type ActionResult, type RunEvent, type RunHandle } from "./host.js";
import { RunConsole } from "./RunConsole.js";
import { useNavigate } from "./Shell.js";
import { Status, type StatusTone } from "./Status.js";

/** An analysis's phase as a tone (`ANALYSIS-PLAYBOOK.md`: Extracting … Closed). */
export function phaseTone(phase: string): StatusTone {
  if (phase === "Closed") return "ok";
  if (phase === "Abandoned") return "info";
  if (phase === "Deciding") return "warn";
  return "info";
}

/** "four-eyes" for two independent passes, "single-pass" for one (catalyst >= 0.84.0). */
export function passesLabel(passes: number): string {
  return passes === 1 ? "single-pass" : "four-eyes";
}

/** The findings still waiting for a person's decision, then the decided ones, each in ID order. */
export function triage(items: AnalysisFinding[]): { open: AnalysisFinding[]; decided: AnalysisFinding[] } {
  const byId = (a: AnalysisFinding, b: AnalysisFinding) => a.id.localeCompare(b.id, undefined, { numeric: true });
  return {
    open: items.filter((f) => !f.decision).sort(byId),
    decided: items.filter((f) => f.decision).sort(byId),
  };
}

/** The closed analyses oldest first, each with how many of its findings were accepted and rejected. */
export function trend(rows: AnalysisSummary[]): AnalysisSummary[] {
  return rows.filter((r) => r.phase === "Closed").sort((a, b) => a.id.localeCompare(b.id));
}

/** The agent command that proposes a fix for an accepted defect: a bug against the rule it breaks. */
export function fixCommand(analysis: string, f: AnalysisFinding): string {
  const breaks = f.breaks ? ` against ${f.breaks}` : "";
  return `/create bug ${f.title ?? f.id} (${analysis} ${f.id}${breaks})`;
}

function Evidence({ f }: { f: AnalysisFinding }) {
  const ev = f.evidence ?? [];
  if (ev.length === 0) return null;
  return (
    <ul className="evidence">
      {ev.map((e, i) => (
        <li key={`${e.path}:${String(e.line ?? i)}`}>
          <code>
            {e.path}
            {e.line ? `:${String(e.line)}` : ""}
          </code>
        </li>
      ))}
    </ul>
  );
}

/** One person's decision on one finding, through the host (law L4); no Try it: catalyst try has no analysis verb. */
function DecideForm({ analysis, finding }: { analysis: string; finding: AnalysisFinding }) {
  const host = useHost();
  const ids = { why: useId(), artifact: useId() };
  const [why, setWhy] = useState("");
  const [artifact, setArtifact] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  if (!host?.act) {
    return (
      <p className="muted">
        Decide it with your agent, or{" "}
        <code>
          catalyst analysis decide {analysis} {finding.id} accept|reject
        </code>
        .
      </p>
    );
  }
  const act = host.act;
  const decide = (verdict: "accept" | "reject") => {
    setBusy(true);
    setResult(null);
    void act({
      verb: "analysis-decide",
      id: analysis,
      finding: finding.id,
      verdict,
      intent: why.trim(),
      ...(verdict === "accept" ? { artifact: artifact.trim() } : {}),
    }).then((r) => {
      setBusy(false);
      setResult(r);
    });
  };
  return (
    <form
      className="action-form"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <label htmlFor={ids.why}>Why</label>{" "}
      <input
        id={ids.why}
        type="text"
        value={why}
        onChange={(event) => {
          setWhy(event.target.value);
        }}
      />{" "}
      <label htmlFor={ids.artifact}>Became</label>{" "}
      <input
        id={ids.artifact}
        type="text"
        placeholder={
          finding.kind === "domain" ? "a domain code" : finding.kind === "rule" ? "a rule ID" : "an artifact ID"
        }
        value={artifact}
        onChange={(event) => {
          setArtifact(event.target.value);
        }}
      />{" "}
      <button
        type="button"
        disabled={busy || !why.trim() || !artifact.trim()}
        onClick={() => {
          decide("accept");
        }}
      >
        Accept
      </button>{" "}
      <button
        type="button"
        disabled={busy || !why.trim()}
        onClick={() => {
          decide("reject");
        }}
      >
        Reject
      </button>
      {result && (
        <p role="status">
          {result.ok ? (
            <Status tone="ok" label="Decided" />
          ) : (
            <>
              <Status tone="error" label={result.declined ? "Not run" : "catalyst refused"} />{" "}
              <span className="muted">{result.error || result.output}</span>
            </>
          )}
        </p>
      )}
    </form>
  );
}

/** For an accepted defect: the agent command that opens its bug, copied or run through the host. */
function ProposeFix({ analysis, finding }: { analysis: string; finding: AnalysisFinding }) {
  const host = useHost();
  const command = fixCommand(analysis, finding);
  const [events, setEvents] = useState<RunEvent[] | null>(null);
  const [declined, setDeclined] = useState(false);
  const [handle, setHandle] = useState<RunHandle | null>(null);
  const start = () => {
    if (!host) return;
    const [name, ...rest] = command.split(" ");
    setEvents([]);
    setDeclined(false);
    setHandle(
      host.run(
        name.replace(/^\//, ""),
        rest.join(" "),
        (event) => {
          setEvents((all) => [...(all ?? []), event]);
        },
        () => {
          setDeclined(true);
        },
      ),
    );
  };
  return (
    <div className="propose-fix">
      <p>
        Propose a fix: <code className="composed">{command}</code> <CopyButton text={command} />{" "}
        {host && (
          <button type="button" onClick={start} disabled={handle !== null && events !== null && !declined}>
            Run with your agent
          </button>
        )}
      </p>
      {events !== null && <RunConsole events={events} declined={declined} />}
    </div>
  );
}

function FindingCard({ analysis, f, deciding }: { analysis: string; f: AnalysisFinding; deciding: boolean }) {
  const navigate = useNavigate();
  const d = f.decision;
  return (
    <li className="finding">
      <p>
        <strong>{f.id}</strong> <span className="muted">{f.kind}</span> {f.title ?? ""}{" "}
        {d ? (
          <Status
            tone={d.verdict === "accept" ? "ok" : "info"}
            label={d.verdict === "accept" ? "Accepted" : "Rejected"}
          />
        ) : (
          <Status tone="warn" label="Undecided" />
        )}
      </p>
      {f.statement && <p>{f.statement}</p>}
      <Evidence f={f} />
      <p className="muted">
        {f.sources?.length ? <>From {f.sources.join(", ")}. </> : null}
        {f.verification ? <>Verified: {f.verification}.</> : null}
        {f.breaks ? <> Breaks {f.breaks}.</> : null}
      </p>
      {d && (
        <p className="muted">
          {d.verdict === "accept" ? "Became " : "Rejected"}
          {d.artifact && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                navigate("artifacts", d.artifact ?? undefined);
              }}
            >
              {d.artifact}
            </button>
          )}
          {d.by ? ` by ${d.by}` : ""}
          {d.at ? `, ${d.at}` : ""}
          {d.reason ? `: ${d.reason}` : ""}
        </p>
      )}
      {!d && deciding && <DecideForm analysis={analysis} finding={f} />}
      {d?.verdict === "accept" && f.kind === "defect" && <ProposeFix analysis={analysis} finding={f} />}
    </li>
  );
}

/** One analysis: its passes, the diff, and each finding with its decision, the open ones first (R6.23). */
export function AnalysisPage({ report, onBack }: { report: AnalysisReport; onBack: () => void }) {
  const { open, decided } = triage(report.items);
  const deciding = report.phase === "Deciding";
  return (
    <article aria-labelledby="analysis-title">
      <p>
        <button type="button" className="link-button" onClick={onBack}>
          ← All analyses
        </button>
      </p>
      <h2 id="analysis-title">
        <code>{report.id}</code> {report.title}
      </h2>
      <p>
        <Status tone={phaseTone(report.phase)} label={report.phase} /> · {passesLabel(report.passes)} ·{" "}
        {report.mode ?? "—"} · {report.scope.join(" ") || "the whole project"}
        {report.code_state && (
          <>
            {" "}
            · at <code>{report.code_state.slice(0, 10)}</code>
          </>
        )}
      </p>
      <section aria-labelledby="analysis-passes">
        <h3 id="analysis-passes">Passes</h3>
        <p>
          Pass A {report.recorded.A ? "recorded" : "not yet"}
          {report.recorded.B !== null && <>, pass B {report.recorded.B ? "recorded" : "not yet"}</>}.
          {report.diff && (
            <>
              {" "}
              Diff: {report.diff.agreed} agreed, {report.diff.conflicting} conflicting, {report.diff.a_only} A-only,{" "}
              {report.diff.b_only} B-only.
            </>
          )}
        </p>
        {report.problems.length > 0 && (
          <ul>
            {report.problems.map((p) => (
              <li key={p}>
                <Status tone="error" label="Problem" /> {p}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="analysis-open">
        <h3 id="analysis-open">To decide ({open.length})</h3>
        {!report.reconciled ? (
          <p className="muted">The findings come once the passes are reconciled.</p>
        ) : open.length === 0 ? (
          <p className="muted">Every finding is decided.</p>
        ) : (
          <ul className="findings">
            {open.map((f) => (
              <FindingCard key={f.id} analysis={report.id} f={f} deciding={deciding} />
            ))}
          </ul>
        )}
      </section>
      {decided.length > 0 && (
        <section aria-labelledby="analysis-decided">
          <h3 id="analysis-decided">Decided ({decided.length})</h3>
          <ul className="findings">
            {decided.map((f) => (
              <FindingCard key={f.id} analysis={report.id} f={f} deciding={deciding} />
            ))}
          </ul>
        </section>
      )}
      {report.dropped.length > 0 && (
        <section aria-labelledby="analysis-dropped">
          <h3 id="analysis-dropped">Dropped at reconciliation ({report.dropped.length})</h3>
          <ul>
            {report.dropped.map((d, i) => (
              <li key={d.source ?? String(i)}>
                <code>{d.source}</code> <span className="muted">{d.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** Every analysis, newest first, and the trend of the closed ones (R6.23). */
export function AnalysisList({ rows, onOpen }: { rows: AnalysisSummary[]; onOpen: (id: string) => void }) {
  const closed = trend(rows);
  const most = Math.max(1, ...closed.map((r) => r.accepted + r.rejected));
  return (
    <>
      <h2>Analyses</h2>
      {rows.length === 0 ? (
        <p className="muted">
          No analysis yet: <code>/run-analysis</code> with your agent starts one.
        </p>
      ) : (
        <table>
          <caption className="muted">Newest first</caption>
          <thead>
            <tr>
              <th scope="col">Analysis</th>
              <th scope="col">Phase</th>
              <th scope="col">Passes</th>
              <th scope="col">Decided</th>
              <th scope="col">Accepted</th>
              <th scope="col">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      onOpen(r.id);
                    }}
                  >
                    <code>{r.id}</code> {r.title}
                  </button>
                </th>
                <td>
                  <Status tone={phaseTone(r.phase)} label={r.phase} />
                </td>
                <td>{passesLabel(r.passes)}</td>
                <td>
                  {r.decided}/{r.findings}
                </td>
                <td>{r.accepted}</td>
                <td>{r.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {closed.length > 0 && (
        <section aria-labelledby="analysis-trend">
          <h3 id="analysis-trend">Trend</h3>
          <p className="muted">Each closed analysis, oldest first: findings accepted and rejected.</p>
          <ul className="trend">
            {closed.map((r) => (
              <li key={r.id}>
                <code>{r.id}</code>{" "}
                <span className="bar accepted" style={{ width: `${String((r.accepted / most) * 12)}em` }} />
                <span className="bar rejected" style={{ width: `${String((r.rejected / most) * 12)}em` }} />{" "}
                <span className="muted">
                  {r.accepted} accepted, {r.rejected} rejected
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

type Load =
  | { state: "loading" }
  | { state: "ready"; rows: AnalysisSummary[]; open: AnalysisReport | null }
  | { state: "failed"; message: string };

/** The analysis workspace (R6.23), reloaded after each change catalyst announces. */
export function Analyses({ client, target }: { client: StudioClient; target?: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [batch, setBatch] = useState(0);
  const [openId, setOpenId] = useState<string | undefined>(target);

  useEffect(() => {
    setOpenId(target);
  }, [target]);

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
    Promise.all([client.analyses(), openId ? client.analysis(openId) : Promise.resolve(null)]).then(
      ([rows, open]) => {
        if (live) setLoad({ state: "ready", rows, open });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, batch, openId]);

  if (load.state === "ready") {
    return load.open ? (
      <AnalysisPage
        report={load.open}
        onBack={() => {
          setOpenId(undefined);
        }}
      />
    ) : (
      <AnalysisList rows={load.rows} onOpen={setOpenId} />
    );
  }
  return (
    <>
      <h2>Analyses</h2>
      {load.state === "loading" ? (
        <Status tone="info" label="Loading" />
      ) : (
        <p>
          <Status tone="error" label="catalyst did not answer" />{" "}
          <span className="muted">{load.message} (the analyses need catalyst 0.85.0 or later)</span>
        </p>
      )}
    </>
  );
}
