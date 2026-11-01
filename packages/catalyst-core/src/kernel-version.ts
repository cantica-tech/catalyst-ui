import { compareVersions } from "./versioning.js";

/**
 * The one place the catalyst kernel versions this build depends on are
 * written (B-07/B-08/B-09). Everything else — `REQUIRED_KERNEL_VERSION`,
 * the VS Code host's sync offer and module restore, the webview header —
 * derives from these two constants; `catalyst-host-vscode/package.json`
 * `catalyst.kernelVersion` must equal `REQUIRED_KERNEL_VERSION` (a test
 * checks it). `VERIFIED_KERNEL_VERSION` is the kernel each UI release is
 * paired with and tested against: raise it with every paired kernel — a
 * test fails while it is older than the desktop app's
 * `catalyst-host-electron/catalyst-version.txt` (`task release:checklist`).
 */

/** Oldest kernel this build parses correctly. */
export const KERNEL_VERSION_FLOOR = "0.54.0";

/**
 * Newest kernel this build has been verified against — the only version a
 * deployment is ever offered a sync to. Never below the floor.
 */
export const VERIFIED_KERNEL_VERSION = "0.121.0";

/**
 * The version to offer a deployment on `deployed` a sync to, or `null`
 * when there is nothing to offer: unknown version (can't compare), or
 * already at/above what this build was verified against — so the offer
 * can never ask for a downgrade.
 */
export function kernelSyncTarget(deployed: string | null): string | null {
  if (!deployed) return null;
  return compareVersions(deployed, VERIFIED_KERNEL_VERSION) < 0 ? VERIFIED_KERNEL_VERSION : null;
}

/**
 * The kernel version to check a UI module against — at activation (a saved
 * module), and when one is loaded or switched: the first resolved
 * deployment's own `version.txt`, else the kernel this build is verified
 * against — always a plain version, never a range string, and never the
 * floor, which current modules require more than.
 */
export function restoreKernelVersion(deployedVersions: Iterable<string | null>): string {
  for (const v of deployedVersions) if (v) return v;
  return VERIFIED_KERNEL_VERSION;
}
