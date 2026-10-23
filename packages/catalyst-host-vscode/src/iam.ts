/**
 * The local system account (`vscode-IAM-000001-UVqkd7cL`, `REQ-000064-UVqkd7cL`):
 * the account catalyst uses on this machine is whoever catalyst-users signs
 * in as the system account. catalyst-users is the facade to whatever identity
 * provider it is configured for, and holds the provider's settings and the
 * account's secret; the extension only runs its command, named by
 * `catalyst.iam.command`, and holds no credential. Pure but for running the
 * command, so it is unit-tested without a VS Code host.
 */

import { execFile } from "node:child_process";
import { homedir } from "node:os";

export const IAM_COMMAND_SETTING = "iam.command";
export const DEFAULT_IAM_COMMAND = "catalyst-users";

/** Where 0.60/0.61 kept a password entered with Catalyst: Set IAM Password; deleted, it is no longer used. */
export const LEGACY_IAM_PASSWORD_SECRET = "catalyst.iam.password";

export interface IamSettings {
  /** The catalyst-users command line, e.g. `uv run --project ~/sources/catalyst-users catalyst-users`. */
  command: string;
}

/** Who the system account is, as `catalyst-users --json whoami --system` says. */
export interface SystemAccount {
  issuer: string;
  subject: string;
  username: string;
  name: string;
  groups: string[];
  roles: string[];
  grants: string[];
}

export interface SystemToken {
  accessToken: string;
  /** Seconds since the epoch. */
  expiresAt: number | undefined;
}

export type Answer<T> = { value: T; problem?: undefined } | { value?: undefined; problem: string };

/** Reads the settings through `get` (a `catalyst.*` key, without the prefix), defaulting what is unset or blank. */
export function readIamSettings(get: (key: string) => unknown): IamSettings {
  const command = get(IAM_COMMAND_SETTING);
  return { command: typeof command === "string" && command.trim() ? command.trim() : DEFAULT_IAM_COMMAND };
}

/**
 * Splits a command line into its words, for running without a shell: blanks
 * separate words, single or double quotes keep a word together, and a
 * leading `~/` is the home directory. No other shell syntax is understood.
 */
export function splitCommand(line: string, home = homedir()): string[] {
  const words: string[] = [];
  let word = "";
  let started = false;
  let quote: string | undefined;
  for (const char of line) {
    if (quote) {
      if (char === quote) quote = undefined;
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) words.push(word);
      word = "";
      started = false;
    } else {
      word += char;
      started = true;
    }
  }
  if (quote) throw new Error(`unclosed ${quote} in the command`);
  if (started) words.push(word);
  return words.map((w) => (w === "~" ? home : w.startsWith("~/") ? home + w.slice(1) : w));
}

/** Runs a program without a shell; resolves to what it printed on stdout. */
export type RunCommand = (file: string, args: string[]) => Promise<string>;

export const runCommand: RunCommand = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 60_000, windowsHide: true }, (error, stdout, stderr) => {
      if (!error) resolve(stdout);
      else if ((error as NodeJS.ErrnoException).code === "ENOENT") reject(new Error(`${file} was not found`));
      else reject(new Error(stderr.trim() || error.message));
    });
  });

/** Runs `<command> --json <args>` and parses what it prints. */
async function catalystUsers(settings: IamSettings, args: string[], run: RunCommand): Promise<Answer<unknown>> {
  let words: string[];
  try {
    words = splitCommand(settings.command);
  } catch (error) {
    return { problem: `catalyst.iam.command: ${error instanceof Error ? error.message : String(error)}` };
  }
  const [file, ...prefix] = words;
  if (!file) return { problem: "catalyst.iam.command is empty" };
  let out: string;
  try {
    out = await run(file, [...prefix, "--json", ...args]);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { problem: `catalyst-users (${settings.command}) failed: ${reason} — check catalyst.iam.command` };
  }
  try {
    return { value: JSON.parse(out) as unknown };
  } catch {
    return {
      problem: `catalyst-users (${settings.command}) did not answer JSON: is it catalyst-users 0.3.0 or later?`,
    };
  }
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

/** Who the system account is: `<command> --json whoami --system`, which signs it in through the provider. */
export async function systemWhoami(
  settings: IamSettings,
  run: RunCommand = runCommand,
): Promise<Answer<SystemAccount>> {
  const answer = await catalystUsers(settings, ["whoami", "--system"], run);
  if (answer.problem !== undefined) return answer;
  const data = (answer.value ?? {}) as Record<string, unknown>;
  if (typeof data.username !== "string" || typeof data.iss !== "string") {
    return { problem: `catalyst-users (${settings.command}) named no system account` };
  }
  return {
    value: {
      issuer: data.iss,
      subject: typeof data.sub === "string" ? data.sub : "",
      username: data.username,
      name: typeof data.name === "string" ? data.name : data.username,
      groups: strings(data.groups),
      roles: strings(data.roles),
      grants: strings(data.grants),
    },
  };
}

/** The system account's access token: `<command> --json token --system`. Never show it. */
export async function systemToken(settings: IamSettings, run: RunCommand = runCommand): Promise<Answer<SystemToken>> {
  const answer = await catalystUsers(settings, ["token", "--system"], run);
  if (answer.problem !== undefined) return answer;
  const data = (answer.value ?? {}) as Record<string, unknown>;
  if (typeof data.access_token !== "string" || !data.access_token) {
    return { problem: `catalyst-users (${settings.command}) gave no token` };
  }
  return {
    value: {
      accessToken: data.access_token,
      expiresAt: typeof data.expires_at === "number" ? data.expires_at : undefined,
    },
  };
}
