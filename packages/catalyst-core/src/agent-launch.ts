import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * catalyst is agent-agnostic — a deployment's `*.catalyst` pointer records
 * which agent runs it (e.g. `"agent": "claude-code"`) rather than us
 * assuming Claude Code. But the pointer is a file inside whatever
 * repository was cloned, so its `agent` value is untrusted input: it is
 * never executed, never passed to a shell, and never used as a binary
 * name directly. Only the ids below resolve, each to a fixed binary that
 * the host then spawns with an argv array and `shell: false` (B-01).
 * Supporting another agent means adding it here, deliberately.
 */
const KNOWN_AGENT_COMMANDS: ReadonlyMap<string, string> = new Map([
  ["claude-code", "claude"],
  ["claude", "claude"],
]);

/** True only for an agent id on the allow-list (exact, case-sensitive). */
export function isAllowedAgentId(agent: string): boolean {
  return KNOWN_AGENT_COMMANDS.has(agent);
}

export type AgentLaunch =
  | { ok: true; agentId: string; command: string; args: string[] }
  | { ok: false; reason: string };

function readPointerAgent(workspaceRoot: string): string | null {
  if (!existsSync(workspaceRoot)) return null;

  const pointerFile = readdirSync(workspaceRoot).find((name) =>
    name.endsWith(".catalyst"),
  );
  if (!pointerFile) return null;

  let pointer: unknown;
  try {
    pointer = JSON.parse(
      readFileSync(join(workspaceRoot, pointerFile), "utf8"),
    );
  } catch {
    return null;
  }
  if (typeof pointer !== "object" || pointer === null) return null;

  const agent = (pointer as Record<string, unknown>).agent;
  if (typeof agent !== "string" || agent.length === 0) return null;
  return agent;
}

/**
 * How to launch the coding agent running this deployment: a fixed binary
 * plus an argv array, for `spawn(command, args, { shell: false })`.
 * `ok: false` (with a reason to show the user) when there is no pointer,
 * no `agent` field, or the id is not on the allow-list.
 */
export function resolveAgentLaunch(workspaceRoot: string): AgentLaunch {
  const agent = readPointerAgent(workspaceRoot);
  if (agent === null) {
    return {
      ok: false,
      reason:
        'Couldn\'t determine which agent runs this deployment — no *.catalyst pointer with an "agent" field found.',
    };
  }
  const command = KNOWN_AGENT_COMMANDS.get(agent);
  if (command === undefined) {
    const shown = JSON.stringify(agent.slice(0, 40));
    return {
      ok: false,
      reason: `The pointer's agent ${shown} is not a supported agent (supported: ${[...KNOWN_AGENT_COMMANDS.keys()].join(", ")}); nothing was run.`,
    };
  }
  return { ok: true, agentId: agent, command, args: [] };
}

/**
 * The binary that launches the deployment's agent, or `null` when the
 * pointer is missing/malformed or names an agent that is not on the
 * allow-list. Callers should surface that rather than guess a default.
 */
export function resolveAgentCommand(workspaceRoot: string): string | null {
  const launch = resolveAgentLaunch(workspaceRoot);
  return launch.ok ? launch.command : null;
}
