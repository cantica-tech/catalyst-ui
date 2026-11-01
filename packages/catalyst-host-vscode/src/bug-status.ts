import type { ChainNode, ModuleType } from "catalyst-core";
import { actionArgs } from "catalyst-core";

import { typeSlug } from "./entity-items.js";

/**
 * Close Bug and Reopen Bug in the Instances tree (REQ-000077-UVqkd7cL): the one catalyst verb the host runs for
 * them, `status set`, built through the host's allow-list (catalyst-core `actionArgs`, owner decision W1) and
 * guarded here to a bug and its two targets. catalyst's own guards decide the rest; `--force` is never passed.
 */

export type BugMove = "close" | "reopen";

/** What a bug's close or reopen does: the state catalyst is asked to set, and how the person reads it. */
export interface BugTransition {
  move: BugMove;
  id: string;
  state: string;
  /** The button and the title: "Close Bug" or "Reopen Bug". */
  verb: string;
}

/** The arguments of the preview (`--preview`, nothing kept) and of the run, from the project's root. */
export interface BugStatusCommands {
  preview: string[];
  run: string[];
}

/** The type's slug a bug has (`Bug` → `bug`). */
export const BUG_TYPE = "bug";

/** True for a module type that is the bug type, by its name as catalyst serves it. */
export function isBugType(type: ModuleType | undefined): boolean {
  return type !== undefined && typeSlug(type.name) === BUG_TYPE;
}

/**
 * The state a close sets, from the type's definition: `Closed` when the type declares it closed, else its first
 * closed state.
 */
export function closeTarget(type: ModuleType): string | undefined {
  return type.closed_states.includes("Closed") ? "Closed" : type.closed_states[0];
}

/** The state a reopen sets: the type's initial state (`Open`). */
export function reopenTarget(type: ModuleType): string | undefined {
  return type.initial ?? undefined;
}

/**
 * The transition a bug's node offers for `move`, or a problem: the node is not a bug, the move does not apply to
 * its status (a closed bug is reopened, an open one closed), or the type declares no target.
 */
export function bugTransition(
  node: ChainNode,
  type: ModuleType | undefined,
  move: BugMove,
): { value: BugTransition; problem?: undefined } | { problem: string; value?: undefined } {
  if ((node.kind !== "artifact" && node.kind !== "row") || !type || !isBugType(type)) {
    return { problem: `${node.id} is not a bug` };
  }
  if (move === "close" && node.closed) return { problem: `${node.id} is already ${node.status}` };
  if (move === "reopen" && !node.closed) return { problem: `${node.id} is not closed (${node.status})` };
  const state = move === "close" ? closeTarget(type) : reopenTarget(type);
  if (!state) return { problem: `the ${type.name} type declares no state to ${move} to` };
  return { value: { move, id: node.id, state, verb: move === "close" ? "Close Bug" : "Reopen Bug" } };
}

/**
 * The guarded commands for a transition: the allow-list's `status-set` (tier fix, journaled as `/status`, the
 * reason its intent), accepted only for a bug's ID and only its close or reopen target. Throws (an `ActionError`
 * from the allow-list, or an `Error` naming the refusal) on anything else.
 */
export function bugStatusCommands(transition: BugTransition, type: ModuleType, reason: string): BugStatusCommands {
  if (!isBugType(type)) throw new Error(`not a bug: ${type.name}`);
  if (!transition.id.startsWith(`${type.prefix}-`)) throw new Error(`not a bug's ID: ${transition.id}`);
  const allowed = transition.move === "close" ? closeTarget(type) : reopenTarget(type);
  if (transition.state !== allowed) throw new Error(`a bug's ${transition.move} does not set ${transition.state}`);
  const run = actionArgs({
    verb: "status-set",
    id: transition.id,
    state: transition.state,
    intent: reason,
    tier: "fix",
    command: "/status",
  });
  return { run, preview: [...run.filter((arg) => arg !== "--json"), "--preview"] };
}

/**
 * catalyst's reason for a refusal, as one sentence: the last line it printed that is neither a warning nor who
 * signs, without its `catalyst:` or `refused:` prefix; the whole text when nothing else is left.
 */
export function refusalReason(result: { output: string; error: string }): string {
  const lines = [result.error, result.output]
    .join("\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const reasons = lines
    .map((line) => line.replace(/^refused:\s*/, "").replace(/^catalyst:\s*/, ""))
    .filter(
      (line) => !line.startsWith("warning:") && !line.startsWith("no one is logged in") && !line.startsWith("tried:"),
    );
  return reasons.at(-1) ?? (lines.join(" ") || "catalyst gave no reason");
}

/**
 * Whether the signer may run `/status` in a deployment (REQ-000077-UVqkd7cL), as catalyst decides it (decision D5,
 * kernel `permissions.refusal`): a `cmd:status` or `cmd:*` grant among those `catalyst identity whoami --json`
 * reports for the effective signer — the person logged in, else the system account catalyst signs as — or the
 * deployment's `role_check = "warn"`, which makes a refusal a warning. `unknown` when catalyst could not say who
 * signs: the menu stays enabled and catalyst's own guard decides on click.
 */
export type StatusPermission =
  | { state: "allowed"; signer: string; warned?: boolean }
  | { state: "denied"; signer: string; reason: string }
  | { state: "unknown"; reason: string };

/** The command a status change is for, and the grants that allow it. */
export const STATUS_COMMAND = "status";
const EVERYTHING = "*";

export function statusPermission(
  whoami: { ok: boolean; output: string; error: string },
  roleCheck: string | undefined,
): StatusPermission {
  let who: { name?: unknown; username?: unknown; grants?: unknown } | undefined;
  if (whoami.ok) {
    try {
      who = JSON.parse(whoami.output) as typeof who;
    } catch {
      who = undefined;
    }
  }
  if (!who || typeof who !== "object") {
    return { state: "unknown", reason: refusalReason(whoami) };
  }
  const named = [who.username, who.name].find((v): v is string => typeof v === "string" && v !== "");
  const signer = named ?? "the signer";
  const held = new Set(
    (Array.isArray(who.grants) ? who.grants : [])
      .map(String)
      .filter((g) => g.startsWith("cmd:"))
      .map((g) => g.slice(4)),
  );
  if (held.has(EVERYTHING) || held.has(STATUS_COMMAND)) return { state: "allowed", signer };
  if ((roleCheck ?? "").trim().toLowerCase() === "warn") return { state: "allowed", signer, warned: true };
  return {
    state: "denied",
    signer,
    reason: `${signer} has no grant that allows /${STATUS_COMMAND} (cmd:${STATUS_COMMAND} or cmd:*, from catalyst-users)`,
  };
}

/** The suffix an entity's context value takes: `.denied` only when catalyst would refuse the signer. */
export function permissionSuffix(permission: StatusPermission | undefined): "allowed" | "denied" {
  return permission?.state === "denied" ? "denied" : "allowed";
}
