import { useId, useState } from "react";

import type { ActionResult, HostRuns, StudioAction } from "./host.js";
import { forewarns, useKernel } from "./kernel.js";
import { Status } from "./Status.js";
import { TryOutcome, tryReport } from "./Trial.js";

/** The tiers catalyst knows by default (a module may declare others; the host and catalyst check them). */
export const TIERS = ["chore", "fix", "feature"] as const;

/**
 * One action, asked for with its reason (and, when it journals a change,
 * its tier and what it serves: law L2), then sent to the host, which shows
 * the exact command and runs it only on the person's yes
 * (studio-SHELL-000016). The result is said, never assumed.
 *
 * With catalyst >= 0.112.0 a tryable action is tried when submitted
 * (studio-SHELL-000029): what it would change is shown, and it is made only
 * on "Make it permanent", with `--forewarned`, so catalyst journals what it
 * added to `check`. The Studio signs as the machine's system account, an
 * admin: every write it offers is an admin's.
 */
export function ActionForm({
  host,
  label,
  action,
  journals = false,
  textLabel,
  tryable = true,
  reasonLabel = "Why",
  onDone,
}: {
  host: HostRuns;
  label: string;
  /** The verb and its fixed fields; the form adds `intent` (and `tier`, `target`). */
  action: StudioAction;
  /** Whether the action journals a change: then it asks for the tier and what it serves. */
  journals?: boolean;
  /** Asks for a `text` field too, under this label (a reconciliation's proposal). */
  textLabel?: string;
  /** Whether `catalyst try` can make it (its writing verbs only; not IAM or sharing). */
  tryable?: boolean;
  /** Names the reason's field (default "Why"). */
  reasonLabel?: string;
  onDone?: (result: ActionResult) => void;
}) {
  const ids = { why: useId(), tier: useId(), target: useId(), text: useId() };
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [tier, setTier] = useState<string>(journals ? "chore" : "");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [tried, setTried] = useState<ActionResult | null>(null);
  const [trying, setTrying] = useState(false);
  const kernel = useKernel();
  if (!host.act) return null;
  const act = host.act;
  const full = (reason: string): StudioAction => ({
    ...action,
    intent: reason,
    ...(journals ? { tier } : {}),
    ...(journals && target.trim() ? { target: target.trim() } : {}),
    ...(textLabel ? { text: text.trim() } : {}),
  });
  const tryIt = tryable ? host.tryIt : undefined;
  const forewarn = tryIt !== undefined && forewarns(kernel);
  const tryFirst = () => {
    if (!tryIt) return;
    setTrying(true);
    setTried(null);
    void tryIt(full(why.trim() || "Trying it")).then((r) => {
      setTrying(false);
      setTried(r);
    });
  };
  const makeIt = (forewarned: boolean) => {
    setBusy(true);
    setResult(null);
    void act(forewarned ? { ...full(why.trim()), forewarned: true } : full(why.trim())).then((r) => {
      setBusy(false);
      setResult(r);
      if (forewarned) setTried(null);
      onDone?.(r);
    });
  };
  const report = tried ? tryReport(tried) : null;
  const findings = report?.ok ? report.check.added.length : 0;
  const submit = () => {
    if (forewarn) tryFirst();
    else makeIt(false);
  };
  return (
    <form
      className="action-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={ids.why}>{reasonLabel}</label>{" "}
      <input
        id={ids.why}
        type="text"
        required
        maxLength={500}
        value={why}
        onChange={(e) => {
          setWhy(e.target.value);
        }}
      />{" "}
      {journals && (
        <>
          <label htmlFor={ids.tier}>Tier</label>{" "}
          <select
            id={ids.tier}
            value={tier}
            onChange={(e) => {
              setTier(e.target.value);
            }}
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>{" "}
          <label htmlFor={ids.target}>Serves (an artifact or rule ID; none for a chore)</label>{" "}
          <input
            id={ids.target}
            type="text"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
            }}
          />{" "}
        </>
      )}
      {textLabel && (
        <>
          <label htmlFor={ids.text}>{textLabel}</label>{" "}
          <input
            id={ids.text}
            type="text"
            required
            maxLength={2000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
            }}
          />{" "}
        </>
      )}
      <button type="submit" disabled={busy || trying || !why.trim() || (textLabel !== undefined && !text.trim())}>
        {label}
      </button>{" "}
      {forewarn && report?.ok && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              makeIt(true);
            }}
          >
            {findings > 0 ? "Make it permanent anyway" : "Make it permanent"}
          </button>{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setTried(null);
            }}
          >
            Cancel
          </button>{" "}
        </>
      )}
      {tryIt && !forewarn && (
        <>
          <button type="button" disabled={trying || busy} onClick={tryFirst}>
            Try it
          </button>{" "}
        </>
      )}
      <span aria-live="polite">
        {trying && <Status tone="info" label="Trying it on a scratch copy" />}
        {tried && !trying && <TryOutcome result={tried} />}
        {busy && <Status tone="info" label="Waiting for your confirmation in the editor" />}
        {result?.declined && <Status tone="info" label="Not done: you declined" />}
        {result && !result.declined && result.ok && <Status tone="ok" label="Done; catalyst journaled it" />}
        {result && !result.declined && !result.ok && (
          <Status tone="error" label={`Not done: ${result.error || "catalyst refused it"}`} />
        )}
      </span>
    </form>
  );
}
