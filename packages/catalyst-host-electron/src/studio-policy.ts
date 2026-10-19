import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * The Studio's built page: in a packaged app, the `studio` resource beside it
 * (electron-builder's `extraResources`); in a checkout, the catalyst-studio
 * package's build.
 */
export function studioBundle(
  resolve: (id: string) => string = require.resolve,
  resources: string | undefined = (process as { resourcesPath?: string }).resourcesPath,
): string | null {
  if (resources && existsSync(join(resources, "studio", "index.html"))) return join(resources, "studio");
  try {
    const dir = join(dirname(resolve("catalyst-studio/package.json")), "dist", "web");
    return existsSync(join(dir, "index.html")) ? dir : null;
  } catch {
    return null;
  }
}

/**
 * The catalyst CLI shipped inside a packaged app (R6.20): the `catalyst`
 * resource's `catalyst.pyz`, which the release build downloads from the
 * kernel's release. Null in a checkout, or when the build had none.
 */
export function bundledCatalyst(
  resources: string | undefined = (process as { resourcesPath?: string }).resourcesPath,
): string | null {
  const pyz = resources ? join(resources, "catalyst", "catalyst.pyz") : null;
  return pyz && existsSync(pyz) ? pyz : null;
}

/**
 * What the person reads when catalyst cannot be started: when it is not
 * found at all, what to install (R6.20: the app's own copy needs Python 3.11
 * or later).
 */
export function serveFailure(err: unknown, shipped: boolean = bundledCatalyst() !== null): string {
  const text = String(err);
  if (!text.includes("ENOENT")) return `catalyst could not serve the Studio: ${text}`;
  return shipped
    ? "catalyst could not be started: this app carries its own catalyst, which needs Python 3.11 or later on the PATH; install one, or install catalyst itself."
    : "catalyst could not be started: it is not installed (the catalyst command, or ~/.catalyst/bin/catalyst).";
}

/** Whether a navigation stays on the Studio's own server: the page never leaves it. */
export function staysOn(server: string, target: string): boolean {
  try {
    return new URL(target).origin === new URL(server).origin;
  } catch {
    return false;
  }
}
