import { describe, expect, it, vi } from "vitest";
import {
  downloadModuleZip,
  fetchRemoteUiModules,
  loadLocalSavedModule,
  parseArtifactSourceLocation,
  saveModuleLocally,
  scanModulesFromLocalDirectory,
} from "../remote-module-store.js";
import {
  packageUiModule,
  UiModuleManager,
  type UiModuleManifest,
} from "../ui-module-manager.js";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Keep the suite hermetic: without this, fetchRemoteUiModules shallow-clones
// the real cantica-tech repo before reaching the mocked GitHub API.
vi.mock("node:child_process", () => ({
  execFileSync: () => {
    throw new Error("git is disabled in unit tests");
  },
}));

describe("remote-module-store", () => {
  it("parses various source URL formats cleanly", () => {
    const loc1 = parseArtifactSourceLocation(
      "git@github.com:oliben67/cantica-tech.git/catalyst/",
    );
    expect(loc1.type).toBe("git");
    expect(loc1.owner).toBe("oliben67");
    expect(loc1.repo).toBe("cantica-tech");
    expect(loc1.branch).toBe("main");
    expect(loc1.moduleSubpath).toBe("catalyst/modules");
    expect(loc1.kernelSubpath).toBe("catalyst/kernel");

    // The pre-0.35.0 "framework" release folder still maps onto the kernel.
    const legacy = parseArtifactSourceLocation(
      "git@github.com:oliben67/cantica-tech.git/catalyst/framework/",
    );
    expect(legacy.kernelSubpath).toBe("catalyst/kernel");
    expect(legacy.moduleSubpath).toBe("catalyst/modules");

    const loc2 = parseArtifactSourceLocation(
      "https://github.com/myorg/myrepo/tree/dev/custom-path",
    );
    expect(loc2.type).toBe("github");
    expect(loc2.owner).toBe("myorg");
    expect(loc2.repo).toBe("myrepo");
    expect(loc2.branch).toBe("dev");
    expect(loc2.moduleSubpath).toBe("custom-path/modules");

    const loc3 = parseArtifactSourceLocation(
      "git+https://github.com/myorg/myrepo.git#main:catalyst",
    );
    expect(loc3.type).toBe("git");
    expect(loc3.owner).toBe("myorg");
    expect(loc3.repo).toBe("myrepo");
    expect(loc3.branch).toBe("main");
    expect(loc3.moduleSubpath).toBe("catalyst/modules");

    const loc4 = parseArtifactSourceLocation("/path/to/local/dir");
    expect(loc4.type).toBe("local");
    expect(loc4.localPath).toBe("/path/to/local/dir");
  });

  it("scans modules from local directory without duplicates", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "catalyst-scan-test-"));
    try {
      const vDir = join(
        tmpDir,
        "catalyst",
        "module",
        "software-engineering",
        "v1.0.0",
      );
      mkdirSync(vDir, { recursive: true });

      const manifest: UiModuleManifest = {
        id: "software-engineering",
        name: "Software Engineering Process Module",
        version: "1.0.0",
        kernelVersion: ">=0.34.0",
      };
      writeFileSync(
        join(vDir, "manifest.json"),
        JSON.stringify(manifest),
        "utf8",
      );
      const zipBuf = packageUiModule(manifest);
      writeFileSync(join(vDir, "software-engineering-v1.0.0.zip"), zipBuf);

      const scanned = scanModulesFromLocalDirectory(tmpDir, "catalyst/module");
      expect(scanned.length).toBe(1);
      expect(scanned[0].id).toBe("software-engineering");
      expect(scanned[0].version).toBe("1.0.0");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("downloads module zip from local path and HTTP URL", async () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "catalyst-dl-test-"));
    try {
      const zipPath = join(tmpDir, "test.zip");
      const sampleData = Buffer.from("ZIPDATA");
      writeFileSync(zipPath, sampleData);

      const loadedLocal = await downloadModuleZip(zipPath);
      expect(loadedLocal.toString()).toBe("ZIPDATA");

      const mockFetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () =>
            Promise.resolve(
              sampleData.buffer.slice(
                sampleData.byteOffset,
                sampleData.byteOffset + sampleData.byteLength,
              ),
            ),
        }),
      );

      const loadedHttp = await downloadModuleZip(
        "https://example.com/mod.zip",
        mockFetch as unknown as typeof fetch,
      );
      expect(loadedHttp.toString()).toBe("ZIPDATA");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("fetches remote UI modules from cantica-tech mock tree", async () => {
    const mockTree = {
      tree: [
        {
          path: "catalyst/module/software-engineering/v1.0.0/manifest.json",
          type: "blob",
        },
      ],
    };

    const mockManifest: UiModuleManifest = {
      id: "software-engineering",
      name: "Software Engineering Process Module",
      version: "1.0.0",
      description: "Standard module",
      kernelVersion: ">=0.34.0",
    };

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("api.github.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTree),
        });
      }
      if (url.includes("manifest.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockManifest),
        });
      }
      return Promise.resolve({ ok: false });
    });

    // A repo with no local clone cache, so only the mocked API can answer.
    const modules = await fetchRemoteUiModules(
      "https://github.com/test-owner/test-repo/tree/main/catalyst/",
      mockFetch as unknown as typeof fetch,
    );
    expect(modules.length).toBe(1);
    expect(modules[0].id).toBe("software-engineering");
    expect(modules[0].version).toBe("1.0.0");
  });

  it("saves module locally and loads it automatically", () => {
    const tmpFolder = mkdtempSync(join(tmpdir(), "catalyst-test-store-"));
    try {
      const manifest: UiModuleManifest = {
        id: "test-module",
        name: "Test Module",
        version: "1.0.0",
        kernelVersion: ">=0.33.0",
      };
      const zipBuf = packageUiModule(manifest);

      const savedPath = saveModuleLocally(tmpFolder, zipBuf);
      expect(savedPath).toContain("active-module.zip");

      const manager = new UiModuleManager();
      const res = loadLocalSavedModule(tmpFolder, manager, "0.34.0");

      expect(res).not.toBeNull();
      expect(res?.success).toBe(true);
      if (res?.success) {
        expect(res.module.manifest.id).toBe("test-module");
      }
      expect(manager.getActiveModule()?.manifest.id).toBe("test-module");
    } finally {
      rmSync(tmpFolder, { recursive: true, force: true });
    }
  });
});
