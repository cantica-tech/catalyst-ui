import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * The project file: the one file catalyst keeps in a project (kernel ADR-010).
 * `catalyst.toml` at the project root names the project and pins its
 * versions, never a path; deployments made before it carry `<name>.catalyst`
 * (JSON), still read. Both read into the same flat record (the legacy
 * pointer's keys), so callers never care which file a project has.
 */
export const PROJECT_FILE = "catalyst.toml";
const LEGACY_SUFFIX = ".catalyst";

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The project file in `directory`: `catalyst.toml`, else a legacy `<name>.catalyst`; `null` if none. */
export function findProjectFile(directory: string): string | null {
  if (!existsSync(directory)) return null;
  const toml = join(directory, PROJECT_FILE);
  if (isFile(toml)) return toml;
  let names: string[];
  try {
    names = readdirSync(directory);
  } catch {
    return null;
  }
  const legacy = names.filter((n) => n.endsWith(LEGACY_SUFFIX) && isFile(join(directory, n))).sort()[0];
  return legacy ? join(directory, legacy) : null;
}

/** Whether `directory` holds a project file. */
export function hasProjectFile(directory: string): boolean {
  return findProjectFile(directory) !== null;
}

/**
 * The flat `key = value` TOML catalyst writes (no tables): basic strings,
 * booleans, numbers and arrays of those. Comments and blank lines are
 * ignored; anything else makes the file unreadable (`null`).
 */
export function parseProjectToml(text: string): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/.exec(line);
    if (!m) return null;
    const value = m[2].replace(/\s+#[^"]*$/, "").trim();
    try {
      // basic strings, true/false, numbers and arrays are valid JSON as catalyst writes them
      out[m[1]] = JSON.parse(value);
    } catch {
      return null;
    }
  }
  return out;
}

/** The project file's fields at `directory`; `null` when there is none or it cannot be parsed. */
export function readProjectFile(directory: string): Record<string, unknown> | null {
  const path = findProjectFile(directory);
  if (!path) return null;
  try {
    const text = readFileSync(path, "utf8");
    const data: unknown = path.endsWith(PROJECT_FILE) ? parseProjectToml(text) : JSON.parse(text);
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** catalyst's own space: `$CATALYST_HOME`, else `~/.catalyst`. */
export function catalystHome(): string {
  const override = process.env.CATALYST_HOME;
  return override?.trim() ? override : join(homedir(), ".catalyst");
}

/** A project's criterion in the home store: `<catalystHome>/projects/<name>/criterion`. */
export function homeCriterion(name: string): string {
  return join(catalystHome(), "projects", name, "criterion");
}

/** The project name a project file declares (`project_name`, else `name`). */
export function projectName(data: Record<string, unknown> | null): string | null {
  const name = data?.project_name ?? data?.name;
  return typeof name === "string" && name ? name : null;
}
