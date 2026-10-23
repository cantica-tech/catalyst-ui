import * as assert from "assert";

import { readIamSettings, resolveIamAccount, splitCommand, type IamSettings, type RunCommand } from "../iam.js";

const settings = (values: Record<string, unknown>): IamSettings => readIamSettings((key) => values[key]);

describe("the local system account (REQ-000062)", () => {
  it("defaults to keycloak at http://localhost:8080/, with the password from secret storage", () => {
    assert.deepStrictEqual(settings({}), {
      type: "keycloak",
      url: "http://localhost:8080/",
      username: "",
      passwordSource: "secret",
      passwordCommand: "",
    });
  });

  it("reads the settings, and falls back on what is invalid", () => {
    const read = settings({
      "iam.type": "ldap",
      "iam.url": " https://id.example/ ",
      "iam.username": "owner",
      "iam.password.source": "command",
      "iam.password.command": "get-pwd pwd",
    });
    assert.deepStrictEqual(read, {
      type: "keycloak",
      url: "https://id.example/",
      username: "owner",
      passwordSource: "command",
      passwordCommand: "get-pwd pwd",
    });
    assert.strictEqual(settings({ "iam.url": "  ", "iam.password.source": "plain" }).url, "http://localhost:8080/");
    assert.strictEqual(settings({ "iam.password.source": "plain" }).passwordSource, "secret");
  });

  it("splits a command into words, without a shell", () => {
    assert.deepStrictEqual(splitCommand("/a/get-keycloack-accnt.sh pwd"), ["/a/get-keycloack-accnt.sh", "pwd"]);
    assert.deepStrictEqual(splitCommand(`  "/a b/run" 'x y'  z ""  `), ["/a b/run", "x y", "z", ""]);
    assert.deepStrictEqual(splitCommand("~/bin/pwd ~ a~/b", "/home/me"), ["/home/me/bin/pwd", "/home/me", "a~/b"]);
    assert.deepStrictEqual(splitCommand("echo $(id); rm"), ["echo", "$(id);", "rm"]);
    assert.throws(() => splitCommand(`run "pwd`), /unclosed/);
  });

  it("takes the password from secret storage, or says none is set", async () => {
    const secret = settings({ "iam.username": "owner" });
    const found = await resolveIamAccount(secret, () => Promise.resolve("s3cret"));
    assert.strictEqual(found.password, "s3cret");
    assert.strictEqual(found.problem, undefined);
    const missing = await resolveIamAccount(secret, () => Promise.resolve(undefined));
    assert.strictEqual(missing.password, undefined);
    assert.match(missing.problem ?? "", /Set IAM Password/);
  });

  it("takes the password from the command's first line, never reading the secret", async () => {
    const ran: [string, string[]][] = [];
    const run: RunCommand = (file, args) => {
      ran.push([file, args]);
      return Promise.resolve("p@ss word\nmore\n");
    };
    const account = await resolveIamAccount(
      settings({ "iam.password.source": "command", "iam.password.command": "/a/get-keycloack-accnt.sh pwd" }),
      () => Promise.reject(new Error("the secret store is not read")),
      run,
    );
    assert.deepStrictEqual(ran, [["/a/get-keycloack-accnt.sh", ["pwd"]]]);
    assert.strictEqual(account.password, "p@ss word");
  });

  it("yields no password, and says why, when the command is empty, fails or prints nothing", async () => {
    const command = (line: string) => settings({ "iam.password.source": "command", "iam.password.command": line });
    const none = () => Promise.resolve(undefined);
    assert.match((await resolveIamAccount(command(""), none)).problem ?? "", /command is empty/);
    const failing: RunCommand = () => Promise.reject(new Error("item not found"));
    const failed = await resolveIamAccount(command("get-pwd"), none, failing);
    assert.strictEqual(failed.password, undefined);
    assert.match(failed.problem ?? "", /failed \(get-pwd\): item not found/);
    const silent = await resolveIamAccount(command("get-pwd"), none, () => Promise.resolve("\n"));
    assert.match(silent.problem ?? "", /printed nothing/);
  });

  it("runs a real program without a shell", async () => {
    const account = await resolveIamAccount(
      settings({ "iam.password.source": "command", "iam.password.command": "printf 'secret\\n$(id)'" }),
      () => Promise.resolve(undefined),
    );
    assert.strictEqual(account.password, "secret");
  });
});
