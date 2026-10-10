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
 * Every file the journal is read from (`rr-META-012`, INV-17): the legacy
 * `development/journal.jsonl` of a deployment made before kernel 0.50, then
 * each shard `development/journal/<actor>@<machine>/<YYYY-MM>.jsonl`, in a
 * stable order.
 */
/**
 * The journal as catalyst serves it (`GET /v1/journal`, `catalyst journal
 * show --json`): each well-formed entry, oldest first.
 */
export function coerceJournal(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(coerceEntry)
    .filter((e): e is JournalEntry => e !== null)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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
