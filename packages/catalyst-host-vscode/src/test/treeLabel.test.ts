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
    assert.strictEqual(formatNodeLabel(n), "… Password Reset Flow [REQ-000001 - Olivier Steck]");
    assert.strictEqual(getNodeUser(n), "Olivier Steck");
  });

  it("formats a node with name but no username, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
      name: "Password Reset Flow",
    });
    assert.strictEqual(formatNodeLabel(n), "… Password Reset Flow [REQ-000001]");
    assert.strictEqual(getNodeUser(n), undefined);
  });

  it("falls back to title when name is missing, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
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

  it("formats an open bug with 🐛 preceding its name and id", () => {
    const n = node({
      id: "BUG-000001-z6qEx1Kf",
      kind: "dev-artifact",
      artifactType: "bug",
      name: "Fluent Bit TCP output format raw unrecognized",
      status: "open",
    });
    assert.strictEqual(formatNodeLabel(n), "🐛 Fluent Bit TCP output format raw unrecognized [BUG-000001]");
  });

  it("formats an in-progress bug with 🐛 preceding its name and id", () => {
    const n = node({
      id: "BUG-000002-z6qEx1Kf",
      kind: "dev-artifact",
      artifactType: "bug",
      name: "Catalog missing column migration",
      status: "in-progress",
    });
    assert.strictEqual(formatNodeLabel(n), "🐛 Catalog missing column migration [BUG-000002]");
  });

  it("formats a fixed bug with ✅ status glyph rather than 🐛", () => {
    const n = node({
      id: "BUG-000003-z6qEx1Kf",
      kind: "dev-artifact",
      artifactType: "bug",
      name: "Childless root sump not correlatable",
      status: "fixed",
    });
    assert.strictEqual(formatNodeLabel(n), "✅ Childless root sump not correlatable [BUG-000003]");
  });

  it("formats a finished roadmap item with ✅ status glyph", () => {
    const n = node({
      id: "RM-000001-z6qEx1Kf",
      kind: "roadmap",
      name: "Bulk export",
      status: "Done",
    });
    assert.strictEqual(formatNodeLabel(n), "✅ Bulk export [RM-000001]");
  });

  it("formats an in-progress roadmap item with ⏳ status glyph", () => {
    const n = node({
      id: "RM-000002-z6qEx1Kf",
      kind: "roadmap",
      name: "Import dataset",
      status: "In progress",
    });
    assert.strictEqual(formatNodeLabel(n), "⏳ Import dataset [RM-000002]");
  });

  it("formats a not done roadmap item with … status glyph", () => {
    const n = node({
      id: "RM-000003-z6qEx1Kf",
      kind: "roadmap",
      name: "Realtime updates",
      status: "Not triaged",
    });
    assert.strictEqual(formatNodeLabel(n), "… Realtime updates [RM-000003]");
  });

  it("formats a passing test with ✅ status glyph", () => {
    const n = node({
      id: "TEST-000001-z6qEx1Kf",
      kind: "dev-artifact",
      artifactType: "test",
      name: "Parser round trip",
      status: "passing",
    });
    assert.strictEqual(formatNodeLabel(n), "✅ Parser round trip [TEST-000001]");
  });

  it("formats a failing test with ❌ status glyph", () => {
    const n = node({
      id: "TEST-000002-z6qEx1Kf",
      kind: "dev-artifact",
      artifactType: "test",
      name: "Auth token expiry",
      status: "failing",
    });
    assert.strictEqual(formatNodeLabel(n), "❌ Auth token expiry [TEST-000002]");
  });

  it("formats a blocked test with ⚠️ status glyph", () => {
    const n = node({
      id: "TEST-000003-z6qEx1Kf",
      kind: "dev-artifact",
      artifactType: "test",
      name: "Migration rollback",
      status: "blocked",
    });
    assert.strictEqual(formatNodeLabel(n), "⚠️ Migration rollback [TEST-000003]");
  });

  it("formats a proposed test with … status glyph", () => {
    const n = node({
      id: "TEST-000004-z6qEx1Kf",
      kind: "dev-artifact",
      artifactType: "test",
      name: "Exploratory smoke test",
      status: "proposed",
    });
    assert.strictEqual(formatNodeLabel(n), "… Exploratory smoke test [TEST-000004]");
  });

  describe("requirement and feature status (implemented / in progress / not yet / abandoned)", () => {
    const glyph = (n: ChainNode) => formatNodeLabel(n).split(" ")[0];
    const req = (status: string) =>
      node({
        id: "REQ-000001-Ab3xR9pQ",
        title: "Login",
        status,
      });
    const feat = (status: string) =>
      node({
        id: "FEAT-000001-Ab3xR9pQ",
        kind: "feature",
        title: "Login",
        status,
      });

    it("marks an implemented requirement or feature ✅", () => {
      for (const s of ["Completed", "done", "shipped"]) {
        assert.strictEqual(glyph(req(s)), "✅", s);
        assert.strictEqual(glyph(feat(s)), "✅", s);
      }
    });

    it("marks one in progress ⏳", () => {
      for (const s of ["Active", "in-progress", "in-development"]) {
        assert.strictEqual(glyph(req(s)), "⏳", s);
        assert.strictEqual(glyph(feat(s)), "⏳", s);
      }
    });

    it("marks one not implemented yet …", () => {
      for (const s of ["Draft", "Proposed", "Vetted", "Triaged", ""]) {
        assert.strictEqual(glyph(req(s)), "…", s);
        assert.strictEqual(glyph(feat(s)), "…", s);
      }
    });

    it("marks an abandoned one 🗑", () => {
      assert.strictEqual(glyph(req("Abandoned")), "🗑");
      assert.strictEqual(glyph(feat("Abandoned")), "🗑");
    });
  });
});
