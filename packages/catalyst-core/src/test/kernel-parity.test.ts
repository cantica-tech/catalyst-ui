import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { buildChainModel } from "../graph.js";
import { parseCorpus } from "../parser.js";
import { validate } from "../validator.js";

/**
 * Golden-corpus parity (B-03): the TS validator, which drives the VS Code
 * Problems panel, must report the same chain errors as the kernel's
 * authoritative `catalyst check --json` on the same corpus. Runs the
 * kernel from a catalyst source checkout — `$CATALYST_KERNEL_DIR`, else
 * `../catalyst` next to this repository — with the software-engineering
 * module checked out beside it (`catalyst-software-engineering`), and is
 * skipped when python3 or either checkout is unavailable.
 */

const here = fileURLToPath(new URL(".", import.meta.url));
const fixture = join(here, "fixtures", "parity", "corpus");
const repoRoot = resolve(here, "..", "..", "..", "..");
const kernelDir = process.env.CATALYST_KERNEL_DIR ?? resolve(repoRoot, "..", "catalyst");
const kernelScripts = join(kernelDir, "scripts");

function kernelAvailable(): boolean {
  if (!existsSync(join(kernelScripts, "catalyst", "__main__.py"))) return false;
  if (
    !existsSync(join(kernelDir, "..", "catalyst-software-engineering", "module.yaml")) &&
    !existsSync(join(kernelDir, "framework", "modules", "software-engineering", "module.yaml"))
  )
    return false;
  return spawnSync("python3", ["--version"]).status === 0;
}

const available = kernelAvailable();

let project: string | undefined;
afterEach(() => {
  if (project) rmSync(project, { recursive: true, force: true });
  project = undefined;
});

function makeProject(): string {
  project = mkdtempSync(join(tmpdir(), "catalyst-parity-"));
  cpSync(fixture, join(project, ".criterion"), { recursive: true });
  writeFileSync(
    join(project, "parity.catalyst"),
    JSON.stringify({
      project_name: "parity",
      format: "1.0-rc",
      module: "software-engineering",
      agent: "claude-code",
      kernel_version: "0.45.0",
    }),
  );
  return project;
}

/** Backticked ids named in dangling-reference errors. */
function danglingIds(messages: string[]): string[] {
  const ids = new Set<string>();
  for (const m of messages) {
    // TS: "X references `id`, which does not exist"
    // kernel: "`Targets` cites `id`, which resolves to nothing"
    const match = /(?:references|cites) `([^`]+)`/.exec(m);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

function kernelChainErrors(projectRoot: string): string[] {
  const res = spawnSync("python3", ["-m", "catalyst", "--project", projectRoot, "check", "--json"], {
    cwd: kernelScripts,
    env: { ...process.env, PYTHONPATH: kernelScripts },
    encoding: "utf8",
  });
  const parsed = JSON.parse(res.stdout) as { errors: string[] };
  // Only chain findings: the kernel's structure/journal checks cover files
  // the TS model does not represent.
  return parsed.errors.filter((e) => e.startsWith("chain "));
}

function tsErrors(projectRoot: string): string[] {
  const parsed = parseCorpus(join(projectRoot, ".criterion"));
  if (!parsed) throw new Error("fixture corpus did not parse");
  const model = buildChainModel(parsed);
  return validate(model)
    .issues.filter((i) => i.severity === "error")
    .map((i) => `${i.kind}: ${i.message}`);
}

describe.skipIf(!available)("parity with kernel `catalyst check --json`", () => {
  it("both accept a corpus citing short-form ids and framework rules in prose", () => {
    const root = makeProject();
    expect(kernelChainErrors(root)).toEqual([]);
    expect(tsErrors(root)).toEqual([]);
  });

  it("both reject the same dangling Targets reference", () => {
    const root = makeProject();
    const bug = join(root, ".criterion", "development", "bugs", "BUG-000001-beta.md");
    writeFileSync(
      bug,
      readFileSync(bug, "utf8").replace(
        "| **Targets** | `env-RUNTIME-000001-Abcd1234` |",
        "| **Targets** | `env-RUNTIME-000099-Abcd1234` |",
      ),
    );
    const kernel = danglingIds(kernelChainErrors(root));
    expect(kernel).toEqual(["env-RUNTIME-000099-Abcd1234"]);
    expect(danglingIds(tsErrors(root))).toEqual(kernel);
  });
});
