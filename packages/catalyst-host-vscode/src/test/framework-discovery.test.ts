import * as assert from "assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  buildInstantiationPrompt,
  findSiblingFrameworkRepo,
} from "../framework-discovery.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "catalyst-host-vscode-discovery-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("findSiblingFrameworkRepo", () => {
  it("finds a sibling directory containing BOOTSTRAP.md", () => {
    const project = join(root, "my-project");
    const framework = join(root, "catalyst");
    mkdirSync(project, { recursive: true });
    mkdirSync(framework, { recursive: true });
    writeFileSync(join(framework, "BOOTSTRAP.md"), "# Bootstrap\n");

    assert.strictEqual(findSiblingFrameworkRepo(project), framework);
  });

  it("ignores a sibling with no BOOTSTRAP.md", () => {
    const project = join(root, "my-project");
    const notFramework = join(root, "some-other-repo");
    mkdirSync(project, { recursive: true });
    mkdirSync(notFramework, { recursive: true });
    writeFileSync(join(notFramework, "README.md"), "# Not it\n");

    assert.strictEqual(findSiblingFrameworkRepo(project), null);
  });

  it("never treats the project's own folder as a candidate", () => {
    const project = join(root, "my-project");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "BOOTSTRAP.md"), "# Not a sibling\n");

    assert.strictEqual(findSiblingFrameworkRepo(project), null);
  });

  it("returns null when the parent directory doesn't exist", () => {
    assert.strictEqual(
      findSiblingFrameworkRepo(join(root, "nowhere", "my-project")),
      null,
    );
  });
});

describe("buildInstantiationPrompt", () => {
  it("names the framework path and project root", () => {
    const prompt = buildInstantiationPrompt(
      "/path/to/catalyst",
      "/path/to/project",
    );
    assert.match(prompt, /BOOTSTRAP\.md/);
    assert.match(prompt, /\/path\/to\/catalyst/);
    assert.match(prompt, /\/path\/to\/project/);
  });
});
