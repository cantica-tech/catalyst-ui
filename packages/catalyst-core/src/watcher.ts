import chokidar, { type FSWatcher } from "chokidar";

import { buildChainModel } from "./graph.js";
import { parseCorpus } from "./parser.js";
import type { ValidationReport, WatcherOptions } from "./types.js";
import { validate } from "./validator.js";

export interface WatcherHandle {
  close(): Promise<void>;
}

/**
 * Watches a corpus root and reports revalidation after each change.
 * Debounces/coalesces changes in a trailing window (agent bursts rewrite
 * many files at once) and is single-flight: a change landing mid-parse
 * bumps the generation, `parseCorpus` notices via `shouldContinue` and bails
 * out early, and the already-rescheduled timer's next firing supplies the
 * authoritative result — correctness comes from that reschedule, not from
 * the aborted pass produding anything itself.
 */
export function watchCorpus(
  root: string,
  onReport: (report: ValidationReport) => void,
  options: WatcherOptions = {},
): WatcherHandle {
  const debounceMs = options.debounceMs ?? 180;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const runParse = () => {
    const myGeneration = generation;
    const result = parseCorpus(root, {
      shouldContinue: () => myGeneration === generation,
    });
    if (result === null) return;
    onReport(validate(buildChainModel(result)));
  };

  const schedule = () => {
    generation++;
    if (timer) clearTimeout(timer);
    timer = setTimeout(runParse, debounceMs);
  };

  const watcher: FSWatcher = chokidar.watch(root, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 20 },
  });
  watcher.on("add", schedule).on("change", schedule).on("unlink", schedule);

  schedule();

  return {
    async close() {
      if (timer) clearTimeout(timer);
      await watcher.close();
    },
  };
}
