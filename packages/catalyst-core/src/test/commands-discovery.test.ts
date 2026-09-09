import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { discoverSlashCommands } from "../commands-discovery.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "catalyst-core-commands-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeCommand(name: string, content: string): void {
  const dir = join(root, ".claude", "commands");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.md`), content);
}

describe("discoverSlashCommands", () => {
  it("parses description and argument-hint from frontmatter", () => {
    writeCommand(
      "create-bug",
      '---\ndescription: "Create a new bug artifact"\nargument-hint: "<title>"\n---\nBody\n',
    );

    const [spec] = discoverSlashCommands(root);
    expect(spec.name).toBe("create-bug");
    expect(spec.description).toBe("Create a new bug artifact");
    expect(spec.argumentHint).toBe("<title>");
  });

  it("yields a spec with no description/hint when there's no frontmatter", () => {
    writeCommand("help", "# Help\nJust a body.\n");

    const [spec] = discoverSlashCommands(root);
    expect(spec.name).toBe("help");
    expect(spec.description).toBeUndefined();
    expect(spec.argumentHint).toBeUndefined();
  });

  it("returns an empty array when .claude/commands doesn't exist", () => {
    expect(discoverSlashCommands(root)).toEqual([]);
  });

  it("ignores non-.md files", () => {
    const dir = join(root, ".claude", "commands");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "README.txt"), "not a command");
    writeCommand("dogfood", "---\ndescription: Vet the repo\n---\n");

    const specs = discoverSlashCommands(root);
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("dogfood");
  });
});
