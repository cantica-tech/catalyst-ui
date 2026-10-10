import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  type CatalystGraph,
  modelFromGraph,
  reportFromCheck,
  watchCatalyst,
  watchProject,
} from "../catalyst-source.js";
import type { WatchUpdate } from "../types.js";

/** Reading the chain model through catalyst (REQ-000019). */

const RULE = "br-AUTH-000001-Abcd1234";
const REQ = "REQ-000001-Abcd1234";
const STEP = "STEP-000001-Abcd1234";

const graph: CatalystGraph = {
  rules: [
    {
      id: RULE,
      title: "Login flow",
      status: "✅ working",
      file: "rules/br.md",
      line: 3,
      retired: false,
      domain: "AUTH",
      mentions: [REQ],
    },
  ],
  domains: [{ code: "AUTH", file: null, title: "" }],
  artifacts: [
    {
      id: REQ,
      type: "REQ",
      title: "Sign in",
      file: "requirements/REQ-000001-sign-in.md",
      Status: "Active",
      "Signed-off-by": "Ada",
      links: { Targets: [RULE], Domain: ["AUTH"] },
      mentions: [RULE, STEP],
    },
    {
      id: STEP,
      type: "STEP",
      title: "First step",
      file: "steps/STEP-000001-first.md",
      Status: "in-progress",
      links: { Parent: ["REQ-000001"] },
      mentions: [],
    },
    {
      id: "RM-000001-Abcd1234",
      type: "RM",
      file: "development/roadmaps/beta.md",
      line: 7,
      row: true,
      fields: { Title: "Beta", Description: "Ship it", Status: "Triaged", Linked: `\`${REQ}\``, Notes: "n" },
      links: {},
      mentions: [REQ],
    },
  ],
  types: {},
};

describe("the adapter", () => {
  it("draws catalyst's graph as the hosts' model", () => {
    const m = modelFromGraph(graph, "/c");
    expect([...m.nodes.keys()].sort()).toEqual(["AUTH", REQ, "RM-000001-Abcd1234", STEP, RULE].sort());
    const req = m.nodes.get(REQ);
    expect(req).toMatchObject({
      kind: "dev-artifact",
      artifactType: "requirement",
      status: "Active",
      signedOffBy: "Ada",
    });
    expect(req?.location).toEqual({ file: "/c/requirements/REQ-000001-sign-in.md", line: 1 });
    expect(m.nodes.get(STEP)).toMatchObject({ kind: "step", parent: "REQ-000001", status: "in-progress" });
    expect(m.nodes.get(RULE)).toMatchObject({ kind: "rule", docPrefix: "br", domain: "AUTH", title: "Login flow" });
    expect(m.nodes.get("RM-000001-Abcd1234")).toMatchObject({
      kind: "roadmap",
      roadmapName: "beta",
      status: "Triaged",
      linked: REQ,
      location: { file: "/c/development/roadmaps/beta.md", line: 7 },
    });
    expect([...(m.edges.get(REQ) ?? [])].sort()).toEqual(["AUTH", RULE, STEP].sort());
    expect([...(m.edges.get(STEP) ?? [])]).toEqual([REQ]); // the short form resolves
    expect([...(m.reverseEdges.get(RULE) ?? [])]).toEqual([REQ]);
  });

  it("takes every finding of catalyst check, located at its file", () => {
    const r = reportFromCheck(
      {
        ok: false,
        errors: ["chain dangling-ref: .criterion/requirements/REQ-000001-sign-in.md: `Targets` cites `x`"],
        warnings: ["journal: 3 warning(s) on pre-CLI entries"],
      },
      "/c",
      modelFromGraph(graph, "/c"),
    );
    expect(r).toMatchObject({ errorCount: 1, warningCount: 1, nodeCount: 5 });
    expect(r.issues[0]).toMatchObject({
      kind: "dangling-reference",
      severity: "error",
      nodeId: REQ,
      location: { file: "/c/requirements/REQ-000001-sign-in.md", line: 1 },
    });
    expect(r.issues[1]).toMatchObject({ kind: "catalyst", severity: "warning", location: undefined });
  });
});

