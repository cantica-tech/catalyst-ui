import { randomBytes } from "node:crypto";

import type { ChainModel, ChainNode, ValidationReport } from "catalyst-core";
import { resolveCorpusRoot, watchCorpus } from "catalyst-core";
import * as vscode from "vscode";

import { buildCodeLensesForFile } from "./codelens.js";
import { buildDiagnosticsByFile } from "./diagnostics.js";
import { resolveDefinitionAt } from "./definitions.js";
import { buildNodeDetail } from "./detail.js";
import { buildTreeSections, type TreeSection } from "./tree.js";

const VIEW_ID = "catalystChainInspector";
const SHOW_DETAIL_COMMAND = "catalyst.showNodeDetail";
const DIAGNOSTIC_COLLECTION_NAME = "catalyst";

type InspectorTreeItem =
  { type: "section"; section: TreeSection } | { type: "node"; node: ChainNode };

class ChainInspectorProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
  private model: ChainModel | undefined;
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  setModel(model: ChainModel): void {
    this.model = model;
    this.changeEmitter.fire();
  }

  getModel(): ChainModel | undefined {
    return this.model;
  }

  getTreeItem(element: InspectorTreeItem): vscode.TreeItem {
    if (element.type === "section") {
      return new vscode.TreeItem(
        `${element.section.label} (${element.section.nodes.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }

    const item = new vscode.TreeItem(
      `${element.node.id} — ${element.node.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    item.command = {
      command: SHOW_DETAIL_COMMAND,
      title: "Show detail",
      arguments: [element.node.id],
    };
    return item;
  }

  getChildren(element?: InspectorTreeItem): InspectorTreeItem[] {
    if (!this.model) return [];
    if (!element)
      return buildTreeSections(this.model).map((section) => ({
        type: "section",
        section,
      }));
    if (element.type === "section")
      return element.section.nodes.map((node) => ({ type: "node", node }));
    return [];
  }
}

function renderWebviewHtml(scriptUri: vscode.Uri, payload: unknown): string {
  const nonce = randomBytes(16).toString("hex");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';" />
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}">window.__CATALYST_INITIAL_PAYLOAD__ = ${JSON.stringify(payload)};</script>
<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
}

function lineRange(oneIndexedLine: number): vscode.Range {
  const line = Math.max(0, oneIndexedLine - 1);
  return new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER);
}

function refreshDiagnostics(
  collection: vscode.DiagnosticCollection,
  report: ValidationReport,
  model: ChainModel,
): void {
  collection.clear();
  for (const [file, diagnostics] of buildDiagnosticsByFile(report, model)) {
    collection.set(
      vscode.Uri.file(file),
      diagnostics.map(
        (d) =>
          new vscode.Diagnostic(
            lineRange(d.line),
            d.message,
            d.severity === "error"
              ? vscode.DiagnosticSeverity.Error
              : vscode.DiagnosticSeverity.Warning,
          ),
      ),
    );
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ChainInspectorProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(VIEW_ID, provider),
  );

  const projectRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const corpusRoot = projectRoot ? resolveCorpusRoot(projectRoot) : null;

  const diagnostics = vscode.languages.createDiagnosticCollection(
    DIAGNOSTIC_COLLECTION_NAME,
  );
  context.subscriptions.push(diagnostics);

  const codeLensChangeEmitter = new vscode.EventEmitter<void>();

  if (corpusRoot) {
    const handle = watchCorpus(corpusRoot, ({ model, report }) => {
      provider.setModel(model);
      refreshDiagnostics(diagnostics, report, model);
      codeLensChangeEmitter.fire();
    });
    context.subscriptions.push({ dispose: () => void handle.close() });

    const selector: vscode.DocumentSelector = {
      pattern: new vscode.RelativePattern(corpusRoot, "**/*.md"),
    };

    context.subscriptions.push(
      vscode.languages.registerDefinitionProvider(selector, {
        provideDefinition(document, position) {
          const model = provider.getModel();
          if (!model) return null;
          const location = resolveDefinitionAt(
            model,
            document.lineAt(position.line).text,
            position.character,
          );
          if (!location) return null;
          return new vscode.Location(
            vscode.Uri.file(location.file),
            lineRange(location.line).start,
          );
        },
      }),
    );

    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(selector, {
        onDidChangeCodeLenses: codeLensChangeEmitter.event,
        provideCodeLenses(document) {
          const model = provider.getModel();
          if (!model) return [];
          return buildCodeLensesForFile(model, document.uri.fsPath).map(
            (spec) =>
              new vscode.CodeLens(lineRange(spec.line), {
                title: spec.title,
                command: SHOW_DETAIL_COMMAND,
                arguments: [spec.targetNodeId],
              }),
          );
        },
      }),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(SHOW_DETAIL_COMMAND, (nodeId: string) => {
      const model = provider.getModel();
      if (!model) return;
      const payload = buildNodeDetail(model, nodeId);
      if (!payload) return;

      const panel = vscode.window.createWebviewPanel(
        "catalystNodeDetail",
        `Node: ${nodeId}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
        },
      );
      const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(
          context.extensionUri,
          "..",
          "catalyst-ui",
          "dist",
          "webview.js",
        ),
      );
      panel.webview.html = renderWebviewHtml(scriptUri, payload);
    }),
  );
}

export function deactivate(): void {}
