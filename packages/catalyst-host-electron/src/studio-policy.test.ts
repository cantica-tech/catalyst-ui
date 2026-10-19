import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { bundledCatalyst, serveFailure, staysOn, studioBundle } from "./studio-policy.js";

describe("the desktop Studio's window (R6.20)", () => {
  it("stays on its own server: any other origin, or a bad URL, is refused", () => {
    const page = "http://127.0.0.1:51234/?token=abc";
    expect(staysOn(page, "http://127.0.0.1:51234/#/rules")).toBe(true);
    expect(staysOn(page, "http://127.0.0.1:9999/")).toBe(false);
    expect(staysOn(page, "https://example.com/")).toBe(false);
    expect(staysOn(page, "file:///etc/passwd")).toBe(false);
    expect(staysOn(page, "not a url")).toBe(false);
  });

  it("finds the Studio bundle the package ships, and none when it is not built", () => {
    const pkg = mkdtempSync(join(tmpdir(), "studio-"));
    writeFileSync(join(pkg, "package.json"), "{}");
    const resolve = () => join(pkg, "package.json");
    expect(studioBundle(resolve)).toBeNull();
    mkdirSync(join(pkg, "dist", "web"), { recursive: true });
    writeFileSync(join(pkg, "dist", "web", "index.html"), "<!doctype html>");
    expect(studioBundle(resolve)).toBe(join(pkg, "dist", "web"));
    expect(
      studioBundle(() => {
        throw new Error("not installed");
      }),
    ).toBeNull();
  });

  it("finds the catalyst the packaged app ships, and none without it", () => {
    const resources = mkdtempSync(join(tmpdir(), "resources-"));
    expect(bundledCatalyst(resources)).toBeNull();
    expect(bundledCatalyst(undefined)).toBeNull();
    mkdirSync(join(resources, "catalyst"));
    writeFileSync(join(resources, "catalyst", "catalyst.pyz"), "");
    expect(bundledCatalyst(resources)).toBe(join(resources, "catalyst", "catalyst.pyz"));
  });

  it("says what to install when catalyst cannot be started at all", () => {
    const missing = new Error("catalyst serve --local: spawn catalyst ENOENT");
    expect(serveFailure(missing, true)).toContain("needs Python 3.11 or later");
    expect(serveFailure(missing, false)).toContain("it is not installed");
    expect(serveFailure(new Error("exited with 2: no deployment"), true)).toBe(
      "catalyst could not serve the Studio: Error: exited with 2: no deployment",
    );
  });
});
