import { describe, expect, it } from "vitest";

import { rolesFrom, usersFrom } from "../iam.js";

describe("usersFrom (what catalyst lists, R5.3)", () => {
  it("keeps each user's name, roles, registration, state and notes, sorted by name", () => {
    expect(
      usersFrom([
        { name: "bob", roles: ["Reviewer"], registered: "2026-10-01", active: false, notes: "on leave", userid: "x" },
        { name: "alice", roles: ["Admin"], active: true },
      ]),
    ).toEqual([
      { name: "alice", roles: ["Admin"], registered: "", active: true, notes: "" },
      { name: "bob", roles: ["Reviewer"], registered: "2026-10-01", active: false, notes: "on leave" },
    ]);
  });

  it("drops what is not a user, and gives nothing for anything but a list", () => {
    expect(usersFrom([{ roles: [] }, "x", null, { name: "alice", roles: "Admin" }])).toEqual([
      { name: "alice", roles: [], registered: "", active: false, notes: "" },
    ]);
    expect(usersFrom({ users: [] })).toEqual([]);
    expect(usersFrom(undefined)).toEqual([]);
  });
});

describe("rolesFrom", () => {
  it("keeps each role's name and actions, sorted by name", () => {
    expect(rolesFrom([{ name: "Reviewer", actions: ["approve"] }, { name: "Admin" }])).toEqual([
      { name: "Admin", actions: [] },
      { name: "Reviewer", actions: ["approve"] },
    ]);
    expect(rolesFrom("x")).toEqual([]);
  });
});
