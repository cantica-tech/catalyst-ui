import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  hasCatalystPointer,
  readCatalystPointer,
  readDeployedFrameworkVersion,
  readEntityDefinition,
  resolveCorpusRoot,
} from "../discover.js";

let projectRoot: string | undefined;

afterEach(() => {
  if (projectRoot) rmSync(projectRoot, { recursive: true, force: true });
  projectRoot = undefined;
});

describe("resolveCorpusRoot", () => {
  it("resolves agent-source from a *.catalyst pointer file", () => {
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

  it("returns null when agent-source does not exist on disk", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({ "agent-source": join(projectRoot, "nowhere") }),
    );
    expect(resolveCorpusRoot(projectRoot)).toBeNull();
  });

  it("returns null when the project root itself does not exist", () => {
    expect(
      resolveCorpusRoot(join(tmpdir(), "does-not-exist-at-all")),
    ).toBeNull();
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
    writeFileSync(
      join(projectRoot, "my-project.catalyst"),
      JSON.stringify({
        project_name: "my-project",
        "agent-source": join(projectRoot, "criterion"),
      }),
    );

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
      JSON.stringify({ project_name: "my-project", "agent-source": "/tmp" }),
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

describe("readDeployedFrameworkVersion", () => {
  it("reads and trims a deployment's version.txt", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "version.txt"), "0.19.0\n");
    expect(readDeployedFrameworkVersion(projectRoot)).toBe("0.19.0");
  });

  it("returns null when version.txt doesn't exist", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    expect(readDeployedFrameworkVersion(projectRoot)).toBeNull();
  });

  it("returns null when version.txt is empty", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeFileSync(join(projectRoot, "version.txt"), "   \n");
    expect(readDeployedFrameworkVersion(projectRoot)).toBeNull();
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
    writeDefinition(
      projectRoot,
      "rule",
      "# `rule`\n\n## Description\n\nA rule.\n",
    );
    expect(readEntityDefinition(projectRoot, "rule")).toBeNull();
  });

  it("returns null when the Description section is missing", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "catalyst-core-discover-"));
    writeDefinition(
      projectRoot,
      "rule",
      "# `rule`\n\n| Field | Value |\n|---|---|\n| **Version** | 1 |\n",
    );
    expect(readEntityDefinition(projectRoot, "rule")).toBeNull();
  });
});
