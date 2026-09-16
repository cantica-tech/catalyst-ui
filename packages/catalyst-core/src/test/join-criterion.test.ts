import { execFile } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  defaultAgentSource,
  joinCriterionRepo,
  repoNameFromUrl,
  writeCatalystPointer,
} from "../join-criterion.js";
import { claudeCodeStoragePath } from "../discover.js";

const execFileAsync = promisify(execFile);

let dirs: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
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
      "agent-source": "/tmp/somewhere",
    });

    const raw = readFileSync(join(projectRoot, "my-project.catalyst"), "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual({
      project_name: "my-project",
      "agent-source": "/tmp/somewhere",
    });
  });
});

describe("joinCriterionRepo", () => {
  it("clones the given branch into agentSource and writes a matching pointer file", async () => {
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
    expect(pointer).toMatchObject({
      "agent-source": agentSource,
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
