import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveAgentCommand } from "../agent-launch.js";

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

  it("passes an unrecognized agent id through verbatim", () => {
    writePointer(JSON.stringify({ agent: "some-other-agent" }));
    expect(resolveAgentCommand(root)).toBe("some-other-agent");
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
