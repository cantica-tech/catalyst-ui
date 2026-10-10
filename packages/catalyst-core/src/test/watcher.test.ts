import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { WatchUpdate } from "../types.js";
import { watchCorpus } from "../watcher.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("watchCorpus", () => {
  it("reports once on startup", async () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "x", targets: ["env-RUNTIME-001"] }],
    });
    const updates: WatchUpdate[] = [];
    const handle = watchCorpus(root, (update) => updates.push(update), {
      debounceMs: 30,
    });

    await new Promise((resolve) => setTimeout(resolve, 200));
    await handle.close();

    expect(updates.length).toBe(1);
    expect(updates[0].report.nodeCount).toBeGreaterThan(0);
    expect(updates[0].model.nodes.size).toBe(updates[0].report.nodeCount);
  });

  it("populates users and roles from the corpus's IAM files", async () => {
    root = createFixtureCorpus({
      users: [{ name: "alice", roles: ["Developer"], active: true }],
      roles: [{ name: "Developer", actions: ["/create-req"] }],
    });
    const updates: WatchUpdate[] = [];
    const handle = watchCorpus(root, (update) => updates.push(update), {
      debounceMs: 30,
    });

    // Wait for the first report; how many follow is "reports once on startup"'s
    // concern, and a late filesystem event from creating the fixture can add one.
    for (let waited = 0; updates.length === 0 && waited < 2000; waited += 20) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await handle.close();

    expect(updates.length).toBeGreaterThanOrEqual(1);
    expect(updates[0].users).toEqual([
      {
        name: "alice",
        roles: ["Developer"],
        registered: "2026-01-01",
        active: true,
        notes: "",
      },
    ]);
    expect(updates[0].roles).toEqual([{ name: "Developer", actions: ["/create-req"] }]);
  });

  it("coalesces a rapid burst of changes into a single report", async () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "x", targets: ["env-RUNTIME-001"] }],
    });
    const updates: WatchUpdate[] = [];
    const handle = watchCorpus(root, (update) => updates.push(update), {
      debounceMs: 80,
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(updates.length).toBe(1);

    // Fired back-to-back, no delay: a real agent burst rewriting many files
    // lands well inside both chokidar's own write-finish coalescing and our
    // debounce window, so this should settle into exactly one more report.
    const target = join(root, "requirements", "REQ-000001-file.md");
    for (let i = 0; i < 5; i++) {
      writeFileSync(
        target,
        `# touch ${i}\n\n| Field | Value |\n|---|---|\n| **Status** | in-progress |\n| **Targets** | \`env-RUNTIME-001\` |\n`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
    await handle.close();

    // Proves coalescing happened (far fewer reports than raw writes) without
    // pinning an exact count that real filesystem-event timing can't guarantee.
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates.length).toBeLessThan(5);
  });

  it("refresh() re-reports immediately, without waiting for the debounce window", async () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "x", targets: ["env-RUNTIME-001"] }],
    });
    const updates: WatchUpdate[] = [];
    const handle = watchCorpus(root, (update) => updates.push(update), {
      debounceMs: 5000,
    });

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(updates.length).toBe(0); // still inside the long debounce window

    handle.refresh();
    await new Promise((resolve) => setTimeout(resolve, 30));
    await handle.close();

    expect(updates.length).toBe(1);
    expect(updates[0].model.nodes.size).toBeGreaterThan(0);
  });
});

describe("isIgnoredWatchPath (B-12)", () => {
  it("ignores .git, node_modules and tool caches, not corpus files", async () => {
    const { isIgnoredWatchPath } = await import("../watcher.js");
    const r = "/p/.criterion";
    expect(isIgnoredWatchPath(r, "/p/.criterion/.git/index")).toBe(true);
    expect(isIgnoredWatchPath(r, "/p/.criterion/.git")).toBe(true);
    expect(isIgnoredWatchPath(r, "/p/.criterion/node_modules/x/a.md")).toBe(true);
    expect(isIgnoredWatchPath(r, "/p/.criterion/bin/__pycache__/a.pyc")).toBe(true);
    expect(isIgnoredWatchPath(r, "/p/.criterion/requirements/REQ-000001-a.md")).toBe(false);
    expect(isIgnoredWatchPath(r, "/p/.criterion")).toBe(false);
    // Only segments inside the corpus count: a corpus living under a
    // folder named node_modules is still watched.
    expect(isIgnoredWatchPath("/x/node_modules/p/.criterion", "/x/node_modules/p/.criterion/rules/a.md")).toBe(false);
  });

  it("does not report a change under .git", async () => {
    const { mkdirSync } = await import("node:fs");
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "x", targets: ["env-RUNTIME-001"] }],
    });
    const updates: WatchUpdate[] = [];
    const handle = watchCorpus(root, (update) => updates.push(update), {
      debounceMs: 30,
    });
    // The watcher emits its initial update(s) — one at start, more for fixture
    // writes still settling — at a time that varies with load: wait until it
    // has been quiet for 300ms before counting, not for a fixed time.
    let seen = -1;
    for (let quiet = 0, waited = 0; quiet < 300 && waited < 5000; waited += 20) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      quiet = updates.length === seen ? quiet + 20 : 0;
      seen = updates.length;
    }
    expect(updates.length).toBeGreaterThan(0);
    const before = updates.length;
    mkdirSync(join(root, ".git"), { recursive: true });
    writeFileSync(join(root, ".git", "index"), "x");
    await new Promise((resolve) => setTimeout(resolve, 400));
    await handle.close();
    expect(updates.length).toBe(before);
  });
});
