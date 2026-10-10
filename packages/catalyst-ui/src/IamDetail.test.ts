import type { IamRole, IamUser } from "catalyst-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IamRoleDetail, IamUserDetail } from "./IamDetail.js";

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

describe("IamUserDetail", () => {
  it("renders the user's name, active state, and registered date", () => {
    const html = renderToStaticMarkup(
      IamUserDetail({
        user: user({ name: "alice", registered: "2026-03-01" }),
        roles: [],
      }),
    );

    expect(html).toContain("alice");
    expect(html).toContain("active");
    expect(html).toContain("2026-03-01");
  });

  it("shows inactive for a deactivated user", () => {
    const html = renderToStaticMarkup(
      IamUserDetail({
        user: user({ name: "alice", active: false }),
        roles: [],
      }),
    );
    expect(html).toContain("inactive");
  });

  it("renders the resolved role list, or 'None.' when empty", () => {
    const withRoles = renderToStaticMarkup(
      IamUserDetail({
        user: user({ name: "alice" }),
        roles: [role({ name: "Developer" })],
      }),
    );
    expect(withRoles).toContain("Developer");

    const withoutRoles = renderToStaticMarkup(IamUserDetail({ user: user({ name: "alice" }), roles: [] }));
    expect(withoutRoles).toContain("None.");
  });
});

describe("IamRoleDetail", () => {
  it("renders the role's name and actions", () => {
    const html = renderToStaticMarkup(
      IamRoleDetail({
        role: role({ name: "Developer", actions: ["/create-req"] }),
        users: [],
      }),
    );
    expect(html).toContain("Developer");
    expect(html).toContain("/create-req");
  });

  it("renders the resolved user list, or 'None.' when empty", () => {
    const withUsers = renderToStaticMarkup(
      IamRoleDetail({
        role: role({ name: "Developer" }),
        users: [user({ name: "alice" })],
      }),
    );
    expect(withUsers).toContain("alice");

    const withoutUsers = renderToStaticMarkup(IamRoleDetail({ role: role({ name: "Developer" }), users: [] }));
    expect(withoutUsers).toContain("None.");
  });
});
