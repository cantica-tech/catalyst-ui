#!/usr/bin/env node
// One-time toggle so `code --install-extension` accepts our unsigned local
// .vsix builds. VS Code has no CLI flag for this — it's only the
// extensions.verifySignature user setting — so this edits the real global
// settings.json. It does a surgical text edit (flip the existing value, or
// splice the key in right after the opening brace) instead of a
// JSON.parse/stringify round trip, so anything else in the file — formatting,
// key order, // comments — is left exactly as it was.

const fs = require("fs");
const os = require("os");
const path = require("path");

function settingsPath() {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support", "Code", "User", "settings.json");
    case "win32":
      return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Code", "User", "settings.json");
    default:
      return path.join(home, ".config", "Code", "User", "settings.json");
  }
}

const file = settingsPath();
const key = "extensions.verifySignature";
const keyPattern = new RegExp(`("${key.replace(/\./g, "\\.")}"\\s*:\\s*)(true|false)`);

fs.mkdirSync(path.dirname(file), { recursive: true });

let raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (raw.trim() === "") raw = "{}";

if (keyPattern.test(raw)) {
  if (keyPattern.exec(raw)[2] === "false") {
    console.log(`${key} is already false in ${file}`);
    process.exit(0);
  }
  raw = raw.replace(keyPattern, `$1false`);
} else {
  const braceIndex = raw.indexOf("{");
  if (braceIndex === -1) {
    console.error(`Could not find an opening "{" in ${file} — add "${key}": false to it manually.`);
    process.exit(1);
  }
  const rest = raw.slice(braceIndex + 1);
  const isEmptyObject = rest.replace(/^\s+/, "").startsWith("}");
  const insertion = isEmptyObject ? `\n  "${key}": false\n` : `\n  "${key}": false,`;
  raw = raw.slice(0, braceIndex + 1) + insertion + rest;
}

fs.writeFileSync(file, raw);
console.log(`Set ${key}: false in ${file}`);