// A catalyst checkout beside this repository with `serve --local`, as in kernel-parity.test.ts.
const here = fileURLToPath(new URL(".", import.meta.url));
const kernelScripts = join(
  process.env.CATALYST_KERNEL_DIR ?? resolve(here, "..", "..", "..", "..", "..", "catalyst"),
  "scripts",
);
const command = ["env", `PYTHONPATH=${kernelScripts}`, "python3", "-m", "catalyst"];
const canServe =
  existsSync(join(kernelScripts, "catalyst", "serve.py")) &&
  spawnSync("python3", ["-c", "from catalyst.serve import make_local"], {
    env: { ...process.env, PYTHONPATH: kernelScripts },
  }).status === 0;
const fixture = join(here, "fixtures", "parity", "corpus");

let project: string | undefined;
afterEach(() => {
  if (project) rmSync(project, { recursive: true, force: true });
  project = undefined;
});

function makeProject(): string {
  project = mkdtempSync(join(tmpdir(), "catalyst-source-"));
  cpSync(fixture, join(project, ".criterion"), { recursive: true });
  writeFileSync(
    join(project, "parity.catalyst"),
    JSON.stringify({
      project_name: "parity",
      format: "1.0-rc",
      module: "software-engineering",
      kernel_version: "0.45.0",
    }),
  );
  return project;
}

function nextUpdate(updates: WatchUpdate[], count: number, timeoutMs = 20000): Promise<WatchUpdate> {
  return new Promise((done, fail) => {
    const started = Date.now();
    const poll = () => {
      if (updates.length >= count) done(updates[count - 1]);
      else if (Date.now() - started > timeoutMs) fail(new Error(`no update ${count} after ${timeoutMs} ms`));
      else setTimeout(poll, 50);
    };
    poll();
  });
}

describe.skipIf(!canServe)("through catalyst serve --local", () => {
  it("delivers the chain, its findings and its journal, and follows a change", async () => {
    const root = makeProject();
    const criterion = join(root, ".criterion");
    const updates: WatchUpdate[] = [];
    const handle = await watchCatalyst(root, criterion, (u) => updates.push(u), command);
    try {
      const first = await nextUpdate(updates, 1);
      const kinds = new Set([...first.model.nodes.values()].map((n) => n.kind));
      expect([...kinds].sort()).toEqual(expect.arrayContaining(["dev-artifact", "domain", "rule"]));
      expect(Array.isArray(first.journal)).toBe(true);
      expect(first.report.nodeCount).toBe(first.model.nodes.size);
      const bug = join(criterion, "development", "bugs", "BUG-000001-beta.md");
      const text = readFileSync(bug, "utf8");
      expect(text).toContain("| **Status** | Fixed |");
      writeFileSync(bug, text.replace("| **Status** | Fixed |", "| **Status** | Open |"));
      const second = await nextUpdate(updates, 2);
      const node = second.model.nodes.get([...second.model.nodes.keys()].find((id) => id.startsWith("BUG-000001"))!);
      expect(node && "status" in node ? node.status : undefined).toBe("Open");
    } finally {
      await handle.close();
    }
  }, 60000);
});

describe("watchProject", () => {
  it("says why catalyst cannot serve, delivers nothing, and tries again on refresh", async () => {
    const root = makeProject();
    const before = process.env.CATALYST_BIN;
    process.env.CATALYST_BIN = "catalyst-that-does-not-exist";
    const reasons: string[] = [];
    const updates: WatchUpdate[] = [];
    const handle = watchProject(
      root,
      join(root, ".criterion"),
      (u) => updates.push(u),
      () => undefined,
      (r) => reasons.push(r),
    );
    try {
      for (let waited = 0; reasons.length === 0 && waited < 10000; waited += 50) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(reasons[0]).toMatch(/cannot serve .* catalyst 0\.54\.0 or later: run `catalyst open`/);
      handle.refresh();
      for (let waited = 0; reasons.length < 2 && waited < 10000; waited += 50) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(reasons).toHaveLength(2);
      expect(updates).toEqual([]);
    } finally {
      await handle.close();
      if (before === undefined) delete process.env.CATALYST_BIN;
      else process.env.CATALYST_BIN = before;
    }
  }, 30000);
});
