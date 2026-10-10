import type { IssueKind, ValidationIssue } from "catalyst-core";

import { renderProposalContent } from "./proposals.js";

const DEFAULT_EXPECTATIONS: Record<IssueKind, string> = {
  "orphaned-artifact":
    "The artifact is registered in its index, its file exists, and it has a resolvable Targets field.",
  "unbacked-rule": "The rule is listed in the global rules index and its domain is registered with a doc file.",
  "id-reuse": "The id is defined at exactly one location.",
  "dangling-reference": "The cited id resolves to a real, existing node.",
  catalyst: "`catalyst check` no longer reports this finding.",
};

export function defaultExpectationFor(kind: IssueKind): string {
  return DEFAULT_EXPECTATIONS[kind];
}

/**
 * Whether a "Propose fix" Quick Fix should be offered for this issue —
 * refused when there's no concrete node to target, or an open
 * (non-`applied`) proposal already targets it, per
 * `openProposalsByTarget`.
 */
export function canProposeFix(issue: ValidationIssue, openTargetIds: ReadonlySet<string>): boolean {
  if (!issue.nodeId) return false;
  return !openTargetIds.has(issue.nodeId);
}

/** Builds the new proposal's content for a "Propose fix" action on one diagnostic. */
export function buildProposeFixContent(issue: ValidationIssue, id: string): string {
  const targetId = issue.nodeId ?? "unknown";
  return renderProposalContent({
    id,
    title: `Propose fix: ${issue.kind}`,
    intent: issue.message,
    targets: [targetId],
    expectations: [defaultExpectationFor(issue.kind)],
    constraints: [],
  });
}
