import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  addTrackedProject,
  loadTrackedProjects,
  removeTrackedProject,
  saveTrackedProjects,
} from "./state.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "catalyst-host-electron-state-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("loadTrackedProjects", () => {
  it("returns an empty list when the state file doesn't exist yet", () => {
    expect(loadTrackedProjects(join(dir, "projects.json"))).toEqual([]);
  });

  it("returns an empty list for unparsable or wrongly-shaped content", () => {
    const stateFile = join(dir, "projects.json");
    saveTrackedProjects(stateFile, []);
    expect(loadTrackedProjects(stateFile)).toEqual([]);
  });

  it("round-trips through save/load", () => {
    const stateFile = join(dir, "projects.json");
    const projects = addTrackedProject([], "/a/project", "/a/corpus");
    saveTrackedProjects(stateFile, projects);
    expect(loadTrackedProjects(stateFile)).toEqual(projects);
  });
});

describe("addTrackedProject", () => {
  it("adds a project with a generated id", () => {
    const projects = addTrackedProject([], "/a/project", "/a/corpus");
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      projectRoot: "/a/project",
      corpusRoot: "/a/corpus",
    });
    expect(typeof projects[0].id).toBe("string");
  });

  it("does not add a duplicate for an already-tracked project root", () => {
    const once = addTrackedProject([], "/a/project", "/a/corpus");
    const twice = addTrackedProject(once, "/a/project", "/a/corpus");
    expect(twice).toBe(once);
    expect(twice).toHaveLength(1);
  });
});

describe("removeTrackedProject", () => {
  it("removes only the matching id", () => {
    const projects = addTrackedProject(
      addTrackedProject([], "/a", "/a-corpus"),
      "/b",
      "/b-corpus",
    );
    const remaining = removeTrackedProject(projects, projects[0].id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].projectRoot).toBe("/b");
  });
});
