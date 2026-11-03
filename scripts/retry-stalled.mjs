// Decides whether a finished workflow run is retried once
// (.github/workflows/retry-stalled.yml): GitHub's macOS runners now and then
// stall, and the job ends cancelled or timed out with no log; a rerun passes.
// A run is retried only when it is its first attempt, it did not succeed, and
// every job that did not succeed is a macOS job that was cancelled or timed
// out. A real failure, or any job on another OS that did not succeed, is
// never retried.
//
// Usage: node scripts/retry-stalled.mjs <jobs.json> <run attempt> <run conclusion>
//   <jobs.json> is the response of GET /repos/{repo}/actions/runs/{id}/attempts/{n}/jobs.
// Prints one line: `retry: <why>` or `no retry: <why>`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const UNSUCCESSFUL_RUN = new Set(["failure", "cancelled", "timed_out"]);
const PASSED = new Set(["success", "skipped", "neutral"]);
const STALLED = new Set(["cancelled", "timed_out"]);

/** @param {{ name?: string, labels?: string[] }} job */
export function isMacos(job) {
  const labels = job.labels ?? [];
  return labels.some((label) => /^macos/i.test(label)) || /macos/i.test(job.name ?? "");
}

/**
 * @param {{ attempt: number, conclusion: string, jobs: { name?: string, conclusion?: string | null, labels?: string[] }[] }} run
 * @returns {{ retry: boolean, reason: string }}
 */
export function decide({ attempt, conclusion, jobs }) {
  if (attempt !== 1) {
    return { retry: false, reason: `attempt ${String(attempt)}: a run is retried once, from its first attempt only` };
  }
  if (!UNSUCCESSFUL_RUN.has(conclusion)) {
    return { retry: false, reason: `the run's conclusion is ${conclusion}` };
  }
  const notPassed = jobs.filter((job) => !PASSED.has(job.conclusion ?? ""));
  if (notPassed.length === 0) {
    return { retry: false, reason: "no job failed" };
  }
  const describe = (job) => `${job.name ?? "?"} (${job.conclusion ?? "no conclusion"})`;
  const other = notPassed.filter((job) => !isMacos(job));
  if (other.length > 0) {
    return { retry: false, reason: `a job on another OS did not pass: ${other.map(describe).join(", ")}` };
  }
  const failed = notPassed.filter((job) => !STALLED.has(job.conclusion ?? ""));
  if (failed.length > 0) {
    return { retry: false, reason: `a macOS job really failed: ${failed.map(describe).join(", ")}` };
  }
  return { retry: true, reason: `macOS job(s) stalled: ${notPassed.map(describe).join(", ")}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, attempt, conclusion] = process.argv.slice(2);
  if (!file || !attempt || !conclusion) {
    console.error("usage: node scripts/retry-stalled.mjs <jobs.json> <run attempt> <run conclusion>");
    process.exit(2);
  }
  /** @type {{ jobs?: { name?: string, conclusion?: string | null, labels?: string[] }[] }} */
  const body = JSON.parse(readFileSync(file, "utf8"));
  const { retry, reason } = decide({ attempt: Number(attempt), conclusion, jobs: body.jobs ?? [] });
  console.log(`${retry ? "retry" : "no retry"}: ${reason}`);
}
