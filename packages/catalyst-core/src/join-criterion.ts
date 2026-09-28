import { execFile } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { claudeCodeStoragePath } from "./discover.js";
import type { CatalystPointer } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * A brand-new deployment's default working-copy location, computed per
 * machine (never stored in a tracked file): the running agent's
 * agent-owned per-project storage — for Claude Code,
 * `claudeCodeStoragePath` — which `resolveCorpusRoot` also knows how to
 * find even if the project's `.criterion` symlink is ever lost.
 */
export function defaultAgentSource(projectRoot: string): string {
  return claudeCodeStoragePath(projectRoot);
}

/** Runs `git <args>` in `cwd`, throwing with stderr on a non-zero exit. */
async function runGit(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: unknown }).stderr).trim()
        : undefined;
    throw new Error(
      `git ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`,
    );
  }
}

/** Best-effort `git config user.name`; `undefined` rather than throwing when git has none configured. */
async function currentGitUserName(): Promise<string | undefined> {
  try {
    const name = await runGit(["config", "user.name"]);
    return name.length > 0 ? name : undefined;
  } catch {
    return undefined;
  }
}

/** The repo's own name, derived from its URL (SSH or HTTPS), `.git` suffix stripped. */
export function repoNameFromUrl(repoUrl: string): string {
  const trimmed = repoUrl.trim().replace(/\.git$/, "");
  const segments = trimmed.split(/[/:]/).filter((s) => s.length > 0);
  return segments[segments.length - 1] ?? trimmed;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Writes `<project_name>.catalyst` at the project root as pretty-printed JSON, trailing newline included. */
export function writeCatalystPointer(
  projectRoot: string,
  pointer: CatalystPointer,
): void {
  const filePath = join(projectRoot, `${pointer.project_name}.catalyst`);
  writeFileSync(filePath, `${JSON.stringify(pointer, null, 2)}\n`);
}

/** The gitignore line that keeps a project's `.criterion` (symlink or in-project fallback) out of its own repo. */
export const CRITERION_GITIGNORE_ENTRY = "/.criterion";

/** Lines a `.gitignore` may already use to ignore the root `.criterion` — any of them counts as present. */
const CRITERION_GITIGNORE_EQUIVALENTS = new Set([
  "/.criterion",
  "/.criterion/",
  ".criterion",
  ".criterion/",
]);

/**
 * Ensures the project's `.gitignore` ignores its root `.criterion`,
 * appending `/.criterion` (creating the file if absent). Idempotent: does
 * nothing when an equivalent line is already there. Returns whether the
 * file was changed.
 */
export function ensureCriterionGitignored(projectRoot: string): boolean {
  const gitignore = join(projectRoot, ".gitignore");
  const existing = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  const present = existing
    .split(/\r?\n/)
    .some((line) => CRITERION_GITIGNORE_EQUIVALENTS.has(line.trim()));
  if (present) return false;

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  appendFileSync(gitignore, `${separator}${CRITERION_GITIGNORE_ENTRY}\n`);
  return true;
}

/** Whether `err` is a Node system error with the given `code`. */
function hasErrorCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === code
  );
}

/**
 * Inspects `<projectRoot>/.criterion` before a join: `"absent"` if nothing
 * is there, `"linked"` if it's already a symlink to `agentSource`. Throws
 * for anything else (a real directory, a file, a symlink elsewhere) rather
 * than silently replacing a possibly-unrelated deployment.
 */
function inspectCriterionLink(
  linkPath: string,
  agentSource: string,
): "absent" | "linked" {
  let stats;
  try {
    stats = lstatSync(linkPath);
  } catch (err) {
    if (hasErrorCode(err, "ENOENT")) return "absent";
    throw err;
  }
  if (stats.isSymbolicLink()) {
    const target = resolve(dirname(linkPath), readlinkSync(linkPath));
    if (target === resolve(agentSource)) return "linked";
  }
  throw new Error(
    `${linkPath} already exists and is not a symlink to ${agentSource}`,
  );
}

