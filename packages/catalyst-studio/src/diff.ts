/** One line of a diff: kept, removed (only before) or added (only after). */
export interface DiffLine {
  kind: "same" | "del" | "add";
  text: string;
  /** Its line number before (same, del) and after (same, add). */
  before?: number;
  after?: number;
}

/** A run of changed lines with the unchanged lines around them. */
export interface Hunk {
  lines: DiffLine[];
}

function split(text: string | null): string[] {
  if (!text) return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/**
 * The line diff from `before` to `after` (a longest common subsequence;
 * each side capped, past which the whole file reads as replaced). `null`
 * is no file: everything is added, or removed.
 */
export function lineDiff(before: string | null, after: string | null, cap = 4000): DiffLine[] {
  const a = split(before);
  const b = split(after);
  const out: DiffLine[] = [];
  if (a.length > cap || b.length > cap) {
    a.forEach((text, i) => out.push({ kind: "del", text, before: i + 1 }));
    b.forEach((text, i) => out.push({ kind: "add", text, after: i + 1 }));
    return out;
  }
  // lengths of the longest common subsequence of a[i..] and b[j..]
  const n = a.length;
  const m = b.length;
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i], before: i + 1, after: j + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ kind: "del", text: a[i], before: i + 1 });
      i++;
    } else {
      out.push({ kind: "add", text: b[j], after: j + 1 });
      j++;
    }
  }
  for (; i < n; i++) out.push({ kind: "del", text: a[i], before: i + 1 });
  for (; j < m; j++) out.push({ kind: "add", text: b[j], after: j + 1 });
  return out;
}

/** The changed runs, each with up to `context` unchanged lines either side; none when nothing changed. */
export function hunks(lines: DiffLine[], context = 2): Hunk[] {
  const changed = lines.map((l, i) => (l.kind === "same" ? -1 : i)).filter((i) => i >= 0);
  const out: Hunk[] = [];
  let start = -1;
  let end = -1;
  for (const i of changed) {
    if (start >= 0 && i - context <= end + context + 1) {
      end = i;
      continue;
    }
    if (start >= 0) out.push({ lines: lines.slice(Math.max(0, start - context), end + context + 1) });
    start = i;
    end = i;
  }
  if (start >= 0) out.push({ lines: lines.slice(Math.max(0, start - context), end + context + 1) });
  return out;
}

/** How many lines were removed and added. */
export function diffStat(lines: DiffLine[]): { removed: number; added: number } {
  return {
    removed: lines.filter((l) => l.kind === "del").length,
    added: lines.filter((l) => l.kind === "add").length,
  };
}

/** One row of a side-by-side diff: the line before (left) and the line after (right), either absent. */
export interface SideRow {
  left?: DiffLine;
  right?: DiffLine;
}

/**
 * A hunk's lines as side-by-side rows: an unchanged line on both sides; a
 * run of removals paired, in order, with the run of additions that follows
 * it; what has no pair stands alone.
 */
export function sideBySide(lines: DiffLine[]): SideRow[] {
  const rows: SideRow[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].kind === "same") {
      rows.push({ left: lines[i], right: lines[i] });
      i++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].kind === "del") dels.push(lines[i++]);
    while (i < lines.length && lines[i].kind === "add") adds.push(lines[i++]);
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
      rows.push({ ...(k < dels.length ? { left: dels[k] } : {}), ...(k < adds.length ? { right: adds[k] } : {}) });
    }
  }
  return rows;
}
