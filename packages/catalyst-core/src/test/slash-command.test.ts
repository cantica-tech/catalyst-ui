import { describe, expect, it } from "vitest";

import { composeCommandRequest, composeSlashCommand } from "../slash-command.js";

describe("composeSlashCommand", () => {
  it("composes the command alone when there are no arguments", () => {
    expect(composeSlashCommand("alpha", "")).toBe("/alpha");
  });

  it("appends trimmed arguments after the command", () => {
    expect(composeSlashCommand("alpha", "  a title  ")).toBe("/alpha a title");
  });

  it("treats whitespace-only arguments as none", () => {
    expect(composeSlashCommand("alpha", "   ")).toBe("/alpha");
  });

  it("accepts a name with its leading slash", () => {
    expect(composeSlashCommand("/beta", "x")).toBe("/beta x");
  });
});

describe("composeCommandRequest", () => {
  it("asks the agent to run the command through catalyst's MCP server", () => {
    expect(composeCommandRequest("alpha", "a title")).toBe(
      'Run the catalyst command /alpha a title (use the catalyst MCP server\'s "alpha" prompt or its "command" tool).',
    );
  });

  it("works without arguments and with a leading slash", () => {
    expect(composeCommandRequest("/beta", " ")).toBe(
      'Run the catalyst command /beta (use the catalyst MCP server\'s "beta" prompt or its "command" tool).',
    );
  });

  it("stays a single line", () => {
    expect(composeCommandRequest("alpha", "a\nb")).not.toMatch(/\n/);
  });
});
