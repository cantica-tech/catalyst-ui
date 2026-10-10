import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { bulletItems, parseFieldTable } from "./markdown.js";
import type { Run, RunStatus, RunStep, RunStepStatus } from "./types.js";

const RUN_ID_RE = /^(RUN-\d{6})-/;
const INDEX_FILENAME = "runs.md";

const STEP_GLYPH_STATUS: [glyph: string, status: RunStepStatus][] = [
  ["✅", "done"],
  ["❌", "failed"],
  ["⏳", "pending"],
  ["⚠️", "drift"],
];

function isRunStatus(value: string | undefined): value is RunStatus {
  return value === "running" || value === "completed" || value === "failed";
}

/** Parses one `## Checklist` line into its glyph-derived status and text. Returns null for a line with no recognized glyph prefix — the agent authoring this file isn't validated the way UI-authored content is. */
function parseStep(line: string): RunStep | null {
  for (const [glyph, status] of STEP_GLYPH_STATUS) {
    if (line.startsWith(glyph)) {
      return { status, text: line.slice(glyph.length).trim() };
    }
  }
  return null;
}

/**
 * Parses `<corpusRoot>/runs/*.md` into a typed list — an external
 * agent's own live run-state, this deployment's own uniform-layout
 * artifact type. Unlike `parseProposals`, this is read-only from every
 * host's perspective: only the agent running a task writes this file.
 * Skips the index and any `templates/` content, same convention as
 * every other collection.
 */
export function parseRuns(corpusRoot: string): Run[] {
  const dir = join(corpusRoot, "runs");
  if (!existsSync(dir)) return [];

  const runs: Run[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === INDEX_FILENAME || entry.name === "README.md") continue;

    const match = RUN_ID_RE.exec(entry.name);
    if (!match) continue;

    const filePath = join(dir, entry.name);
    const { fields, text } = parseFieldTable(filePath);
    const status = fields.get("Status");

    runs.push({
      id: match[1],
      status: isRunStatus(status) ? status : "running",
      command: fields.get("Command") ?? "",
      started: fields.get("Started") ?? "",
      steps: bulletItems(text, "Checklist")
        .map(parseStep)
        .filter((step): step is RunStep => step !== null),
      ledger: bulletItems(text, "Ledger"),
      location: { file: filePath, line: 1 },
    });
  }

  return runs.sort((a, b) => a.id.localeCompare(b.id));
}

/** `true` iff any of the run's checklist steps is self-reported as `drift`. */
export function hasDrift(run: Run): boolean {
  return run.steps.some((step) => step.status === "drift");
}
