import * as assert from "assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loginNameFor,
  passwordLogin,
  readIamSettings,
  splitCommand,
  systemToken,
  systemWhoami,
  type RunCommand,
  type RunWithInput,
} from "../iam.js";

const settings = (command?: unknown) => readIamSettings((key) => (key === "iam.command" ? command : undefined));

const WHOAMI = {
  iss: "http://localhost:8080/realms/catalyst",
  sub: "sa-1",
  username: "service-account-catalyst-system",
  name: "service-account-catalyst-system",
  at: "2026-10-23T13:00:00Z",
  email: null,
  groups: [],
  roles: ["catalyst-admin"],
  grants: ["cmd:*"],
};

describe("the local system account through catalyst-users (REQ-000064)", () => {
  it("runs catalyst-users by default, or the command the setting names", () => {
    assert.deepStrictEqual(settings(), { command: "catalyst-users" });
    assert.deepStrictEqual(settings("  "), { command: "catalyst-users" });
    assert.deepStrictEqual(settings(" uv run catalyst-users "), { command: "uv run catalyst-users" });
  });

  it("splits a command into words, without a shell", () => {
    assert.deepStrictEqual(splitCommand("uv run --project ~/src/cu catalyst-users", "/home/me"), [
      "uv",
      "run",
      "--project",
      "/home/me/src/cu",
      "catalyst-users",
    ]);
    assert.deepStrictEqual(splitCommand(`  "/a b/run" 'x y'  z ""  `), ["/a b/run", "x y", "z", ""]);
    assert.deepStrictEqual(splitCommand("echo $(id); rm"), ["echo", "$(id);", "rm"]);
    assert.throws(() => splitCommand(`run "pwd`), /unclosed/);
  });

  it("asks catalyst-users who the system account is, after the command's own words", async () => {
    const ran: [string, string[]][] = [];
    const run: RunCommand = (file, args) => {
      ran.push([file, args]);
      return Promise.resolve(JSON.stringify(WHOAMI));
    };
    const answer = await systemWhoami(settings("uv run --project /cu catalyst-users"), run);
    assert.deepStrictEqual(ran, [
      ["uv", ["run", "--project", "/cu", "catalyst-users", "--json", "whoami", "--system"]],
    ]);
    assert.deepStrictEqual(answer.value, {
      issuer: WHOAMI.iss,
      subject: "sa-1",
      username: "service-account-catalyst-system",
      name: "service-account-catalyst-system",
      groups: [],
      roles: ["catalyst-admin"],
      grants: ["cmd:*"],
    });
  });

  it("gets the system account's token, never more than catalyst-users gives", async () => {
    const run: RunCommand = (_file, args) => {
      assert.deepStrictEqual(args, ["--json", "token", "--system"]);
      return Promise.resolve(JSON.stringify({ access_token: "at-1", token_type: "Bearer", expires_at: 1_800_000_000 }));
    };
    assert.deepStrictEqual((await systemToken(settings(), run)).value, {
      accessToken: "at-1",
      expiresAt: 1_800_000_000,
    });
    const empty = await systemToken(settings(), () => Promise.resolve("{}"));
    assert.match(empty.problem ?? "", /gave no token/);
  });

  it("says why, when catalyst-users fails, is missing, or does not answer JSON", async () => {
    const failing: RunCommand = () => Promise.reject(new Error("catalyst-users: error: no secret_command"));
    const failed = await systemWhoami(settings(), failing);
    assert.strictEqual(failed.value, undefined);
    assert.match(failed.problem, /failed: catalyst-users: error: no secret_command — check catalyst\.iam\.command/);
    const old = await systemWhoami(settings(), () => Promise.resolve("usage: catalyst-users …"));
    assert.match(old.problem ?? "", /did not answer JSON/);
    const nobody = await systemWhoami(settings(), () => Promise.resolve("{}"));
    assert.match(nobody.problem ?? "", /named no system account/);
    const unclosed = await systemWhoami(settings(`"catalyst-users`));
    assert.match(unclosed.problem ?? "", /unclosed/);
  });

  it("runs a real program without a shell, and names a missing one", async () => {
    const dir = mkdtempSync(join(tmpdir(), "catalyst-users-"));
    const fake = join(dir, "fake-catalyst-users.js");
    writeFileSync(fake, `process.stdout.write(JSON.stringify(${JSON.stringify(WHOAMI)}));\n`);
    const answer = await systemWhoami(settings(`"${process.execPath}" "${fake}"`));
    assert.strictEqual(answer.value?.username, "service-account-catalyst-system");
    const missing = await systemWhoami(settings("/no/such/catalyst-users"));
    assert.match(missing.problem ?? "", /\/no\/such\/catalyst-users was not found/);
  });
});

describe("a person's password login through catalyst-users (REQ-000070)", () => {
  const SIGNER = { iss: WHOAMI.iss, sub: "u-1", username: "oliviersteck", name: "Olivier Steck", at: WHOAMI.at };

  it("passes the password on standard input, never as an argument", async () => {
    const seen: { file: string; args: string[]; input: string }[] = [];
    const run: RunWithInput = (file, args, input) => {
      seen.push({ file, args, input });
      return Promise.resolve(JSON.stringify(SIGNER));
    };
    const answer = await passwordLogin(settings("uv run catalyst-users"), "oliviersteck", "pw-1", run);
    assert.deepStrictEqual(answer.value, { username: "oliviersteck", name: "Olivier Steck" });
    assert.deepStrictEqual(seen[0].args, [
      "run",
      "catalyst-users",
      "--json",
      "login",
      "--password",
      "--username",
      "oliviersteck",
    ]);
    assert.strictEqual(seen[0].file, "uv");
    assert.strictEqual(seen[0].input, "pw-1");
    assert.ok(!seen[0].args.includes("pw-1"));
  });

  it("reports a refused login without the password", async () => {
    const run: RunWithInput = () =>
      Promise.reject(new Error("catalyst-users: error: invalid_grant: Invalid user credentials (pw-1)"));
    const answer = await passwordLogin(settings(), "oliviersteck", "pw-1", run);
    assert.ok(answer.problem?.includes("could not log oliviersteck in"));
    assert.ok(!answer.problem?.includes("pw-1"));
  });

  it("says when catalyst-users is too old or the command is wrong", async () => {
    const notJson: RunWithInput = () => Promise.resolve("usage: catalyst-users login");
    assert.match((await passwordLogin(settings(), "a", "b", notJson)).problem ?? "", /0\.9\.0 or later/);
    assert.match((await passwordLogin(settings(`run "x`), "a", "b", notJson)).problem ?? "", /unclosed/);
  });

  it("offers a login name for a user shown by name", () => {
    assert.strictEqual(loginNameFor(" Olivier Steck "), "oliviersteck");
    assert.strictEqual(loginNameFor("ada"), "ada");
  });
});
