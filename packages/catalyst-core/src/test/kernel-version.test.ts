import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { REQUIRED_KERNEL_VERSION } from "../discover.js";
import { VERSION } from "../index.js";
import {
  KERNEL_VERSION_FLOOR,
  VERIFIED_KERNEL_VERSION,
  kernelSyncTarget,
  restoreKernelVersion,
} from "../kernel-version.js";
import { compareVersions, satisfiesVersionSpecifier } from "../versioning.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..");
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

describe("kernel version: one source of truth (B-07/B-08/B-09)", () => {
  it("states the required range from the floor", () => {
    expect(REQUIRED_KERNEL_VERSION).toBe(`>=${KERNEL_VERSION_FLOOR}`);
  });

  it("matches the VS Code host's declared catalyst.kernelVersion", () => {
    const host = readJson(join(repoRoot, "packages", "catalyst-host-vscode", "package.json"));
    expect(host.catalyst.kernelVersion).toBe(REQUIRED_KERNEL_VERSION);
  });

  it("verifies at least the floor it requires", () => {
    expect(satisfiesVersionSpecifier(VERIFIED_KERNEL_VERSION, REQUIRED_KERNEL_VERSION)).toBe(true);
  });

  it("never offers a sync to a version at or below the deployed one", () => {
    expect(kernelSyncTarget(VERIFIED_KERNEL_VERSION)).toBeNull();
    expect(kernelSyncTarget("9.0.0")).toBeNull();
    expect(kernelSyncTarget(null)).toBeNull();
    const target = kernelSyncTarget("0.10.0");
    expect(target).toBe(VERIFIED_KERNEL_VERSION);
    expect(compareVersions(target!, "0.10.0")).toBeGreaterThan(0);
  });

  it("restores a saved module against a version, never a range", () => {
    expect(restoreKernelVersion([null, "0.46.1"])).toBe("0.46.1");
    expect(restoreKernelVersion([])).toBe(KERNEL_VERSION_FLOOR);
    expect(restoreKernelVersion([])).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("package VERSION constant", () => {
  it("is the package's own version (version.txt is the release source)", () => {
    const pkg = readJson(join(repoRoot, "packages", "catalyst-core", "package.json"));
    expect(VERSION).toBe(pkg.version);
    expect(readFileSync(join(repoRoot, "version.txt"), "utf8").trim()).toBe(pkg.version);
  });
});
