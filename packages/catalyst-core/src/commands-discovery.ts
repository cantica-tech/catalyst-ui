import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveCorpusRoot } from "./discover.js";

export interface SlashCommandSpec {
  /** The command's primary name, without the slash. */
  name: string;
  /** Its §4 bullet text after the "—": first sentence, whitespace-collapsed. */
  description?: string;
  /** What its bullet shows after the name in the code span, e.g. `<title>`; several bullets' are joined with " | ". */
  argumentHint?: string;
  /** Other names its bullet gives it (`/create-req` or `/create-requirement`). */
  aliases?: string[];
  /** The `CODE-OF-CONDUCT.md` it was read from. */
  filePath: string;
}

/** A bullet that defines a command: "- `/name". Same as catalyst's `spec.py` `BULLET_START`. */
const BULLET_START = /^- `\/([a-z][a-z0-9-]*)/;
/** `/name`, `/name <args>` and `/name: ...` all name a command. Same as `spec.py` `MENTION`. */
const MENTION = /`\/([a-z][a-z0-9-]*)(?=[`\s:])/g;
/** The first code span opening the bullet: "- `/name <args>`". */
const FIRST_SPAN = /^- `\/[a-z][a-z0-9-]*([^`]*)`/;
const MAX_DESCRIPTION = 200;

/** The lines of `## 4.` up to `## 5.` (or the end), or `null` with no §4. */
function section4Lines(text: string): string[] | null {
  const start = /^## 4\.[^\n]*\n/m.exec(text);
  if (!start) return null;
  const rest = text.slice(start.index + start[0].length);
  const end = /^## 5\./m.exec(rest);
  return (end ? rest.slice(0, end.index) : rest).split(/\r?\n/);
}

/** The bullet blocks of §4: a "- `/name" line plus its indented continuation lines. */
function bulletBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!BULLET_START.test(lines[i])) {
      i += 1;
      continue;
    }
    const block = [lines[i]];
    i += 1;
    while (i < lines.length && lines[i].startsWith("  ") && !BULLET_START.test(lines[i])) {
      block.push(lines[i]);
      i += 1;
    }
    blocks.push(block.join("\n"));
  }
  return blocks;
}

function summarize(bullet: string): string | undefined {
  const flat = bullet.replace(/\s+/g, " ").trim();
  const dash = flat.indexOf("—");
  if (dash < 0) return undefined;
  const text = flat.slice(dash + 1).trim();
  if (text.length === 0) return undefined;
  // First sentence: a stop followed by a capital (so "e.g. foo" doesn't end it).
  const sentence = /^(.*?[.!?])(?=\s+[A-Z`(]|$)/.exec(text);
  const first = sentence ? sentence[1] : text;
  return first.length <= MAX_DESCRIPTION ? first : `${first.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
}

function argumentHintOf(bullet: string): string | undefined {
  const hint = FIRST_SPAN.exec(bullet)?.[1]?.trim();
  return hint ? hint : undefined;
}

/**
 * The commands of a composed `CODE-OF-CONDUCT.md` §4 — mirrors catalyst's
 * `scripts/catalyst/spec.py` (`section4_text`, `BULLET_START`, `MENTION`,
 * `parse`): a command is a bullet starting "- `/name"; further `/x`
 * mentions before its "—" are aliases. A command with several bullets
 * (one per subcommand) is one entry. Sorted by name; `[]` with no §4.
 */
export function parseSection4Commands(text: string, filePath = "CODE-OF-CONDUCT.md"): SlashCommandSpec[] {
  const lines = section4Lines(text);
  if (!lines) return [];

  const byName = new Map<string, { description?: string; hints: string[]; aliases: string[] }>();
  const aliasOf = new Map<string, string>();
  for (const bullet of bulletBlocks(lines)) {
    const head = `${bullet.split("—", 1)[0]} `;
    const names = [...head.matchAll(MENTION)].map((m) => m[1]);
    // e.g. "`/x|y`" names no command: skip it, never fail the parse.
    if (names.length === 0) continue;
    const [primary, ...aliases] = names;
    let entry = byName.get(primary);
    if (!entry) {
      entry = { description: summarize(bullet), hints: [], aliases: [] };
      byName.set(primary, entry);
    }
    const hint = argumentHintOf(bullet);
    if (hint && !entry.hints.includes(hint)) entry.hints.push(hint);
    for (const alias of aliases) {
      if (alias === primary || aliasOf.has(alias)) continue;
      aliasOf.set(alias, primary);
      entry.aliases.push(alias);
    }
  }

  return [...byName.entries()]
    .filter(([name]) => !aliasOf.has(name))
    .map(([name, entry]): SlashCommandSpec => {
      const spec: SlashCommandSpec = { name, filePath };
      if (entry.description) spec.description = entry.description;
      if (entry.hints.length > 0) spec.argumentHint = entry.hints.join(" | ");
      if (entry.aliases.length > 0) spec.aliases = entry.aliases;
      return spec;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every name a command answers to — primaries and aliases — e.g. for an allow-list. */
export function commandNames(specs: readonly SlashCommandSpec[]): string[] {
  return specs.flatMap((spec) => [spec.name, ...(spec.aliases ?? [])]);
}

/**
 * The catalyst commands of a project: §4 of its criterion's composed
 * `CODE-OF-CONDUCT.md` (the criterion resolved by `resolveCorpusRoot`),
 * the same list catalyst's MCP server (`catalyst mcp`) offers as prompts.
 * catalyst writes no command files into the project, so nothing under
 * the project's own tree is read. `[]` when no criterion resolves or it
 * has no readable `CODE-OF-CONDUCT.md`.
 */
export function discoverSlashCommands(projectRoot: string): SlashCommandSpec[] {
  let corpusRoot: string | null;
  try {
    corpusRoot = resolveCorpusRoot(projectRoot);
  } catch {
    return [];
  }
  if (!corpusRoot) return [];
  const filePath = join(corpusRoot, "CODE-OF-CONDUCT.md");
  let text: string;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  return parseSection4Commands(text, filePath);
}
