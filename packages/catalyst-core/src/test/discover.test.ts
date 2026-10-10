import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

// Worker threads keep their own copy of process.env, which libuv's
// homedir() never sees: route homedir() through it so a test can point
// HOME at a scratch directory.
vi.mock("node:os", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:os")>();
  return { ...actual, homedir: () => process.env.HOME ?? actual.homedir() };
});

import {
  claudeCodeStoragePath,
  hasCatalystPointer,
  meetsRequiredKernelVersion,
  readCatalystPointer,
  readDeployedKernelVersion,
  readEntityDefinition,
  REQUIRED_KERNEL_VERSION,
  resolveCorpusRoot,
  workingCopyState,
} from "../discover.js";

let projectRoot: string | undefined;

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = undefined;
});

describe("resolveCorpusRoot", () => {
  it("resolves <projectRoot>/.criterion when it is a symlink to agent-owned storage", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    const agentOwned = join(projectRoot, "agent-owned", ".criterion");
    mkdirSync(agentOwned, { recursive: true });
    symlinkSync(agentOwned, join(projectRoot, ".criterion"), "dir");
    writeFileSync(join(projectRoot, "my-project.catalyst"), JSON.stringify({ project_name: "my-project" }));

    expect(resolveCorpusRoot(projectRoot)).toBe(join(projectRoot, ".criterion"));
  });

  it("prefers the .criterion symlink over a legacy pointer agent-source", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    const agentOwned = join(projectRoot, "agent-owned", ".criterion");
    const legacy = join(projectRoot, "legacy-criterion");
    mkdirSync(agentOwned, { recursive: true });
    mkdirSync(legacy, { recursive: true });
    symlinkSync(agentOwned, join(projectRoot, ".criterion"), "dir");
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({ project_name: "my-project", "agent-source": legacy }),
    );

    expect(resolveCorpusRoot(projectRoot)).toBe(join(projectRoot, ".criterion"));
  });

  it("falls back to the legacy agent-source when .criterion is a dangling symlink", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    const legacy = join(projectRoot, "legacy-criterion");
    mkdirSync(legacy, { recursive: true });
    symlinkSync(join(projectRoot, "gone"), join(projectRoot, ".criterion"), "dir");
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({ project_name: "my-project", "agent-source": legacy }),
    );

    expect(resolveCorpusRoot(projectRoot)).toBe(legacy);
  });

  it("resolves a legacy (pre-0.37.0) agent-source from a *.catalyst pointer file", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    const agentSource = join(projectRoot, "agent-owned-criterion");
    mkdirSync(agentSource, { recursive: true });
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({
        project_name: "my-project",
        "agent-source": agentSource,
      }),
    );

    expect(resolveCorpusRoot(projectRoot)).toBe(agentSource);
  });

  it("returns null when no *.catalyst pointer file exists", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    expect(resolveCorpusRoot(projectRoot)).toBeNull();
  });

  it("returns null when the pointer file is malformed JSON", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "broken.catalyst"), "{not json");
    expect(resolveCorpusRoot(projectRoot)).toBeNull();
  });

  it("returns null when a legacy agent-source does not exist on disk", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({ "agent-source": join(projectRoot, "nowhere") }),
    );
    expect(resolveCorpusRoot(projectRoot)).toBeNull();
  });

  it("returns null when the project root itself does not exist", () => {
    expect(resolveCorpusRoot(join(tmpdir(), "does-not-exist-at-all"))).toBeNull();
  });
});

describe("claudeCodeStoragePath", () => {
  it("replaces every non-alphanumeric character of the project path with '-'", () => {
    expect(claudeCodeStoragePath("/Users/me/src/my_app.v2")).toBe(
      join(homedir(), ".claude", "projects", "-Users-me-src-my-app-v2", ".criterion"),
    );
  });

  it("slugs a Windows-style path the same way", () => {
    expect(claudeCodeStoragePath("C:\\Users\\me\\my app")).toBe(
      join(homedir(), ".claude", "projects", "C--Users-me-my-app", ".criterion"),
    );
  });
});

describe("readCatalystPointer", () => {
  it("reads the full pointer, including repoed-criterion fields", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    const agentSource = join(projectRoot, "agent-owned-criterion");
    mkdirSync(agentSource, { recursive: true });
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({
        project_name: "my-project",
        agent: "claude-code",
        "agent-source": agentSource,
        repoed: true,
        catalyst_repo: "my-project-criterion",
        catalyst_repo_url: "git@github.com:example/my-project-criterion.git",
        criterion_branch: "olivier-steck.criterion",
        created_by: "Olivier Steck",
      }),
    );

    expect(readCatalystPointer(projectRoot)).toEqual({
      project_name: "my-project",
      agent: "claude-code",
      "agent-source": agentSource,
      repoed: true,
      catalyst_repo: "my-project-criterion",
      catalyst_repo_url: "git@github.com:example/my-project-criterion.git",
      criterion_branch: "olivier-steck.criterion",
      created_by: "Olivier Steck",
    });
  });

  it("returns a pointer even when repoed fields are absent", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "my-project.catalyst"), JSON.stringify({ project_name: "my-project" }));

    expect(readCatalystPointer(projectRoot)?.repoed).toBeUndefined();
  });

  it("returns null when no *.catalyst pointer file exists", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    expect(readCatalystPointer(projectRoot)).toBeNull();
  });

  it("returns null when the pointer file is malformed JSON", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "broken.catalyst"), "{not json");
    expect(readCatalystPointer(projectRoot)).toBeNull();
  });
});

