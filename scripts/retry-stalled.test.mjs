// The retry decision of .github/workflows/retry-stalled.yml, fed with the jobs
// GitHub recorded for the Desktop run 41483376994, attempt 1 (its macOS build
// stalled and was cancelled at 15 minutes), and variants of it.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { decide } from "./retry-stalled.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "retry-stalled.fixture.json");
/** @type {{ jobs: { name: string, conclusion: string, labels: string[] }[] }} */
const recorded = JSON.parse(readFileSync(fixture, "utf8"));

/** The recorded jobs, with the conclusions in `changes` (by job name). */
function jobsWith(changes) {
  return recorded.jobs.map((job) => ({ ...job, conclusion: changes[job.name] ?? job.conclusion }));
}

test("a cancelled macOS job is retried", () => {
  const result = decide({ attempt: 1, conclusion: "cancelled", jobs: recorded.jobs });
  assert.equal(result.retry, true);
  assert.match(result.reason, /build \(macos-latest\) \(cancelled\)/);
});

test("a timed-out macOS job is retried", () => {
  const jobs = jobsWith({ "build (macos-latest)": "timed_out" });
  assert.equal(decide({ attempt: 1, conclusion: "timed_out", jobs }).retry, true);
});

test("a macOS job that really failed is not retried", () => {
  const jobs = jobsWith({ "build (macos-latest)": "failure" });
  const result = decide({ attempt: 1, conclusion: "failure", jobs });
  assert.equal(result.retry, false);
  assert.match(result.reason, /really failed/);
});

test("a cancelled Linux job is not retried", () => {
  const jobs = jobsWith({ "build (macos-latest)": "success", "build (ubuntu-latest)": "cancelled" });
  const result = decide({ attempt: 1, conclusion: "cancelled", jobs });
  assert.equal(result.retry, false);
  assert.match(result.reason, /another OS/);
});

test("a stalled macOS job beside a failed Windows job is not retried", () => {
  const jobs = jobsWith({ "build (windows-latest)": "failure" });
  assert.equal(decide({ attempt: 1, conclusion: "failure", jobs }).retry, false);
});

test("a second attempt is never retried", () => {
  const result = decide({ attempt: 2, conclusion: "cancelled", jobs: recorded.jobs });
  assert.equal(result.retry, false);
  assert.match(result.reason, /attempt 2/);
});

test("a successful run is not retried", () => {
  const jobs = jobsWith({ "build (macos-latest)": "success" });
  assert.equal(decide({ attempt: 1, conclusion: "success", jobs }).retry, false);
});

test("the command line prints one line", () => {
  const script = join(here, "retry-stalled.mjs");
  const out = execFileSync(process.execPath, [script, fixture, "1", "cancelled"], { encoding: "utf8" });
  assert.equal(out, "retry: macOS job(s) stalled: build (macos-latest) (cancelled)\n");
  const again = execFileSync(process.execPath, [script, fixture, "2", "cancelled"], { encoding: "utf8" });
  assert.match(again, /^no retry: attempt 2/);
});
