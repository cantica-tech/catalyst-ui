import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `main([..., "--watch"])` calls the real `watchCorpus`, which spins up a
// live chokidar watcher with no way for this test to close it — that leaked
// handle stalls vitest's worker shutdown for ~10s. Mock it so the --watch
// branch's contract (returns null, never a real watcher) is still verified
// without ever touching the filesystem watcher.
vi.mock("../watcher.js", () => ({
  watchCorpus: vi.fn(() => ({ close: vi.fn().mockResolvedValue(undefined) })),
}));

import { main } from "../cli.js";
import { createFixtureCorpus, removeFixtureCorpus } from "./test-support.js";
import { watchCorpus } from "../watcher.js";

let root: string | undefined;

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
  vi.restoreAllMocks();
});

describe("main", () => {
  it("returns 2 and prints usage when no corpus root is given", () => {
    expect(main([])).toBe(2);
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringContaining("usage:"));
  });

  it("returns 0 and prints a clean report for a well-formed corpus", () => {
    root = createFixtureCorpus({
      ruleDocs: [
        {
          prefix: "env",
          filename: "dev-environment-rules.md",
          rules: [{ id: "env-RUNTIME-001", title: "x", domain: "RUNTIME" }],
        },
      ],
      domains: [{ code: "RUNTIME" }],
      requirements: [{ id: "REQ-000001", title: "x", targets: ["env-RUNTIME-001"] }],
    });

    expect(main([root])).toBe(0);
    expect(vi.mocked(console.log)).toHaveBeenCalledWith(expect.stringContaining("errors: 0"));
  });

  it("returns 1 when the report has errors", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "x", targets: [] }],
    });
    expect(main([root])).toBe(1);
  });

  it("prints JSON when --json is passed", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "x", targets: [] }],
    });
    main([root, "--json"]);
    const output = vi.mocked(console.log).mock.calls[0]?.[0] as string;
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("returns null for --watch instead of an exit code (the caller must not process.exit on this)", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "x", targets: [] }],
    });
    expect(main([root, "--watch"])).toBeNull();
    expect(vi.mocked(watchCorpus)).toHaveBeenCalledWith(root, expect.any(Function));
  });
});
