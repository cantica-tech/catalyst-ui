import * as assert from "assert";

import { groupDocument, readDirectory, roleDocument, userDocument } from "../directory.js";
import { readIamSettings, type RunCommand } from "../iam.js";

const settings = readIamSettings((key) => (key === "iam.command" ? "catalyst-users" : undefined));

/** A fake catalyst-users: answers each `--json <args>` from `answers`, keyed by the args joined. */
function fake(answers: Record<string, unknown>, calls: string[][] = []): RunCommand {
  return (file, args) => {
    calls.push([file, ...args]);
    const key = args.slice(1).join(" ");
    if (!(key in answers)) return Promise.reject(new Error(`not logged in: run \`catalyst-users login\``));
    return Promise.resolve(JSON.stringify(answers[key]));
  };
}

const ALICE = { id: "u1", username: "alice", email: "a@x", name: "Alice D", enabled: true };

describe("the Users panel's reads (vscode-IAM-000003)", () => {
  it("reads users, roles and groups, each sorted, through catalyst-users", async () => {
    const calls: string[][] = [];
    const answer = await readDirectory(
      settings,
      fake(
        {
          "users list": [{ ...ALICE, username: "bob", enabled: false }, ALICE],
          "roles list": [
            { name: "reviewer", description: "" },
            { name: "developer", description: "Writes code" },
          ],
          "groups list": [
            { path: "/ops", roles: [] },
            { path: "/cantica-tech", roles: ["reviewer"] },
          ],
        },
        calls,
      ),
    );
    const directory = answer.value;
    assert.ok(directory, answer.problem);
    assert.deepStrictEqual(
      directory.users.map((u) => [u.username, u.enabled]),
      [
        ["alice", true],
        ["bob", false],
      ],
    );
    assert.deepStrictEqual(
      directory.roles.map((r) => r.name),
      ["developer", "reviewer"],
    );
    assert.deepStrictEqual(
      directory.groups.map((g) => g.path),
      ["/cantica-tech", "/ops"],
    );
    assert.ok(calls.every((c) => c[0] === "catalyst-users" && c[1] === "--json"));
  });

  it("says why when catalyst-users cannot answer, for the panel to show with the login", async () => {
    const answer = await readDirectory(settings, fake({}));
    assert.match(answer.problem ?? "", /not logged in/);
  });

  it("gives a user's document their roles, each with how it is held, and their groups", async () => {
    const answer = await userDocument(
      settings,
      ALICE,
      fake({
        "users roles alice": [
          { name: "developer", direct: true, groups: ["/cantica-tech/developers"] },
          { name: "reviewer", direct: false, groups: ["/cantica-tech"] },
        ],
        "users groups alice": ["/cantica-tech/developers"],
      }),
    );
    assert.deepStrictEqual(answer.value, {
      type: "directory-user",
      user: ALICE,
      roles: [
        { name: "developer", direct: true, groups: ["/cantica-tech/developers"] },
        { name: "reviewer", direct: false, groups: ["/cantica-tech"] },
      ],
      groups: ["/cantica-tech/developers"],
    });
  });

  it("gives a role's document who holds it and the groups granted it", async () => {
    const role = { name: "reviewer", description: "" };
    const answer = await roleDocument(
      settings,
      role,
      fake({
        "roles holders reviewer": {
          role: "reviewer",
          groups: ["/cantica-tech"],
          users: [{ username: "alice", direct: false, groups: ["/cantica-tech"] }],
        },
      }),
    );
    assert.deepStrictEqual(answer.value, {
      type: "directory-role",
      role,
      groups: ["/cantica-tech"],
      users: [{ username: "alice", direct: false, groups: ["/cantica-tech"] }],
    });
  });

  it("gives a group's document its roles and members", async () => {
    const group = { path: "/cantica-tech", roles: ["reviewer"] };
    const answer = await groupDocument(settings, group, fake({ "groups members /cantica-tech": ["bob", "alice"] }));
    assert.deepStrictEqual(answer.value, { type: "directory-group", group, members: ["alice", "bob"] });
  });
});
