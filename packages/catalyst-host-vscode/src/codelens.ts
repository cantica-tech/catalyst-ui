import type { ChainModel } from "catalyst-core";

export interface CodeLensSpec {
  line: number;
  title: string;
  targetNodeId: string;
}

function idsOf(ids: Set<string> | undefined): string[] {
  return ids ? [...ids].sort() : [];
}

/**
 * One CodeLens per node defined in `filePath`, summarizing its resolved
 * links (what it targets/cites, and what cites it back) — "the governing
 * [artifact] for the open file," since no work-items layer is active in
 * this deployment. Clicking opens that same node's own detail webview
 * (`catalyst.showNodeDetail`, from Phase 2), which already renders both
 * directions.
 */
export function buildCodeLensesForFile(
  model: ChainModel,
  filePath: string,
): CodeLensSpec[] {
  const lenses: CodeLensSpec[] = [];

  for (const node of model.nodes.values()) {
    if (node.location.file !== filePath) continue;

    const targets = idsOf(model.edges.get(node.id));
    const referencedBy = idsOf(model.reverseEdges.get(node.id));
    if (targets.length === 0 && referencedBy.length === 0) continue;

    // Deliberately direction-neutral wording: an edge here can be a real
    // structural field (a requirement's own Targets) or just a mutual
    // prose citation (a rule's own "Targeted by `REQ-X`"), and both
    // produce edges the same way — "Targets"/"Referenced by" would read
    // backwards for the latter (a rule doesn't "target" a requirement).
    const parts: string[] = [];
    if (targets.length > 0) parts.push(`Links to ${targets.join(", ")}`);
    if (referencedBy.length > 0)
      parts.push(`Linked from ${referencedBy.join(", ")}`);

    lenses.push({
      line: node.location.line,
      title: parts.join(" · "),
      targetNodeId: node.id,
    });
  }

  return lenses.sort((a, b) => a.line - b.line);
}
