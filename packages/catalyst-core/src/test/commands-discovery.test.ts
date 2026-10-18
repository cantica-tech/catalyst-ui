import { describe, expect, it } from "vitest";

import { commandNames, commandsFromCatalog, discoverSlashCommands, type RunCatalyst } from "../commands-discovery.js";

/** What `catalyst spec --json` prints, cut to what the picker reads. */
const CATALOG = {
  commands: [
    { name: "alpha", usage: "/alpha", summary: "Does the alpha thing. Then more.", aliases: [], parts: [] },
    {
      name: "create",
      usage: "/create <type> <title>",
      summary: "create an artifact of a type the active modules declare; each type is a part.",
      aliases: ["create-item"],
      parts: [],
    },
    { name: "long", usage: "/long", summary: "word ".repeat(80) },
    { usage: "/nameless" },
  ],
};

describe("commandsFromCatalog (R5.3: catalyst's own list)", () => {
  it("reads each command's name, hint, first sentence and aliases", () => {
    const specs = commandsFromCatalog(CATALOG);
    expect(specs.map((s) => s.name)).toEqual(["alpha", "create", "long"]);
    expect(specs[0]).toEqual({ name: "alpha", description: "Does the alpha thing." });
    expect(specs[1].argumentHint).toBe("<type> <title>");
    expect(specs[1].aliases).toEqual(["create-item"]);
    expect(commandNames(specs)).toEqual(["alpha", "create", "create-item", "long"]);
  });

  it("caps a long description", () => {
    const long = commandsFromCatalog(CATALOG)[2];
    expect(long.description?.length).toBe(200);
    expect(long.description?.endsWith("…")).toBe(true);
  });

  it("gives nothing for anything but a catalogue", () => {
    expect(commandsFromCatalog(null)).toEqual([]);
    expect(commandsFromCatalog({ commands: "x" })).toEqual([]);
  });
});

describe("discoverSlashCommands", () => {
  it("asks catalyst, from the project", () => {
    const asked: [string[], string][] = [];
    const run: RunCatalyst = (args, cwd) => {
      asked.push([args, cwd]);
      return { status: 0, stdout: JSON.stringify(CATALOG) };
    };
    expect(discoverSlashCommands("/work/app", run).map((s) => s.name)).toEqual(["alpha", "create", "long"]);
    expect(asked).toEqual([[["--project", "/work/app", "spec", "--json"], "/work/app"]]);
  });

  it("gives nothing when catalyst fails, answers garbage or cannot run", () => {
    expect(discoverSlashCommands("/p", () => ({ status: 2, stdout: "" }))).toEqual([]);
    expect(discoverSlashCommands("/p", () => ({ status: 0, stdout: "not json" }))).toEqual([]);
    expect(
      discoverSlashCommands("/p", () => {
        throw new Error("ENOENT");
      }),
    ).toEqual([]);
  });
});
