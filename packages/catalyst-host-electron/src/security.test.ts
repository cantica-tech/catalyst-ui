import { describe, expect, it } from "vitest";

import {
  MAX_AGENT_TEXT_LENGTH,
  renderIndexHtml,
  validateAgentInput,
  validateSlashCommandRequest,
} from "./security.js";

const allowed = ["alpha", "beta"];

describe("validateSlashCommandRequest (B-02 dispatch bridge)", () => {
  it("accepts a discovered command with string args", () => {
    expect(
      validateSlashCommandRequest("p1", "alpha", "login fails", allowed),
    ).toEqual({ ok: true, name: "alpha", args: "login fails" });
  });

  it("rejects a command that is not in the project's allow-list", () => {
    const res = validateSlashCommandRequest("p1", "rm-everything", "", allowed);
    expect(res.ok).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(
      validateSlashCommandRequest("p1", { name: "x" }, "", allowed).ok,
    ).toBe(false);
    expect(validateSlashCommandRequest("p1", "alpha", 42, allowed).ok).toBe(
      false,
    );
    expect(validateSlashCommandRequest(7, "alpha", "", allowed).ok).toBe(false);
  });

  it("rejects over-long args and args with control characters", () => {
    expect(
      validateSlashCommandRequest(
        "p1",
        "alpha",
        "x".repeat(MAX_AGENT_TEXT_LENGTH + 1),
        allowed,
      ).ok,
    ).toBe(false);
    // A newline would smuggle a second prompt line into the agent's stdin.
    expect(
      validateSlashCommandRequest("p1", "alpha", "a\n/other", allowed).ok,
    ).toBe(false);
    expect(
      validateSlashCommandRequest("p1", "alpha", "a\u0000b", allowed).ok,
    ).toBe(false);
  });

  it("rejects names that do not look like a slash command even if listed", () => {
    expect(validateSlashCommandRequest("p1", "a b", "", ["a b"]).ok).toBe(
      false,
    );
  });
});

describe("validateAgentInput", () => {
  it("accepts a bounded single line", () => {
    expect(validateAgentInput("p1", "yes")).toEqual({ ok: true, text: "yes" });
  });
  it("rejects non-strings, newlines and over-long text", () => {
    expect(validateAgentInput("p1", 1).ok).toBe(false);
    expect(validateAgentInput("p1", "a\nb").ok).toBe(false);
    expect(
      validateAgentInput("p1", "x".repeat(MAX_AGENT_TEXT_LENGTH + 1)).ok,
    ).toBe(false);
  });
});

describe("renderIndexHtml", () => {
  it("sets a restrictive Content-Security-Policy with a script nonce", () => {
    const html = renderIndexHtml("file:///app/dist/renderer.js", "abc123");
    const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(
      html,
    )?.[1];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-abc123'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).not.toContain("unsafe-eval");
    expect(html).toContain(
      '<script nonce="abc123" src="file:///app/dist/renderer.js"></script>',
    );
  });
});