export interface JoinCriterionOptions {
  projectRoot: string;
  repoUrl: string;
  /** Branch to check out: a contributor's own `<name>.criterion`, or `criterion` itself (single-maintainer mode). */
  branch: string;
  /** Defaults to `defaultAgentSource(projectRoot)`. */
  agentSource?: string;
  /** The `*.catalyst` pointer's `agent` field (which coding agent this deployment is chat-bound to), if known. */
  agentId?: string;
}

/**
 * Joins an already-repoed criterion deployment (`Rules-of-Rules.md` §13's
 * `/criterion get`, done in code rather than handed to a reasoning agent —
 * cloning a branch and writing a pointer file needs no judgment calls).
 *
 * Kernel 0.37.0's working-copy location model: clones `branch` from
 * `repoUrl` into the resolved `agentSource` (agent-owned space, never
 * inside the project's own tree — INV-6), makes `<projectRoot>/.criterion`
 * a symlink to it (the single access path), ensures `/.criterion` is in
 * the project's `.gitignore`, then writes the project-root pointer file —
 * which carries no path (no `agent-source`). Where symlinks can't be
 * created (`EPERM`, e.g. Windows without developer mode), clones straight
 * into `<projectRoot>/.criterion` instead (the in-project fallback), still
 * gitignored.
 *
 * Refuses if `.criterion` already exists and isn't a symlink to
 * `agentSource`, or if the clone target already has content, rather than
 * silently overwriting a possibly-unrelated deployment.
 *
 * Deliberately narrower than `/criterion get`'s full spec: it does not
 * perform that command's identity migration (rewriting existing artifacts'
 * `Signed-off-by` fields to a newly-registered `git_username`) — there are
 * no local artifacts to migrate for a project that had no deployment at
 * all a moment ago.
 */
export async function joinCriterionRepo(
  options: JoinCriterionOptions,
): Promise<CatalystPointer> {
  const { projectRoot, repoUrl, branch } = options;
  const agentSource = resolve(
    options.agentSource ?? defaultAgentSource(projectRoot),
  );
  const linkPath = join(resolve(projectRoot), ".criterion");
  const inProjectRequested = agentSource === linkPath;

  const linkState = inProjectRequested
    ? "absent"
    : inspectCriterionLink(linkPath, agentSource);

  if (existsSync(agentSource) && readdirSync(agentSource).length > 0) {
    throw new Error(`${agentSource} already exists and is not empty`);
  }

  let cloneTarget = agentSource;
  let createdLink = false;
  if (!inProjectRequested && linkState === "absent") {
    mkdirSync(dirname(agentSource), { recursive: true });
    try {
      symlinkSync(agentSource, linkPath, "dir");
      createdLink = true;
    } catch (err) {
      if (!hasErrorCode(err, "EPERM")) throw err;
      cloneTarget = linkPath;
    }
  }
  mkdirSync(dirname(cloneTarget), { recursive: true });

  try {
    await runGit([
      "clone",
      "--branch",
      branch,
      "--single-branch",
      repoUrl,
      cloneTarget,
    ]);
  } catch (err) {
    // git removes a clone directory it created itself; only the symlink is ours to undo.
    if (createdLink) unlinkSync(linkPath);
    throw err;
  }

  ensureCriterionGitignored(projectRoot);

  const createdBy = await currentGitUserName();
  const pointer: CatalystPointer = {
    project_name: basename(projectRoot),
    ...(options.agentId ? { agent: options.agentId } : {}),
    repoed: true,
    catalyst_repo: repoNameFromUrl(repoUrl),
    catalyst_repo_url: repoUrl,
    criterion_branch: branch,
    ...(createdBy ? { created_by: createdBy } : {}),
    created: todayIso(),
    updated: todayIso(),
  };

  writeCatalystPointer(projectRoot, pointer);
  return pointer;
}
