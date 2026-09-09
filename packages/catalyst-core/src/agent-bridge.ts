import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AgentBinding, DetectedAgent, ResolvedBinding } from "./types.js";

export interface AgentPreset {
  extensionId: string;
  participant: string;
}

/**
 * Convenience lookup only — never a substitute for detection. A preset
 * means "if this extension turns out to be installed, here's its likely
 * participant"; whether it's actually present is `scanAvailableAgents`'s
 * job (host-side, since it reads `vscode.extensions.all`). Keep this list
 * small and verified: a wrong preset should fail open into the detection
 * scan, not silently mis-target an unrelated participant.
 */
export const AGENT_PRESETS: Record<string, AgentPreset> = {
  copilot: { extensionId: "GitHub.copilot-chat", participant: "@workspace" },
  claude: { extensionId: "anthropic.claude-code", participant: "@claude" },
};

function readPointer(workspaceRoot: string): Record<string, unknown> | null {
  if (!existsSync(workspaceRoot)) return null;

  const pointerFile = readdirSync(workspaceRoot).find((name) =>
    name.endsWith(".catalyst"),
  );
  if (!pointerFile) return null;

  try {
    const pointer: unknown = JSON.parse(
      readFileSync(join(workspaceRoot, pointerFile), "utf8"),
    );
    return typeof pointer === "object" && pointer !== null
      ? (pointer as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function coerceBinding(value: unknown): AgentBinding | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.length === 0) {
    return null;
  }
  const binding =
    record.binding === "chat-participant" ||
    record.binding === "command" ||
    record.binding === "lm-model"
      ? record.binding
      : "chat-participant";

  return {
    name: record.name,
    binding,
    participant:
      typeof record.participant === "string" ? record.participant : undefined,
    command: typeof record.command === "string" ? record.command : undefined,
  };
}

/**
 * Reads a `*.catalyst` pointer's optional `chatAgents` array (this
 * codebase's additive, VS-Code-specific extension of the pointer format —
 * see the `AgentBinding` doc comment in `types.ts`). Same pointer-glob-
 * and-parse pattern `resolveAgentCommand` already uses in `agent-launch.ts`:
 * never throws, degrades to `[]` for a missing pointer, malformed JSON, a
 * non-array field, or a field that's simply absent (most deployments won't
 * have one yet).
 */
export function parseChatAgents(workspaceRoot: string): AgentBinding[] {
  const pointer = readPointer(workspaceRoot);
  if (!pointer) return [];

  const chatAgents = pointer.chatAgents;
  if (!Array.isArray(chatAgents)) return [];

  return chatAgents
    .map(coerceBinding)
    .filter((binding): binding is AgentBinding => binding !== null);
}

/**
 * The zero-configuration fallback: when a deployment declares no
 * `chatAgents` at all, treat its plain `agent` field (the CLI-agent id
 * `resolveAgentCommand` already resolves) as a chat-participant binding
 * too, so this feature works before anyone has opted into the richer
 * `chatAgents` config. Returns `null` under the same conditions
 * `resolveAgentCommand` returns `null` for (no pointer, malformed JSON, no
 * `agent` field).
 */
export function defaultChatAgent(workspaceRoot: string): AgentBinding | null {
  const pointer = readPointer(workspaceRoot);
  if (!pointer) return null;

  const agent = pointer.agent;
  if (typeof agent !== "string" || agent.length === 0) return null;

  return { name: agent, binding: "chat-participant" };
}

/** Preset lookup, then an explicit `participant` override, then a bare `@<name>` guess — spec's own §1/§2 resolution order. */
export function resolveParticipant(agentDef: AgentBinding): string {
  if (agentDef.participant) return agentDef.participant;
  const preset = AGENT_PRESETS[agentDef.name];
  if (preset) return preset.participant;
  return `@${agentDef.name}`;
}

/** Resolves one `AgentBinding` into something a host can actually invoke, per its declared `binding` kind. */
export function resolveBinding(agentDef: AgentBinding): ResolvedBinding {
  if (agentDef.binding === "command") {
    return { kind: "command", commandId: agentDef.command ?? agentDef.name };
  }
  if (agentDef.binding === "lm-model") {
    return { kind: "lm-model" };
  }
  return {
    kind: "chat-participant",
    participant: resolveParticipant(agentDef),
  };
}

/** Whether a detected agent's own manifest declares this slash command (leading `/` optional on input). */
export function declaresCommand(
  agent: DetectedAgent,
  slashCommand: string,
): boolean {
  return agent.commands.includes(slashCommand.replace(/^\//, ""));
}

/** The detected agent whose participant name matches exactly, if any. */
export function findExactMatch(
  detected: DetectedAgent[],
  participant: string,
): DetectedAgent | undefined {
  return detected.find((agent) => agent.participant === participant);
}
