import {
  buildShortFormIndex,
  isFrameworkRuleId,
  resolveIdReference,
} from "./ids.js";
import type {
  ChainModel,
  ChainNode,
  ValidationIssue,
  ValidationReport,
} from "./types.js";

/**
 * The ids a node cites through a structured field (Targets, Requirements,
 * Steps, Feature, Parent, Linked) — what the kernel's ETD-driven
 * `catalyst check` validates as references.
 */
function fieldReferences(node: ChainNode): string[] {
  const refs: string[] = [];
  if (node.kind === "dev-artifact") {
    refs.push(
      ...node.targets,
      ...(node.requirements ?? []),
      ...(node.steps ?? []),
    );
    if (node.feature) refs.push(node.feature);
  }
  if (node.kind === "step" && node.parent) refs.push(node.parent);
  if (node.kind === "roadmap" && node.linked) refs.push(node.linked);
  return refs;
}

/**
 * Global validation over a full chain model — never incremental, since every
 * check here is inherently cross-cutting (Rules-of-Rules.md's own framing
 * for why a reparse always revalidates everything). Four checks, each
 * concretely defined against a specific rule:
 *
 * 1. orphaned-artifact — a dev-artifact registered in its index but its file
 *    is missing (or the reverse), or a dev-artifact with no Targets rule at
 *    all (Rules-of-Rules.md §1: no development without a targeted rule).
 *    Same registered/fileExists check applies to a step, plus a step with
 *    no Parent field (Rules-of-Rules.md §21: always names exactly one
 *    parent — a requirement or a bug).
 * 2. unbacked-rule — a rule not listed in the global rules/rules.md, or
 *    whose domain isn't registered (with an existing doc file) in
 *    rules/domains/domains.md (§5/§7). `rr-META-*` rules are exempt — they
 *    are self-governing inside Rules-of-Rules.md §3, not the global index.
 * 3. id-reuse — the same id defined at more than one location.
 * 4. dangling-reference — matching the kernel's `catalyst check` (B-03):
 *    a structured field (Targets, Requirements, Steps, Feature, Parent,
 *    Linked) citing an id that does not exist is an error. A free-text
 *    citation the kernel does not check is only a warning, and resolves
 *    more leniently: a unique short form (`REQ-000014` for
 *    `REQ-000014-UVqkd7cL`) resolves, and a framework rule (`rr-`, `fw-`)
 *    is external, never dangling.
 */
export function validate(model: ChainModel): ValidationReport {
  const start = performance.now();
  const issues: ValidationIssue[] = [];

  for (const node of model.nodes.values()) {
    if (node.kind !== "dev-artifact") continue;
    if (!node.registered) {
      issues.push({
        kind: "orphaned-artifact",
        severity: "error",
        nodeId: node.id,
        message: `${node.id} has a file on disk but is not registered in its index`,
        location: node.location,
      });
    }
    if (!node.fileExists) {
      issues.push({
        kind: "orphaned-artifact",
        severity: "error",
        nodeId: node.id,
        message: `${node.id} is registered in its index but its file is missing`,
        location: node.location,
      });
    }
    if (node.fileExists && node.targets.length === 0) {
      issues.push({
        kind: "orphaned-artifact",
        severity: "error",
        nodeId: node.id,
        message: `${node.id} has no Targets rule (no development without a targeted rule)`,
        location: node.location,
      });
    }
  }

  for (const node of model.nodes.values()) {
    if (node.kind !== "step") continue;
    if (!node.registered) {
      issues.push({
        kind: "orphaned-artifact",
        severity: "error",
        nodeId: node.id,
        message: `${node.id} has a file on disk but is not registered in steps/steps.md`,
        location: node.location,
      });
    }
    if (!node.fileExists) {
      issues.push({
        kind: "orphaned-artifact",
        severity: "error",
        nodeId: node.id,
        message: `${node.id} is registered in steps/steps.md but its file is missing`,
        location: node.location,
      });
    }
    if (node.fileExists && !node.parent) {
      issues.push({
        kind: "orphaned-artifact",
        severity: "error",
        nodeId: node.id,
        message: `${node.id} has no Parent field (a step always names exactly one parent — a requirement or a bug)`,
        location: node.location,
      });
    }
  }

  for (const node of model.nodes.values()) {
    if (node.kind !== "rule") continue;
    if (node.docPrefix === "rr") continue;

    if (!node.registeredInRulesIndex) {
      issues.push({
        kind: "unbacked-rule",
        severity: "error",
        nodeId: node.id,
        message: `${node.id} is not listed in rules/rules.md`,
        location: node.location,
      });
    }

    const domain = model.nodes.get(node.domain);
    if (!domain || domain.kind !== "domain") {
      issues.push({
        kind: "unbacked-rule",
        severity: "error",
        nodeId: node.id,
        message: `${node.id}'s domain \`${node.domain}\` is not registered in rules/domains/domains.md`,
        location: node.location,
      });
    } else if (!domain.hasDoc) {
      issues.push({
        kind: "unbacked-rule",
        severity: "error",
        nodeId: node.id,
        message: `${node.id}'s domain \`${node.domain}\` has no domain doc file`,
        location: node.location,
      });
    }
  }

  for (const [id, locations] of model.definitionsById) {
    if (locations.length <= 1) continue;
    issues.push({
      kind: "id-reuse",
      severity: "error",
      nodeId: id,
      message: `${id} is defined ${locations.length} times: ${locations.map((l) => `${l.file}:${l.line}`).join(", ")}`,
    });
  }

  const shortIndex = buildShortFormIndex(model.nodes.keys());
  for (const node of model.nodes.values()) {
    const fields = new Set(fieldReferences(node));
    const seen = new Set<string>();
    for (const ref of [...fields, ...node.references]) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      if (fields.has(ref)) {
        if (model.nodes.has(ref)) continue;
        issues.push({
          kind: "dangling-reference",
          severity: "error",
          nodeId: node.id,
          message: `${node.id} references \`${ref}\`, which does not exist`,
          location: node.location,
        });
        continue;
      }
      if (resolveIdReference(model.nodes, ref, shortIndex) !== null) continue;
      if (isFrameworkRuleId(ref)) continue;
      issues.push({
        kind: "dangling-reference",
        severity: "warning",
        nodeId: node.id,
        message: `${node.id} mentions \`${ref}\`, which does not exist`,
        location: node.location,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  return {
    issues,
    nodeCount: model.nodes.size,
    errorCount,
    warningCount: issues.length - errorCount,
    durationMs: performance.now() - start,
  };
}
