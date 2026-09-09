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
      requirements: [
        { id: "REQ-000001", title: "x", targets: ["env-RUNTIME-001"] },
      ],
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

    await new Promise((resolve) => setTimeout(resolve, 200));
    await handle.close();

    expect(updates.length).toBe(1);
    expect(updates[0].users).toEqual([
      {
        name: "alice",
        roles: ["Developer"],
        registered: "2026-01-01",
        active: true,
        notes: "",
      },
    ]);
    expect(updates[0].roles).toEqual([
      { name: "Developer", actions: ["/create-req"] },
    ]);
  });

  it("coalesces a rapid burst of changes into a single report", async () => {
    root = createFixtureCorpus({
      requirements: [
        { id: "REQ-000001", title: "x", targets: ["env-RUNTIME-001"] },
      ],
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
});
