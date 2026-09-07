import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Looks for a sibling directory of `workspaceFolderPath` containing a
 * `BOOTSTRAP.md` at its root — the convention a catalyst framework
 * checkout and the projects it governs are already cloned under, side
 * by side. Returns the first match (deterministic order), or `null`
 * if none is found — the caller falls back to the `catalyst.
 * frameworkPath` setting.
 */
export function findSiblingFrameworkRepo(
  workspaceFolderPath: string,
): string | null {
  const parent = dirname(workspaceFolderPath);
  if (!existsSync(parent)) return null;

  const candidates = readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(parent, entry.name))
    .filter((candidate) => candidate !== workspaceFolderPath)
    .sort();

  return (
    candidates.find((candidate) =>
      existsSync(join(candidate, "BOOTSTRAP.md")),
    ) ?? null
  );
}

/**
 * The prompt copied to the clipboard by the install-offer — handed to
 * whichever coding agent the user runs it through, since catalyst's own
 * `BOOTSTRAP.md` is written to be followed by a reasoning agent, not
 * run as a deterministic script.
 */
export function buildInstantiationPrompt(
  frameworkPath: string,
  projectRoot: string,
): string {
  return `Load BOOTSTRAP.md from ${frameworkPath} and follow it to instantiate catalyst in this project (${projectRoot}).`;
}
