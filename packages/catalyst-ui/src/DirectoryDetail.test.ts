import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DirectoryGroupDetail, DirectoryRoleDetail, DirectoryUserDetail } from "./DirectoryDetail.js";

const links = (html: string) =>
  [...html.matchAll(/data-directory-kind="(\w+)" data-directory-name="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);

describe("the Users panel's documents (vscode-IAM-000003)", () => {
  it("lists a user's roles, each with how it is held, and their groups, every one a link", () => {
    const html = renderToStaticMarkup(
      createElement(DirectoryUserDetail, {
        user: { username: "alice", name: "Alice D", email: "a@x", enabled: true },
        roles: [
          { name: "developer", direct: true, groups: ["/cantica-tech/developers"] },
          { name: "reviewer", direct: false, groups: ["/cantica-tech"] },
        ],
        groups: ["/cantica-tech/developers"],
      }),
    );
    expect(html).toContain("directly");
    expect(links(html)).toEqual([
      "role:developer",
      "group:/cantica-tech/developers",
      "role:reviewer",
      "group:/cantica-tech",
      "group:/cantica-tech/developers",
    ]);
  });

  it("lists who holds a role and the groups granted it, as links", () => {
    const html = renderToStaticMarkup(
      createElement(DirectoryRoleDetail, {
        role: { name: "reviewer", description: "Reviews" },
        groups: ["/cantica-tech"],
        users: [{ username: "alice", direct: false, groups: ["/cantica-tech"] }],
      }),
    );
    expect(links(html)).toEqual(["user:alice", "group:/cantica-tech", "group:/cantica-tech"]);
  });

  it("lists a group's roles and members as links, and says when there are none", () => {
    const html = renderToStaticMarkup(
      createElement(DirectoryGroupDetail, { group: { path: "/ops", roles: [] }, members: ["bob"] }),
    );
    expect(html).toContain("None.");
    expect(links(html)).toEqual(["user:bob"]);
  });
});
