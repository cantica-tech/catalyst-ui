import { fileURLToPath } from "node:url";

import { buildChainModel } from "./graph.js";
import { parseCorpus } from "./parser.js";
import type { ValidationReport } from "./types.js";
import { validate } from "./validator.js";
import { watchCorpus } from "./watcher.js";

function printReport(report: ValidationReport, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("catalyst-core validation report");
  console.log(`  nodes checked: ${report.nodeCount}`);
  console.log(
    `  errors: ${report.errorCount}, warnings: ${report.warningCount}`,
  );
  console.log(`  duration: ${report.durationMs.toFixed(1)}ms`);
  for (const issue of report.issues) {
    const location = issue.location
      ? ` (${issue.location.file}:${issue.location.line})`
      : "";
    console.log(
      `  [${issue.severity}] ${issue.kind}: ${issue.message}${location}`,
    );
  }
}

/**
 * Returns an exit code for a one-shot run, or `null` for `--watch` (a
 * long-running mode with no exit code of its own — the caller must not
 * call `process.exit` in that case, or the process dies before the
 * watcher's debounced first report ever fires).
 */
export function main(argv: string[] = process.argv.slice(2)): number | null {
  const watch = argv.includes("--watch");
  const json = argv.includes("--json");
  const root = argv.find((arg) => !arg.startsWith("--"));

  if (!root) {
    console.error("usage: catalyst-core <corpusRoot> [--watch] [--json]");
    return 2;
  }

  if (watch) {
    watchCorpus(root, ({ report }) => printReport(report, json));
    return null;
  }

  const result = parseCorpus(root);
  if (result === null) {
    console.error("parse aborted unexpectedly");
    return 1;
  }

  const report = validate(buildChainModel(result));
  printReport(report, json);
  return report.errorCount > 0 ? 1 : 0;
}

function isMain(): boolean {
  return (
    process.argv[1] !== undefined &&
    process.argv[1] === fileURLToPath(import.meta.url)
  );
}

if (isMain()) {
  const code = main();
  if (code !== null) process.exit(code);
}
