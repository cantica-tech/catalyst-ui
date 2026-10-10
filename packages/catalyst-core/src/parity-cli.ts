import { resolve } from "node:path";

import { renderParity, runParity } from "./parity.js";

/** `npm run parity -- <project>... [--json]`: the chain model against catalyst's own answers, per project. */
const args = process.argv.slice(2);
const json = args.includes("--json");
const projects = args.filter((a) => !a.startsWith("--"));
if (!projects.length) {
  console.error("usage: npm run parity -- <project>... [--json]");
  process.exit(2);
}
const reports: Record<string, unknown> = {};
for (const project of projects.map((p) => resolve(p))) {
  const report = runParity(project);
  reports[project] = report;
  if (!json) console.log(renderParity(project, report) + "\n");
}
if (json) console.log(JSON.stringify(reports, null, 2));
