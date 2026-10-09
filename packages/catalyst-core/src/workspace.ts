import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { hasProjectFile } from "./project-file.js";

/**
 * What a deployment governs, and where deployments are in a workspace
 * folder (`REQ-000015-UVqkd7cL`) — the TypeScript side of catalyst's scope
 * rule (kernel `fw-STRUCTURE-000017`, `scripts/catalyst/scope.py`): a
 * deployment governs the files under its pointer's directory, minus nested
 * directories with their own pointer (separate deployments) and minus what
 * a `.catalystignore` opts out — empty: its whole directory; with lines:
 * those paths, relative to it.
 */

export const IGNORE_FILE = ".catalystignore";

/** Directories never searched for deployments. */
export const SKIPPED_DIRS = new Set([
  ".git",
  ".criterion",
  "node_modules",
  "dist",
  "out",
  "build",
  ".venv",
  "venv",
  "__pycache__",
  "target",
]);

const toPosix = (p: string): string => p.split(sep).join("/");

/** A directory's opt-outs: `[]` for an empty `.catalystignore` (all of it), `null` without one. */
export function ignoreLines(directory: string): string[] | null {
  const file = join(directory, IGNORE_FILE);
  if (!existsSync(file)) return null;
  const lines: string[] = [];
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    while (line.startsWith("./")) line = line.slice(2);
    line = line.replace(/^\/+|\/+$/g, "");
    if (!line || line === ".") return [];
    lines.push(line);
  }
  return lines;
}

/** Whether `directory` is a catalyst project: it holds `catalyst.toml` (or a legacy `*.catalyst` pointer). */
export function hasPointer(directory: string): boolean {
  return hasProjectFile(directory);
}

const covers = (rest: string, lines: readonly string[]): boolean =>
  lines.some((l) => rest === l || rest.startsWith(`${l}/`));

/** The directory is outside catalyst: an empty `.catalystignore` in it or above, or a line above naming it. */
export function optedOut(directory: string): boolean {
  let d = resolve(directory);
  const target = d;
  for (;;) {
    const lines = ignoreLines(d);
    if (lines !== null) {
      if (lines.length === 0) return true;
      const rest = toPosix(relative(d, target));
      if (rest && covers(rest, lines)) return true;
    }
    const up = dirname(d);
    if (up === d) return false;
    d = up;
  }
}

/** `file` (absolute) belongs to the deployment whose pointer is in `projectRoot`. */
export function governs(projectRoot: string, file: string): boolean {
  const root = resolve(projectRoot);
  const rel = relative(root, resolve(file));
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return false;
  const parts = toPosix(rel).split("/");
  if (parts[0] === ".criterion") return false;
  for (let depth = 0; depth < parts.length; depth++) {
    const here = join(root, ...parts.slice(0, depth));
    if (depth > 0 && hasPointer(here)) return false; // a nested deployment owns it
    const lines = ignoreLines(here);
    if (lines !== null) {
      if (lines.length === 0) return false;
      if (covers(parts.slice(depth).join("/"), lines)) return false;
    }
  }
  return true;
}

/** Of `projectRoots` (deployments' directories), the one owning `file`, if any. */
export function owningDeployment(
  projectRoots: readonly string[],
  file: string,
): string | null {
  let best: string | null = null;
  for (const root of projectRoots) {
    const r = resolve(root);
    const rel = relative(r, resolve(file));
    if (rel.startsWith("..") || isAbsolute(rel)) continue;
    if (best === null || r.length > best.length) best = r;
  }
  return best !== null && governs(best, file) ? best : null;
}

/** `directory` is listed in `catalyst.ignoredFolders`: an absolute path, or one relative to `workspaceFolder`. */
export function isIgnoredFolder(
  directory: string,
  ignored: readonly string[],
  workspaceFolder: string,
): boolean {
  const target = resolve(directory);
  return ignored.some((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return false;
    const base = resolve(
      isAbsolute(trimmed) ? trimmed : join(workspaceFolder, trimmed),
    );
    const rel = relative(base, target);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
}

export interface FoundDeployment {
  /** The directory holding the `*.catalyst` pointer. */
  projectRoot: string;
  /** `<folder name>` for the folder itself, else `<folder name>/<relative path>`. */
  name: string;
}

/**
 * Every deployment under a workspace folder, nested ones included,
 * shallowest first: directories with a `*.catalyst` pointer, not under a
 * skipped directory, an opted-out one or an ignored folder, to `maxDepth`
 * levels below the folder.
 */
export function findDeployments(
  folderRoot: string,
  folderName: string,
  options: { ignored?: readonly string[]; maxDepth?: number } = {},
): FoundDeployment[] {
  const root = resolve(folderRoot);
  const ignored = options.ignored ?? [];
  const maxDepth = options.maxDepth ?? 4;
  const found: FoundDeployment[] = [];
  const queue: Array<[string, number]> = [[root, 0]];
  while (queue.length > 0) {
    const [dir, depth] = queue.shift()!;
    if (optedOut(dir) || isIgnoredFolder(dir, ignored, root)) continue;
    if (hasPointer(dir)) {
      const rel = toPosix(relative(root, dir));
      found.push({
        projectRoot: dir,
        name: rel ? `${folderName}/${rel}` : folderName,
      });
    }
    if (depth >= maxDepth) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      continue;
    }
    for (const name of entries) {
      if (SKIPPED_DIRS.has(name)) continue;
      const child = join(dir, name);
      try {
        if (statSync(child).isDirectory()) queue.push([child, depth + 1]);
      } catch {
        // unreadable: skip
      }
    }
  }
  return found;
}
