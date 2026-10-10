import { describe, expect, it } from "vitest";

import { compareVersions, parseVersionSpecifier, satisfiesVersionSpecifier } from "../versioning.js";

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

describe("parseVersionSpecifier", () => {
  it("parses each supported operator", () => {
    expect(parseVersionSpecifier(">=0.31.0")).toEqual({
      operator: ">=",
      version: "0.31.0",
    });
    expect(parseVersionSpecifier("<=0.31.0")).toEqual({
      operator: "<=",
      version: "0.31.0",
    });
    expect(parseVersionSpecifier("==0.31.0")).toEqual({
      operator: "==",
      version: "0.31.0",
    });
    expect(parseVersionSpecifier("!=0.31.0")).toEqual({
      operator: "!=",
      version: "0.31.0",
    });
    expect(parseVersionSpecifier(">0.31.0")).toEqual({
      operator: ">",
      version: "0.31.0",
    });
    expect(parseVersionSpecifier("<0.31.0")).toEqual({
      operator: "<",
      version: "0.31.0",
    });
  });

  it("does not mistake >= for > (longer operators checked first)", () => {
    expect(parseVersionSpecifier(">=0.31.0").operator).toBe(">=");
  });

  it("tolerates surrounding/inner whitespace", () => {
    expect(parseVersionSpecifier("  >= 0.31.0  ")).toEqual({
      operator: ">=",
      version: "0.31.0",
    });
  });

  it("throws on a specifier with no recognized operator", () => {
    expect(() => parseVersionSpecifier("0.31.0")).toThrow(/Invalid version specifier/);
  });

  it("throws on an operator with no version", () => {
    expect(() => parseVersionSpecifier(">=")).toThrow(/Invalid version specifier/);
  });
});

describe("satisfiesVersionSpecifier", () => {
  it("evaluates >= correctly", () => {
    expect(satisfiesVersionSpecifier("0.31.0", ">=0.31.0")).toBe(true);
    expect(satisfiesVersionSpecifier("0.32.0", ">=0.31.0")).toBe(true);
    expect(satisfiesVersionSpecifier("0.30.0", ">=0.31.0")).toBe(false);
  });

  it("evaluates <, >, <=, ==, != correctly", () => {
    expect(satisfiesVersionSpecifier("0.30.0", "<0.31.0")).toBe(true);
    expect(satisfiesVersionSpecifier("0.31.0", "<0.31.0")).toBe(false);
    expect(satisfiesVersionSpecifier("0.32.0", ">0.31.0")).toBe(true);
    expect(satisfiesVersionSpecifier("0.31.0", "<=0.31.0")).toBe(true);
    expect(satisfiesVersionSpecifier("0.31.0", "==0.31.0")).toBe(true);
    expect(satisfiesVersionSpecifier("0.31.0", "!=0.31.0")).toBe(false);
  });
});
