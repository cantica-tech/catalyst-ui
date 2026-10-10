import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { commandNames, discoverSlashCommands, parseSection4Commands } from "../commands-discovery.js";

const CODE_OF_CONDUCT = `# Code of conduct

## 3. Before

- \`/not-a-command\` — outside §4, never listed.

## 4. Commands

Every command below ends with a check.

- \`/alpha <title>\` — create an alpha thing immediately, e.g. for a
  quick note. Then register it in the index.
- \`/beta\` or \`/beta-long\` — run beta.
- \`/gamma create <name>\` — create a gamma.
- \`/gamma remove <name>\` — remove a gamma.
- \`/x|y\` — names no command.
- \`/delta\`

A paragraph about \`/alpha\`: its procedure, not a command.

## 5. After

- \`/omega\` — after §4, never listed.
`;

describe("parseSection4Commands", () => {
  const specs = parseSection4Commands(CODE_OF_CONDUCT, "/c/CODE-OF-CONDUCT.md");
  const byName = (name: string) => specs.find((s) => s.name === name);

  it("lists only §4's bullet commands, sorted, with their file", () => {
    expect(specs.map((s) => s.name)).toEqual(["alpha", "beta", "delta", "gamma"]);
    expect(byName("alpha")?.filePath).toBe("/c/CODE-OF-CONDUCT.md");
  });

  it("takes the first sentence after the dash, whitespace collapsed", () => {
    expect(byName("alpha")?.description).toBe("create an alpha thing immediately, e.g. for a quick note.");
    expect(byName("delta")?.description).toBeUndefined();
  });

  it("reads the argument hint from the bullet's code span", () => {
    expect(byName("alpha")?.argumentHint).toBe("<title>");
    expect(byName("beta")?.argumentHint).toBeUndefined();
    expect(byName("gamma")?.argumentHint).toBe("create <name> | remove <name>");
  });

  it("treats further mentions before the dash as aliases", () => {
    expect(byName("beta")?.aliases).toEqual(["beta-long"]);
    expect(byName("beta-long")).toBeUndefined();
    expect(commandNames(specs)).toEqual(["alpha", "beta", "beta-long", "delta", "gamma"]);
  });

  it("caps a long description", () => {
    const long = "word ".repeat(80).trim();
    const [spec] = parseSection4Commands(`## 4. C\n- \`/long\` — ${long}\n`);
    expect(spec.description?.length).toBe(200);
    expect(spec.description?.endsWith("…")).toBe(true);
  });

  it("returns nothing without a §4", () => {
    expect(parseSection4Commands("# Nothing\n\n- `/alpha` — a.\n")).toEqual([]);
  });
});

describe("discoverSlashCommands", () => {
  let scratch: string;
  let savedHome: string | undefined;

  beforeEach(() => {
    scratch = mkdtempSync(join(tmpdir(), "catalyst-core-commands-"));
    savedHome = process.env.CATALYST_HOME;
    process.env.CATALYST_HOME = join(scratch, "home");
  });

  afterEach(() => {
    if (savedHome === undefined) delete process.env.CATALYST_HOME;
    else process.env.CATALYST_HOME = savedHome;
    rmSync(scratch, { recursive: true, force: true });
  });

  it("reads §4 of the criterion's CODE-OF-CONDUCT.md", () => {
    const project = join(scratch, "project");
    const criterion = join(scratch, "home", "projects", "app", "criterion");
    mkdirSync(project);
    mkdirSync(criterion, { recursive: true });
    writeFileSync(join(project, "catalyst.toml"), 'project_name = "app"\n');
    writeFileSync(join(criterion, "CODE-OF-CONDUCT.md"), CODE_OF_CONDUCT);

    const specs = discoverSlashCommands(project);
    expect(specs.map((s) => s.name)).toEqual(["alpha", "beta", "delta", "gamma"]);
    expect(specs[0].filePath).toBe(join(criterion, "CODE-OF-CONDUCT.md"));
  });

  it("ignores command files in the project's .claude/commands", () => {
    const project = join(scratch, "project");
    mkdirSync(join(project, ".claude", "commands"), { recursive: true });
    writeFileSync(join(project, ".claude", "commands", "alpha.md"), "---\ndescription: stale\n---\n");
    expect(discoverSlashCommands(project)).toEqual([]);
  });

  it("returns nothing when the criterion has no CODE-OF-CONDUCT.md", () => {
    const project = join(scratch, "project");
    mkdirSync(join(project, ".criterion"), { recursive: true });
    expect(discoverSlashCommands(project)).toEqual([]);
  });
});
