import { describe, expect, it } from "vitest";
import { satisfiesUvVersionSpecifier } from "../versioning.js";
import {
  createZipArchive,
  readZipArchive,
  packageUiModule,
  parseUiModuleFromZip,
  UiModuleManager,
  type UiModuleManifest,
} from "../ui-module-manager.js";

describe("satisfiesUvVersionSpecifier", () => {
  it("evaluates single clause >= specifiers", () => {
    expect(satisfiesUvVersionSpecifier("0.33.0", ">=0.31.0")).toBe(true);
    expect(satisfiesUvVersionSpecifier("0.30.0", ">=0.31.0")).toBe(false);
  });

  it("evaluates multi-clause comma separated specifiers", () => {
    expect(satisfiesUvVersionSpecifier("0.33.0", ">=0.30.0, <0.40.0")).toBe(true);
    expect(satisfiesUvVersionSpecifier("0.45.0", ">=0.30.0, <0.40.0")).toBe(false);
  });

  it("evaluates compatible release operator ~=", () => {
    expect(satisfiesUvVersionSpecifier("0.33.0", "~=0.33.0")).toBe(true);
    expect(satisfiesUvVersionSpecifier("0.33.5", "~=0.33.0")).toBe(true);
    expect(satisfiesUvVersionSpecifier("0.34.0", "~=0.33.0")).toBe(false);
  });
});

describe("Zip Archiving & Parsing", () => {
  it("packs and unpacks zip files accurately", () => {
    const files = new Map<string, Buffer | string>();
    files.set("hello.txt", "Hello World!");
    files.set("sub/data.json", JSON.stringify({ a: 1 }));

    const zipBuffer = createZipArchive(files);
    const unzipped = readZipArchive(zipBuffer);

    expect(unzipped.has("hello.txt")).toBe(true);
    expect(unzipped.get("hello.txt")!.toString("utf8")).toBe("Hello World!");
    expect(unzipped.has("sub/data.json")).toBe(true);
  });

  it("packages and parses UI modules from zip", () => {
    const manifest: UiModuleManifest = {
      id: "software-engineering-ui",
      name: "Software Engineering UI",
      version: "1.0.0",
      frameworkVersion: ">=0.33.0",
      entry: "dist/index.js",
    };

    const codeFiles = new Map<string, string>();
    codeFiles.set("dist/index.js", "console.log('UI module');");

    const zipBuffer = packageUiModule(manifest, codeFiles);
    const parsed = parseUiModuleFromZip(zipBuffer);

    expect(parsed.manifest.id).toBe("software-engineering-ui");
    expect(parsed.manifest.frameworkVersion).toBe(">=0.33.0");
    expect(parsed.files.has("dist/index.js")).toBe(true);
  });
});

describe("UiModuleManager", () => {
  const manager = new UiModuleManager();
  const manifestA: UiModuleManifest = {
    id: "module-a",
    name: "Module A",
    version: "1.0.0",
    frameworkVersion: ">=0.30.0",
  };
  const manifestB: UiModuleManifest = {
    id: "module-b",
    name: "Module B",
    version: "2.0.0",
    frameworkVersion: ">=0.33.0",
  };

  it("loads and activates compatible module zip", () => {
    const zipA = packageUiModule(manifestA);
    const res = manager.loadAndActivateZipModule(zipA, "0.33.0");

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.module.manifest.id).toBe("module-a");
    }
    expect(manager.getActiveModule()?.manifest.id).toBe("module-a");
  });

  it("rejects incompatible framework version", () => {
    const zipB = packageUiModule(manifestB);
    const res = manager.loadAndActivateZipModule(zipB, "0.31.0");

    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain("requires catalyst framework \">=0.33.0\"");
    }
    // Active module remains unchanged
    expect(manager.getActiveModule()?.manifest.id).toBe("module-a");
  });

  it("enforces ONLY ONE loaded/active module at a time", () => {
    const zipB = packageUiModule(manifestB);
    const res = manager.loadAndActivateZipModule(zipB, "0.33.0");

    expect(res.success).toBe(true);
    // Deactivated module-a, now active module is module-b
    expect(manager.getActiveModule()?.manifest.id).toBe("module-b");
  });
});
