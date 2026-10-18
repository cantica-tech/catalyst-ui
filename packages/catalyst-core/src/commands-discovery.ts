import { spawnSync } from "node:child_process";

import { catalystCommand } from "./catalyst-source.js";

export interface SlashCommandSpec {
  /** The command's primary name, without the slash. */
  name: string;
  /** Its summary's first sentence, whitespace-collapsed. */
  description?: string;
  /** What its usage shows after the name, e.g. `<title>`. */
  argumentHint?: string;
  /** Other names it answers to (`/create-<type>`). */
  aliases?: string[];
}

/** One command as `catalyst spec --json` (`GET /v1/commands`) gives it. */
interface CatalogEntry {
  name: string;
  usage?: string;
  summary?: string;
  aliases?: string[];
}

const MAX_DESCRIPTION = 200;

function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const end = flat.search(/[.;](\s|$)/);
  const sentence = end >= 0 ? flat.slice(0, end + 1) : flat;
  return sentence.length > MAX_DESCRIPTION ? `${sentence.slice(0, MAX_DESCRIPTION - 1)}…` : sentence;
}

/** The commands of catalyst's own catalogue, in its order (R5.3: read from catalyst, never parsed here). */
export function commandsFromCatalog(catalog: unknown): SlashCommandSpec[] {
  const list = (catalog as { commands?: unknown } | null)?.commands;
  if (!Array.isArray(list)) return [];
  return list
    .filter((c): c is CatalogEntry => typeof (c as CatalogEntry | null)?.name === "string")
    .map((c) => {
      const hint = (c.usage ?? "").replace(new RegExp(`^/${c.name}\\s*`), "").trim();
      return {
        name: c.name,
        ...(c.summary ? { description: firstSentence(c.summary) } : {}),
        ...(hint ? { argumentHint: hint } : {}),
        ...(c.aliases && c.aliases.length > 0 ? { aliases: c.aliases } : {}),
      };
    });
}

export function commandNames(specs: readonly SlashCommandSpec[]): string[] {
  return specs.flatMap((spec) => [spec.name, ...(spec.aliases ?? [])]);
}

/** Runs catalyst; the default spawns it with no shell, from the project, for at most 15 seconds. */
export type RunCatalyst = (args: string[], cwd: string) => { status: number | null; stdout: string };

const runCatalyst: RunCatalyst = (args, cwd) => {
  const [cmd, ...pre] = catalystCommand();
  const out = spawnSync(cmd, [...pre, ...args], { cwd, encoding: "utf8", timeout: 15_000, shell: false });
  return { status: out.status, stdout: out.stdout };
};

/**
 * The catalyst commands of a project, as catalyst gives them (`catalyst spec
 * --json`): the same list its MCP server offers as prompts. `[]` when
 * catalyst cannot be run or the project has no deployment.
 */
export function discoverSlashCommands(projectRoot: string, run: RunCatalyst = runCatalyst): SlashCommandSpec[] {
  try {
    const out = run(["--project", projectRoot, "spec", "--json"], projectRoot);
    return out.status === 0 ? commandsFromCatalog(JSON.parse(out.stdout)) : [];
  } catch {
    return [];
  }
}
