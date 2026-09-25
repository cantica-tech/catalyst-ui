import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseUiModuleFromZip, UiModuleManager, type UiModuleLoadResult, type UiModuleManifest } from "./ui-module-manager.js";

export interface RemoteModuleInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  frameworkVersion: string;
  downloadUrl: string;
}

export const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/oliben67/cantica-tech/main/catalyst/module";
export const GITHUB_API_TREE_URL = "https://api.github.com/repos/oliben67/cantica-tech/git/trees/main?recursive=1";

/**
 * Fetches available UI modules from git@github.com:oliben67/cantica-tech.git
 * by listing the remote directory structure via GitHub REST API / raw contents.
 */
export async function fetchRemoteUiModules(
  fetchFn: typeof fetch = globalThis.fetch
): Promise<RemoteModuleInfo[]> {
  try {
    const res = await fetchFn(GITHUB_API_TREE_URL, {
      headers: { "User-Agent": "Catalyst-UI-Extension" },
    });
    if (!res.ok) {
      throw new Error(`GitHub API returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as { tree?: Array<{ path: string; type: string }> };
    if (!data.tree) return [];

    // Filter paths matching catalyst/module/<module_id>/<vX.Y.Z>/manifest.json
    const manifestPaths = data.tree
      .map((item) => item.path)
      .filter((p) => p.startsWith("catalyst/module/") && p.endsWith("/manifest.json"));

    const modules: RemoteModuleInfo[] = [];

    for (const manifestPath of manifestPaths) {
      // catalyst/module/software-engineering/v1.0.0/manifest.json
      const parts = manifestPath.split("/");
      if (parts.length === 5) {
        const moduleId = parts[2];
        const versionDir = parts[3]; // v1.0.0
        const rawUrl = `${GITHUB_RAW_BASE}/${moduleId}/${versionDir}/manifest.json`;
        const zipUrl = `${GITHUB_RAW_BASE}/${moduleId}/${versionDir}/${moduleId}-${versionDir}.zip`;

        try {
          const mRes = await fetchFn(rawUrl, {
            headers: { "User-Agent": "Catalyst-UI-Extension" },
          });
          if (mRes.ok) {
            const json = (await mRes.json()) as Partial<UiModuleManifest>;
            if (json.id && json.version && json.frameworkVersion) {
              modules.push({
                id: json.id,
                name: json.name || json.id,
                version: json.version,
                description: json.description,
                frameworkVersion: json.frameworkVersion,
                downloadUrl: zipUrl,
              });
            }
          }
        } catch {
          // ignore single manifest fetch failure
        }
      }
    }

    return modules;
  } catch (err) {
    // Return empty list if network/API unavailable
    return [];
  }
}

/**
 * Persists the active UI module zip buffer locally to globalStorageUri.
 */
export function saveModuleLocally(storageDir: string, zipBuffer: Buffer): string {
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }
  const filePath = join(storageDir, "active-module.zip");
  writeFileSync(filePath, zipBuffer);
  return filePath;
}

/**
 * Loads the locally persisted UI module zip if present.
 */
export function loadLocalSavedModule(
  storageDir: string,
  manager: UiModuleManager,
  currentFrameworkVersion: string
): UiModuleLoadResult | null {
  const filePath = join(storageDir, "active-module.zip");
  if (!existsSync(filePath)) return null;

  try {
    const buffer = readFileSync(filePath);
    return manager.loadAndActivateZipModule(buffer, currentFrameworkVersion);
  } catch (err) {
    return {
      success: false,
      error: `Failed to load saved local module: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
