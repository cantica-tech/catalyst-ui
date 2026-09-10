import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolves which catalyst deployment to inspect for an opened project, the
 * same way catalyst's own scripts/check_deployment.py's find_deploy_root
 * does: a `*.catalyst` pointer file at the project root, whose
 * `agent-source` field names the real working copy (INV-6 — the working
 * copy lives in agent-owned space, never inside the project's own repo).
 * Returns null rather than throwing when nothing resolves — no catalyst
 * deployment for the opened project is a normal, expected state.
 */
export function resolveCorpusRoot(projectRoot: string): string | null {
  if (!existsSync(projectRoot)) return null;

  const pointerFile = readdirSync(projectRoot).find((name) =>
    name.endsWith(".catalyst"),
  );
  if (!pointerFile) return null;

  let pointer: unknown;
  try {
    pointer = JSON.parse(readFileSync(join(projectRoot, pointerFile), "utf8"));
  } catch {
    return null;
  }

  if (typeof pointer !== "object" || pointer === null) return null;
  const agentSource = (pointer as Record<string, unknown>)["agent-source"];
  if (typeof agentSource !== "string" || !existsSync(agentSource)) return null;

  return agentSource;
}

/**
 * Reads a resolved deployment's `version.txt` (SYNCHRONIZE.md's "Version
 * rule": "the deployed framework must have a version.txt file"), trimmed.
 * `null` if missing, empty, or unreadable — callers should treat that as
 * "can't safely compare," not as any particular version.
 */
export function readDeployedFrameworkVersion(
  corpusRoot: string,
): string | null {
  const versionFile = join(corpusRoot, "version.txt");
  if (!existsSync(versionFile)) return null;

  try {
    const version = readFileSync(versionFile, "utf8").trim();
    return version.length > 0 ? version : null;
  } catch {
    return null;
  }
}
