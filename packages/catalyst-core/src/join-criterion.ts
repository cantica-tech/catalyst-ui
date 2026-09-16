import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { promisify } from "node:util";

import { claudeCodeStoragePath } from "./discover.js";
import type { CatalystPointer } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * A brand-new deployment's default working-copy location: the same
 * Claude Code per-project convention `resolveCorpusRoot`'s fallback 2
 * already knows how to find, so a deployment created this way is
 * discoverable even if its pointer file is ever lost or rebuilt.
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
 * Clones `branch` from `repoUrl` straight into the resolved `agentSource`
 * (agent-owned space, never inside the project's own tree — INV-6), then
 * writes the project-root pointer file. Refuses if `agentSource` already
 * has content, rather than silently overwriting a possibly-unrelated
 * deployment.
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
  const agentSource = options.agentSource ?? defaultAgentSource(projectRoot);

  if (existsSync(agentSource) && readdirSync(agentSource).length > 0) {
    throw new Error(`${agentSource} already exists and is not empty`);
  }
  mkdirSync(dirname(agentSource), { recursive: true });

  await runGit([
    "clone",
    "--branch",
    branch,
    "--single-branch",
    repoUrl,
    agentSource,
  ]);

  const createdBy = await currentGitUserName();
  const pointer: CatalystPointer = {
    project_name: basename(projectRoot),
    ...(options.agentId ? { agent: options.agentId } : {}),
    "agent-source": agentSource,
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
