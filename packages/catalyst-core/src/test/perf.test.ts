import { afterEach, describe, expect, it } from "vitest";

import { buildChainModel } from "../graph.js";
import { parseCorpus } from "../parser.js";
import { validate } from "../validator.js";

import { createSyntheticCorpus, removeFixtureCorpus } from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("perf", () => {
  it("parses, models, and validates a synthetic 5x corpus in under 100ms", () => {
    // There's no real deployment big enough yet to size roadmap Phase 1's own
    // exit criterion from ("a synthetic 5x repo passes under 100ms"), so this
    // stands in for "the largest real one": ~50 rules across 5 docs, ~50
    // domains, ~50 requirements at 1x -> 250/250/250 at 5x.
    root = createSyntheticCorpus(5);
    const corpus = root;

    const run = () => {
      const start = performance.now();
      const result = parseCorpus(corpus);
      expect(result).not.toBeNull();
      const report = validate(buildChainModel(result!));
      return { report, durationMs: performance.now() - start };
    };
    // One warm-up run, then the best of three: the budget is the work's own
    // cost, not the JIT's first pass or a core shared with parallel test files.
    run();
    const runs = [run(), run(), run()];
    const best = Math.min(...runs.map((r) => r.durationMs));

    expect(runs[0].report.nodeCount).toBeGreaterThan(0);
    expect(runs[0].report.errorCount).toBe(0);
    expect(best).toBeLessThan(100);
  });
});
