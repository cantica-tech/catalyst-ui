import { useEffect, useState } from "react";

import { ActionForm } from "./ActionForm.js";
import type { ShareStatus, StudioClient } from "./client.js";
import { useHost, type ActionResult } from "./host.js";
import { Status, type StatusTone } from "./Status.js";

/** Where the criterion stands against its shared copy, as a tone and a word. */
export function shareState(st: ShareStatus): { tone: StatusTone; label: string } {
  if (st.driver === "local") return { tone: "info", label: "Not shared" };
  if (st.behind && st.behind > 0) return { tone: "warn", label: `${String(st.behind)} change(s) to pull` };
  if (st.dirty.length > 0 || (st.ahead && st.ahead > 0)) return { tone: "warn", label: "Not published yet" };
  if (st.ahead === null) return { tone: "info", label: "Not compared yet" };
  return { tone: "ok", label: "Up to date" };
}

function Pull({ onDone }: { onDone: () => void }) {
  const host = useHost();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  if (!host?.act) return <code>catalyst share pull</code>;
  const act = host.act;
  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setResult(null);
          void act({ verb: "share-pull" }).then((r) => {
            setBusy(false);
            setResult(r);
            onDone();
          });
        }}
      >
        Pull
      </button>{" "}
      <span aria-live="polite">
        {busy && <Status tone="info" label="Waiting for your confirmation" />}
        {result?.declined && <Status tone="info" label="Not done: you declined" />}
        {result && !result.declined && result.ok && <Status tone="ok" label="Pulled" />}
        {result && !result.declined && !result.ok && (
          <Status tone="error" label={`Not pulled: ${result.error || "catalyst refused it"}`} />
        )}
      </span>
    </>
  );
}

/** The share panel's content (R6.25): where the criterion is shared, what is not published, push and pull. */
export function ShareView({
  status,
  onFetch,
  onChanged,
}: {
  status: ShareStatus;
  onFetch: () => void;
  onChanged: () => void;
}) {
  const host = useHost();
  const st = shareState(status);
  const shared = status.driver !== "local";
  return (
    <>
      <h2>Share</h2>
      <p>
        <Status tone={st.tone} label={st.label} />{" "}
        {shared ? (
          <span className="muted">
            {status.driver}
            {status.mode ? ` (${status.mode})` : ""}: {status.location}
            {status.branch ? <>, branch {status.branch}</> : null}
          </span>
        ) : (
          <span className="muted">
            This criterion is on this machine only: <code>catalyst share create</code> publishes it, with the person's
            yes.
          </span>
        )}
      </p>
      {shared && (
        <>
          <p>
            {status.ahead === null ? (
              "Not compared with the shared copy yet."
            ) : (
              <>
                {status.ahead} change(s) here not in the shared copy, {status.behind} there not here.
              </>
            )}{" "}
            <button type="button" onClick={onFetch}>
              Compare with the shared copy
            </button>{" "}
            <span className="muted">(asks it: the network)</span>
          </p>
          <section aria-labelledby="share-dirty">
            <h3 id="share-dirty">Not published</h3>
            {status.dirty.length === 0 ? (
              <p className="muted">Nothing: every change here is published.</p>
            ) : (
              <ul>
                {status.dirty.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="share-act">
            <h3 id="share-act">Pull and publish</h3>
            <p>
              <Pull onDone={onChanged} />{" "}
              <span className="muted">
                A change that conflicts with one here becomes a <code>RECON-</code> case for a person to decide (Inbox);
                nothing is merged for you.
              </span>
            </p>
            {status.dirty.length > 0 || (status.ahead ?? 0) > 0 ? (
              host?.act ? (
                <ActionForm
                  host={host}
                  label="Publish"
                  reasonLabel="Message"
                  tryable={false}
                  action={{ verb: "share-push" }}
                  onDone={onChanged}
                />
              ) : (
                <p>
                  <code>catalyst share push -m &quot;…&quot;</code>
                </p>
              )
            ) : null}
          </section>
        </>
      )}
    </>
  );
}

type Load = { state: "loading" } | { state: "ready"; status: ShareStatus } | { state: "failed"; message: string };

/** The Share view, reloaded after each change catalyst announces. */
export function Share({ client }: { client: StudioClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [batch, setBatch] = useState(0);
  const [fetch, setFetch] = useState(false);

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
    client.share(fetch).then(
      (status) => {
        if (live) setLoad({ state: "ready", status });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, batch, fetch]);

  if (load.state !== "ready") {
    return (
      <>
        <h2>Share</h2>
        {load.state === "loading" ? (
          <Status tone="info" label="Loading" />
        ) : (
          <p>
            <Status tone="error" label="catalyst did not answer" />{" "}
            <span className="muted">
              {load.message} (the share status needs <code>catalyst serve --local</code>, catalyst 0.90.0 or later)
            </span>
          </p>
        )}
      </>
    );
  }
  return (
    <ShareView
      status={load.status}
      onFetch={() => {
        setFetch(true);
        setBatch((b) => b + 1);
      }}
      onChanged={() => {
        setBatch((b) => b + 1);
      }}
    />
  );
}
