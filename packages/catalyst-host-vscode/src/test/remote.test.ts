import * as assert from "assert";

import {
  devcontainerMount,
  environmentLabel,
  unreachableAdvice,
} from "../remote.js";

describe("remote environments (REQ-000016)", () => {
  it("names the environment", () => {
    assert.strictEqual(environmentLabel(undefined), undefined);
    assert.strictEqual(environmentLabel("wsl"), "WSL");
    assert.strictEqual(environmentLabel("ssh-remote"), "SSH");
    assert.strictEqual(environmentLabel("dev-container"), "a dev container");
    assert.strictEqual(environmentLabel("codespaces"), "a codespace");
    assert.strictEqual(environmentLabel("tunnel"), "tunnel");
  });

  it("mounts the target at the same path, so the symlink resolves", () => {
    assert.strictEqual(
      devcontainerMount("/Users/ada/.claude/projects/x/.criterion"),
      '"mounts": ["source=/Users/ada/.claude/projects/x/.criterion,target=/Users/ada/.claude/projects/x/.criterion,type=bind"]',
    );
  });

  it("offers the mount in a dev container, sharing everywhere", () => {
    const c = unreachableAdvice("app", "/h/.criterion", "dev-container");
    assert.deepStrictEqual(c.actions, ["copy-mount", "share"]);
    assert.ok(
      c.message.includes("from a dev container") &&
        c.message.includes("/h/.criterion"),
    );
    const w = unreachableAdvice("app", "/h/.criterion", "wsl");
    assert.deepStrictEqual(w.actions, ["share"]);
    assert.ok(w.message.includes("from WSL"));
    const local = unreachableAdvice("app", undefined, undefined);
    assert.deepStrictEqual(local.actions, ["share"]);
    assert.ok(local.message.includes("no working copy here"));
  });
});
