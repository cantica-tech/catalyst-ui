import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { parseFieldTable, sectionLines } from "./parser.js";
import type { CatalystPointer } from "./types.js";

/** Parses the `*.catalyst` pointer file at a project's root, if any. `null` if there's no such file or it isn't well-formed JSON. */
function readPointerFile(projectRoot: string): CatalystPointer | null {
  if (!existsSync(projectRoot)) return null;

  const pointerFile = readdirSync(projectRoot).find((name) =>
    name.endsWith(".catalyst"),
  );
  if (!pointerFile) return null;

  try {
    const pointer: unknown = JSON.parse(
      readFileSync(join(projectRoot, pointerFile), "utf8"),
    );
    if (typeof pointer !== "object" || pointer === null) return null;
    return pointer as CatalystPointer;
  } catch {
    return null;
  }
}

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
  const agentSource = readPointerFile(projectRoot)?.["agent-source"];
  if (typeof agentSource !== "string" || !existsSync(agentSource)) return null;
  return agentSource;
}

/**
 * Reads the full `*.catalyst` pointer at a project's root — everything
 * `resolveCorpusRoot` doesn't expose, e.g. the repoed-criterion fields
 * (`repoed`, `catalyst_repo`, `catalyst_repo_url`, `criterion_branch`,
 * `created_by`). `null` under the same conditions as `resolveCorpusRoot`.
 */
export function readCatalystPointer(
  projectRoot: string,
): CatalystPointer | null {
  return readPointerFile(projectRoot);
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

/**
 * Reads a deployed entity definition (`INVARIANTS.md` INV-23,
 * `.criterion/definitions/<entityType>.md`) — the short, versioned prose
 * explaining what one catalyst entity type is and what it's for. `null`
 * if the file is missing, unreadable, or missing its `Version` field or
 * `## Description` section — callers should treat that as "nothing to
 * show," not throw.
 */
export function readEntityDefinition(
  corpusRoot: string,
  entityType: string,
): { version: string; description: string } | null {
  const definitionFile = join(corpusRoot, "definitions", `${entityType}.md`);
  if (!existsSync(definitionFile)) return null;

  try {
    const { fields, text } = parseFieldTable(definitionFile);
    const version = fields.get("Version");
    const description = sectionLines(text, "Description").join(" ");
    if (!version || description.length === 0) return null;
    return { version, description };
  } catch {
    return null;
  }
}
