// The packaged app's own directory (R6.20): app/{main,preload,studio-preload,renderer}.js
// and a package.json with no dependencies, so electron-builder packs these files
// alone, never the workspace's links. The Studio bundle ships beside it as a
// resource (electron-builder.yml, `extraResources`).
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const out = "app";
mkdirSync(out, { recursive: true });
const node = {
  bundle: true,
  minify: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["electron"],
  logLevel: "warning",
};
await build({ ...node, entryPoints: ["src/main.ts"], outfile: `${out}/main.js` });
await build({ ...node, entryPoints: ["src/preload.ts"], outfile: `${out}/preload.js` });
await build({ ...node, entryPoints: ["src/studio-preload.ts"], outfile: `${out}/studio-preload.js` });
await build({
  entryPoints: ["src/renderer-entry.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  outfile: `${out}/renderer.js`,
  logLevel: "warning",
});
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
writeFileSync(
  `${out}/package.json`,
  JSON.stringify(
    {
      name: "catalyst-studio-desktop",
      productName: "Catalyst Studio",
      version: pkg.version,
      description: "Catalyst Studio on the desktop",
      author: "Cantica Tech",
      license: pkg.license,
      main: "main.js",
    },
    null,
    2,
  ) + "\n",
);
console.log(`desktop app bundled into ${out}/ (${pkg.version})`);
