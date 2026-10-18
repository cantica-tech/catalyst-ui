import { describe, it } from "vitest";
import * as assert from "assert";

import type { ChainNode, ModuleType } from "catalyst-core";

import { formatNodeLabel, getNodeUser } from "../tree.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "artifact",
    typePrefix: overrides.id.split("-")[0],
    status: "",
    closed: false,
    links: {},
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

describe("formatNodeLabel", () => {
  it("drops the bracket when the label already starts with it", () => {
    assert.strictEqual(formatNodeLabel(node({ id: "AUTH", kind: "domain" })), "AUTH");
    assert.strictEqual(formatNodeLabel(node({ id: "STEP-000001-yCNjAMXO" })), "… STEP-000001");
  });

  it("keeps only the signer in the bracket when the label already starts with the ID", () => {
    assert.strictEqual(
      formatNodeLabel(node({ id: "STEP-000001-yCNjAMXO", signedOffBy: "Olivier Steck" })),
      "… STEP-000001 [Olivier Steck]",
    );
  });

  it("formats a node with name and username, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "artifact",
      name: "Password Reset Flow",
      signedOffBy: "Olivier Steck",
    });
    assert.strictEqual(formatNodeLabel(n), "… Password Reset Flow [REQ-000001 - Olivier Steck]");
    assert.strictEqual(getNodeUser(n), "Olivier Steck");
  });

  it("formats a node with name but no username, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "artifact",
      name: "Password Reset Flow",
    });
    assert.strictEqual(formatNodeLabel(n), "… Password Reset Flow [REQ-000001]");
    assert.strictEqual(getNodeUser(n), undefined);
  });

  it("falls back to title when name is missing, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "artifact",
      title: "Password Reset Flow Title",
      signedOffBy: "Olivier Steck",
    });
    assert.strictEqual(formatNodeLabel(n), "… Password Reset Flow Title [REQ-000001 - Olivier Steck]");
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
    assert.strictEqual(formatNodeLabel(n), "✅ Splash first boot flow [ui-BOOT-001]");
  });

  it("formats working rule with embedded userid and slug suffix correctly", () => {
    const n = node({
      id: "env-CI-000001-z6qEx1Kf-github-actions-on-push",
      kind: "rule",
      status: "✅",
      signedOffBy: "olivier steck",
    });
    assert.strictEqual(formatNodeLabel(n), "✅ github actions on push [env-CI-000001 - olivier steck]");
  });

  it("formats not implemented rule with embedded userid and slug suffix correctly", () => {
    const n = node({
      id: "cor-CORE-000001-z6qEx1Kf-telemetry-log-correlation",
      kind: "rule",
      status: "❌",
      signedOffBy: "olivier steck",
    });
    assert.strictEqual(formatNodeLabel(n), "❌ telemetry log correlation [cor-CORE-000001 - olivier steck]");
  });

  it("cleans dirty status strings like '✅ working' from node name and falls back to slug", () => {
    const n = node({
      id: "env-CI-000001-z6qEx1Kf-github-actions-on-push",
      kind: "rule",
      name: "✅ working",
      title: "✅ working",
      status: "✅ working",
      signedOffBy: "olivier steck",
    });
    assert.strictEqual(formatNodeLabel(n), "✅ github actions on push [env-CI-000001 - olivier steck]");
  });

  it("strips status prefix from name when name contains both status and descriptive title", () => {
    const n = node({
      id: "env-CI-000001-z6qEx1Kf-github-actions-on-push",
      kind: "rule",
      name: "✅ working github actions on push",
      title: "✅ working github actions on push",
      status: "✅ working",
    });
    assert.strictEqual(formatNodeLabel(n), "✅ github actions on push [env-CI-000001]");
  });

  describe("a mark from the type alone (catalyst roadmap R6.7)", () => {
    const type: ModuleType = {
      prefix: "ITEM",
      name: "Item",
      plural_name: "Items",
      states: ["Open", "Active", "Done", "Abandoned"],
      initial: "Open",
      closed_states: ["Done", "Abandoned"],
      fields: [],
    };
    const glyph = (status: string) =>
      formatNodeLabel(
        node({ id: "ITEM-000001-Ab3xR9pQ", title: "Login", status, closed: type.closed_states.includes(status) }),
        type,
      ).split(" ")[0];

    it("marks a closed state done, or dropped when its word says so", () => {
      assert.strictEqual(glyph("Done"), "✅");
      assert.strictEqual(glyph("Abandoned"), "🗑");
    });

    it("marks the initial state, or none, not started", () => {
      assert.strictEqual(glyph("Open"), "…");
      assert.strictEqual(glyph(""), "…");
    });

    it("marks any other state under way", () => {
      assert.strictEqual(glyph("Active"), "⏳");
    });

    it("marks a row the same way", () => {
      const row = {
        ...node({ id: "RM-000001-Ab3xR9pQ", title: "Bulk export" }),
        kind: "row",
        table: "beta",
        tableRetired: false,
        fields: {},
        signedOffBy: "",
        description: "",
        status: "Done",
        closed: true,
      } as ChainNode;
      assert.strictEqual(formatNodeLabel(row), "✅ Bulk export [RM-000001]");
    });
  });
});
