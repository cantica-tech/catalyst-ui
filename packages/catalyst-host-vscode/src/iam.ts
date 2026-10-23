/**
 * The local system account (`vscode-IAM-000001-UVqkd7cL`, `REQ-000062-UVqkd7cL`,
 * `REQ-000063-UVqkd7cL`): the account catalyst uses on this machine, named by
 * the `catalyst.iam.*` settings. Its provider is a catalyst-users pointer
 * (`{provider, issuer, client}`), never the identity provider's bare URL. Its
 * password comes from VS Code's secret storage or from a command's output,
 * and is never written to settings.
 * Pure but for running the command, so it is unit-tested without a VS Code
 * host.
 */

import { execFile } from "node:child_process";
import { homedir } from "node:os";

export type IamProvider = "keycloak";
export type IamPasswordSource = "secret" | "command";

export const IAM_PROVIDERS: readonly IamProvider[] = ["keycloak"];
export const DEFAULT_IAM_ISSUER = "http://localhost:8080/realms/catalyst";
export const DEFAULT_IAM_CLIENT = "catalyst-cli";

export const IAM_PROVIDER_SETTING = "iam.provider";
export const IAM_ISSUER_SETTING = "iam.issuer";
export const IAM_CLIENT_SETTING = "iam.client";
export const IAM_USERNAME_SETTING = "iam.username";
export const IAM_PASSWORD_SOURCE_SETTING = "iam.password.source";
export const IAM_PASSWORD_COMMAND_SETTING = "iam.password.command";

/** The secret storage key of the password entered with Catalyst: Set IAM Password. */
export const IAM_PASSWORD_SECRET = "catalyst.iam.password";

/** The pointer document catalyst-users reads to choose its backend (its `id-PROVIDER-000001`). */
export interface IamPointer {
  provider: IamProvider;
  issuer: string;
  client: string;
}

export interface IamSettings {
  pointer: IamPointer;
  username: string;
  passwordSource: IamPasswordSource;
  passwordCommand: string;
}

export interface IamAccount {
  pointer: IamPointer;
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
  const provider = get(IAM_PROVIDER_SETTING);
  const issuer = get(IAM_ISSUER_SETTING);
  return {
    pointer: {
      provider: IAM_PROVIDERS.includes(provider as IamProvider) ? (provider as IamProvider) : "keycloak",
      // Unset is the default; set but blank is a pointer without an issuer, reported as such.
      issuer: typeof issuer === "string" ? issuer.trim() : DEFAULT_IAM_ISSUER,
      client: text(IAM_CLIENT_SETTING, DEFAULT_IAM_CLIENT),
    },
    username: text(IAM_USERNAME_SETTING),
    passwordSource: get(IAM_PASSWORD_SOURCE_SETTING) === "command" ? "command" : "secret",
    passwordCommand: text(IAM_PASSWORD_COMMAND_SETTING),
  };
}

/** What is wrong with a pointer, worded as catalyst-users' `pointer_problems` words it. */
export function pointerProblems(pointer: IamPointer): string[] {
  return pointer.issuer ? [] : [`a "${pointer.provider}" pointer needs an "issuer"`];
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
  const account = { pointer: settings.pointer, username: settings.username };
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
