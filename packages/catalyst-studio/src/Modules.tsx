import { useEffect, useState } from "react";

import type { InstalledModule, ModulePlan, ModuleReleases, StudioClient } from "./client.js";
import { CopyButton } from "./Copy.js";
import { Status, type StatusTone } from "./Status.js";

/** A module's state as a tone and a word (`catalyst module verify`). */
export function moduleState(state: string): { tone: StatusTone; label: string } {
  if (state === "ok") return { tone: "ok", label: "As recorded" };
  if (state === "changed") return { tone: "error", label: "Changed by hand" };
  if (state === "missing") return { tone: "error", label: "Missing" };
  if (state === "unrecorded") return { tone: "warn", label: "Not recorded yet" };
  return { tone: "info", label: state };
}

/** The command that upgrades a module to a release; run by the person or their agent, then its migrations. */
export function upgradeCommand(m: ModuleReleases, tag: string): string {
  return `catalyst module upgrade ${m.id} ${m.source}@${tag}`;
}

function Plan({ plan }: { plan: ModulePlan }) {
  return (
    <section aria-labelledby={`plan-${plan.id}`}>
      <h4 id={`plan-${plan.id}`}>
        What {plan.to} would change {plan.from_module ? `(from ${plan.from_module})` : ""}
      </h4>
      {plan.actions.length === 0 ? (
        <p className="muted">Nothing: the criterion already holds this release.</p>
      ) : (
        <ul>
          {plan.actions.map((a) => (
            <li key={`${a.kind}-${a.target}`}>
              <code>{a.change}</code> {a.kind} <code>{a.target}</code>
              {a.detail ? <span className="muted"> ({a.detail})</span> : null}
            </li>
          ))}
        </ul>
      )}
      {plan.migrations && plan.migrations.length > 0 && (
        <p>
          <Status tone="warn" label="Migrations" /> {plan.migrations.length} migration(s) with judgment steps: upgrade
          with your agent (<code>/sync-framework</code>), not by hand.
        </p>
      )}
    </section>
  );
}

/** One installed module: its state, and on asking its releases and a release's plan (R6.24). */
function ModuleCard({ client, m }: { client: StudioClient; m: InstalledModule }) {
  const st = moduleState(m.state);
  const [releases, setReleases] = useState<ModuleReleases | null>(null);
  const [plan, setPlan] = useState<ModulePlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const look = () => {
    setBusy(true);
    setError("");
    client.moduleReleases(m.id).then(
      (r) => {
        setBusy(false);
        setReleases(r);
      },
      (err: unknown) => {
        setBusy(false);
        setError(String(err));
      },
    );
  };
  const planFor = (tag: string) => {
    setBusy(true);
    setError("");
    setPlan(null);
    client.modulePlan(m.id, tag).then(
      (p) => {
        setBusy(false);
        setPlan(p);
      },
      (err: unknown) => {
        setBusy(false);
        setError(String(err));
      },
    );
  };
  const newer = releases?.releases.filter((r) => r.newer) ?? [];
  return (
    <section aria-labelledby={`module-${m.id}`} className="module">
      <h3 id={`module-${m.id}`}>
        <code>{m.id}</code> {m.version ?? "?"} <Status tone={st.tone} label={st.label} />
      </h3>
      <p className="muted">
        {m.source ? <>From {m.source}</> : "Installed from a directory or a release file"}
        {m.commit ? <> at {m.commit.slice(0, 12)}</> : null}.
      </p>
      {m.state === "changed" && (
        <p>
          Its files differ from the release it was installed from: <code>catalyst module verify {m.id}</code> says how;
          a sync puts the release back.
        </p>
      )}
      <p>
        <button type="button" onClick={look} disabled={busy}>
          Look for releases
        </button>{" "}
        <span className="muted">(asks its repository: the network)</span>
      </p>
      {error && (
        <p role="status">
          <Status tone="error" label="catalyst did not answer" /> <span className="muted">{error}</span>
        </p>
      )}
      {releases && (
        <>
          <p>
            {newer.length === 0 ? (
              <Status tone="ok" label="Up to date" />
            ) : (
              <Status tone="warn" label={`${String(newer.length)} newer release(s)`} />
            )}
          </p>
          <ul>
            {releases.releases.slice(0, 8).map((r) => (
              <li key={r.tag}>
                <code>{r.tag}</code> {r.installed && <span className="muted">installed</span>}
                {!r.installed && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      planFor(r.tag);
                    }}
                    disabled={busy}
                  >
                    What would {r.tag} change?
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {plan && releases && (
        <>
          <Plan plan={plan} />
          <p>
            Upgrade: <code className="composed">{upgradeCommand(releases, plan.to)}</code>{" "}
            <CopyButton text={upgradeCommand(releases, plan.to)} />
          </p>
        </>
      )}
    </section>
  );
}

/** Every installed module (R6.24): state, releases, an upgrade's plan; no module is removed here. */
export function ModulesView({ client, modules }: { client: StudioClient; modules: InstalledModule[] }) {
  return (
    <>
      <h2>Modules</h2>
      {modules.length === 0 ? (
        <p className="muted">
          No module installed: <code>catalyst module install &lt;source&gt;</code> adds one.
        </p>
      ) : (
        modules.map((m) => <ModuleCard key={m.id} client={client} m={m} />)
      )}
      <p className="muted">
        A module is not removed from a deployment: its artifacts would lose their types. A second module is installed
        beside the first with <code>catalyst module install</code>.
      </p>
    </>
  );
}

type Load =
  { state: "loading" } | { state: "ready"; modules: InstalledModule[] } | { state: "failed"; message: string };

/** The Modules view (local mode: modules are this machine's). */
export function Modules({ client }: { client: StudioClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    let live = true;
    client.modules().then(
      (modules) => {
        if (live) setLoad({ state: "ready", modules });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client]);
  if (load.state === "ready") return <ModulesView client={client} modules={load.modules} />;
  return (
    <>
      <h2>Modules</h2>
      {load.state === "loading" ? (
        <Status tone="info" label="Loading" />
      ) : (
        <p>
          <Status tone="error" label="catalyst did not answer" />{" "}
          <span className="muted">
            {load.message} (modules need <code>catalyst serve --local</code>, catalyst 0.86.0 or later)
          </span>
        </p>
      )}
    </>
  );
}
