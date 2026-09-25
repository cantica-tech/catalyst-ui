import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import { parseFieldTable, sectionLines } from "./parser.js";
import type { CatalystPointer } from "./types.js";
import { satisfiesVersionSpecifier } from "./versioning.js";

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

function expandPath(pathStr: string, projectRoot: string): string {
  let expanded = pathStr.trim();
  if (expanded.startsWith("~/") || expanded === "~") {
    expanded = join(homedir(), expanded.slice(expanded === "~" ? 1 : 2));
  }
  return isAbsolute(expanded) ? expanded : resolve(projectRoot, expanded);
}

/**
 * Thoroughly explores persistent memory notes and directories to locate a project's catalyst working copy.
 */
function findCorpusRootFromMemory(projectRoot: string): string | null {
  const memoryDirs = [
    join(
      homedir(),
      "Library",
      "Application Support",
      "Code",
      "User",
      "globalStorage",
      "github.copilot-chat",
      "memory-tool",
      "memories",
    ),
    join(homedir(), ".vscode", "memories"),
    join(homedir(), ".claude", "memories"),
  ];

  const projectName = projectRoot.split("/").pop() || "";

  for (const memDir of memoryDirs) {
    if (!existsSync(memDir)) continue;
    try {
      const files = readdirSync(memDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        const content = readFileSync(join(memDir, file), "utf8");
        if (
          content.includes(projectRoot) ||
          (projectName && content.includes(projectName))
        ) {
          const matches = content.matchAll(
            /(?:deployment root|agent-source|deployment directory|working copy|path):\s*(`?[^\n`]+`?)/gi,
          );
          for (const match of matches) {
            const rawPath = match[1].replace(/[`"]/g, "").trim();
            const candidate = expandPath(rawPath, projectRoot);
            if (existsSync(candidate)) return candidate;
          }
        }
      }
    } catch {
      // ignore read errors
    }
  }
  return null;
}

/**
 * Claude Code's per-project data directory convention for a fresh
 * deployment's working copy: `~/.claude/projects/<slug>/.criterion`, where
 * `<slug>` is the project's absolute path with `/` and `:` collapsed to
 * `-`. Shared by `resolveCorpusRoot`'s fallback 2 (an existing deployment
 * that predates its own pointer) and by a brand-new deployment's default
 * `agent-source` (`join-criterion.ts`) — both need the exact same
 * convention or the two would disagree about where the working copy lives.
 */
export function claudeCodeStoragePath(projectRoot: string): string {
  const slug = projectRoot.replace(/[/:]/g, "-");
  return join(homedir(), ".claude", "projects", slug, ".criterion");
}

/**
 * Resolves which catalyst deployment to inspect for an opened project, the
 * same way catalyst's own scripts/check_deployment.py's find_deploy_root
 * does: a `*.catalyst` pointer file at the project root, whose
 * `agent-source` field names the real working copy (INV-6 — the working
 * copy lives in agent-owned space, never inside the project's own repo).
 * Falls back to in-project `.criterion`, Claude Code storage, or memory notes.
 */
export function resolveCorpusRoot(projectRoot: string): string | null {
  const pointer = readPointerFile(projectRoot);
  const agentSource = pointer?.["agent-source"];
  if (typeof agentSource === "string") {
    const resolved = expandPath(agentSource, projectRoot);
    if (existsSync(resolved)) return resolved;
  }

  // Fallback 1: in-project fallback (.criterion)
  const inProject = join(projectRoot, ".criterion");
  if (existsSync(inProject)) return inProject;

  // Fallback 2: Claude Code per-project storage (~/.claude/projects/<slug>/.criterion)
  const claudeCode = claudeCodeStoragePath(projectRoot);
  if (existsSync(claudeCode)) return claudeCode;

  // Fallback 3: Thoroughly explore persistent memory for recorded deployment targets
  const fromMemory = findCorpusRootFromMemory(projectRoot);
  if (fromMemory) return fromMemory;

  return null;
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
 * Whether a catalyst deployment is already declared for this project — the
 * one, deliberately simple existence check an install-offer should gate
 * on: does a well-formed `*.catalyst` pointer file exist at the project
 * root? Never the richer `resolveCorpusRoot` fallback chain (in-project
 * `.criterion`, Claude Code storage guesses, memory-note text scanning) —
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
 * The oldest catalyst kernel version this `catalyst-core` build can
 * correctly parse — a version specifier (`versioning.ts`), the same way
 * a `uv.lock`'s `requires-python` field states its floor, rather than a
 * bare number. Below `0.31.0`, a step's parent field is still named
 * `Requirement` everywhere (this parser reads that as a fallback, so it
 * degrades gracefully) — but `0.31.0` is the newest kernel version
 * this build's parser/graph/validator logic (`TEST-`, a step's `Parent`
 * accepting a bug) was actually written and tested against, so it's the
 * declared floor: below it, this build hasn't been verified, not just
 * "might render fewer sections."
 */
export const REQUIRED_KERNEL_VERSION = ">=0.31.0";

/**
 * Whether a resolved deployment's own kernel version satisfies
 * `REQUIRED_KERNEL_VERSION`. `null` (from `readDeployedKernelVersion`,
 * e.g. a missing/unreadable `version.txt`) is treated as satisfying it —
 * "can't safely compare" must never itself become a false failure.
 */
export function meetsRequiredKernelVersion(
  deployedVersion: string | null,
): boolean {
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
