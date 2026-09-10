import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  readDeployedFrameworkVersion,
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
