import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  declaresCommand,
  defaultChatAgent,
  findExactMatch,
  parseChatAgents,
  resolveBinding,
  resolveParticipant,
} from "../agent-bridge.js";
import type { AgentBinding, DetectedAgent } from "../types.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "catalyst-core-agent-bridge-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writePointer(content: unknown): void {
  writeFileSync(join(root, "project.catalyst"), JSON.stringify(content));
}

describe("parseChatAgents", () => {
  it("returns an empty list when no pointer file exists", () => {
    expect(parseChatAgents(root)).toEqual([]);
  });

  it("returns an empty list for malformed JSON", () => {
    writeFileSync(join(root, "project.catalyst"), "{ not json");
    expect(parseChatAgents(root)).toEqual([]);
  });

  it("returns an empty list when chatAgents is absent", () => {
    writePointer({ agent: "claude-code" });
    expect(parseChatAgents(root)).toEqual([]);
  });

  it("returns an empty list when chatAgents is not an array", () => {
    writePointer({ agent: "claude-code", chatAgents: "not-an-array" });
    expect(parseChatAgents(root)).toEqual([]);
  });

  it("parses a well-formed chatAgents array", () => {
    writePointer({
      agent: "claude-code",
      chatAgents: [
        {
          name: "copilot",
          binding: "chat-participant",
          participant: "@workspace",
        },
        { name: "claude", binding: "chat-participant" },
        { name: "custom-linter", binding: "command", command: "myext.runLint" },
      ],
    });

    expect(parseChatAgents(root)).toEqual([
      {
        name: "copilot",
        binding: "chat-participant",
        participant: "@workspace",
        command: undefined,
      },
      {
        name: "claude",
        binding: "chat-participant",
        participant: undefined,
        command: undefined,
      },
      {
        name: "custom-linter",
        binding: "command",
        participant: undefined,
        command: "myext.runLint",
      },
    ]);
  });

  it("defaults an unrecognized binding kind to chat-participant", () => {
    writePointer({
      chatAgents: [{ name: "mystery", binding: "not-a-real-kind" }],
    });
    expect(parseChatAgents(root)).toEqual([
      {
        name: "mystery",
        binding: "chat-participant",
        participant: undefined,
        command: undefined,
      },
    ]);
  });

  it("skips an entry with no name rather than failing the whole list", () => {
    writePointer({
      chatAgents: [{ binding: "command" }, { name: "claude" }],
    });
    expect(parseChatAgents(root).map((a) => a.name)).toEqual(["claude"]);
  });
});

describe("defaultChatAgent", () => {
  it("returns null when no pointer file exists", () => {
    expect(defaultChatAgent(root)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    writeFileSync(join(root, "project.catalyst"), "{ not json");
    expect(defaultChatAgent(root)).toBeNull();
  });

  it("returns null when the pointer has no agent field", () => {
    writePointer({ "agent-source": "/tmp/wherever" });
    expect(defaultChatAgent(root)).toBeNull();
  });

  it("wraps the plain agent field as a chat-participant binding", () => {
    writePointer({ agent: "claude-code" });
    expect(defaultChatAgent(root)).toEqual({
      name: "claude-code",
      binding: "chat-participant",
    });
  });
});

describe("resolveParticipant", () => {
  it("prefers an explicit participant override", () => {
    expect(
      resolveParticipant({
        name: "copilot",
        binding: "chat-participant",
        participant: "@custom",
      }),
    ).toBe("@custom");
  });

  it("falls back to the preset registry", () => {
    expect(
      resolveParticipant({ name: "claude", binding: "chat-participant" }),
    ).toBe("@claude");
    expect(
      resolveParticipant({ name: "copilot", binding: "chat-participant" }),
    ).toBe("@workspace");
  });

  it("falls back to a bare @name for an unrecognized agent with no override", () => {
    expect(
      resolveParticipant({
        name: "some-other-agent",
        binding: "chat-participant",
      }),
    ).toBe("@some-other-agent");
  });
});

describe("resolveBinding", () => {
  it("resolves a chat-participant binding via resolveParticipant", () => {
    expect(
      resolveBinding({ name: "claude", binding: "chat-participant" }),
    ).toEqual({
      kind: "chat-participant",
      participant: "@claude",
    });
  });

  it("resolves a command binding to its explicit command id", () => {
    expect(
      resolveBinding({
        name: "custom-linter",
        binding: "command",
        command: "myext.runLint",
      }),
    ).toEqual({ kind: "command", commandId: "myext.runLint" });
  });

  it("falls back to the agent's own name as the command id when none is given", () => {
    expect(
      resolveBinding({ name: "myext.runLint", binding: "command" }),
    ).toEqual({
      kind: "command",
      commandId: "myext.runLint",
    });
  });

  it("resolves an lm-model binding", () => {
    expect(resolveBinding({ name: "anything", binding: "lm-model" })).toEqual({
      kind: "lm-model",
    });
  });
});

function detected(
  overrides: Partial<DetectedAgent> & { participant: string },
): DetectedAgent {
  return {
    extensionId: "some.extension",
    commands: [],
    active: true,
    ...overrides,
  };
}

describe("declaresCommand", () => {
  it("matches regardless of a leading slash on the input", () => {
    const agent = detected({ participant: "@claude", commands: ["review"] });
    expect(declaresCommand(agent, "/review")).toBe(true);
    expect(declaresCommand(agent, "review")).toBe(true);
  });

  it("returns false for a command the agent doesn't declare", () => {
    const agent = detected({ participant: "@claude", commands: ["review"] });
    expect(declaresCommand(agent, "/fix")).toBe(false);
  });
});

describe("findExactMatch", () => {
  it("finds the detected agent with a matching participant", () => {
    const claude = detected({ participant: "@claude" });
    const copilot = detected({ participant: "@workspace" });
    expect(findExactMatch([copilot, claude], "@claude")).toBe(claude);
  });

  it("returns undefined when nothing matches", () => {
    expect(
      findExactMatch([detected({ participant: "@workspace" })], "@claude"),
    ).toBeUndefined();
  });
});

// Exercises AgentBinding's full field shape end-to-end through the module,
// guarding against a silent shape drift between types.ts and agent-bridge.ts.
describe("AgentBinding shape", () => {
  it("round-trips every field through parseChatAgents", () => {
    const binding: AgentBinding = {
      name: "custom-linter",
      binding: "command",
      participant: undefined,
      command: "myext.runLint",
    };
    writePointer({ chatAgents: [binding] });
    expect(parseChatAgents(root)).toEqual([binding]);
  });
});
