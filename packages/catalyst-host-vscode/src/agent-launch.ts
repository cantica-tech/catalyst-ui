import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * catalyst is agent-agnostic — a deployment's `*.catalyst` pointer records
 * which agent runs it (e.g. `"agent": "claude-code"`) rather than us
 * assuming Claude Code. This is the one mismatch we know of between an
 * agent id and its actual CLI binary; anything else is passed through
 * verbatim on the assumption its id already is its binary name.
 */
const KNOWN_AGENT_COMMANDS: Record<string, string> = {
  "claude-code": "claude",
};

/**
 * Resolves the shell command that launches the coding agent running this
 * deployment, read from the workspace folder's `*.catalyst` pointer file
 * (same lookup `resolveCorpusRoot` uses in catalyst-core, but reading the
 * `agent` field instead of `agent-source`). Returns `null` if no pointer
 * file, invalid JSON, or no `agent` field is found — callers should surface
 * that rather than silently guessing a default.
 */
export function resolveAgentCommand(workspaceRoot: string): string | null {
  if (!existsSync(workspaceRoot)) return null;

  const pointerFile = readdirSync(workspaceRoot).find((name) =>
    name.endsWith(".catalyst"),
  );
  if (!pointerFile) return null;

  let pointer: unknown;
  try {
    pointer = JSON.parse(readFileSync(join(workspaceRoot, pointerFile), "utf8"));
  } catch {
    return null;
  }
  if (typeof pointer !== "object" || pointer === null) return null;

  const agent = (pointer as Record<string, unknown>).agent;
  if (typeof agent !== "string" || agent.length === 0) return null;

  return KNOWN_AGENT_COMMANDS[agent] ?? agent;
}
