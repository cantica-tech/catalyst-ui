import { spawn } from "node:child_process";

import { catalystCommand } from "./catalyst-source.js";

/**
 * What the Studio may ask its host to do (studio-SHELL-000016, owner
 * decision W1): a catalyst verb from this allow-list, each argument a named
 * field. The host checks every field, builds the argument list itself and
 * runs it with no shell; catalyst journals the change as for any command.
 */
export type StudioAction =
  | { verb: "status-set"; id: string; state: string; intent: string; tier?: string }
  | { verb: "journal-adopt"; commit: string; intent: string; tier: string; target?: string }
  | { verb: "journal-append"; path: string; intent: string; tier: string; target?: string; artifact?: string }
  | { verb: "reconcile"; case: string; decision: string; intent: string; text?: string }
  | { verb: "restore"; id: string; to: string; intent: string; tier?: string };

export class ActionError extends Error {}

const ENTITY = /^[A-Za-z][A-Za-z0-9.]*(-[A-Za-z0-9.]+)+$/;
const STATE = /^[A-Za-z][A-Za-z0-9 _-]{0,40}$/;
const COMMIT = /^[0-9a-f]{7,40}$/;
const TIER = /^[a-z][a-z-]{0,20}$/;
const DECISIONS = ["accept", "accept-with-edits", "reject", "propose", "close"];
/** A version of an entity: its Nth change (`#3`) or an ISO time (`2026-10-16T08:00:00Z`). */
const VERSION = /^(#[1-9][0-9]{0,5}|\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z?)?)$/;

function field(value: unknown, name: string, check: (v: string) => boolean, why: string): string {
  if (typeof value !== "string" || !check(value.trim())) throw new ActionError(`${name}: ${why}`);
  return value.trim();
}

function words(value: unknown, name: string, max: number): string {
  return field(
    value,
    name,
    (v) => v.length > 0 && v.length <= max && !v.includes("\0"),
    `say it in 1 to ${String(max)} characters`,
  );
}

function entity(value: unknown, name: string): string {
  return field(value, name, (v) => ENTITY.test(v), "not an entity ID");
}

function optional(value: unknown, make: (v: unknown) => string, flag: string): string[] {
  return value === undefined || value === "" ? [] : [`${flag}=${make(value)}`];
}

/** A project-relative path: no absolute path, no `..`, nothing that reads as an option. */
function projectPath(value: unknown): string {
  return field(
    value,
    "path",
    (v) =>
      v.length > 0 &&
      v.length <= 300 &&
      !v.startsWith("/") &&
      !v.startsWith("-") &&
      !/^[A-Za-z]:/.test(v) &&
      !v.includes("\0") &&
      !v.split(/[\\/]/).includes(".."),
    "a path inside the project",
  );
}

/**
 * The argument list for `catalyst`, from an action; an `ActionError` names
 * the first field that is not acceptable. Options are given as `--name=value`,
 * so no value can be read as another option; positional values never start
 * with `-`.
 */
export function actionArgs(action: unknown): string[] {
  if (!action || typeof action !== "object") throw new ActionError("not an action");
  const a = action as Record<string, unknown>;
  const intent = () => `--intent=${words(a.intent, "intent", 500)}`;
  const tier = (v: unknown) => field(v, "tier", (t) => TIER.test(t), "not a tier");
  switch (a.verb) {
    case "status-set":
      return [
        "status",
        "set",
        entity(a.id, "id"),
        field(a.state, "state", (v) => STATE.test(v), "not a state"),
        intent(),
        ...optional(a.tier, tier, "--tier"),
        "--json",
      ];
    case "journal-adopt":
      return [
        "journal",
        "adopt",
        field(a.commit, "commit", (v) => COMMIT.test(v), "not a commit"),
        intent(),
        `--tier=${tier(a.tier)}`,
        ...optional(a.target, (v) => entity(v, "target"), "--target"),
        "--json",
      ];
    case "journal-append": {
      const path = projectPath(a.path);
      return [
        "journal",
        "append",
        "--command=/adopt",
        "--action=update",
        `--artifact=${a.artifact ? words(a.artifact, "artifact", 120) : path}`,
        `--file=${path}`,
        intent(),
        `--tier=${tier(a.tier)}`,
        ...optional(a.target, (v) => entity(v, "target"), "--target"),
        "--json",
      ];
    }
    case "reconcile": {
      const decision = field(a.decision, "decision", (v) => DECISIONS.includes(v), `one of ${DECISIONS.join(", ")}`);
      if (decision === "propose" && !a.text) throw new ActionError("text: a proposal says what it proposes");
      return [
        "reconcile",
        entity(a.case, "case"),
        decision,
        intent(),
        ...optional(a.text, (v) => words(v, "text", 2000), "--text"),
      ];
    }
    case "restore":
      return [
        "restore",
        entity(a.id, "id"),
        `--to=${field(a.to, "to", (v) => VERSION.test(v), "a change (#N) or a time")}`,
        intent(),
        ...optional(a.tier, tier, "--tier"),
        "--json",
      ];
    default:
      throw new ActionError("not an action the Studio may ask for");
  }
}

/** The command as the person reads it in the host's dialog. */
export function describeAction(args: string[]): string {
  return ["catalyst", ...args.map((x) => (/^[\w./:=@-]+$/.test(x) ? x : JSON.stringify(x)))].join(" ");
}

export interface ActionResult {
  ok: boolean;
  /** What catalyst printed: its JSON when the verb gives one, else its text. */
  output: string;
  error: string;
}

/** Run `catalyst <args>` from the project's root, with no shell. */
export function runAction(project: string, args: string[], catalyst = catalystCommand()): Promise<ActionResult> {
  const [cmd, ...pre] = catalyst;
  return new Promise((resolve) => {
    const child = spawn(cmd, [...pre, ...args], { cwd: project, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let error = "";
    child.stdout.on("data", (c: Buffer) => (output += c.toString()));
    child.stderr.on("data", (c: Buffer) => (error += c.toString()));
    child.on("error", (e) => {
      resolve({ ok: false, output, error: `catalyst could not start: ${e.message}` });
    });
    child.on("close", (code) => {
      resolve({ ok: code === 0, output: output.trim(), error: error.trim() });
    });
  });
}