describe("hasCatalystPointer", () => {
  it("is true when a well-formed *.catalyst pointer file exists", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({ project_name: "my-project", agent: "claude-code" }),
    );
    expect(hasCatalystPointer(projectRoot)).toBe(true);
  });

  it("is false when no *.catalyst pointer file exists, even if a legacy in-project .criterion is present", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    mkdirSync(join(projectRoot, ".criterion"), { recursive: true });
    expect(hasCatalystPointer(projectRoot)).toBe(false);
    // resolveCorpusRoot's richer fallback chain still finds it — that's a
    // separate concern from "should an install be offered."
    expect(resolveCorpusRoot(projectRoot)).toBe(join(projectRoot, ".criterion"));
  });

  it("is false when the pointer file is malformed JSON", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "broken.catalyst"), "{not json");
    expect(hasCatalystPointer(projectRoot)).toBe(false);
  });
});

describe("readDeployedKernelVersion", () => {
  it("reads and trims a deployment's version.txt", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "version.txt"), "0.19.0\n");
    expect(readDeployedKernelVersion(projectRoot)).toBe("0.19.0");
  });

  it("returns null when version.txt doesn't exist", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    expect(readDeployedKernelVersion(projectRoot)).toBeNull();
  });

  it("returns null when version.txt is empty", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "version.txt"), "   \n");
    expect(readDeployedKernelVersion(projectRoot)).toBeNull();
  });
});

describe("meetsRequiredKernelVersion", () => {
  it("is described as a version specifier, not a bare number", () => {
    expect(REQUIRED_KERNEL_VERSION).toMatch(/^(>=|<=|==|!=|>|<)/);
  });

  it("returns true for a deployment at or above the required floor", () => {
    expect(meetsRequiredKernelVersion("0.54.0")).toBe(true);
    expect(meetsRequiredKernelVersion("0.55.0")).toBe(true);
  });

  it("returns false for a deployment below the required floor", () => {
    expect(meetsRequiredKernelVersion("0.53.9")).toBe(false);
    expect(meetsRequiredKernelVersion("0.31.0")).toBe(false);
  });

  it("treats null (can't safely compare) as satisfying the requirement", () => {
    expect(meetsRequiredKernelVersion(null)).toBe(true);
  });
});

describe("readEntityDefinition", () => {
  function writeDefinition(root: string, entityType: string, body: string) {
    mkdirSync(join(root, "definitions"), { recursive: true });
    writeFileSync(join(root, "definitions", `${entityType}.md`), body);
  }

  it("reads a definition's version and description", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeDefinition(
      projectRoot,
      "rule",
      "# `rule` — entity definition (v1)\n\n" +
        "| Field | Value |\n|---|---|\n" +
        "| **Entity type** | `rule` |\n| **Version** | 1 |\n\n" +
        "## Description\n\nA rule is the unit implementation is measured against.\n",
    );
    expect(readEntityDefinition(projectRoot, "rule")).toEqual({
      version: "1",
      description: "A rule is the unit implementation is measured against.",
    });
  });

  it("returns null when definitions/<type>.md doesn't exist", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    expect(readEntityDefinition(projectRoot, "rule")).toBeNull();
  });

  it("returns null when the Version field is missing", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeDefinition(projectRoot, "rule", "# `rule`\n\n## Description\n\nA rule.\n");
    expect(readEntityDefinition(projectRoot, "rule")).toBeNull();
  });

  it("returns null when the Description section is missing", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeDefinition(projectRoot, "rule", "# `rule`\n\n| Field | Value |\n|---|---|\n| **Version** | 1 |\n");
    expect(readEntityDefinition(projectRoot, "rule")).toBeNull();
  });
});

describe("workingCopyState (REQ-000016)", () => {
  it("tells reachable, dangling and missing working copies apart", () => {
    const base = mkdtempSync(join(tmpdir(), "catalyst-wc-"));
    try {
      const project = join(base, "project");
      mkdirSync(project);
      writeFileSync(join(project, "app.catalyst"), "{}");
      const home = join(base, "elsewhere", ".criterion");
      // missing: no .criterion, no fallback (a fresh HOME-independent path)
      expect(workingCopyState(project).state).toBe("missing");
      // dangling: a symlink into another machine's agent-owned space
      symlinkSync(home, join(project, ".criterion"));
      expect(workingCopyState(project)).toEqual({
        state: "dangling",
        target: home,
      });
      // reachable once the target exists (mounted, or created)
      mkdirSync(home, { recursive: true });
      expect(workingCopyState(project).state).toBe("reachable");
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});

describe("resolveCorpusRoot — no memory-note scan (B-13)", () => {
  it("never adopts a path found in another tool's memory notes", () => {
    const fakeHome = mkdtempSync(join(tmpdir(), "catalyst-core-home-"));
    const savedHome = process.env.HOME;
    process.env.HOME = fakeHome;
    try {
      projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
      const name = projectRoot.split("/").pop()!;
      // Another project's working copy, mentioned in a memory note that
      // merely contains this project's name.
      const elsewhere = join(fakeHome, "other-project", ".criterion");
      mkdirSync(elsewhere, { recursive: true });
      const memDir = join(fakeHome, ".claude", "memories");
      mkdirSync(memDir, { recursive: true });
      writeFileSync(join(memDir, "note.md"), `About ${name}-legacy.\nworking copy: ${elsewhere}\n`);
      writeFileSync(join(projectRoot, "p.catalyst"), JSON.stringify({ project_name: "p" }));
      expect(resolveCorpusRoot(projectRoot)).toBeNull();
    } finally {
      process.env.HOME = savedHome;
      rmSync(fakeHome, { recursive: true, force: true });
    }
  });
});
