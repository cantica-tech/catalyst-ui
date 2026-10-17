import type { Evidence, InboxItem } from "./client.js";

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

function words(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * An item's evidence in words, from what catalyst gives for its kind; a kind
 * this Studio does not know is said as its plain `key: value` pairs.
 */
export function describeEvidence(item: InboxItem): string {
  const e: Evidence = typeof item.evidence === "object" ? item.evidence : {};
  switch (item.kind) {
    case "unrecorded-commit": {
      const who = words(e.author);
      const sha = words(e.commit).slice(0, 7);
      const files = Array.isArray(e.files) ? plural(e.files.length, "file") : "";
      return [who && `by ${who}`, sha && `commit ${sha}`, files].filter(Boolean).join(", ");
    }
    case "unrecorded-change":
      return words(e.path);
    case "reconciliation":
    case "analysis": {
      const about = words(e.entity) || words(e.scope);
      return [words(e.status), about && `about ${about}`].filter(Boolean).join(", ");
    }
    case "approval": {
      const missing = typeof e.missing === "number" ? e.missing : 0;
      return [words(e.gate) && `gate ${words(e.gate)}`, missing > 0 && `${plural(missing, "approval")} missing`]
        .filter(Boolean)
        .join(", ");
    }
    default:
      return Object.entries(e)
        .filter(([, v]) => typeof v === "string" && v.trim())
        .map(([k, v]) => `${k}: ${String(v).trim()}`)
        .join(", ");
  }
}
