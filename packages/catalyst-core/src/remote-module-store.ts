import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  UiModuleManager,
  type UiModuleLoadResult,
  type UiModuleManifest,
} from "./ui-module-manager.js";

export interface RemoteModuleInfo {
  id: string;
  name: string;
  version: string;
  description?: string;
  frameworkVersion: string;
  downloadUrl: string;
}

export interface ArtifactSourceLocation {
  type: "github" | "raw-http" | "git";
  owner: string;
  repo: string;
  branch: string;
  subpath: string;
  moduleSubpath: string;
  frameworkSubpath: string;
  rawBaseUrl: string;
  apiTreeUrl: string;
}

export const DEFAULT_MODULE_SOURCE_URL =
  "git@github.com:oliben67/cantica-tech.git/catalyst/";

export const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/oliben67/cantica-tech/main/catalyst/module";
export const GITHUB_API_TREE_URL =
  "https://api.github.com/repos/oliben67/cantica-tech/git/trees/main?recursive=1";

/**
 * Parses a module or framework source location string (Git SSH URL with path,
 * GitHub web URL, raw GitHub URL, or standard VCS URI) into a structured location.
 */
export function parseArtifactSourceLocation(
  sourceUrl: string = DEFAULT_MODULE_SOURCE_URL,
): ArtifactSourceLocation {
  const trimmed = sourceUrl.trim();
  let owner = "oliben67";
  let repo = "cantica-tech";
  let branch = "main";
  let subpath = "catalyst";
  let type: "github" | "raw-http" | "git" = "git";

  // 1. Git SSH syntax: git@github.com:owner/repo.git/subpath or git@github.com:owner/repo/subpath
  const gitSshMatch = trimmed.match(
    /^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?(?:\/(.*))?$/,
  );
  if (gitSshMatch) {
    type = "git";
    owner = gitSshMatch[2];
    repo = gitSshMatch[3];
    const rawPath = (gitSshMatch[4] || "").replace(/\/+$/, "");
    if (rawPath) subpath = rawPath;
  }
  // 2. Standard VCS URI: git+https://github.com/owner/repo.git#branch:path
  else if (trimmed.startsWith("git+")) {
    type = "git";
    const vcsMatch = trimmed.match(
      /^git\+(?:https?|ssh):\/\/(?:[^@]+@)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:#(.*?))?$/,
    );
    if (vcsMatch) {
      owner = vcsMatch[1];
      repo = vcsMatch[2];
      const fragment = vcsMatch[3] || "";
      if (fragment.includes(":")) {
        const [b, p] = fragment.split(":");
        if (b) branch = b;
        if (p) subpath = p.replace(/\/+$/, "");
      } else if (fragment) {
        branch = fragment;
      }
    }
  }
  // 3. Raw GitHub HTTP URL: https://raw.githubusercontent.com/owner/repo/branch/subpath
  else if (trimmed.includes("raw.githubusercontent.com")) {
    type = "raw-http";
    const rawMatch = trimmed.match(
      /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(.*))?$/,
    );
    if (rawMatch) {
      owner = rawMatch[1];
      repo = rawMatch[2];
      branch = rawMatch[3];
      const rawPath = (rawMatch[4] || "").replace(/\/+$/, "");
      if (rawPath) subpath = rawPath;
    }
  }
  // 4. GitHub Web URL: https://github.com/owner/repo/tree/branch/subpath
  else if (trimmed.includes("github.com")) {
    type = "github";
    const ghMatch = trimmed.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/(.*))?$/,
    );
    if (ghMatch) {
      owner = ghMatch[1];
      repo = ghMatch[2];
      if (ghMatch[3]) branch = ghMatch[3];
      const rawPath = (ghMatch[4] || "").replace(/\/+$/, "");
      if (rawPath) subpath = rawPath;
    }
  }

  // Normalize subpath slashes
  subpath = subpath.replace(/^\/+|\/+$/g, "");
  if (!subpath) subpath = "catalyst";

  const moduleSubpath = subpath.endsWith("module")
    ? subpath
    : subpath.endsWith("framework")
      ? subpath.replace(/framework$/, "module")
      : `${subpath}/module`;

  const frameworkSubpath = subpath.endsWith("framework")
    ? subpath
    : subpath.endsWith("module")
      ? subpath.replace(/module$/, "framework")
      : `${subpath}/framework`;

  const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
  const apiTreeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;

  return {
    type,
    owner,
    repo,
    branch,
    subpath,
    moduleSubpath,
    frameworkSubpath,
    rawBaseUrl,
    apiTreeUrl,
  };
}

/**
 * Fetches available UI modules from the configured module source URL
 * by listing the remote directory structure via GitHub REST API / raw contents.
 */
export async function fetchRemoteUiModules(
  sourceUrlOrFetch?: string | typeof fetch,
  fetchFnArg?: typeof fetch,
): Promise<RemoteModuleInfo[]> {
  let sourceUrl = DEFAULT_MODULE_SOURCE_URL;
  let fetchFn: typeof fetch = globalThis.fetch;

  if (typeof sourceUrlOrFetch === "string") {
    sourceUrl = sourceUrlOrFetch;
    if (fetchFnArg) fetchFn = fetchFnArg;
  } else if (typeof sourceUrlOrFetch === "function") {
    fetchFn = sourceUrlOrFetch;
  }

  const loc = parseArtifactSourceLocation(sourceUrl);

  try {
    const res = await fetchFn(loc.apiTreeUrl, {
      headers: { "User-Agent": "Catalyst-UI-Extension" },
    });
    if (!res.ok) {
      throw new Error(`GitHub API returned HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      tree?: Array<{ path: string; type: string }>;
    };
    if (!data.tree) return [];

    const prefix = `${loc.moduleSubpath}/`;

    // Filter paths matching <moduleSubpath>/<module_id>/<vX.Y.Z>/manifest.json
    const manifestPaths = data.tree
      .map((item) => item.path)
      .filter((p) => p.startsWith(prefix) && p.endsWith("/manifest.json"));

    const zipFiles = new Map<string, string>();
    for (const item of data.tree) {
      if (item.path.startsWith(prefix) && item.path.endsWith(".zip")) {
        const dir = item.path.substring(0, item.path.lastIndexOf("/"));
        zipFiles.set(dir, item.path);
      }
    }

    const modules: RemoteModuleInfo[] = [];

    for (const manifestPath of manifestPaths) {
      const dir = manifestPath.substring(0, manifestPath.lastIndexOf("/"));
      const relative = manifestPath.slice(prefix.length);
      const parts = relative.split("/");
      if (parts.length === 3) {
        const moduleId = parts[0];
        const versionDir = parts[1]; // v1.0.0
        const rawUrl = `${loc.rawBaseUrl}/${manifestPath}`;
        let zipUrl = `${loc.rawBaseUrl}/${loc.moduleSubpath}/${moduleId}/${versionDir}/${moduleId}-${versionDir}.zip`;

        if (zipFiles.has(dir)) {
          zipUrl = `${loc.rawBaseUrl}/${zipFiles.get(dir)}`;
        }

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
  } catch {
    // Return empty list if network/API unavailable
    return [];
  }
}

/**
 * Persists the active UI module zip buffer locally to globalStorageUri.
 */
export function saveModuleLocally(
  storageDir: string,
  zipBuffer: Buffer,
): string {
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
  currentFrameworkVersion: string,
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
