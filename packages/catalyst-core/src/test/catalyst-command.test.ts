import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { catalystCommand, onPath, pythonCommand } from "../catalyst-source.js";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

function binDir(...names: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "bin-"));
  for (const name of names) {
    writeFileSync(join(dir, name), "");
    chmodSync(join(dir, name), 0o755);
  }
  return dir;
}

describe("which catalyst runs (R6.20: the desktop app's own copy last)", () => {
  it("finds an executable on PATH, with PATHEXT on Windows", () => {
    const dir = binDir("python3", "py.EXE");
    expect(onPath("python3", { PATH: dir }, "darwin")).toBe(true);
    expect(onPath("catalyst", { PATH: dir }, "darwin")).toBe(false);
    expect(onPath("py", { Path: dir, PATHEXT: ".EXE;.CMD" }, "win32")).toBe(true);
  });

  it("runs a .pyz with the first Python on PATH that is 3.11 or later", () => {
    const recent = () => true;
    expect(pythonCommand({ PATH: binDir("python3", "python3.12") }, "linux", recent)).toEqual(["python3.12"]);
    expect(pythonCommand({ PATH: binDir("python3", "python") }, "linux", recent)).toEqual(["python3"]);
    expect(pythonCommand({ PATH: binDir("python") }, "linux", recent)).toEqual(["python"]);
    expect(pythonCommand({ Path: binDir("py.EXE"), PATHEXT: ".EXE" }, "win32", recent)).toEqual(["py", "-3"]);
    expect(pythonCommand({ PATH: binDir() }, "linux", recent)).toBeNull();
    // macOS's own python3 is 3.9: passed over for a newer one, none when it is the only one
    const onlyPython = (c: string[]) => c[0] === "python";
    expect(pythonCommand({ PATH: binDir("python3", "python") }, "darwin", onlyPython)).toEqual(["python"]);
    expect(pythonCommand({ PATH: binDir("python3") }, "darwin", () => false)).toBeNull();
  });

  it("prefers CATALYST_BIN, then the user's launcher, then catalyst on PATH; the bundled copy only without them", () => {
    if (process.platform === "win32") return; // the launcher's name and PATH separators differ there
    const home = mkdtempSync(join(tmpdir(), "home-"));
    const pyz = join(home, "catalyst.pyz");
    writeFileSync(pyz, "");
    process.env.CATALYST_HOME = home;
    process.env.CATALYST_BUNDLED_PYZ = pyz;
    delete process.env.CATALYST_BIN;

    process.env.PATH = binDir("python3");
    expect(catalystCommand(() => true)).toEqual(["python3", pyz]);
    expect(catalystCommand(() => false)).toEqual(["catalyst"]); // no Python 3.11 or later

    process.env.PATH = binDir("python3", "catalyst");
    expect(catalystCommand()).toEqual(["catalyst"]);

    mkdirSync(join(home, "bin"));
    writeFileSync(join(home, "bin", "catalyst"), "");
    expect(catalystCommand()).toEqual([join(home, "bin", "catalyst")]);

    process.env.CATALYST_BIN = "/opt/catalyst --flag";
    expect(catalystCommand()).toEqual(["/opt/catalyst", "--flag"]);
  });

  it("falls back to `catalyst` when there is no Python to run the bundled copy", () => {
    if (process.platform === "win32") return;
    const home = mkdtempSync(join(tmpdir(), "home-"));
    writeFileSync(join(home, "catalyst.pyz"), "");
    process.env.CATALYST_HOME = home;
    process.env.CATALYST_BUNDLED_PYZ = join(home, "catalyst.pyz");
    delete process.env.CATALYST_BIN;
    process.env.PATH = binDir();
    expect(catalystCommand()).toEqual(["catalyst"]);
  });
});
