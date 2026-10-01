import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  findDeployments,
  governs,
  isIgnoredFolder,
  optedOut,
  owningDeployment,
} from "../workspace.js";

let root: string;

function write(rel: string, text = ""): string {
  const file = join(root, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, text);
  return file;
}

function layout(): void {
  root = mkdtempSync(join(tmpdir(), "catalyst-ws-"));
  write("app.catalyst", "{}");
  write(".catalystignore", "vendor\n# comment\n");
  write("src/a.ts");
  write("vendor/lib.ts");
  write("legacy/.catalystignore", "# outside catalyst\n");
  write("legacy/old.ts");
  write("legacy/inner/x.catalyst", "{}");
  write("services/pay/pay.catalyst", "{}");
  write("services/pay/src/p.ts");
  write("node_modules/dep/dep.catalyst", "{}");
  write("other/o.ts");
}

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("workspace scope (REQ-000015)", () => {
  it("finds every deployment, nested ones included, never skipped or opted-out ones", () => {
    layout();
    expect(findDeployments(root, "ws")).toEqual([
      { projectRoot: root, name: "ws" },
      { projectRoot: join(root, "services", "pay"), name: "ws/services/pay" },
    ]);
    expect(findDeployments(root, "ws", { ignored: ["services"] })).toEqual([
      { projectRoot: root, name: "ws" },
    ]);
    expect(findDeployments(root, "ws", { maxDepth: 1 })).toEqual([
      { projectRoot: root, name: "ws" },
    ]);
  });

  it("applies the kernel's rule: nested deployments and .catalystignore", () => {
    layout();
    expect(governs(root, join(root, "src", "a.ts"))).toBe(true);
    expect(governs(root, join(root, "services", "pay", "src", "p.ts"))).toBe(
      false,
    );
    expect(
      governs(
        join(root, "services", "pay"),
        join(root, "services", "pay", "src", "p.ts"),
      ),
    ).toBe(true);
    expect(governs(root, join(root, "vendor", "lib.ts"))).toBe(false);
    expect(governs(root, join(root, "legacy", "old.ts"))).toBe(false);
    expect(governs(root, join(root, ".criterion", "x.md"))).toBe(false);
    expect(governs(root, join(root, "..", "elsewhere.ts"))).toBe(false);
    expect(optedOut(join(root, "legacy", "inner"))).toBe(true);
    expect(optedOut(join(root, "vendor"))).toBe(true);
    expect(optedOut(join(root, "src"))).toBe(false);
  });

  it("names the deployment owning a file", () => {
    layout();
    const roots = [root, join(root, "services", "pay")];
    expect(
      owningDeployment(roots, join(root, "services", "pay", "src", "p.ts")),
    ).toBe(join(root, "services", "pay"));
    expect(owningDeployment(roots, join(root, "src", "a.ts"))).toBe(root);
    expect(owningDeployment(roots, join(root, "legacy", "old.ts"))).toBeNull();
    expect(owningDeployment(roots, join(tmpdir(), "nowhere.ts"))).toBeNull();
  });

  it("matches ignored folders, relative or absolute", () => {
    layout();
    expect(
      isIgnoredFolder(join(root, "services", "pay"), ["services"], root),
    ).toBe(true);
    expect(
      isIgnoredFolder(
        join(root, "services", "pay"),
        [join(root, "services", "pay")],
        root,
      ),
    ).toBe(true);
    expect(isIgnoredFolder(join(root, "servicesX"), ["services"], root)).toBe(
      false,
    );
    expect(isIgnoredFolder(root, ["", "  "], root)).toBe(false);
  });
});
