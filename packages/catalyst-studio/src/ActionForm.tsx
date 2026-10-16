import { useId, useState } from "react";

import type { ActionResult, HostRuns, StudioAction } from "./host.js";
import { Status } from "./Status.js";

/** The tiers catalyst knows by default (a module may declare others; the host and catalyst check them). */
export const TIERS = ["chore", "fix", "feature"] as const;

/**
 * One action, asked for with its reason (and, when it journals a change,
 * its tier and what it serves: law L2), then sent to the host, which shows
 * the exact command and runs it only on the person's yes
 * (studio-SHELL-000016). The result is said, never assumed.
 */
export function ActionForm({
  host,
  label,
  action,
  journals = false,
  textLabel,
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
  onDone?: (result: ActionResult) => void;
}) {
  const ids = { why: useId(), tier: useId(), target: useId(), text: useId() };
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [tier, setTier] = useState<string>(journals ? "chore" : "");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  if (!host.act) return null;
  const act = host.act;
  const submit = () => {
    setBusy(true);
    setResult(null);
    const full: StudioAction = {
      ...action,
      intent: why.trim(),
      ...(journals ? { tier } : {}),
      ...(journals && target.trim() ? { target: target.trim() } : {}),
      ...(textLabel ? { text: text.trim() } : {}),
    };
    void act(full).then((r) => {
      setBusy(false);
      setResult(r);
      onDone?.(r);
    });
  };
  return (
    <form
      className="action-form"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={ids.why}>Why</label>{" "}
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
      <button type="submit" disabled={busy || !why.trim() || (textLabel !== undefined && !text.trim())}>
        {label}
      </button>{" "}
      <span aria-live="polite">
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
