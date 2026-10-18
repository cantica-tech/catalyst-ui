import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** The Studio's built page, as the catalyst-studio package ships it. */
export function studioBundle(resolve: (id: string) => string = require.resolve): string | null {
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
