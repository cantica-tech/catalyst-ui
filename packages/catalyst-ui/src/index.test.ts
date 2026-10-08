import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { VERSION } from "./index.js";

describe("catalyst-ui scaffold", () => {
  it("exposes a version", () => {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    );
    expect(VERSION).toBe(pkg.version);
  });
});
