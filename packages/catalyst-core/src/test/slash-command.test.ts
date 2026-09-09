import { describe, expect, it } from "vitest";

import { composeSlashCommand } from "../slash-command.js";

describe("composeSlashCommand", () => {
  it("composes the command alone when there are no arguments", () => {
    expect(composeSlashCommand("dogfood", "")).toBe("/dogfood");
  });

  it("appends trimmed arguments after the command", () => {
    expect(composeSlashCommand("create-bug", "  a title  ")).toBe(
      "/create-bug a title",
    );
  });

  it("treats whitespace-only arguments as none", () => {
    expect(composeSlashCommand("dogfood", "   ")).toBe("/dogfood");
  });
});
