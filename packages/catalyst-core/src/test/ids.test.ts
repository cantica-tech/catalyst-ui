import { describe, expect, it } from "vitest";

import {
  BACKTICK_RULE_ID_RE,
  DEV_ARTIFACT_ID_RE,
  FEATURE_ID_RE,
  ROADMAP_ID_RE,
  RULE_ID_RE,
  collectIdReferences,
  devArtifactType,
  extractIds,
} from "../ids.js";

describe("id patterns", () => {
  it("matches well-formed rule ids", () => {
    expect(RULE_ID_RE.test("env-RUNTIME-001")).toBe(true);
    expect(RULE_ID_RE.test("rr-META-003")).toBe(true);
    expect(RULE_ID_RE.test("br-EVTO-015-1")).toBe(true);
    expect(RULE_ID_RE.test("br-ACCESS_CONTROL-001")).toBe(true);
  });

  it("matches a migrated rule id: 6-digit sequence plus a userid suffix (Rules-of-Rules.md §3/§20)", () => {
    expect(RULE_ID_RE.test("rr-META-000003")).toBe(true);
    expect(RULE_ID_RE.test("rr-META-000003-Ab3xR9pQ")).toBe(true);
    expect(RULE_ID_RE.test("br-EVTO-000015-1-Ab3xR9pQ")).toBe(true);
  });

  it("does not match dev-artifact or feature ids as rule ids", () => {
    expect(RULE_ID_RE.test("REQ-000001")).toBe(false);
    expect(RULE_ID_RE.test("FEAT-000001")).toBe(false);
  });

  it("matches well-formed dev-artifact ids", () => {
    expect(DEV_ARTIFACT_ID_RE.test("REQ-000001")).toBe(true);
    expect(DEV_ARTIFACT_ID_RE.test("BUG-000042")).toBe(true);
    expect(DEV_ARTIFACT_ID_RE.test("HK-000003")).toBe(true);
    expect(DEV_ARTIFACT_ID_RE.test("env-RUNTIME-001")).toBe(false);
  });

  it("matches a dev-artifact id carrying its signer's userid suffix (Rules-of-Rules.md §20)", () => {
    expect(DEV_ARTIFACT_ID_RE.test("REQ-000001-Ab3xR9pQ")).toBe(true);
    expect(DEV_ARTIFACT_ID_RE.test("BUG-000042-Ab3xR9pQ")).toBe(true);
  });

  it("does not mistake an all-lowercase 8-letter summary word for a userid suffix", () => {
    // Every generated userid contains an uppercase letter (rr-META-011) —
    // an old-style, unsuffixed id followed by a lowercase 8-letter word
    // must never be misread as if that word were the suffix.
    expect(DEV_ARTIFACT_ID_RE.test("REQ-000001-database")).toBe(false);
  });

  it("matches well-formed feature ids, with or without a userid suffix", () => {
    expect(FEATURE_ID_RE.test("FEAT-000001")).toBe(true);
    expect(FEATURE_ID_RE.test("FEAT-000001-Ab3xR9pQ")).toBe(true);
    expect(FEATURE_ID_RE.test("REQ-000001")).toBe(false);
  });

  it("matches well-formed roadmap ids, with or without a userid suffix", () => {
    expect(ROADMAP_ID_RE.test("RM-000001")).toBe(true);
    expect(ROADMAP_ID_RE.test("RM-000001-Ab3xR9pQ")).toBe(true);
    expect(ROADMAP_ID_RE.test("REQ-000001")).toBe(false);
    expect(ROADMAP_ID_RE.test("FEAT-000001")).toBe(false);
  });
});

describe("extractIds", () => {
  it("returns every match of a global regex in order", () => {
    const text = "targets `env-RUNTIME-001` and `core-CONTRACT-001`";
    expect(extractIds(text, BACKTICK_RULE_ID_RE)).toEqual(["env-RUNTIME-001", "core-CONTRACT-001"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(extractIds("no ids here", BACKTICK_RULE_ID_RE)).toEqual([]);
  });
});

describe("collectIdReferences", () => {
  it("collects rule, dev-artifact, and feature ids from free text", () => {
    const text = "Targeted by `REQ-000001`, backed by `env-RUNTIME-001`, part of `FEAT-000001`.";
    expect(collectIdReferences(text).sort()).toEqual(["FEAT-000001", "REQ-000001", "env-RUNTIME-001"].sort());
  });

  it("collects a roadmap id, e.g. a feature's own `Roadmap` field citation", () => {
    const text = "**Roadmap:** `RM-000001`";
    expect(collectIdReferences(text)).toEqual(["RM-000001"]);
  });

  it("dedupes repeated citations", () => {
    const text = "`env-RUNTIME-001` ... later again `env-RUNTIME-001`";
    expect(collectIdReferences(text)).toEqual(["env-RUNTIME-001"]);
  });

  it("ignores backtick tokens that are not id-shaped", () => {
    const text = "`create-bug` is a command, `NNN` is a placeholder.";
    expect(collectIdReferences(text)).toEqual([]);
  });
});

describe("devArtifactType", () => {
  it("classifies each dev-artifact prefix", () => {
    expect(devArtifactType("BUG-000001")).toBe("bug");
    expect(devArtifactType("HK-000001")).toBe("house-keeping");
    expect(devArtifactType("REQ-000001")).toBe("requirement");
  });
});
