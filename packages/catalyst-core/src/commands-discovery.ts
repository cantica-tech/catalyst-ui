import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface SlashCommandSpec {
  name: string;
  description?: string;
  argumentHint?: string;
  filePath: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
const FIELD_LINE_RE = /^([\w-]+):\s*(.*)$/;

function parseFrontmatter(raw: string): {
  description?: string;
  argumentHint?: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) return {};

  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const fieldMatch = line.match(FIELD_LINE_RE);
    if (!fieldMatch) continue;
    fields[fieldMatch[1]] = fieldMatch[2].trim().replace(/^["']|["']$/g, "");
  }
  return {
    description: fields.description,
    argumentHint: fields["argument-hint"],
  };
}

/**
 * Slash commands deployed to a project root as `.claude/commands/<name>.md`
 * (per CLAUDE.md / CODE-OF-CONDUCT.md §4) — read directly from the workspace
 * folder, not the resolved corpus root, since that's where they're deployed.
 */
export function discoverSlashCommands(
  workspaceRoot: string,
): SlashCommandSpec[] {
  const dir = join(workspaceRoot, ".claude", "commands");
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const filePath = join(dir, name);
      const { description, argumentHint } = parseFrontmatter(
        readFileSync(filePath, "utf8"),
      );
      return { name: name.slice(0, -3), description, argumentHint, filePath };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
