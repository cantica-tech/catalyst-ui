import type { JournalEntry, WatcherHandle } from "catalyst-core";
import { watchProject } from "catalyst-core";
import * as vscode from "vscode";
import { buildCodeLensesForFile } from "../codelens.js";
import { SHOW_DETAIL_COMMAND } from "../constants.js";
import { resolveDefinitionAt } from "../definitions.js";
import { lineRange, refreshDiagnosticsForDeployment } from "./deployment-diagnostics.js";
import type { ChainInspectorProvider } from "./inspector.js";

/** One deployment as the tree shows it: its display name and its project directory. */
export interface DeploymentTarget {
  name: string;
  path: string;
}

/** The instances already notified that catalyst cannot serve them, this session. */
const notifiedUnavailable = new Set<string>();

/** Each deployment's journal, oldest first, as catalyst last served it (the journal view reads it). */
export const journalByCorpus = new Map<string, JournalEntry[]>();

export interface RegisteredDeployment {
  handle: WatcherHandle;
  disposables: vscode.Disposable[];
  ownedDiagnosticFiles: Set<string>;
}

/** Sets up one resolved deployment: its watcher plus its own Definition and CodeLens providers. */
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

  // Through catalyst serve (REQ-000019); when catalyst cannot serve the project, say why (REQ-000020).
  const handle = watchProject(
    target.path,
    corpusRoot,
    ({ model, report, journal, definitions }) => {
      journalByCorpus.set(corpusRoot, journal);
      provider.setState(corpusRoot, target.name, target.path, model, definitions);
      refreshDiagnosticsForDeployment(diagnostics, ownedDiagnosticFiles, report, model);
      codeLensChangeEmitter.fire();
      // Open detail panels of this deployment show the new state (B-10).
      onUpdate(corpusRoot);
    },
    log,
    (reason) => {
      // Once per instance per session; a later failure is only logged (REQ-000069-UVqkd7cL).
      if (notifiedUnavailable.has(target.path)) return;
      notifiedUnavailable.add(target.path);
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

  return { handle, disposables, ownedDiagnosticFiles };
}
