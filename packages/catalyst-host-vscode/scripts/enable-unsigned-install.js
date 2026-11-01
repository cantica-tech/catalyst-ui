#!/usr/bin/env node
// Lets `code --install-extension` accept our unsigned local .vsix builds for
// one install, then puts the setting back. VS Code has no CLI flag for this —
// it's only the extensions.verifySignature user setting — so this edits the
// real global settings.json, for as long as the install takes:
//
//   node enable-unsigned-install.js set           -> prints the previous state
//   node enable-unsigned-install.js restore <state>
//
// `set` turns verification off and prints what was there before (`true`,
// `false`, `absent`, or `absent-empty` for a settings file with no other
// key); `restore` puts exactly that back. The Taskfile runs the install
// between the two, restoring on any exit. Both are surgical text edits (flip
// the value, or splice the key in and out right after the opening brace)
// instead of a JSON.parse/stringify round trip, so anything else in the file —
// formatting, key order, // comments — is left exactly as it was.

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
// What `set` splices in when the key is absent: after the opening brace, with
// a trailing comma when other keys follow, without one in an empty object.
const inserted = { absent: `\n  "${key}": false,`, "absent-empty": `\n  "${key}": false\n` };

function set() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let raw = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (raw.trim() === "") raw = "{}";

  const found = keyPattern.exec(raw);
  if (found) {
    if (found[2] === "false") {
      console.error(`${key} is already false in ${file}`);
      return "false";
    }
    fs.writeFileSync(file, raw.replace(keyPattern, `$1false`));
    console.error(`Set ${key}: false in ${file} for this install`);
    return "true";
  }
  const braceIndex = raw.indexOf("{");
  if (braceIndex === -1) {
    console.error(`Could not find an opening "{" in ${file} — add "${key}": false to it manually.`);
    process.exit(1);
  }
  const rest = raw.slice(braceIndex + 1);
  const state = rest.replace(/^\s+/, "").startsWith("}") ? "absent-empty" : "absent";
  fs.writeFileSync(file, raw.slice(0, braceIndex + 1) + inserted[state] + rest);
  console.error(`Set ${key}: false in ${file} for this install`);
  return state;
}

function restore(state) {
  if (state === "false") return; // it was off before: nothing to put back
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  if (state === "true") {
    fs.writeFileSync(file, raw.replace(keyPattern, `$1true`));
    console.error(`Restored ${key}: true in ${file}`);
    return;
  }
  const splice = inserted[state];
  if (!splice) {
    console.error(`unknown state "${state}": ${key} left as it is in ${file}`);
    process.exit(1);
  }
  if (!raw.includes(splice)) {
    console.error(`${key} was edited during the install: left as it is in ${file} — remove it by hand if unwanted`);
    process.exit(1);
  }
  fs.writeFileSync(file, raw.replace(splice, ""));
  console.error(`Removed ${key} from ${file} again`);
}

const [command, state] = process.argv.slice(2);
if (command === "set") console.log(set());
else if (command === "restore" && state) restore(state);
else {
  console.error("usage: enable-unsigned-install.js set | restore <state>");
  process.exit(2);
}
