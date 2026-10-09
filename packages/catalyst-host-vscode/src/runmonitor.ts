import type { Run, RunStep, RunStepStatus } from "catalyst-core";
import { hasDrift } from "catalyst-core";

export interface RunSection {
  label: string;
  runs: Run[];
}

const STEP_STATUS_GLYPH: Record<RunStepStatus, string> = {
  done: "✅",
  failed: "❌",
  pending: "⏳",
  drift: "⚠️",
};

/**
 * An 8th sidebar section listing every known run, alongside proposals
 * and the five chain-model sections. The label itself carries a `⚠️`
 * suffix whenever any run has drift — this is what makes a drift event
 * visible in the tree as soon as the watcher picks it up, not just
 * after the run completes.
 */
export function buildRunSection(runs: Run[]): RunSection {
  const label = runs.some(hasDrift) ? `Runs (${runs.length}) ⚠️` : `Runs (${runs.length})`;
  return { label, runs };
}

/** A run's own one-line tree label: id, status, and a `⚠️` marker if it has drift. */
export function formatRunLabel(run: Run): string {
  return hasDrift(run) ? `${run.id} — ${run.status} ⚠️` : `${run.id} — ${run.status}`;
}

/** A checklist step's tree label: its glyph, re-derived from the parsed status, plus its text. */
export function formatStepLabel(step: RunStep): string {
  return `${STEP_STATUS_GLYPH[step.status]} ${step.text}`;
}
