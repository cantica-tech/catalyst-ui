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
for (const file of ["index.html", "studio.css"]) copyFileSync(`static/${file}`, `${out}/${file}`);
console.log(`studio bundle written to ${out}`);
