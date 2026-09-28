import { execFile } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defaultAgentSource,
  ensureCriterionGitignored,
  joinCriterionRepo,
  repoNameFromUrl,
  writeCatalystPointer,
} from "../join-criterion.js";
import { claudeCodeStoragePath } from "../discover.js";

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
      return actual.symlinkSync(...args);
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
    expect(defaultAgentSource(projectRoot)).toBe(
      claudeCodeStoragePath(projectRoot),
    );
  });
});

describe("repoNameFromUrl", () => {
  it("strips .git from an SSH URL", () => {
    expect(repoNameFromUrl("git@github.com:oliben67/criterion.git")).toBe(
      "criterion",
    );
  });

  it("strips .git from an HTTPS URL", () => {
    expect(repoNameFromUrl("https://github.com/oliben67/criterion.git")).toBe(
      "criterion",
    );
  });

  it("handles a URL with no .git suffix", () => {
    expect(repoNameFromUrl("https://github.com/oliben67/criterion")).toBe(
      "criterion",
    );
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
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toBe(
      "/.criterion\n",
    );
  });

  it("appends to an existing .gitignore lacking a trailing newline", () => {
    const projectRoot = tempDir("catalyst-core-join-gitignore-");
    writeFileSync(join(projectRoot, ".gitignore"), "node_modules/");
    ensureCriterionGitignored(projectRoot);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toBe(
      "node_modules/\n/.criterion\n",
    );
  });

  it("is idempotent, and accepts an equivalent existing entry", () => {
    const projectRoot = tempDir("catalyst-core-join-gitignore-");
    ensureCriterionGitignored(projectRoot);
    expect(ensureCriterionGitignored(projectRoot)).toBe(false);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toBe(
      "/.criterion\n",
    );

    const other = tempDir("catalyst-core-join-gitignore-");
    writeFileSync(join(other, ".gitignore"), "dist/\n.criterion/\n");
    expect(ensureCriterionGitignored(other)).toBe(false);
  });
});

describe("joinCriterionRepo", () => {
  it("clones into agentSource, links .criterion to it, gitignores it, and writes a path-free pointer", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      "nested",
      ".criterion",
    );

    const pointer = await joinCriterionRepo({
      projectRoot,
      repoUrl,
      branch: "criterion",
      agentSource,
      agentId: "claude-code",
    });

    expect(existsSync(join(agentSource, "DEPLOYMENT.md"))).toBe(true);
    const link = join(projectRoot, ".criterion");
    expect(lstatSync(link).isSymbolicLink()).toBe(true);
    expect(readlinkSync(link)).toBe(agentSource);
    expect(existsSync(join(link, "DEPLOYMENT.md"))).toBe(true);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toContain(
      "/.criterion\n",
    );
    expect(pointer).not.toHaveProperty("agent-source");
    expect(pointer).toMatchObject({
      agent: "claude-code",
      repoed: true,
      criterion_branch: "criterion",
      catalyst_repo_url: repoUrl,
    });
    expect(pointer.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const written = JSON.parse(
      readFileSync(
        join(projectRoot, `${pointer.project_name}.catalyst`),
        "utf8",
      ),
    );
    expect(written).toEqual(pointer);
  });

  it("clones a contributor's own <name>.criterion branch, not just criterion itself", async () => {
    const repoUrl = await createBareCriterionRepo("olivier-steck.criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      ".criterion",
    );

    const pointer = await joinCriterionRepo({
      projectRoot,
      repoUrl,
      branch: "olivier-steck.criterion",
      agentSource,
    });

    expect(pointer.criterion_branch).toBe("olivier-steck.criterion");
    expect(pointer.agent).toBeUndefined();
  });

  it("refuses when agentSource already exists and is not empty", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const agentSource = tempDir("catalyst-core-join-existing-");
    writeFileSync(join(agentSource, "already-here.txt"), "content");

    await expect(
      joinCriterionRepo({
        projectRoot,
        repoUrl,
        branch: "criterion",
        agentSource,
      }),
    ).rejects.toThrow(/already exists and is not empty/);
  });

  it("refuses when .criterion already exists as a real directory", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    mkdirSync(join(projectRoot, ".criterion"));
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      ".criterion",
    );

    await expect(
      joinCriterionRepo({
        projectRoot,
        repoUrl,
        branch: "criterion",
        agentSource,
      }),
    ).rejects.toThrow(/already exists and is not a symlink to/);
    expect(existsSync(agentSource)).toBe(false);
  });

  it("refuses when .criterion is a symlink to a different location", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const elsewhere = tempDir("catalyst-core-join-elsewhere-");
    symlinkSync(elsewhere, join(projectRoot, ".criterion"), "dir");
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      ".criterion",
    );

    await expect(
      joinCriterionRepo({
        projectRoot,
        repoUrl,
        branch: "criterion",
        agentSource,
      }),
    ).rejects.toThrow(/already exists and is not a symlink to/);
  });

  it("reuses an existing .criterion symlink that already points at agentSource", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      ".criterion",
    );
    symlinkSync(agentSource, join(projectRoot, ".criterion"), "dir");

    await joinCriterionRepo({
      projectRoot,
      repoUrl,
      branch: "criterion",
      agentSource,
    });

    expect(existsSync(join(projectRoot, ".criterion", "DEPLOYMENT.md"))).toBe(
      true,
    );
  });

  it("falls back to cloning into <projectRoot>/.criterion when symlinks aren't permitted", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      ".criterion",
    );
    symlinkControl.failWithEperm = true;

    const pointer = await joinCriterionRepo({
      projectRoot,
      repoUrl,
      branch: "criterion",
      agentSource,
    });

    const inProject = join(projectRoot, ".criterion");
    expect(lstatSync(inProject).isDirectory()).toBe(true);
    expect(existsSync(join(inProject, "DEPLOYMENT.md"))).toBe(true);
    expect(existsSync(join(agentSource, "DEPLOYMENT.md"))).toBe(false);
    expect(readFileSync(join(projectRoot, ".gitignore"), "utf8")).toContain(
      "/.criterion\n",
    );
    expect(pointer).not.toHaveProperty("agent-source");
  });

  it("removes the .criterion symlink it created when the clone fails", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      ".criterion",
    );

    await expect(
      joinCriterionRepo({
        projectRoot,
        repoUrl,
        branch: "does-not-exist.criterion",
        agentSource,
      }),
    ).rejects.toThrow(/git clone/);
    expect(() => lstatSync(join(projectRoot, ".criterion"))).toThrow();
  });

  it("rejects when the branch doesn't exist on the remote", async () => {
    const repoUrl = await createBareCriterionRepo("criterion");
    const projectRoot = tempDir("catalyst-core-join-project-");
    const agentSource = join(
      tempDir("catalyst-core-join-target-"),
      ".criterion",
    );

    await expect(
      joinCriterionRepo({
        projectRoot,
        repoUrl,
        branch: "does-not-exist.criterion",
        agentSource,
      }),
    ).rejects.toThrow(/git clone/);
  });
});
