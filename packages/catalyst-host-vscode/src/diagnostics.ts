import type {
  ChainModel,
  IssueSeverity,
  ValidationIssue,
  ValidationReport,
} from "catalyst-core";

export interface RawDiagnostic {
  line: number;
  severity: IssueSeverity;
  message: string;
  /** The issue this diagnostic came from — lets a CodeActionProvider offer a targeted "Propose fix" without re-deriving it from the message string. */
  issue: ValidationIssue;
}

/**
 * Maps a validation report's issues onto the files they concern, so the
 * host can turn each into a native `vscode.Diagnostic` — this alone gives
 * a worklist (the Problems panel), click-to-jump, and gutter marks, all
 * from one API. An issue with no single `location` (id reuse today) gets
 * one diagnostic per definition site instead of being dropped, since the
 * issue is inherently about more than one place.
 */
export function buildDiagnosticsByFile(
  report: ValidationReport,
  model: ChainModel,
): Map<string, RawDiagnostic[]> {
  const byFile = new Map<string, RawDiagnostic[]>();

  const add = (file: string, line: number, issue: ValidationIssue) => {
    const list = byFile.get(file) ?? [];
    list.push({
      line,
      severity: issue.severity,
      message: issue.message,
      issue,
    });
    byFile.set(file, list);
  };

  for (const issue of report.issues) {
    if (issue.location) {
      add(issue.location.file, issue.location.line, issue);
      continue;
    }
    if (!issue.nodeId) continue;
    for (const location of model.definitionsById.get(issue.nodeId) ?? []) {
      add(location.file, location.line, issue);
    }
  }

  return byFile;
}
