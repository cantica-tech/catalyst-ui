import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import type { Finding, StudioClient } from "./client.js";
import { Status } from "./Status.js";

/** Each entity's findings, from one `check` every view shares (studio-SHELL-000017). */
export type Drift = Map<string, Finding[]>;

const DriftContext = createContext<Drift>(new Map());

/** Provides a drift directly (a view's tests). */
export const DriftProvider = DriftContext.Provider;

export function useDrift(): Drift {
  return useContext(DriftContext);
}

/** The findings by entity; a finding about no entity is left out (the dashboard shows it). */
export function driftOf(findings: Finding[] | undefined): Drift {
  const out: Drift = new Map();
  for (const f of findings ?? []) if (f.entity) out.set(f.entity, [...(out.get(f.entity) ?? []), f]);
  return out;
}

/** Gives every view the drift: `check` once, then again after each change catalyst announces. */
export function WithDrift({ client, children }: { client: StudioClient | null; children: ReactNode }) {
  const [drift, setDrift] = useState<Drift>(new Map());
  const [batch, setBatch] = useState(0);
  useEffect(() => {
    if (!client) return;
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
    if (!client) return;
    let live = true;
    client.check().then(
      (report) => {
        if (live) setDrift(driftOf(report.findings));
      },
      () => undefined, // no drift shown when catalyst cannot check; the dashboard says why
    );
    return () => {
      live = false;
    };
  }, [client, batch]);
  return <DriftContext.Provider value={drift}>{children}</DriftContext.Provider>;
}

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** A mark beside an entity with findings: how many, and what they say on hover and to a screen reader. */
export function DriftBadge({ id }: { id: string }) {
  const found = useDrift().get(id);
  if (!found || found.length === 0) return null;
  const errors = found.filter((f) => f.level === "error").length;
  const label = errors > 0 ? plural(errors, "error") : plural(found.length, "warning");
  return (
    <span className="drift-badge" title={found.map((f) => f.text).join("\n")}>
      <Status tone={errors > 0 ? "error" : "warn"} label={label} />
    </span>
  );
}

/** An entity page's findings, in full. */
export function DriftSection({ id }: { id: string }) {
  const found = useDrift().get(id);
  if (!found || found.length === 0) return null;
  return (
    <section aria-labelledby="entity-drift">
      <h3 id="entity-drift">Problems catalyst reports</h3>
      <ul>
        {found.map((f, i) => (
          <li key={i}>
            <Status tone={f.level === "error" ? "error" : "warn"} label={f.level} /> {f.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
