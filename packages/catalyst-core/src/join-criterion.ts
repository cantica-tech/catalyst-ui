import { execFile } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

import { claudeCodeStoragePath } from "./discover.js";
import {
  PROJECT_FILE,
  catalystHome,
  findProjectFile,
  homeCriterion,
  projectName,
  readProjectFile,
} from "./project-file.js";
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
    const stderr = err && typeof err === "object" && "stderr" in err ? String(err.stderr).trim() : undefined;
    throw new Error(`git ${args.join(" ")} failed${stderr ? `: ${stderr}` : ""}`);
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
export function writeCatalystPointer(projectRoot: string, pointer: CatalystPointer): void {
  const filePath = join(projectRoot, `${pointer.project_name}.catalyst`);
  writeFileSync(filePath, `${JSON.stringify(pointer, null, 2)}\n`);
}

/** The gitignore line that keeps a project's `.criterion` (symlink or in-project fallback) out of its own repo. */
export const CRITERION_GITIGNORE_ENTRY = "/.criterion";

/** Lines a `.gitignore` may already use to ignore the root `.criterion` — any of them counts as present. */
const CRITERION_GITIGNORE_EQUIVALENTS = new Set(["/.criterion", "/.criterion/", ".criterion", ".criterion/"]);

/**
 * Ensures the project's `.gitignore` ignores its root `.criterion`,
 * appending `/.criterion` (creating the file if absent). Idempotent: does
 * nothing when an equivalent line is already there. Returns whether the
 * file was changed.
 */
export function ensureCriterionGitignored(projectRoot: string): boolean {
  const gitignore = join(projectRoot, ".gitignore");
  const existing = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  const present = existing.split(/\r?\n/).some((line) => CRITERION_GITIGNORE_EQUIVALENTS.has(line.trim()));
  if (present) return false;

  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  appendFileSync(gitignore, `${separator}${CRITERION_GITIGNORE_ENTRY}\n`);
  return true;
}

export interface JoinCriterionOptions {
  projectRoot: string;
  repoUrl: string;
  /** Branch to check out: a contributor's own `<name>.criterion`, or `criterion` itself (single-maintainer mode). */
  branch: string;
  /** Legacy (agent-owned space); ignored since kernel 0.48.0 — the criterion goes to the home store. */
  agentSource?: string;
  /** The project file's `agent` field (which coding agent this deployment is chat-bound to), if known. */
  agentId?: string;
}

/** `catalyst.toml` as catalyst writes it: flat `key = value` lines (kernel ADR-010). */
export function writeProjectToml(projectRoot: string, data: Record<string, unknown>): string {
  const lines = [
    "# catalyst project file: names this project's criterion ($HOME/.catalyst/projects/<project_name>/criterion). Never a path.",
  ];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined || typeof value === "object") continue;
    lines.push(`${key} = ${JSON.stringify(value)}`);
  }
  const path = join(projectRoot, PROJECT_FILE);
  writeFileSync(path, `${lines.join("\n")}\n`);
  return path;
}

/**
 * Joins an already-repoed criterion deployment (`catalyst criterion join`,
 * done in code — cloning a branch and writing the project file need no
 * judgment calls).
 *
 * Kernel 0.48.0's model (ADR-010, INV-6): clones `branch` from `repoUrl`
 * into the home store, `<catalyst home>/projects/<name>/criterion` — or
 * brings an existing clone of the same repository up to date — and writes
 * `catalyst.toml`, the only file it adds to the project. No symlink, no
 * `.gitignore` entry. A same-named criterion with another remote is
 * refused, as is a project still on a legacy `*.catalyst` pointer
 * (`catalyst move --to-home` first). The criterion's runtime is installed by
 * `catalyst runtime install`, which this tries through the launcher when
 * it is installed.
 */
export async function joinCriterionRepo(options: JoinCriterionOptions): Promise<CatalystPointer> {
  const projectRoot = resolve(options.projectRoot);
  const { repoUrl, branch } = options;
  const existingFile = findProjectFile(projectRoot);
  if (existingFile && !existingFile.endsWith(PROJECT_FILE)) {
    throw new Error(`${basename(existingFile)} is a legacy pointer — run \`catalyst move --to-home\` first`);
  }
  const existing = readProjectFile(projectRoot) ?? {};
  const name = projectName(existing) ?? basename(projectRoot);
  const target = homeCriterion(name);

  if (existsSync(target) && readdirSync(target).length > 0) {
    let remote = "";
    try {
      remote = await runGit(["-C", target, "remote", "get-url", "origin"]);
    } catch {
      remote = "";
    }
    if (remote !== repoUrl) {
      throw new Error(
        `${target} exists with another remote (${remote || "none"}) — a different project with the same name?`,
      );
    }
    await runGit(["-C", target, "fetch", "--quiet", "origin"]);
    await runGit(["-C", target, "checkout", "--quiet", "-B", branch, `origin/${branch}`]);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    await runGit(["clone", "--branch", branch, "--single-branch", repoUrl, target]);
  }

  const createdBy = await currentGitUserName();
  const pointer: CatalystPointer = {
    ...(existing as unknown as Partial<CatalystPointer>),
    project_name: name,
    ...(options.agentId ? { agent: options.agentId } : {}),
    repoed: true,
    catalyst_repo: repoNameFromUrl(repoUrl),
    catalyst_repo_url: repoUrl,
    criterion_branch: branch,
    ...(createdBy && !existing.created_by ? { created_by: createdBy } : {}),
    created: (existing.created as string | undefined) ?? todayIso(),
    updated: todayIso(),
  };
  writeProjectToml(projectRoot, pointer as unknown as Record<string, unknown>);

  // best effort: the criterion's own runtime, when catalyst's launcher is installed
  const launcher = join(catalystHome(), "bin", "catalyst");
  if (existsSync(launcher)) {
    try {
      await execFileAsync(
        process.platform === "win32" ? "py" : "python3",
        [...(process.platform === "win32" ? ["-3"] : []), launcher, "runtime", "install"],
        { cwd: projectRoot },
      );
    } catch {
      /* the user can run `catalyst runtime install` later */
    }
  }
  return pointer;
}
