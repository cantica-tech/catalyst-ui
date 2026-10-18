// The Studio's static bundle: dist/web/{index.html, studio.css, studio.js},
// what `catalyst serve --local --static dist/web` serves (studio-SHELL-000001).
import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

const out = "dist/web";
mkdirSync(out, { recursive: true });
await build({
  entryPoints: ["src/main.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  jsx: "automatic",
  outfile: `${out}/studio.js`,
  logLevel: "warning",
});
// the web component other sites embed (owner decision B8): no React, its own small file
await build({
  entryPoints: ["src/embed.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  outfile: `${out}/embed.js`,
  logLevel: "warning",
});
for (const file of ["index.html", "studio.css"]) copyFileSync(`static/${file}`, `${out}/${file}`);
console.log(`studio bundle written to ${out}`);
