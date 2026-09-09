import * as assert from "assert";

import type { IamRole, IamUser } from "catalyst-core";

import { buildRoleSection, buildUserSection } from "../iam.js";

function user(overrides: Partial<IamUser> & { name: string }): IamUser {
  return {
    roles: [],
    registered: "2026-01-01",
    active: true,
    notes: "",
    ...overrides,
  };
}

function role(overrides: Partial<IamRole> & { name: string }): IamRole {
  return { actions: [], ...overrides };
}

describe("buildUserSection", () => {
  it("labels the section with the user count and carries them through", () => {
    const users = [user({ name: "alice" }), user({ name: "bob" })];
    const section = buildUserSection(users);
    assert.strictEqual(section.label, "Users (2)");
    assert.deepStrictEqual(section.users, users);
  });

  it("handles an empty list", () => {
    assert.strictEqual(buildUserSection([]).label, "Users (0)");
  });
});

describe("buildRoleSection", () => {
  it("labels the section with the role count and carries them through", () => {
    const roles = [role({ name: "Developer" }), role({ name: "Tech Lead" })];
    const section = buildRoleSection(roles);
    assert.strictEqual(section.label, "Roles (2)");
    assert.deepStrictEqual(section.roles, roles);
  });

  it("handles an empty list", () => {
    assert.strictEqual(buildRoleSection([]).label, "Roles (0)");
  });
});
