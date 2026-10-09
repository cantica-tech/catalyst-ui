import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { JournalEntry, JournalFilters } from "./types.js";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function coerceEntry(value: unknown): JournalEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.timestamp !== "string" || typeof record.actor !== "string" || typeof record.artifact !== "string") {
    return null;
  }

  const files = Array.isArray(record.files)
    ? record.files
        .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
        .map((f) => ({
          path: typeof f.path === "string" ? f.path : "",
          before: typeof f.before === "string" ? f.before : null,
          after: typeof f.after === "string" ? f.after : "",
        }))
    : [];

  return {
    timestamp: record.timestamp,
    actor: record.actor,
    command: typeof record.command === "string" ? record.command : "",
    action:
      record.action === "create" ||
      record.action === "update" ||
      record.action === "close" ||
      record.action === "retire" ||
      record.action === "status-change" ||
      record.action === "sync"
        ? record.action
        : "update",
    artifact: record.artifact,
    targets: isStringArray(record.targets) ? record.targets : [],
    intent: isStringArray(record.intent) ? record.intent : [],
    files,
  };
}

/**
 * `development/journal.jsonl` (`rr-META-012`) — one JSON object per line,
 * strictly append-only. A line that fails to parse is skipped rather than
 * failing the whole read, the same posture as `runs.ts`'s `parseStep`
 * skipping an unrecognized checklist line: the agent-authored content here
 * isn't validated the way UI-authored content is.
 *
 * Deliberately not part of `WatchUpdate`/`watchCorpus` — the journal can
 * grow to thousands of lines over a project's life, and nothing in the
 * sidebar tree renders it continuously (only a static "Journal" row),
 * so re-parsing it on every unrelated corpus edit would be pure waste.
 * Called only on demand, when that command actually runs.
 */
export function parseJournal(corpusRoot: string): JournalEntry[] {
  const filePath = join(corpusRoot, "development", "journal.jsonl");
  if (!existsSync(filePath)) return [];

  const entries: JournalEntry[] = [];
  const lines = readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      const entry = coerceEntry(JSON.parse(trimmed));
      if (entry) entries.push(entry);
    } catch {
      continue;
    }
  }
  return entries;
}

/** Mirrors the `/journal` slash-command's `--since/--actor/--artifact/--rule` filters, newest-first (ISO timestamps sort lexicographically). */
export function queryJournal(entries: JournalEntry[], filters: JournalFilters): JournalEntry[] {
  return entries
    .filter((e) => !filters.since || e.timestamp >= filters.since)
    .filter((e) => !filters.actor || e.actor === filters.actor)
    .filter((e) => !filters.artifact || e.artifact === filters.artifact)
    .filter((e) => !filters.rule || e.targets.includes(filters.rule))
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
