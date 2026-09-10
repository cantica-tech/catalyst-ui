import { describe, expect, it } from "vitest";

import { compareVersions } from "../versioning.js";

describe("compareVersions", () => {
  it("returns 0 for equal versions", () => {
    expect(compareVersions("0.19.0", "0.19.0")).toBe(0);
  });

  it("returns negative when the first version is lower", () => {
    expect(compareVersions("0.18.0", "0.19.0")).toBeLessThan(0);
  });

  it("returns positive when the first version is higher", () => {
    expect(compareVersions("0.19.0", "0.18.0")).toBeGreaterThan(0);
  });

  it("compares numerically, not lexically", () => {
    // A plain string compare would put "0.9.0" after "0.10.0".
    expect(compareVersions("0.9.0", "0.10.0")).toBeLessThan(0);
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
  });

  it("treats a missing trailing segment as 0", () => {
    expect(compareVersions("0.19", "0.19.0")).toBe(0);
    expect(compareVersions("0.19.0", "0.19")).toBe(0);
  });

  it("compares the first differing segment, ignoring the rest", () => {
    expect(compareVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
  });
});
