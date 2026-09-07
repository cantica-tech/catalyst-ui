import * as assert from "assert";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { resolveAgentCommand } from "../agent-launch.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "catalyst-host-vscode-agent-launch-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writePointer(content: string): void {
  writeFileSync(join(root, "project.catalyst"), content);
}

describe("resolveAgentCommand", () => {
  it("aliases claude-code to its actual CLI binary", () => {
    writePointer(JSON.stringify({ agent: "claude-code" }));
    assert.strictEqual(resolveAgentCommand(root), "claude");
  });

  it("passes an unrecognized agent id through verbatim", () => {
    writePointer(JSON.stringify({ agent: "some-other-agent" }));
    assert.strictEqual(resolveAgentCommand(root), "some-other-agent");
  });

  it("returns null when no pointer file exists", () => {
    assert.strictEqual(resolveAgentCommand(root), null);
  });

  it("returns null for malformed JSON", () => {
    writePointer("{ not json");
    assert.strictEqual(resolveAgentCommand(root), null);
  });

  it("returns null when the pointer has no agent field", () => {
    writePointer(JSON.stringify({ "agent-source": "/tmp/wherever" }));
    assert.strictEqual(resolveAgentCommand(root), null);
  });
});
