import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseIamRoles, parseIamUsers } from "../iam.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("parseIamUsers", () => {
  it("returns an empty list when IAM/users/users.json doesn't exist", () => {
    root = createFixtureCorpus({});
    expect(parseIamUsers(root)).toEqual([]);
  });

  it("parses a well-formed users.json, sorted by name", () => {
    root = createFixtureCorpus({
      users: [
        { name: "bob", roles: ["Tech Lead"], active: false, notes: "on leave" },
        { name: "alice", roles: ["Developer"] },
      ],
    });

    expect(parseIamUsers(root)).toEqual([
      {
        name: "alice",
        roles: ["Developer"],
        registered: "2026-01-01",
        active: true,
        notes: "",
      },
      {
        name: "bob",
        roles: ["Tech Lead"],
        registered: "2026-01-01",
        active: false,
        notes: "on leave",
      },
    ]);
  });

  it("degrades to an empty list rather than throwing on malformed JSON", () => {
    root = createFixtureCorpus({});
    const dir = join(root, "IAM", "users");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "users.json"), "{ not valid json");

    expect(parseIamUsers(root)).toEqual([]);
  });

  it("degrades to an empty list when users.json isn't the expected {users: [...]} shape", () => {
    root = createFixtureCorpus({});
    const dir = join(root, "IAM", "users");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "users.json"), JSON.stringify([{ name: "alice" }]));

    expect(parseIamUsers(root)).toEqual([]);
  });

  it("skips an entry with no name rather than failing the whole file", () => {
    root = createFixtureCorpus({});
    const dir = join(root, "IAM", "users");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "users.json"), JSON.stringify({ users: [{ roles: [] }, { name: "alice" }] }));

    expect(parseIamUsers(root).map((u) => u.name)).toEqual(["alice"]);
  });
});

describe("parseIamRoles", () => {
  it("returns an empty list when IAM/roles/roles.json doesn't exist", () => {
    root = createFixtureCorpus({});
    expect(parseIamRoles(root)).toEqual([]);
  });

  it("parses a well-formed roles.json, sorted by name", () => {
    root = createFixtureCorpus({
      roles: [
        { name: "Tech Lead", actions: ["/create-req", "/create-bug"] },
        { name: "Developer", actions: ["/create-req"] },
      ],
    });

    expect(parseIamRoles(root)).toEqual([
      { name: "Developer", actions: ["/create-req"] },
      { name: "Tech Lead", actions: ["/create-req", "/create-bug"] },
    ]);
  });

  it("degrades to an empty list rather than throwing on malformed JSON", () => {
    root = createFixtureCorpus({});
    const dir = join(root, "IAM", "roles");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "roles.json"), "not json at all");

    expect(parseIamRoles(root)).toEqual([]);
  });
});
