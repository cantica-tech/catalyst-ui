import { describe, expect, it, vi } from "vitest";
import {
  fetchRemoteUiModules,
  loadLocalSavedModule,
  parseArtifactSourceLocation,
  saveModuleLocally,
} from "../remote-module-store.js";
import {
  packageUiModule,
  UiModuleManager,
  type UiModuleManifest,
} from "../ui-module-manager.js";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

describe("remote-module-store", () => {
  it("parses various source URL formats cleanly", () => {
    const loc1 = parseArtifactSourceLocation(
      "git@github.com:oliben67/cantica-tech.git/catalyst/",
    );
    expect(loc1.type).toBe("git");
    expect(loc1.owner).toBe("oliben67");
    expect(loc1.repo).toBe("cantica-tech");
    expect(loc1.branch).toBe("main");
    expect(loc1.moduleSubpath).toBe("catalyst/module");
    expect(loc1.frameworkSubpath).toBe("catalyst/framework");

    const loc2 = parseArtifactSourceLocation(
      "https://github.com/myorg/myrepo/tree/dev/custom-path",
    );
    expect(loc2.type).toBe("github");
    expect(loc2.owner).toBe("myorg");
    expect(loc2.repo).toBe("myrepo");
    expect(loc2.branch).toBe("dev");
    expect(loc2.moduleSubpath).toBe("custom-path/module");

    const loc3 = parseArtifactSourceLocation(
      "git+https://github.com/myorg/myrepo.git#main:catalyst",
    );
    expect(loc3.type).toBe("git");
    expect(loc3.owner).toBe("myorg");
    expect(loc3.repo).toBe("myrepo");
    expect(loc3.branch).toBe("main");
    expect(loc3.moduleSubpath).toBe("catalyst/module");
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
      frameworkVersion: ">=0.34.0",
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

    const modules = await fetchRemoteUiModules(
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
        frameworkVersion: ">=0.33.0",
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
