#!/usr/bin/env node
// Copy the packaged catalyst-host-vscode .vsix into a distribution
// repository checkout, the same way catalyst publishes its kernel releases:
//
//   <publish-dir>/catalyst/vsix/v<version>/catalyst-host-vscode-v<version>.vsix
//   <publish-dir>/catalyst/vsix/v<version>/manifest.json
//   <publish-dir>/catalyst/vsix/README.md          (regenerated)
//
// manifest.json's `kernelVersion` is the catalyst kernel range the extension
// works with, read from package.json's `catalyst.kernelVersion`.
//
// Usage: node scripts/release-vsix.mjs --publish-dir <dir> [--push]
// Nothing is committed or pushed without --push, and --push refuses unless
// HEAD is exactly a release tag matching package.json's version.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "packages", "catalyst-host-vscode");
const args = process.argv.slice(2);
const push = args.includes("--push");
const at = args.indexOf("--publish-dir");
if (at < 0 || !args[at + 1]) {
  console.error("usage: release-vsix.mjs --publish-dir <dir> [--push]");
  process.exit(2);
}
const publishDir = resolve(
  args[at + 1].replace(/^~(?=\/|$)/, process.env.HOME ?? "~"),
);
if (!existsSync(publishDir)) {
  console.error(`publish directory not found: ${publishDir}`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
const kernelVersion = pkg.catalyst?.kernelVersion;
if (typeof kernelVersion !== "string" || !kernelVersion) {
  console.error(
    "packages/catalyst-host-vscode/package.json has no catalyst.kernelVersion",
  );
  process.exit(1);
}
const git = (cwd, ...a) =>
  execFileSync("git", ["-C", cwd, ...a], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

if (push) {
  let tag = "";
  try {
    tag = git(root, "describe", "--tags", "--exact-match", "HEAD");
  } catch {
    console.error(
      "HEAD is not an exact release tag — cut the release first, or check out the release tag.",
    );
    process.exit(1);
  }
  if (tag.replace(/^v/, "") !== pkg.version) {
    console.error(
      `Release tag (${tag}) doesn't match package.json version (${pkg.version}) — refusing.`,
    );
    process.exit(1);
  }
}

const vsix = join(pkgDir, "catalyst-host-vscode.vsix");
if (!existsSync(vsix)) {
  console.error(`${vsix} not found — run task build:vscode-extension first`);
  process.exit(1);
}

const vsixRoot = join(publishDir, "catalyst", "vsix");
const dest = join(vsixRoot, `v${pkg.version}`);
mkdirSync(dest, { recursive: true });
const fileName = `${pkg.name}-v${pkg.version}.vsix`;
for (const f of readdirSync(dest)) {
  if (f !== fileName && f !== "manifest.json") unlinkSync(join(dest, f));
}
copyFileSync(vsix, join(dest, fileName));
const manifest = {
  id: pkg.name,
  name: pkg.displayName ?? pkg.name,
  version: pkg.version,
  description: pkg.description,
  kernelVersion,
  vscode: pkg.engines?.vscode,
  file: fileName,
};
writeFileSync(
  join(dest, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Copied ${pkg.name} v${pkg.version} (kernel ${kernelVersion}) -> ${dest}`,
);

// README: one row per release, newest first.
const cmp = (a, b) => {
  const pa = a.slice(1).split(".").map(Number),
    pb = b.slice(1).split(".").map(Number);
  for (let i = 0; i < 3; i++)
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
  return 0;
};
const rows = readdirSync(vsixRoot)
  .filter(
    (d) =>
      /^v\d/.test(d) &&
      statSync(join(vsixRoot, d)).isDirectory() &&
      existsSync(join(vsixRoot, d, "manifest.json")),
  )
  .sort(cmp)
  .map((d) => {
    const m = JSON.parse(
      readFileSync(join(vsixRoot, d, "manifest.json"), "utf8"),
    );
    const file = m.file ?? `${m.id}-${d}.vsix`;
    return `| \`${d}\` | \`${m.kernelVersion ?? "*"}\` | [\`${d}/manifest.json\`](${d}/manifest.json) | [\`${d}/${file}\`](${d}/${file}) | ${m.name} |`;
  });
writeFileSync(
  join(vsixRoot, "README.md"),
  [
    "# Catalyst VS Code Extension Releases",
    "",
    "This directory contains versioned releases of the Catalyst VS Code extension (`.vsix`), each with a manifest naming the catalyst kernel versions it works with.",
    "",
    "Install one with `code --install-extension <file>.vsix`.",
    "",
    "## Available Releases",
    "",
    "| Version | Requires Kernel | Manifest | Package | Name |",
    "| ------- | --------------- | -------- | ------- | ---- |",
    ...(rows.length ? rows : ["| *(none)* | - | - | - | - |"]),
    "",
  ].join("\n"),
);

if (push) {
  git(publishDir, "add", "catalyst/vsix");
  if (git(publishDir, "status", "--porcelain", "catalyst/vsix")) {
    git(
      publishDir,
      "commit",
      "-m",
      `Deploy release: ${pkg.name} v${pkg.version}`,
    );
    git(publishDir, "push", "origin", "main");
    console.log(`Committed and pushed from ${publishDir}`);
  } else {
    console.log(`No changes to commit in ${publishDir}.`);
  }
}
