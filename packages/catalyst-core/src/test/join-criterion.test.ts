import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultAgentSource,
  ensureCriterionGitignored,
  joinCriterionRepo,
  repoNameFromUrl,
  writeCatalystPointer,
} from "../join-criterion.js";
import { claudeCodeStoragePath, readCatalystPointer, resolveCorpusRoot } from "../discover.js";

const execFileAsync = promisify(execFile);

/** When set, `symlinkSync` fails with `EPERM`, as on Windows without developer mode. */
const symlinkControl = vi.hoisted(() => ({ failWithEperm: false }));

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    symlinkSync: (...args: Parameters<typeof actual.symlinkSync>) => {
      if (symlinkControl.failWithEperm) {
        throw Object.assign(new Error("EPERM: operation not permitted"), {
          code: "EPERM",
        });
      }
      actual.symlinkSync(...args);
    },
  };
});

let dirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
  symlinkControl.failWithEperm = false;
});

/** A local bare repo with one commit on `branch` — clone-able over a plain filesystem path, no network involved. */
async function createBareCriterionRepo(branch: string): Promise<string> {
  const bareDir = tempDir("catalyst-core-join-bare-");
  const workDir = tempDir("catalyst-core-join-work-");
  await execFileAsync("git", ["init", "--bare", bareDir]);
  await execFileAsync("git", ["init", "-b", branch, workDir]);
  await execFileAsync("git", ["config", "user.email", "test@example.com"], {
    cwd: workDir,
  });
  await execFileAsync("git", ["config", "user.name", "Test User"], {
    cwd: workDir,
  });
  writeFileSync(join(workDir, "DEPLOYMENT.md"), "# Deployment\n");
  await execFileAsync("git", ["add", "DEPLOYMENT.md"], { cwd: workDir });
  await execFileAsync("git", ["commit", "-m", "seed"], { cwd: workDir });
  await execFileAsync("git", ["push", bareDir, `${branch}:${branch}`], {
    cwd: workDir,
  });
  return bareDir;
}

describe("defaultAgentSource", () => {
  it("matches claudeCodeStoragePath — the same convention resolveCorpusRoot's fallback looks for", () => {
    const projectRoot = "/Users/example/sources/my-project";
    expect(defaultAgentSource(projectRoot)).toBe(claudeCodeStoragePath(projectRoot));
  });
});

describe("repoNameFromUrl", () => {
  it("strips .git from an SSH URL", () => {
    expect(repoNameFromUrl("git@github.com:oliben67/criterion.git")).toBe("criterion");
  });

  it("strips .git from an HTTPS URL", () => {
    expect(repoNameFromUrl("https://github.com/oliben67/criterion.git")).toBe("criterion");
  });

  it("handles a URL with no .git suffix", () => {
    expect(repoNameFromUrl("https://github.com/oliben67/criterion")).toBe("criterion");
  });
});

describe("writeCatalystPointer", () => {
  it("writes <project_name>.catalyst as pretty JSON with a trailing newline", () => {
    const projectRoot = tempDir("catalyst-core-join-pointer-");
    writeCatalystPointer(projectRoot, {
      project_name: "my-project",
      agent: "claude-code",
    });

    const raw = readFileSync(join(projectRoot, "my-project.catalyst"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual({
      project_name: "my-project",
      agent: "claude-code",
    });
  });
});

describe("ensureCriterionGitignored", () => {
  it("creates .gitignore with /.criterion when absent", () => {
    const projectRoot = tempDir("catalyst-core-join-gitignore-");
    expect(ensureCriterionGitignored(projectRoot)).toBe(true);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toBe("/.criterion\n");
  });

  it("appends to an existing .gitignore lacking a trailing newline", () => {
    const projectRoot = tempDir("catalyst-core-join-gitignore-");
    writeFileSync(join(projectRoot, ".gitignore"), "node_modules/");
    ensureCriterionGitignored(projectRoot);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toBe("node_modules/\n/.criterion\n");
  });

  it("is idempotent, and accepts an equivalent existing entry", () => {
    const projectRoot = tempDir("catalyst-core-join-gitignore-");
    ensureCriterionGitignored(projectRoot);
    expect(ensureCriterionGitignored(projectRoot)).toBe(false);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toBe("/.criterion\n");

    const other = tempDir("catalyst-core-join-gitignore-");
    writeFileSync(join(other, ".gitignore"), "dist/\n.criterion/\n");
    expect(ensureCriterionGitignored(other)).toBe(false);
  });
});

describe("joinCriterionRepo (home store, kernel 0.48.0)", () => {
  let savedHome: string | undefined;
  let home: string;

  beforeEach(() => {
    savedHome = process.env.CATALYST_HOME;
    home = tempDir("catalyst-core-join-home-");
    process.env.CATALYST_HOME = home;
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.CATALYST_HOME;
    else process.env.CATALYST_HOME = savedHome;
  });

  it("clones into the home store and writes catalyst.toml — nothing else in the project", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");

    const pointer = await joinCriterionRepo({
      projectRoot,
      repoUrl,
      branch: "criterion",
      agentId: "claude-code",
    });

    const name = pointer.project_name;
    expect(existsSync(join(home, "projects", name, "criterion", "DEPLOYMENT.md"))).toBe(true);
    expect(existsSync(join(projectRoot, ".criterion"))).toBe(false);
    expect(existsSync(join(projectRoot, ".gitignore"))).toBe(false);
    expect(pointer).toMatchObject({
      agent: "claude-code",
      repoed: true,
      criterion_branch: "criterion",
      catalyst_repo_url: repoUrl,
    });
    expect(readCatalystPointer(projectRoot)).toEqual(pointer);
    expect(resolveCorpusRoot(projectRoot)).toBe(join(home, "projects", name, "criterion"));
  });

  it("clones a contributor's own <name>.criterion branch", async () => {
    const repoUrl = await createBareCriterionRepo("ada.criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const pointer = await joinCriterionRepo({
      projectRoot,
      repoUrl,
      branch: "ada.criterion",
    });
    const { stdout } = await execFileAsync("git", [
      "-C",
      join(home, "projects", pointer.project_name, "criterion"),
      "symbolic-ref",
      "--short",
      "HEAD",
    ]);
    expect(stdout.trim()).toBe("ada.criterion");
  });

  it("joining again updates the same clone; another remote under the same name is refused", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    await joinCriterionRepo({ projectRoot, repoUrl, branch: "criterion" });
    await joinCriterionRepo({ projectRoot, repoUrl, branch: "criterion" });
    const other = await createBareCriterionRepo("criterion");
    await expect(joinCriterionRepo({ projectRoot, repoUrl: other, branch: "criterion" })).rejects.toThrow(
      /another remote/,
    );
  });

  it("refuses a project still on a legacy *.catalyst pointer", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    writeFileSync(join(projectRoot, "app.catalyst"), JSON.stringify({ project_name: "app" }));
    await expect(joinCriterionRepo({ projectRoot, repoUrl, branch: "criterion" })).rejects.toThrow(/move --to-home/);
  });

  it("rejects when the branch doesn't exist on the remote", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    await expect(joinCriterionRepo({ projectRoot, repoUrl, branch: "no-such-branch" })).rejects.toThrow();
  });
});
