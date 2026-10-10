import { existsSync, lstatSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { KERNEL_VERSION_FLOOR } from "./kernel-version.js";
import { parseFieldTable, sectionLines } from "./markdown.js";
import { homeCriterion, projectName, readProjectFile } from "./project-file.js";
import type { CatalystPointer } from "./types.js";
import { satisfiesVersionSpecifier } from "./versioning.js";

/** The project file at a project's root (`catalyst.toml`, else a legacy `*.catalyst` pointer), if any. `null` if there's no such file or it can't be parsed. */
function readPointerFile(projectRoot: string): CatalystPointer | null {
  return readProjectFile(projectRoot) as CatalystPointer | null;
}

function expandPath(pathStr: string, projectRoot: string): string {
  let expanded = pathStr.trim();
  if (expanded.startsWith("~/") || expanded === "~") {
    expanded = join(homedir(), expanded.slice(expanded === "~" ? 1 : 2));
  }
  return isAbsolute(expanded) ? expanded : resolve(projectRoot, expanded);
}

/**
 * Claude Code's agent-owned per-project storage for a deployment's working
 * copy: `~/.claude/projects/<slug>/.criterion`, where `<slug>` is the
 * project's absolute path with every non-alphanumeric character replaced
 * by `-` (Claude Code's own project-slug convention, so this is the parent
 * of the project's auto-memory directory). Shared by `resolveCorpusRoot`'s
 * Claude Code storage fallback and by a brand-new deployment's default
 * working-copy location (`join-criterion.ts`) — both need the exact same
 * convention or the two would disagree about where the working copy lives.
 * Computed per machine, never stored in a tracked file.
 */
export function claudeCodeStoragePath(projectRoot: string): string {
  const slug = projectRoot.replace(/[^a-zA-Z0-9]/g, "-");
  return join(homedir(), ".claude", "projects", slug, ".criterion");
}

/** Whether `path` exists and is a directory, following symlinks (a dangling symlink is `false`). */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolves which catalyst deployment to inspect for an opened project
 * (kernel 0.37.0's working-copy location model), in order:
 *
 * 1. `<projectRoot>/.criterion` — the single access path: a gitignored
 *    symlink into the running agent's agent-owned storage (INV-6), or the
 *    real directory where the agent has no owned space / the platform has
 *    no symlinks. Followed if it's a symlink; returned as the in-project
 *    path either way.
 * 2. Legacy: the `*.catalyst` pointer's `agent-source` field, if present
 *    and an existing directory (pre-0.37.0 deployments, until migrated —
 *    the pointer no longer carries a path).
 * 3. Claude Code per-project storage (`claudeCodeStoragePath`), derived
 *    from the project path alone.
 *
 * Deterministic on purpose (B-13): no scan of other tools' memory notes,
 * which matched by project-name substring and could open another
 * project's working copy.
 */
export function resolveCorpusRoot(projectRoot: string): string | null {
  // 0. The home store (kernel ADR-010): <catalyst home>/projects/<name>/criterion
  const name = projectName(readProjectFile(projectRoot));
  if (name && isDirectory(homeCriterion(name))) return homeCriterion(name);

  // 1. Legacy <projectRoot>/.criterion (symlink followed, or real dir)
  const inProject = join(projectRoot, ".criterion");
  if (isDirectory(inProject)) return inProject;

  // 2. Legacy pointer `agent-source` (pre-0.37.0)
  const legacyAgentSource = readPointerFile(projectRoot)?.["agent-source"];
  if (typeof legacyAgentSource === "string") {
    const resolved = expandPath(legacyAgentSource, projectRoot);
    if (isDirectory(resolved)) return resolved;
  }

  // 3. Claude Code per-project storage (~/.claude/projects/<slug>/.criterion)
  const claudeCode = claudeCodeStoragePath(projectRoot);
  if (isDirectory(claudeCode)) return claudeCode;

  return null;
}

/**
 * Reads the full `*.catalyst` pointer at a project's root — everything
 * `resolveCorpusRoot` doesn't expose, e.g. the repoed-criterion fields
 * (`repoed`, `catalyst_repo`, `catalyst_repo_url`, `criterion_branch`,
 * `created_by`). `null` under the same conditions as `resolveCorpusRoot`.
 */
export function readCatalystPointer(projectRoot: string): CatalystPointer | null {
  return readPointerFile(projectRoot);
}

/**
 * Whether a catalyst deployment is already declared for this project — the
 * one, deliberately simple existence check an install-offer should gate
 * on: does a well-formed `*.catalyst` pointer file exist at the project
 * root? Never the richer `resolveCorpusRoot` fallback chain (in-project
 * `.criterion`, Claude Code storage) —
 * those exist to *locate* an already-declared deployment's working copy,
 * not to decide whether one was ever declared in the first place. A
 * project with none of those fallbacks resolving but a real pointer file
 * still counts as "has catalyst" here — it just needs its pointer fixed,
 * not a fresh install offered on top.
 */
export function hasCatalystPointer(projectRoot: string): boolean {
  return readPointerFile(projectRoot) !== null;
}

/**
 * Reads a resolved deployment's `version.txt` (SYNCHRONIZE.md's "Version
 * rule": "the deployed framework must have a version.txt file"), trimmed.
 * `null` if missing, empty, or unreadable — callers should treat that as
 * "can't safely compare," not as any particular version.
 */
export function readDeployedKernelVersion(corpusRoot: string): string | null {
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
 * The kernel versions this `catalyst-core` build can correctly parse, as a
 * version specifier (`versioning.ts`) the way a `uv.lock`'s
 * `requires-python` states its floor. Derived from the single source in
 * `kernel-version.ts`.
 */
export const REQUIRED_KERNEL_VERSION = `>=${KERNEL_VERSION_FLOOR}`;

/**
 * Whether a resolved deployment's own kernel version satisfies
 * `REQUIRED_KERNEL_VERSION`. `null` (from `readDeployedKernelVersion`,
 * e.g. a missing/unreadable `version.txt`) is treated as satisfying it —
 * "can't safely compare" must never itself become a false failure.
 */
export function meetsRequiredKernelVersion(deployedVersion: string | null): boolean {
  if (!deployedVersion) return true;
  return satisfiesVersionSpecifier(deployedVersion, REQUIRED_KERNEL_VERSION);
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

/**
 * Whether a deployment's working copy is reachable from where the extension
 * runs (`REQ-000016-UVqkd7cL`): `reachable` (its `.criterion`, or a
 * fallback location, resolves); `dangling` (`.criterion` is a symlink whose
 * target does not exist here — typically the agent-owned space of another
 * machine, as seen from a dev container, WSL or SSH); `missing` (no
 * `.criterion` at all, and no fallback).
 */
export type WorkingCopyState =
  { state: "reachable"; path: string } | { state: "dangling"; target: string } | { state: "missing" };

export function workingCopyState(projectRoot: string): WorkingCopyState {
  const resolved = resolveCorpusRoot(projectRoot);
  if (resolved) return { state: "reachable", path: resolved };
  const link = join(projectRoot, ".criterion");
  try {
    if (lstatSync(link).isSymbolicLink()) {
      return {
        state: "dangling",
        target: resolve(projectRoot, readlinkSync(link)),
      };
    }
  } catch {
    // no .criterion at all
  }
  return { state: "missing" };
}
