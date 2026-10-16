import type { JournalEntry, ValidationReport, WatcherHandle } from "catalyst-core";
import { watchProject } from "catalyst-core";
import * as vscode from "vscode";
import { canProposeFix } from "./codeactions.js";
import { buildCodeLensesForFile } from "./codelens.js";
import { PROPOSE_FIX_COMMAND, SHOW_DETAIL_COMMAND } from "./constants.js";
import { resolveDefinitionAt } from "./definitions.js";
import { lineRange, refreshDiagnosticsForDeployment } from "./deployment-diagnostics.js";
import type { ChainInspectorProvider } from "./inspector.js";

/** One deployment as the tree shows it: its display name and its project directory. */
export interface DeploymentTarget {
  name: string;
  path: string;
}

/** Each deployment's journal, oldest first, as catalyst last served it (the journal view reads it). */
export const journalByCorpus = new Map<string, JournalEntry[]>();

export interface RegisteredDeployment {
  handle: WatcherHandle;
  disposables: vscode.Disposable[];
  ownedDiagnosticFiles: Set<string>;
}

/** Sets up one resolved deployment: its watcher plus its own Definition/CodeLens/CodeActions providers. */
export function setupDeployment(
  target: DeploymentTarget,
  corpusRoot: string,
  provider: ChainInspectorProvider,
  diagnostics: vscode.DiagnosticCollection,
  codeLensChangeEmitter: vscode.EventEmitter<void>,
  onUpdate: (corpusRoot: string) => void = () => undefined,
  log: (message: string) => void = () => undefined,
): RegisteredDeployment {
  const ownedDiagnosticFiles = new Set<string>();
  let latestReport: ValidationReport | undefined;

  // Through catalyst serve (REQ-000019); when catalyst cannot serve the project, say why (REQ-000020).
  const handle = watchProject(
    target.path,
    corpusRoot,
    ({ model, report, journal, proposals, runs, users, roles }) => {
      journalByCorpus.set(corpusRoot, journal);
      provider.setState(corpusRoot, target.name, target.path, model, proposals, runs, users, roles);
      latestReport = report;
      refreshDiagnosticsForDeployment(diagnostics, ownedDiagnosticFiles, report, model);
      codeLensChangeEmitter.fire();
      // Open detail panels of this deployment show the new state (B-10).
      onUpdate(corpusRoot);
    },
    log,
    (reason) => {
      void vscode.window.showWarningMessage(`Catalyst: ${reason}`);
    },
  );

  const selector: vscode.DocumentSelector = {
    pattern: new vscode.RelativePattern(corpusRoot, "**/*.md"),
  };

  const disposables: vscode.Disposable[] = [];

  disposables.push(
    vscode.languages.registerDefinitionProvider(selector, {
      provideDefinition(document, position) {
        const model = provider.getModel(corpusRoot);
        if (!model) return null;
        const location = resolveDefinitionAt(model, document.lineAt(position.line).text, position.character);
        if (!location) return null;
        return new vscode.Location(vscode.Uri.file(location.file), lineRange(location.line).start);
      },
    }),
  );

  disposables.push(
    vscode.languages.registerCodeLensProvider(selector, {
      onDidChangeCodeLenses: codeLensChangeEmitter.event,
      provideCodeLenses(document) {
        const model = provider.getModel(corpusRoot);
        if (!model) return [];
        return buildCodeLensesForFile(model, document.uri.fsPath).map(
          (spec) =>
            new vscode.CodeLens(lineRange(spec.line), {
              title: spec.title,
              command: SHOW_DETAIL_COMMAND,
              arguments: [corpusRoot, spec.targetNodeId],
            }),
        );
      },
    }),
  );

  disposables.push(
    vscode.languages.registerCodeActionsProvider(
      selector,
      {
        provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
          if (!latestReport) return [];
          const openTargetIds = new Set(provider.getPendingTargets(corpusRoot).keys());
          const line = range.start.line + 1;

          return latestReport.issues
            .filter((issue) => issue.location?.file === document.uri.fsPath && issue.location.line === line)
            .filter((issue) => canProposeFix(issue, openTargetIds))
            .map((issue) => {
              const action = new vscode.CodeAction(`Propose fix: ${issue.kind}`, vscode.CodeActionKind.QuickFix);
              action.command = {
                command: PROPOSE_FIX_COMMAND,
                title: "Propose fix",
                arguments: [corpusRoot, issue],
              };
              return action;
            });
        },
      },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  return { handle, disposables, ownedDiagnosticFiles };
}
