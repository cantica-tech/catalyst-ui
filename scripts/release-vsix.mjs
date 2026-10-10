// manifest.json's `kernelVersion` is the catalyst kernel range the extension
// works with: package.json's `catalyst.kernelVersion`, or --kernel-version
// for a release cut before that field existed.
//
// Usage: node scripts/release-vsix.mjs --publish-dir <dir>
//          [--push [--tag <tag>]] [--kernel-version <range>]
// Without --push: copies the .vsix already built from the working tree
// (task build:vscode-extension); nothing is committed.
// With --push: builds the .vsix from the release tag (package.json's
// version, as `v<version>` or `<version>`, or --tag) in a temporary
// worktree, so what is published is exactly the release, then commits and
// pushes <publish-dir>. Refuses when no such tag exists.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extDir = (base) => join(base, "packages", "catalyst-host-vscode");
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const push = args.includes("--push");
const publishArg = opt("--publish-dir");
if (!publishArg) {
  console.error("usage: release-vsix.mjs --publish-dir <dir> [--push [--tag <tag>]] [--kernel-version <range>]");
  process.exit(2);
}
const publishDir = resolve(publishArg.replace(/^~(?=\/|$)/, process.env.HOME ?? "~"));
if (!existsSync(publishDir)) {
  console.error(`publish directory not found: ${publishDir}`);
  process.exit(1);
}
const git = (cwd, ...a) =>
  execFileSync("git", ["-C", cwd, ...a], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const readPkg = (base) => JSON.parse(readFileSync(join(extDir(base), "package.json"), "utf8"));

let source = root; // the tree the .vsix comes from
let worktree;
if (push) {
  const version = readPkg(root).version;
  const tags = git(root, "tag", "--list").split("\n");
  const tag = opt("--tag") ?? [`v${version}`, version].find((t) => tags.includes(t));
  if (!tag || !tags.includes(tag)) {
    console.error(`No release tag for ${opt("--tag") ?? version} — cut the release first (or pass --tag <tag>).`);
    process.exit(1);
  }
  worktree = mkdtempSync(join(tmpdir(), "release-vsix-"));
  console.log(`Building the .vsix from release tag ${tag} in ${worktree} ...`);
  git(root, "worktree", "add", "--detach", worktree, tag);
  source = worktree;
  try {
    const run = (cmd, a, cwd) => execFileSync(cmd, a, { cwd, stdio: ["ignore", "inherit", "inherit"] });
    run("npm", ["ci", "--no-audit", "--no-fund"], worktree);
    run("npm", ["run", "typecheck"], worktree); // builds every workspace (project references)
    run("npm", ["run", "package"], extDir(worktree));
  } catch (e) {
    cleanup();
    throw e;
  }
}
function cleanup() {
  if (worktree) {
    try {
      git(root, "worktree", "remove", "--force", worktree);
    } catch {
      rmSync(worktree, { recursive: true, force: true });
      git(root, "worktree", "prune");
    }
    worktree = undefined;
  }
}

const pkg = readPkg(source);
const kernelVersion = opt("--kernel-version") ?? pkg.catalyst?.kernelVersion;
if (typeof kernelVersion !== "string" || !kernelVersion) {
  cleanup();
  console.error(
    `${pkg.name} ${pkg.version}'s package.json has no catalyst.kernelVersion — pass --kernel-version <range> (e.g. ">=0.36.0").`,
  );
  process.exit(1);
}

const vsix = join(extDir(source), "catalyst-host-vscode.vsix");
if (!existsSync(vsix)) {
  cleanup();
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
cleanup();
const manifest = {
  id: pkg.name,
  name: pkg.displayName ?? pkg.name,
  version: pkg.version,
  description: pkg.description,
  kernelVersion,
  vscode: pkg.engines?.vscode,
  file: fileName,
};
writeFileSync(join(dest, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Copied ${pkg.name} v${pkg.version} (kernel ${kernelVersion}) -> ${dest}`);

// README: one row per release, newest first.
const cmp = (a, b) => {
  const pa = a.slice(1).split(".").map(Number),
    pb = b.slice(1).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pb[i] ?? 0) - (pa[i] ?? 0);
  return 0;
};
const rows = readdirSync(vsixRoot)
  .filter(
    (d) =>
      /^v\d/.test(d) && statSync(join(vsixRoot, d)).isDirectory() && existsSync(join(vsixRoot, d, "manifest.json")),
  )
  .sort(cmp)
  .map((d) => {
    const m = JSON.parse(readFileSync(join(vsixRoot, d, "manifest.json"), "utf8"));
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
    git(publishDir, "commit", "-m", `Deploy release: ${pkg.name} v${pkg.version}`);
    git(publishDir, "push", "origin", "main");
    console.log(`Committed and pushed from ${publishDir}`);
  } else {
    console.log(`No changes to commit in ${publishDir}.`);
  }
}
