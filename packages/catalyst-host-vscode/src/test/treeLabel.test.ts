import * as assert from "assert";

import type { ChainNode } from "catalyst-core";

import { formatNodeLabel, getNodeUser } from "../tree.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    artifactType: "requirement",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

describe("formatNodeLabel", () => {
  it("formats a node with name and username, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
      name: "Password Reset Flow",
      signedOffBy: "Olivier Steck",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "Password Reset Flow [REQ-000001 - Olivier Steck]",
    );
    assert.strictEqual(getNodeUser(n), "Olivier Steck");
  });

  it("formats a node with name but no username, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
      name: "Password Reset Flow",
    });
    assert.strictEqual(formatNodeLabel(n), "Password Reset Flow [REQ-000001]");
    assert.strictEqual(getNodeUser(n), undefined);
  });

  it("falls back to title when name is missing, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
      title: "Password Reset Flow Title",
      signedOffBy: "Olivier Steck",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "Password Reset Flow Title [REQ-000001 - Olivier Steck]",
    );
    assert.strictEqual(getNodeUser(n), "Olivier Steck");
  });

  it("includes status glyph when status is non-working or broken", () => {
    const n = node({
      id: "br-REDIS-016",
      kind: "rule",
      title: "Redis replay",
      status: "❌",
    });
    assert.strictEqual(formatNodeLabel(n), "❌ Redis replay [br-REDIS-016]");
  });

  it("removes dashes from name in formatNodeLabel", () => {
    const n = node({
      id: "ui-BOOT-001",
      kind: "rule",
      name: "Splash-first boot-flow",
      status: "✅",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "✅ Splash first boot flow [ui-BOOT-001]",
    );
  });

  it("formats working rule with embedded userid and slug suffix correctly", () => {
    const n = node({
      id: "env-CI-000001-z6qEx1Kf-github-actions-on-push",
      kind: "rule",
      status: "✅",
      signedOffBy: "olivier steck",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "✅ github actions on push [env-CI-000001 - olivier steck]",
    );
  });

  it("formats not implemented rule with embedded userid and slug suffix correctly", () => {
    const n = node({
      id: "cor-CORE-000001-z6qEx1Kf-telemetry-log-correlation",
      kind: "rule",
      status: "❌",
      signedOffBy: "olivier steck",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "❌ telemetry log correlation [cor-CORE-000001 - olivier steck]",
    );
  });
});
