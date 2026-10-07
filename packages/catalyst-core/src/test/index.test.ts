import { describe, expect, it } from "vitest";
import { VERSION } from "../index.js";

describe("catalyst-core scaffold", () => {
  it("exposes a version", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
