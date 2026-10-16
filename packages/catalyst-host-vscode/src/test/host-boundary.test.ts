import * as assert from "assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname, "..", "..", "src");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "vscode" || name === "test" ? [] : sources(path);
    return name.endsWith(".ts") ? [path] : [];
  });
}

describe("the host boundary (catalyst roadmap R6.1)", () => {
  it("imports vscode only in src/vscode/ and the extension's entry point", () => {
    const leaks = sources(SRC)
      .filter((file) => relative(SRC, file) !== "extension.ts")
      .filter((file) => readFileSync(file, "utf8").includes('from "vscode"'))
      .map((file) => relative(SRC, file));
    assert.deepStrictEqual(leaks, []);
  });
});
