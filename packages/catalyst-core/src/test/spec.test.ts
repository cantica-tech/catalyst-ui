import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PACKAGE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("the types generated from catalyst's spec/ (R6.50)", () => {
  it("are what the vendored schemas generate: never edited by hand, never stale", () => {
    const out = execFileSync(process.execPath, [join(PACKAGE, "scripts", "spec.mjs"), "check"], { encoding: "utf8" });
    expect(out).toContain("matches");
  });

  it("name the kernel release the schemas were vendored from", () => {
    const kernel = readFileSync(join(PACKAGE, "spec", "KERNEL"), "utf8").trim();
    expect(kernel).toMatch(/^\d+\.\d+\.\d+$/);
    expect(readFileSync(join(PACKAGE, "src", "spec.ts"), "utf8")).toContain(`from catalyst ${kernel}'s`);
  });
});
