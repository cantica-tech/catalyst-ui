import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("catalyst-ui scaffold", () => {
  it("exposes a version", () => {
    expect(VERSION).toBe("0.3.0");
  });
});
