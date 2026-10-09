import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCatalystPointer, resolveCorpusRoot } from "../discover.js";
import { findProjectFile, hasProjectFile, homeCriterion, parseProjectToml, readProjectFile } from "../project-file.js";
import { hasPointer } from "../workspace.js";

let scratch: string;
let savedHome: string | undefined;

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), "project-file-"));
  savedHome = process.env.CATALYST_HOME;
  process.env.CATALYST_HOME = join(scratch, "catalyst-home");
});

afterEach(() => {
  if (savedHome === undefined) delete process.env.CATALYST_HOME;
  else process.env.CATALYST_HOME = savedHome;
  rmSync(scratch, { recursive: true, force: true });
});

const TOML = `# catalyst project file: names this project's criterion. Never a path.
project_name = "app"
kernel_version = "0.48.0"
repoed = true
catalyst_repo_url = "git@example.com:org/app-criterion.git"
`;

describe("the project file", () => {
  it("parses the flat TOML catalyst writes", () => {
    expect(parseProjectToml(TOML)).toEqual({
      project_name: "app",
      kernel_version: "0.48.0",
      repoed: true,
      catalyst_repo_url: "git@example.com:org/app-criterion.git",
    });
    expect(parseProjectToml("[table]\nx = 1\n")).toBeNull();
  });

  it("prefers catalyst.toml over a legacy pointer, and reads either", () => {
    const project = join(scratch, "p");
    mkdirSync(project);
    writeFileSync(join(project, "app.catalyst"), JSON.stringify({ project_name: "old" }));
    expect(readProjectFile(project)?.project_name).toBe("old");
    writeFileSync(join(project, "catalyst.toml"), TOML);
    expect(findProjectFile(project)?.endsWith("catalyst.toml")).toBe(true);
    expect(readCatalystPointer(project)?.project_name).toBe("app");
    expect(hasProjectFile(project) && hasPointer(project)).toBe(true);
  });

  it("resolves the home store before a legacy .criterion", () => {
    const project = join(scratch, "p");
    mkdirSync(join(project, ".criterion"), { recursive: true });
    writeFileSync(join(project, "catalyst.toml"), TOML);
    expect(resolveCorpusRoot(project)).toBe(join(project, ".criterion"));
    mkdirSync(homeCriterion("app"), { recursive: true });
    expect(resolveCorpusRoot(project)).toBe(homeCriterion("app"));
    expect(homeCriterion("app")).toBe(join(scratch, "catalyst-home", "projects", "app", "criterion"));
  });
});
