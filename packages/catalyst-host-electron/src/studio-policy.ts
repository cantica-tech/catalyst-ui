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

/** Whether a navigation stays on the Studio's own server: the page never leaves it. */
export function staysOn(server: string, target: string): boolean {
  try {
    return new URL(target).origin === new URL(server).origin;
  } catch {
    return false;
  }
}
