export type StatusTone = "ok" | "warn" | "error" | "info";

const ICONS: Record<StatusTone, string> = { ok: "✓", warn: "!", error: "✕", info: "i" };

/**
 * A status as icon, word and colour together (studio-SHELL-000001): the
 * word carries the meaning, so a colour-blind reader or a screen reader
 * loses nothing; the icon is decoration.
 */
export function Status({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <span className={`status status-${tone}`}>
      <span aria-hidden="true">{ICONS[tone]}</span>
      {label}
    </span>
  );
}
