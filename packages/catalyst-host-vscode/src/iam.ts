/**
 * The local system account (`vscode-IAM-000001-UVqkd7cL`, `REQ-000062-UVqkd7cL`):
 * the identity provider account catalyst uses on this machine, named by the
 * `catalyst.iam.*` settings. Its password comes from VS Code's secret
 * storage or from a command's output, and is never written to settings.
 * Pure but for running the command, so it is unit-tested without a VS Code
 * host.
 */

import { execFile } from "node:child_process";
import { homedir } from "node:os";

export type IamType = "keycloak";
export type IamPasswordSource = "secret" | "command";

export const IAM_TYPES: readonly IamType[] = ["keycloak"];
export const DEFAULT_IAM_URL = "http://localhost:8080/";

export const IAM_TYPE_SETTING = "iam.type";
export const IAM_URL_SETTING = "iam.url";
export const IAM_USERNAME_SETTING = "iam.username";
export const IAM_PASSWORD_SOURCE_SETTING = "iam.password.source";
export const IAM_PASSWORD_COMMAND_SETTING = "iam.password.command";

/** The secret storage key of the password entered with Catalyst: Set IAM Password. */
export const IAM_PASSWORD_SECRET = "catalyst.iam.password";

export interface IamSettings {
  type: IamType;
  url: string;
  username: string;
  passwordSource: IamPasswordSource;
  passwordCommand: string;
}

export interface IamAccount {
  type: IamType;
  url: string;
  username: string;
  password: string | undefined;
  /** Why there is no password, when there is none. */
  problem?: string;
}

/** Reads the settings through `get` (a `catalyst.*` key, without the prefix), defaulting what is unset or invalid. */
export function readIamSettings(get: (key: string) => unknown): IamSettings {
  const text = (key: string, fallback = ""): string => {
    const value = get(key);
    return typeof value === "string" ? value.trim() || fallback : fallback;
  };
  const type = get(IAM_TYPE_SETTING);
  return {
    type: IAM_TYPES.includes(type as IamType) ? (type as IamType) : "keycloak",
    url: text(IAM_URL_SETTING, DEFAULT_IAM_URL),
    username: text(IAM_USERNAME_SETTING),
    passwordSource: get(IAM_PASSWORD_SOURCE_SETTING) === "command" ? "command" : "secret",
    passwordCommand: text(IAM_PASSWORD_COMMAND_SETTING),
  };
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
    execFile(file, args, { timeout: 30_000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message));
      else resolve(stdout);
    });
  });

/** The account the settings name, with its password from the secret store or the command. */
export async function resolveIamAccount(
  settings: IamSettings,
  readSecret: () => Promise<string | undefined>,
  run: RunCommand = runCommand,
): Promise<IamAccount> {
  const account = { type: settings.type, url: settings.url, username: settings.username };
  if (settings.passwordSource === "secret") {
    const password = await readSecret();
    return password
      ? { ...account, password }
      : { ...account, password: undefined, problem: "no password is set (Catalyst: Set IAM Password)" };
  }
  if (!settings.passwordCommand) {
    return { ...account, password: undefined, problem: "catalyst.iam.password.command is empty" };
  }
  try {
    const [file, ...args] = splitCommand(settings.passwordCommand);
    if (!file) throw new Error("catalyst.iam.password.command is empty");
    const password = (await run(file, args)).split(/\r?\n/)[0];
    return password
      ? { ...account, password }
      : {
          ...account,
          password: undefined,
          problem: `the password command printed nothing: ${settings.passwordCommand}`,
        };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ...account,
      password: undefined,
      problem: `the password command failed (${settings.passwordCommand}): ${reason}`,
    };
  }
}
