import * as assert from "assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { discoverSlashCommands } from "../commands-discovery.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "catalyst-host-vscode-commands-"));
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
    assert.strictEqual(spec.name, "create-bug");
    assert.strictEqual(spec.description, "Create a new bug artifact");
    assert.strictEqual(spec.argumentHint, "<title>");
  });

  it("yields a spec with no description/hint when there's no frontmatter", () => {
    writeCommand("help", "# Help\nJust a body.\n");

    const [spec] = discoverSlashCommands(root);
    assert.strictEqual(spec.name, "help");
    assert.strictEqual(spec.description, undefined);
    assert.strictEqual(spec.argumentHint, undefined);
  });

  it("returns an empty array when .claude/commands doesn't exist", () => {
    assert.deepStrictEqual(discoverSlashCommands(root), []);
  });

  it("ignores non-.md files", () => {
    const dir = join(root, ".claude", "commands");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "README.txt"), "not a command");
    writeCommand("dogfood", "---\ndescription: Vet the repo\n---\n");

    const specs = discoverSlashCommands(root);
    assert.strictEqual(specs.length, 1);
    assert.strictEqual(specs[0].name, "dogfood");
  });
});
