import * as assert from "assert";

import { ScriptedHost, type SlashCommandSpec } from "catalyst-core";

import { pickCommandAndArgs, type CommandCandidate } from "../command-picker.js";

const app = { name: "app", path: "/work/app" };
const lib = { name: "lib", path: "/work/lib" };
const create: SlashCommandSpec = {
  name: "create",
  description: "create an artifact",
  argumentHint: "<type> <title>",
};
const help: SlashCommandSpec = { name: "help", description: "every command" };

describe("pickCommandAndArgs (through the host port)", () => {
  it("says so and picks nothing when no project has commands", async () => {
    const host = new ScriptedHost();
    assert.strictEqual(await pickCommandAndArgs(host, []), undefined);
    assert.strictEqual(host.notified[0]?.level, "info");
  });

  it("asks for the project, the command, then its arguments", async () => {
    const host = new ScriptedHost({ pick: [1, 0], input: ["bug The export drops a row"] });
    const candidates: CommandCandidate[] = [
      { folder: app, commands: [help] },
      { folder: lib, commands: [create, help] },
    ];
    const picked = await pickCommandAndArgs(host, candidates);
    assert.deepStrictEqual(picked, { folder: lib, cmd: create, args: "bug The export drops a row" });
  });

  it("asks no arguments of a command that takes none, and stops when a pick is dismissed", async () => {
    const one: CommandCandidate[] = [{ folder: app, commands: [help] }];
    assert.deepStrictEqual(await pickCommandAndArgs(new ScriptedHost({ pick: [0] }), one), {
      folder: app,
      cmd: help,
      args: "",
    });
    assert.strictEqual(await pickCommandAndArgs(new ScriptedHost({ pick: [-1] }), one), undefined);
  });
});
