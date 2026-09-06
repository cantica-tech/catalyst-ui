import { randomBytes } from "node:crypto";
import { join } from "node:path";

import type {
  ChainModel,
  ChainNode,
  Proposal,
  Run,
  RunStep,
  ValidationIssue,
  ValidationReport,
} from "catalyst-core";
import {
  nextProposalId,
  openProposalsByTarget,
  resolveCorpusRoot,
  watchCorpus,
} from "catalyst-core";
import * as vscode from "vscode";

import {
  buildAuthoringProposalContent,
  type ComposableArtifactType,
} from "./composer.js";
import { buildProposeFixContent, canProposeFix } from "./codeactions.js";
import { buildCodeLensesForFile } from "./codelens.js";
import { resolveDefinitionAt } from "./definitions.js";
import { buildDiagnosticsByFile } from "./diagnostics.js";
import { buildNodeDetail } from "./detail.js";
import { buildProposalSection, type ProposalSection } from "./proposals.js";
import {
  buildRunSection,
  formatRunLabel,
  formatStepLabel,
  type RunSection,
} from "./runmonitor.js";
import { buildTreeSections, type TreeSection } from "./tree.js";

const VIEW_ID = "catalystChainInspector";
const SHOW_DETAIL_COMMAND = "catalyst.showNodeDetail";
const PROPOSE_FIX_COMMAND = "catalyst.proposeFix";
const COMPOSE_PROPOSAL_COMMAND = "catalyst.composeProposal";
const DIAGNOSTIC_COLLECTION_NAME = "catalyst";
const COMPOSABLE_TYPES: ComposableArtifactType[] = [
  "rule",
  "requirement",
  "bug",
  "house-keeping",
];

type InspectorTreeItem =
  | { type: "section"; section: TreeSection }
  | { type: "node"; node: ChainNode; pending: boolean }
  | { type: "proposal-section"; section: ProposalSection }
  | { type: "proposal"; proposal: Proposal }
  | { type: "run-section"; section: RunSection }
  | { type: "run"; run: Run }
  | { type: "run-step"; step: RunStep }
  | { type: "run-ledger-entry"; text: string };

class ChainInspectorProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
  private model: ChainModel | undefined;
  private proposals: Proposal[] = [];
  private runs: Run[] = [];
  private pendingTargets: Map<string, Proposal[]> = new Map();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  setState(model: ChainModel, proposals: Proposal[], runs: Run[]): void {
    this.model = model;
    this.proposals = proposals;
    this.runs = runs;
    this.pendingTargets = openProposalsByTarget(proposals);
    this.changeEmitter.fire();
  }

  getModel(): ChainModel | undefined {
    return this.model;
  }

  /** Every known proposal, any status — the pool `nextProposalId` must never reuse from. */
  getAllProposals(): Proposal[] {
    return this.proposals;
  }

  /** Target id -> open (non-`applied`) proposals against it — for pending badges and refusing a duplicate Quick Fix. */
  getPendingTargets(): Map<string, Proposal[]> {
    return this.pendingTargets;
  }

  getTreeItem(element: InspectorTreeItem): vscode.TreeItem {
    if (element.type === "section") {
      return new vscode.TreeItem(
        `${element.section.label} (${element.section.nodes.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "proposal-section") {
      return new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "proposal") {
      return new vscode.TreeItem(
        `${element.proposal.id} — ${element.proposal.intent} (${element.proposal.status})`,
        vscode.TreeItemCollapsibleState.None,
      );
    }
    if (element.type === "run-section") {
      return new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "run") {
      return new vscode.TreeItem(
        formatRunLabel(element.run),
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "run-step") {
      return new vscode.TreeItem(
        formatStepLabel(element.step),
        vscode.TreeItemCollapsibleState.None,
      );
    }
    if (element.type === "run-ledger-entry") {
      return new vscode.TreeItem(
        element.text,
        vscode.TreeItemCollapsibleState.None,
      );
    }

    const pendingMark = element.pending ? "⏳ " : "";
    const item = new vscode.TreeItem(
      `${pendingMark}${element.node.id} — ${element.node.title}`,
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
    if (!element) {
      const sections: InspectorTreeItem[] = buildTreeSections(this.model).map(
        (section) => ({ type: "section", section }),
      );
      sections.push({
        type: "proposal-section",
        section: buildProposalSection(this.proposals),
      });
      sections.push({
        type: "run-section",
        section: buildRunSection(this.runs),
      });
      return sections;
    }
    if (element.type === "section") {
      return element.section.nodes.map((node) => ({
        type: "node",
        node,
        pending: this.pendingTargets.has(node.id),
      }));
    }
    if (element.type === "proposal-section") {
      return element.section.proposals.map((proposal) => ({
        type: "proposal",
        proposal,
      }));
    }
    if (element.type === "run-section") {
      return element.section.runs.map((run) => ({ type: "run", run }));
    }
    if (element.type === "run") {
      const stepItems: InspectorTreeItem[] = element.run.steps.map((step) => ({
        type: "run-step",
        step,
      }));
      const ledgerItems: InspectorTreeItem[] = element.run.ledger.map(
        (text) => ({ type: "run-ledger-entry", text }),
      );
      return [...stepItems, ...ledgerItems];
    }
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

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "proposal"
  );
}

async function writeProposal(
  corpusRoot: string,
  id: string,
  title: string,
  content: string,
): Promise<void> {
  const filePath = join(corpusRoot, "proposals", `${id}-${slugify(title)}.md`);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(content, "utf8"),
  );
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
  let latestReport: ValidationReport | undefined;

  if (corpusRoot) {
    const handle = watchCorpus(
      corpusRoot,
      ({ model, report, proposals, runs }) => {
        provider.setState(model, proposals, runs);
        latestReport = report;
        refreshDiagnostics(diagnostics, report, model);
        codeLensChangeEmitter.fire();
      },
    );
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

    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        selector,
        {
          provideCodeActions(
            document: vscode.TextDocument,
            range: vscode.Range,
          ): vscode.CodeAction[] {
            if (!latestReport) return [];
            const openTargetIds = new Set(provider.getPendingTargets().keys());
            const line = range.start.line + 1;

            return latestReport.issues
              .filter(
                (issue) =>
                  issue.location &&
                  issue.location.file === document.uri.fsPath &&
                  issue.location.line === line,
              )
              .filter((issue) => canProposeFix(issue, openTargetIds))
              .map((issue) => {
                const action = new vscode.CodeAction(
                  `Propose fix: ${issue.kind}`,
                  vscode.CodeActionKind.QuickFix,
                );
                action.command = {
                  command: PROPOSE_FIX_COMMAND,
                  title: "Propose fix",
                  arguments: [issue],
                };
                return action;
              });
          },
        },
        { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(
        PROPOSE_FIX_COMMAND,
        async (issue: ValidationIssue) => {
          const id = nextProposalId(provider.getAllProposals());
          const content = buildProposeFixContent(issue, id);
          await writeProposal(
            corpusRoot,
            id,
            `propose-fix-${issue.kind}`,
            content,
          );
          void vscode.window.showInformationMessage(
            `Created ${id} — an agent still needs to act on it.`,
          );
        },
      ),
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(COMPOSE_PROPOSAL_COMMAND, async () => {
        const type = (await vscode.window.showQuickPick(COMPOSABLE_TYPES, {
          placeHolder: "What kind of artifact are you proposing?",
        })) as ComposableArtifactType | undefined;
        if (!type) return;

        const domain = await vscode.window.showInputBox({ prompt: "Domain" });
        if (!domain) return;
        const title = await vscode.window.showInputBox({ prompt: "Title" });
        if (!title) return;
        const description =
          (await vscode.window.showInputBox({ prompt: "Description" })) ?? "";
        const targetsRaw =
          (await vscode.window.showInputBox({
            prompt: "Related ids (comma-separated, optional)",
          })) ?? "";
        const targets = targetsRaw
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        const id = nextProposalId(provider.getAllProposals());
        const content = buildAuthoringProposalContent(
          { type, domain, targets, title, description },
          id,
        );
        await writeProposal(corpusRoot, id, title, content);
        void vscode.window.showInformationMessage(
          `Created ${id} — an agent still needs to act on it.`,
        );
      }),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(SHOW_DETAIL_COMMAND, (nodeId: string) => {
      const model = provider.getModel();
      if (!model) return;
      const payload = buildNodeDetail(
        model,
        nodeId,
        provider.getPendingTargets(),
      );
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
