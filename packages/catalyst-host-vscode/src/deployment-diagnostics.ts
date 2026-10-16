import type { ChainModel, ValidationReport } from "catalyst-core";
import * as vscode from "vscode";
import { buildDiagnosticsByFile } from "./diagnostics.js";

export function lineRange(oneIndexedLine: number): vscode.Range {
  const line = Math.max(0, oneIndexedLine - 1);
  return new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
}

/**
 * Refreshes only the diagnostics this one deployment owns, tracked via
 * `ownedFiles` (mutated in place) — never a global `collection.clear()`,
 * which would wipe every other deployment's diagnostics the moment any
 * one watcher fires.
 */
export function refreshDiagnosticsForDeployment(
  collection: vscode.DiagnosticCollection,
  ownedFiles: Set<string>,
  report: ValidationReport,
  model: ChainModel,
): void {
  const byFile = buildDiagnosticsByFile(report, model);
  const newFiles = new Set(byFile.keys());

  for (const file of ownedFiles) {
    if (!newFiles.has(file)) collection.delete(vscode.Uri.file(file));
  }
  for (const [file, fileDiagnostics] of byFile) {
    collection.set(
      vscode.Uri.file(file),
      fileDiagnostics.map(
        (d) =>
          new vscode.Diagnostic(
            lineRange(d.line),
            d.message,
            d.severity === "error" ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning,
          ),
      ),
    );
  }

  ownedFiles.clear();
  for (const file of newFiles) ownedFiles.add(file);
}
