import { spawnSync } from "node:child_process";

import { buildChainModel } from "./graph.js";
import { buildShortFormIndex, resolveIdReference } from "./ids.js";
import { parseCorpus } from "./parser.js";
import { type CatalystCheck, type CatalystGraph, catalystCommand } from "./catalyst-source.js";
import type { ChainModel, ChainNode, IssueKind } from "./types.js";
import { validate } from "./validator.js";

/**
 * Parity of the chain model with catalyst's own answers (REQ-000018): before
 * the extension reads a criterion through `catalyst serve` instead of this
 * package's parser, the two must agree on real deployments. `compareModel`
 * is pure; `runParity` gets catalyst's answers from its CLI
 * (`catalyst graph --json`, `catalyst check --json`) and changes nothing.
 */

export interface StatusDifference {
  id: string;
  model: string;
  catalyst: string;
}

export interface ParityReport {
  nodes: { both: number; onlyModel: string[]; onlyCatalyst: string[] };
  statuses: StatusDifference[];
  edges: { both: number; missingInModel: [string, string][]; onlyModel: [string, string][] };
  validation: { model: Partial<Record<IssueKind, number>>; catalystChain: Record<string, number> };
}

function statusOf(node: ChainNode): string | undefined {
  return "status" in node && typeof node.status === "string" ? node.status : undefined;
}

/** The edges catalyst's graph implies: each field link and mention resolved to a node, and each rule's domain. */
export function catalystEdges(graph: CatalystGraph): Set<string> {
  const ids = new Set<string>([
    ...graph.rules.map((r) => r.id),
    ...graph.artifacts.map((a) => a.id),
    ...graph.domains.map((d) => d.code),
  ]);
  const short = buildShortFormIndex(ids);
  const out = new Set<string>();
  for (const art of graph.artifacts) {
    for (const cited of [...Object.values(art.links), art.mentions]) {
      for (const ref of cited) {
        const to = resolveIdReference(ids, ref, short);
        if (to && to !== art.id) out.add(`${art.id}\u0000${to}`);
      }
    }
  }
  for (const rule of graph.rules) {
    if (rule.domain && ids.has(rule.domain)) out.add(`${rule.id}\u0000${rule.domain}`);
    for (const ref of rule.mentions) {
      const to = resolveIdReference(ids, ref, short);
      if (to && to !== rule.id) out.add(`${rule.id}\u0000${to}`);
    }
  }
  return out;
}

export function compareModel(model: ChainModel, graph: CatalystGraph, check?: CatalystCheck): ParityReport {
  const catalystIds = new Set<string>([
    ...graph.rules.map((r) => r.id),
    ...graph.artifacts.map((a) => a.id),
    ...graph.domains.map((d) => d.code),
  ]);
  const modelIds = new Set(model.nodes.keys());
  const onlyModel = [...modelIds].filter((id) => !catalystIds.has(id)).sort();
  const onlyCatalyst = [...catalystIds].filter((id) => !modelIds.has(id)).sort();

  const statuses: StatusDifference[] = [];
  for (const art of graph.artifacts) {
    const node = model.nodes.get(art.id);
    const theirs = typeof art.Status === "string" ? art.Status.trim() : "";
    const ours = node ? (statusOf(node) ?? "").trim() : "";
    if (node && theirs && ours !== theirs) statuses.push({ id: art.id, model: ours, catalyst: theirs });
  }
  for (const rule of graph.rules) {
    const node = model.nodes.get(rule.id);
    if (!node) continue;
    const retired = (statusOf(node) ?? "").startsWith("🗑");
    if (retired !== rule.retired) {
      statuses.push({ id: rule.id, model: statusOf(node) ?? "", catalyst: rule.retired ? "retired" : "not retired" });
    }
  }

  const theirs = catalystEdges(graph);
  const ours = new Set<string>();
  for (const [from, tos] of model.edges) for (const to of tos) ours.add(`${from}\u0000${to}`);
  const pair = (key: string) => key.split("\u0000") as [string, string];
  const missingInModel = [...theirs]
    .filter((e) => !ours.has(e))
    .sort()
    .map(pair);
  const onlyModelEdges = [...ours]
    .filter((e) => !theirs.has(e))
    .sort()
    .map(pair);

  const modelCounts: Partial<Record<IssueKind, number>> = {};
  for (const issue of validate(model).issues) {
    if (issue.severity === "error") modelCounts[issue.kind] = (modelCounts[issue.kind] ?? 0) + 1;
  }
  const chain: Record<string, number> = {};
  for (const error of check?.errors ?? []) {
    const match = /^chain\s+(\S+?):?\s/.exec(error);
    if (match) chain[match[1]] = (chain[match[1]] ?? 0) + 1;
  }

  return {
    nodes: { both: modelIds.size - onlyModel.length, onlyModel, onlyCatalyst },
    statuses,
    edges: { both: [...ours].filter((e) => theirs.has(e)).length, missingInModel, onlyModel: onlyModelEdges },
    validation: { model: modelCounts, catalystChain: chain },
  };
}

function catalystJson(project: string, args: string[]): unknown {
  const [cmd, ...pre] = catalystCommand();
  const res = spawnSync(cmd, [...pre, "--project", project, ...args, "--json"], { encoding: "utf8" });
  if (res.error) throw new Error(`cannot run catalyst: ${res.error.message}`);
  try {
    return JSON.parse(res.stdout) as unknown;
  } catch {
    throw new Error(`catalyst ${args.join(" ")} printed no JSON for ${project}: ${res.stderr.trim()}`);
  }
}

/** Parse a project's criterion with this package and compare it with catalyst's answers. */
export function runParity(project: string): ParityReport & { criterion: string } {
  const where = catalystJson(project, ["where"]) as { criterion?: string };
  const criterion = where.criterion;
  if (!criterion) throw new Error(`catalyst where found no criterion for ${project}`);
  const parsed = parseCorpus(criterion);
  if (!parsed) throw new Error(`${criterion} did not parse`);
  const report = compareModel(
    buildChainModel(parsed),
    catalystJson(project, ["graph"]) as CatalystGraph,
    catalystJson(project, ["check"]) as CatalystCheck,
  );
  return { criterion, ...report };
}

export function renderParity(project: string, r: ParityReport): string {
  const list = (xs: string[], n = 10) =>
    xs.length ? ` (${xs.slice(0, n).join(", ")}${xs.length > n ? ", …" : ""})` : "";
  const edges = (xs: [string, string][], n = 10) =>
    xs.length
      ? ` (${xs
          .slice(0, n)
          .map(([a, b]) => `${a}→${b}`)
          .join(", ")}${xs.length > n ? ", …" : ""})`
      : "";
  return [
    `parity: ${project}`,
    `  nodes: ${r.nodes.both} in both; ${r.nodes.onlyModel.length} only in the model${list(r.nodes.onlyModel)}; ${r.nodes.onlyCatalyst.length} only in catalyst${list(r.nodes.onlyCatalyst)}`,
    `  statuses: ${r.statuses.length} differ${list(
      r.statuses.map((s) => `${s.id}: ${s.model || "—"} ≠ ${s.catalyst}`),
      5,
    )}`,
    `  edges: ${r.edges.both} in both; ${r.edges.missingInModel.length} missing in the model${edges(r.edges.missingInModel)}; ${r.edges.onlyModel.length} only in the model${edges(r.edges.onlyModel, 5)}`,
    `  validation errors: model ${JSON.stringify(r.validation.model)}; catalyst chain ${JSON.stringify(r.validation.catalystChain)}`,
  ].join("\n");
}
