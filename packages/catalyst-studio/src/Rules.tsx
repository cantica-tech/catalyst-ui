import { useEffect, useId, useState } from "react";

import type { Graph, GraphRule, StudioClient } from "./client.js";
import { DriftBadge } from "./drift.js";
import { useNavigate } from "./Shell.js";
import { Status, type StatusTone } from "./Status.js";

/** A rule's status as a tone and a word, from the mark its status line carries. */
export function ruleStatus(rule: { status: string | null; retired: boolean }): { tone: StatusTone; label: string } {
  const status = rule.status ?? ""; // a rule with no status line
  if (rule.retired || status.includes("🗑")) return { tone: "info", label: "Retired" };
  if (status.includes("✅")) return { tone: "ok", label: "Working" };
  if (status.includes("⏳")) return { tone: "warn", label: "In progress" };
  if (status.includes("❌")) return { tone: "error", label: "Broken" };
  return { tone: "info", label: "No status" };
}

export const STRENGTHS = ["must", "should", "may"] as const;

/** How hard a rule binds: its stated strength, `must` when it states none (an older catalyst). */
export function ruleStrength(rule: { strength?: unknown }): string {
  return typeof rule.strength === "string" && rule.strength !== "" ? rule.strength : "must";
}

/** What a breach of the rule is reported as: a violation, a warning or a note. */
export function breachIs(strength: string): string {
  return strength === "should"
    ? "a breach is a warning"
    : strength === "may"
      ? "a breach is a note"
      : "a breach is a violation";
}

/** Which entities cite each rule: every artifact whose reference fields name it. */
export function citers(graph: Graph): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (rule: string, by: string) => {
    if (rule === by) return;
    out.set(rule, (out.get(rule) ?? new Set()).add(by));
  };
  const rules = new Set(graph.rules.map((r) => r.id));
  for (const a of graph.artifacts)
    for (const ids of Object.values(a.links)) for (const id of ids) if (rules.has(id)) add(id, a.id);
  return out;
}

/** The rule's document: the prefix before its domain (`studio` of `studio-SHELL-000001`). */
export function ruleDocument(rule: GraphRule): string {
  return rule.id.split("-")[0];
}

/** The rules a search keeps: every word in the ID, title, domain, status or strength, of the strength asked. */
export function searchRules(rules: GraphRule[], words: string, showRetired: boolean, strength = ""): GraphRule[] {
  const ws = words.toLowerCase().split(/\s+/).filter(Boolean);
  return rules.filter((r) => {
    if (!showRetired && ruleStatus(r).label === "Retired") return false;
    if (strength && ruleStrength(r) !== strength) return false;
    const hay =
      `${r.id} ${r.title} ${r.domain ?? ""} ${ruleStatus(r).label} ${r.status ?? ""} ${ruleStrength(r)}`.toLowerCase();
    return ws.every((w) => hay.includes(w));
  });
}

/** The rules by document, then by domain, each in ID order. */
export function groupRules(
  rules: GraphRule[],
): { document: string; domains: { code: string; rules: GraphRule[] }[] }[] {
  const docs = new Map<string, Map<string, GraphRule[]>>();
  for (const r of [...rules].sort((a, b) => a.id.localeCompare(b.id))) {
    const doc = docs.get(ruleDocument(r)) ?? new Map<string, GraphRule[]>();
    const code = r.domain ?? "—";
    doc.set(code, [...(doc.get(code) ?? []), r]);
    docs.set(ruleDocument(r), doc);
  }
  return [...docs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([document, domains]) => ({
      document,
      domains: [...domains.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, list]) => ({ code, rules: list })),
    }));
}

/** Every rule of the deployment (studio-SHELL-000009), each opening its page. */
export function RuleBrowser({ graph }: { graph: Graph }) {
  const navigate = useNavigate();
  const [words, setWords] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [strength, setStrength] = useState("");
  const searchId = useId();
  const retiredId = useId();
  const strengthId = useId();
  const all = graph.rules;
  const kept = searchRules(all, words, showRetired, strength);
  const cited = citers(graph);
  const domainTitle = new Map(graph.domains.map((d) => [d.code, d.title]));
  return (
    <>
      <h2>Rules</h2>
      <div className="filters" role="search">
        <label htmlFor={searchId}>Find</label>{" "}
        <input
          id={searchId}
          type="search"
          value={words}
          onChange={(event) => {
            setWords(event.target.value);
          }}
        />{" "}
        <input
          id={retiredId}
          type="checkbox"
          checked={showRetired}
          onChange={(event) => {
            setShowRetired(event.target.checked);
          }}
        />{" "}
        <label htmlFor={retiredId}>Show retired rules</label> <label htmlFor={strengthId}>Strength</label>{" "}
        <select
          id={strengthId}
          value={strength}
          onChange={(event) => {
            setStrength(event.target.value);
          }}
        >
          <option value="">any</option>
          {STRENGTHS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <p className="muted" aria-live="polite">
        {kept.length} of {all.length} rules
      </p>
      {groupRules(kept).map((doc) => (
        <section key={doc.document} aria-labelledby={`rules-${doc.document}`}>
          <h3 id={`rules-${doc.document}`}>
            <code>{doc.document}</code> rules
          </h3>
          {doc.domains.map((d) => (
            <section key={d.code} aria-labelledby={`rules-${doc.document}-${d.code}`}>
              <h4 id={`rules-${doc.document}-${d.code}`}>{domainTitle.get(d.code) ?? d.code}</h4>
              <ul className="artifact-list">
                {d.rules.map((r) => {
                  const st = ruleStatus(r);
                  const n = cited.get(r.id)?.size ?? 0;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          navigate("artifacts", r.id);
                        }}
                      >
                        <code>{r.id}</code> {r.title.replace(/^🗑\s*/, "")}
                      </button>{" "}
                      <Status tone={st.tone} label={st.label} />{" "}
                      {ruleStrength(r) !== "must" && (
                        <>
                          <span className="strength" title={breachIs(ruleStrength(r))}>
                            {ruleStrength(r)}
                          </span>{" "}
                        </>
                      )}
                      <span className="muted">{n === 0 ? "cited by nothing" : `cited by ${String(n)}`}</span>{" "}
                      <DriftBadge id={r.id} />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </section>
      ))}
    </>
  );
}

type Load = { state: "loading" } | { state: "ready"; graph: Graph } | { state: "failed"; message: string };

/** The Rules view, reloaded after each change catalyst announces. */
export function Rules({ client }: { client: StudioClient }) {
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
        <h2>Rules</h2>
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
  return <RuleBrowser graph={load.graph} />;
}
