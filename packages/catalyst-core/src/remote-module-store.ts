import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
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
  type: "git" | "github" | "raw-http" | "local";
  gitUrl?: string;
  localPath?: string;
  owner?: string;
  repo?: string;
  branch: string;
  subpath: string;
  moduleSubpath: string;
  frameworkSubpath: string;
  rawBaseUrl?: string;
  apiTreeUrl?: string;
}

export const DEFAULT_MODULE_SOURCE_URL =
  "git@github.com:oliben67/cantica-tech.git/catalyst/";

export const GITHUB_RAW_BASE =
  "https://raw.githubusercontent.com/oliben67/cantica-tech/main/catalyst/modules";
export const GITHUB_API_TREE_URL =
  "https://api.github.com/repos/oliben67/cantica-tech/git/trees/main?recursive=1";

/**
 * Parses a module or framework source location string (Git SSH URL with path,
 * GitHub web URL, raw GitHub URL, standard VCS URI, or local file path) into a structured location.
 */
export function parseArtifactSourceLocation(
  sourceUrl: string = DEFAULT_MODULE_SOURCE_URL,
): ArtifactSourceLocation {
  const trimmed = sourceUrl.trim();
  let owner: string | undefined;
  let repo: string | undefined;
  let branch = "main";
  let subpath = "catalyst";
  let gitUrl: string | undefined;
  let localPath: string | undefined;
  let type: "git" | "github" | "raw-http" | "local" = "git";

  if (trimmed.startsWith("/") || trimmed.startsWith("file://")) {
    type = "local";
    localPath = trimmed.startsWith("file://") ? trimmed.slice(7) : trimmed;
    subpath = "";
  } else if (trimmed.startsWith("git@")) {
    type = "git";
    const match = trimmed.match(
      /^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?(?:\/(.*))?$/,
    );
    if (match) {
      const host = match[1];
      owner = match[2];
      repo = match[3].replace(/\.git$/, "");
      gitUrl = `git@${host}:${owner}/${repo}.git`;
      const rawPath = (match[4] || "").replace(/\/+$/, "");
      if (rawPath) subpath = rawPath;
    }
  } else if (trimmed.startsWith("git+")) {
    type = "git";
    const vcsMatch = trimmed.match(
      /^git\+(?:https?|ssh):\/\/(?:[^@]+@)?([^/]+)\/([^/]+)\/([^/]+?)(?:\.git)?(?:#(.*?))?$/,
    );
    if (vcsMatch) {
      const host = vcsMatch[1];
      owner = vcsMatch[2];
      repo = vcsMatch[3].replace(/\.git$/, "");
      gitUrl = `https://${host}/${owner}/${repo}.git`;
      const fragment = vcsMatch[4] || "";
      if (fragment.includes(":")) {
        const [b, p] = fragment.split(":");
        if (b) branch = b;
        if (p) subpath = p.replace(/\/+$/, "");
      } else if (fragment) {
        branch = fragment;
      }
    }
  } else if (trimmed.includes("raw.githubusercontent.com")) {
    type = "raw-http";
    const rawMatch = trimmed.match(
      /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)(?:\/(.*))?$/,
    );
    if (rawMatch) {
      owner = rawMatch[1];
      repo = rawMatch[2];
      branch = rawMatch[3];
      gitUrl = `https://github.com/${owner}/${repo}.git`;
      const rawPath = (rawMatch[4] || "").replace(/\/+$/, "");
      if (rawPath) subpath = rawPath;
    }
  } else if (trimmed.includes("github.com")) {
    type = "github";
    const ghMatch = trimmed.match(
      /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+))?(?:\/(.*))?$/,
    );
    if (ghMatch) {
      owner = ghMatch[1];
      repo = ghMatch[2].replace(/\.git$/, "");
      gitUrl = `https://github.com/${owner}/${repo}.git`;
      if (ghMatch[3]) branch = ghMatch[3];
      const rawPath = (ghMatch[4] || "").replace(/\/+$/, "");
      if (rawPath) subpath = rawPath;
    }
  }

  subpath = subpath.replace(/^\/+|\/+$/g, "");
  if (!subpath && type !== "local") subpath = "catalyst";

  const moduleSubpath = subpath.endsWith("modules")
    ? subpath
    : subpath.endsWith("module")
      ? `${subpath}s`
      : subpath.endsWith("framework")
        ? subpath.replace(/framework$/, "modules")
        : subpath
          ? `${subpath}/modules`
          : "modules";

  const frameworkSubpath = subpath.endsWith("framework")
    ? subpath
    : subpath.endsWith("modules")
      ? subpath.replace(/modules$/, "framework")
      : subpath.endsWith("module")
        ? subpath.replace(/module$/, "framework")
        : subpath
          ? `${subpath}/framework`
          : "framework";

  const rawBaseUrl =
    owner && repo
      ? `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`
      : undefined;
  const apiTreeUrl =
    owner && repo
      ? `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
      : undefined;

  return {
    type,
    gitUrl,
    localPath,
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
 * Syncs/clones a git repository to a local cache directory in OS temp.
 */
export function syncGitRepoToCache(
  gitUrl: string,
  branch: string = "main",
): string | null {
  try {
    const hash = createHash("sha256").update(gitUrl).digest("hex").slice(0, 12);
    const cacheDir = join(tmpdir(), "catalyst-git-remotes", hash);

    if (existsSync(join(cacheDir, ".git"))) {
      try {
        execFileSync("git", ["fetch", "--depth=1", "origin", branch], {
          cwd: cacheDir,
          stdio: "ignore",
          timeout: 10000,
        });
        execFileSync("git", ["reset", "--hard", `origin/${branch}`], {
          cwd: cacheDir,
          stdio: "ignore",
          timeout: 5000,
        });
        return cacheDir;
      } catch {
        return cacheDir;
      }
    }

    mkdirSync(join(tmpdir(), "catalyst-git-remotes"), { recursive: true });
    execFileSync(
      "git",
      ["clone", "--depth=1", "-b", branch, gitUrl, cacheDir],
      {
        stdio: "ignore",
        timeout: 15000,
      },
    );
    return cacheDir;
  } catch {
    return null;
  }
}

/**
 * Scans a local directory structure for process module releases and manifests.
 */
export function scanModulesFromLocalDirectory(
  baseDir: string,
  moduleSubpath: string,
): RemoteModuleInfo[] {
  const rawCandidates = [
    join(baseDir, moduleSubpath),
    join(baseDir, moduleSubpath + "s"),
    join(baseDir, "catalyst", "module"),
    join(baseDir, "catalyst", "modules"),
    baseDir,
  ];

  const candidateDirs = Array.from(new Set(rawCandidates));
  const seenKeys = new Set<string>();
  const modules: RemoteModuleInfo[] = [];

  for (const cand of candidateDirs) {
    if (!existsSync(cand)) continue;

    let modDirs: string[] = [];
    try {
      modDirs = readdirSync(cand, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => join(cand, d.name));
    } catch {
      continue;
    }

    for (const modDir of modDirs) {
      let vDirs: string[] = [];
      try {
        vDirs = readdirSync(modDir, { withFileTypes: true })
          .filter((d) => d.isDirectory() && d.name.startsWith("v"))
          .map((d) => join(modDir, d.name));
      } catch {
        continue;
      }

      for (const vDir of vDirs) {
        const manifestPath = join(vDir, "manifest.json");
        if (!existsSync(manifestPath)) continue;

        try {
          const json = JSON.parse(
            readFileSync(manifestPath, "utf8"),
          ) as Partial<UiModuleManifest>;
          if (json.id && json.version && json.frameworkVersion) {
            const key = `${json.id}@${json.version}`;
            if (seenKeys.has(key)) continue;

            const vName = vDir.slice(vDir.lastIndexOf("/") + 1);
            let zipPath = join(vDir, `${json.id}-${vName}.zip`);
            if (!existsSync(zipPath)) {
              // Find any zip file in vDir
              const zips = readdirSync(vDir).filter((f) => f.endsWith(".zip"));
              if (zips.length > 0) {
                zipPath = join(vDir, zips[0]);
              }
            }
            if (existsSync(zipPath)) {
              seenKeys.add(key);
              modules.push({
                id: json.id,
                name: json.name || json.id,
                version: json.version,
                description: json.description,
                frameworkVersion: json.frameworkVersion,
                downloadUrl: zipPath,
              });
            }
          }
        } catch {
          // ignore bad manifest
        }
      }
    }
  }

  return modules;
}

/**
 * Downloads/reads a module zip buffer from a local file path or HTTP URL.
 */
export async function downloadModuleZip(
  downloadUrl: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<Buffer> {
  if (
    downloadUrl.startsWith("file://") ||
    downloadUrl.startsWith("/") ||
    !downloadUrl.startsWith("http")
  ) {
    const cleanPath = downloadUrl.startsWith("file://")
      ? downloadUrl.slice(7)
      : downloadUrl;
    return readFileSync(cleanPath);
  }
  const res = await fetchFn(downloadUrl);
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status} downloading module zip from ${downloadUrl}`,
    );
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Fetches available UI modules from the configured module source URL
 * by trying Git CLI sync, local file scan, and GitHub REST API fallback.
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

  // Strategy 1: Local directory path
  if (loc.type === "local" && loc.localPath && existsSync(loc.localPath)) {
    const localMods = scanModulesFromLocalDirectory(
      loc.localPath,
      loc.moduleSubpath,
    );
    if (localMods.length > 0) return localMods;
  }

  // Strategy 2: Git CLI sync (supports SSH git@github.com:... and HTTPS git URLs)
  if (loc.gitUrl) {
    const cachedDir = syncGitRepoToCache(loc.gitUrl, loc.branch);
    if (cachedDir) {
      const gitMods = scanModulesFromLocalDirectory(
        cachedDir,
        loc.moduleSubpath,
      );
      if (gitMods.length > 0) return gitMods;
    }
  }

  // Strategy 3: GitHub REST API fallback (for public repos when git CLI is unavailable)
  if (loc.apiTreeUrl && loc.rawBaseUrl) {
    try {
      const res = await fetchFn(loc.apiTreeUrl, {
        headers: { "User-Agent": "Catalyst-UI-Extension" },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          tree?: Array<{ path: string; type: string }>;
        };
        if (data.tree) {
          const prefix = `${loc.moduleSubpath}/`;
          const altPrefix = loc.moduleSubpath.endsWith("s")
            ? `${loc.moduleSubpath.slice(0, -1)}/`
            : `${loc.moduleSubpath}s/`;

          const isMatchingPrefix = (p: string) =>
            p.startsWith(prefix) || p.startsWith(altPrefix);

          const manifestPaths = data.tree
            .map((item) => item.path)
            .filter((p) => isMatchingPrefix(p) && p.endsWith("/manifest.json"));

          const zipFiles = new Map<string, string>();
          for (const item of data.tree) {
            if (isMatchingPrefix(item.path) && item.path.endsWith(".zip")) {
              const dir = item.path.substring(0, item.path.lastIndexOf("/"));
              zipFiles.set(dir, item.path);
            }
          }

          const modules: RemoteModuleInfo[] = [];

          for (const manifestPath of manifestPaths) {
            const dir = manifestPath.substring(
              0,
              manifestPath.lastIndexOf("/"),
            );
            const matchedPrefix = manifestPath.startsWith(prefix)
              ? prefix
              : altPrefix;
            const relative = manifestPath.slice(matchedPrefix.length);
            const parts = relative.split("/");
            if (parts.length === 3) {
              const moduleId = parts[0];
              const versionDir = parts[1]; // v1.0.0
              const rawUrl = `${loc.rawBaseUrl}/${manifestPath}`;
              let zipUrl = `${loc.rawBaseUrl}/${matchedPrefix}${moduleId}/${versionDir}/${moduleId}-${versionDir}.zip`;

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

          if (modules.length > 0) return modules;
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
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
