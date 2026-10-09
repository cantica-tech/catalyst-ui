import { describe, expect, it } from "vitest";

import { branchSafeName, suggestCriterionBranch } from "../criterion.js";

describe("branchSafeName", () => {
  it("lowercases and hyphenates a display name", () => {
    expect(branchSafeName("Olivier Steck")).toBe("olivier-steck");
  });

  it("collapses a run of non-alphanumeric characters to a single hyphen", () => {
    expect(branchSafeName("Jean--Pierre  O'Neil")).toBe("jean-pierre-o-neil");
  });

  it("trims leading and trailing hyphens", () => {
    expect(branchSafeName("--Ada--")).toBe("ada");
  });

  it("leaves an already branch-safe name unchanged", () => {
    expect(branchSafeName("ada-lovelace")).toBe("ada-lovelace");
  });

  it("handles a purely numeric or alphanumeric name", () => {
    expect(branchSafeName("Agent007")).toBe("agent007");
  });
});

describe("suggestCriterionBranch", () => {
  it("appends .criterion to the branch-safe name", () => {
    expect(suggestCriterionBranch("Olivier Steck")).toBe("olivier-steck.criterion");
  });
});
