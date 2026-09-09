import { randomBytes } from "node:crypto";
import { join } from "node:path";

import type {
  ChainModel,
  ChainNode,
  IamRole,
  IamUser,
  Proposal,
  RoadmapNode,
  Run,
  RunStep,
  ValidationIssue,
  ValidationReport,
  WatcherHandle,
  WebviewPayload,
} from "catalyst-core";
import {
  composeSlashCommand,
  discoverSlashCommands,
  nextProposalId,
  openProposalsByTarget,
  parseJournal,
  resolveAgentCommand,
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
import {
  buildIamRoleDetail,
  buildIamUserDetail,
  buildNodeDetail,
} from "./detail.js";
import {
  buildInstantiationPrompt,
  findSiblingFrameworkRepo,
} from "./framework-discovery.js";
import {
  buildRoleSection,
  buildUserSection,
  type RoleSection,
  type UserSection,
} from "./iam.js";
import { buildProposalSection, type ProposalSection } from "./proposals.js";
import {
  buildRoadmapSection,
  type RoadmapGroup,
  type RoadmapSection,
} from "./roadmaps.js";
import {
  buildRunSection,
  formatRunLabel,
  formatStepLabel,
  type RunSection,
} from "./runmonitor.js";
import { buildTreeSections, type TreeSection } from "./tree.js";

const VIEW_ID = "catalystChainInspector";
const SHOW_DETAIL_COMMAND = "catalyst.showNodeDetail";
const SHOW_IAM_DETAIL_COMMAND = "catalyst.showIamDetail";
const OPEN_JOURNAL_COMMAND = "catalyst.openJournal";
const OPEN_BACKLOG_COMMAND = "catalyst.openBacklog";
const PROPOSE_FIX_COMMAND = "catalyst.proposeFix";
const COMPOSE_PROPOSAL_COMMAND = "catalyst.composeProposal";
const RUN_SLASH_COMMAND_COMMAND = "catalyst.runSlashCommand";
const DIAGNOSTIC_COLLECTION_NAME = "catalyst";
const ONBOARDING_DISMISSED_PREFIX = "catalyst.onboarding.dismissed:";
const COMPOSABLE_TYPES: ComposableArtifactType[] = [
  "rule",
  "requirement",
  "bug",
  "house-keeping",
];

interface DeploymentView {
  corpusRoot: string;
  folderName: string;
  model: ChainModel;
  proposals: Proposal[];
  runs: Run[];
  users: IamUser[];
  roles: IamRole[];
  pendingTargets: Map<string, Proposal[]>;
}

type InspectorTreeItem =
  | { type: "deployment"; corpusRoot: string; folderName: string }
  | { type: "section"; corpusRoot: string; section: TreeSection }
  | { type: "node"; corpusRoot: string; node: ChainNode; pending: boolean }
  | { type: "roadmap-section"; corpusRoot: string; section: RoadmapSection }
  | { type: "roadmap-group"; corpusRoot: string; group: RoadmapGroup }
  | { type: "proposal-section"; corpusRoot: string; section: ProposalSection }
  | { type: "proposal"; corpusRoot: string; proposal: Proposal }
  | { type: "run-section"; corpusRoot: string; section: RunSection }
  | { type: "run"; corpusRoot: string; run: Run }
  | { type: "run-step"; step: RunStep }
  | { type: "run-ledger-entry"; text: string }
  | { type: "user-section"; corpusRoot: string; section: UserSection }
  | { type: "user"; corpusRoot: string; user: IamUser }
  | { type: "role-section"; corpusRoot: string; section: RoleSection }
  | { type: "role"; corpusRoot: string; role: IamRole }
  | { type: "journal-entry"; corpusRoot: string }
  | { type: "backlog-entry"; corpusRoot: string };

/**
 * Deployment-aware: with exactly one resolved deployment its root shows
 * that deployment's sections directly (today's single-folder UX,
 * unchanged); with more than one, the root shows one collapsible entry
 * per deployment (named after its workspace folder) expanding into its
 * own sections — node ids are only unique within one corpus, so every
 * item below the root carries which deployment it came from.
 */
class ChainInspectorProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
  private readonly deployments = new Map<string, DeploymentView>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  setState(
    corpusRoot: string,
    folderName: string,
    model: ChainModel,
    proposals: Proposal[],
    runs: Run[],
    users: IamUser[],
    roles: IamRole[],
  ): void {
    this.deployments.set(corpusRoot, {
      corpusRoot,
      folderName,
      model,
      proposals,
      runs,
      users,
      roles,
      pendingTargets: openProposalsByTarget(proposals),
    });
    this.changeEmitter.fire();
  }

  removeDeployment(corpusRoot: string): void {
    this.deployments.delete(corpusRoot);
    this.changeEmitter.fire();
  }

  getModel(corpusRoot: string): ChainModel | undefined {
    return this.deployments.get(corpusRoot)?.model;
  }

  getFolderName(corpusRoot: string): string | undefined {
    return this.deployments.get(corpusRoot)?.folderName;
  }

  /** Every known proposal for this deployment, any status — the pool `nextProposalId` must never reuse from. */
  getAllProposals(corpusRoot: string): Proposal[] {
    return this.deployments.get(corpusRoot)?.proposals ?? [];
  }

  /** Target id -> open (non-`applied`) proposals against it, for this deployment — for pending badges and refusing a duplicate Quick Fix. */
  getPendingTargets(corpusRoot: string): Map<string, Proposal[]> {
    return this.deployments.get(corpusRoot)?.pendingTargets ?? new Map();
  }

  /** Every registered user for this deployment — for the Users section and IAM cross-referencing. */
  getUsers(corpusRoot: string): IamUser[] {
    return this.deployments.get(corpusRoot)?.users ?? [];
  }

  /** Every registered role for this deployment — for the Roles section and IAM cross-referencing. */
  getRoles(corpusRoot: string): IamRole[] {
    return this.deployments.get(corpusRoot)?.roles ?? [];
  }

  /** Every currently-registered deployment's corpus root, in insertion order. */
  getCorpusRoots(): string[] {
    return [...this.deployments.keys()];
  }

  getTreeItem(element: InspectorTreeItem): vscode.TreeItem {
    if (element.type === "deployment") {
      return new vscode.TreeItem(
        element.folderName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
    }
    if (element.type === "section") {
      return new vscode.TreeItem(
        `${element.section.label} (${element.section.nodes.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "roadmap-section") {
      return new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "roadmap-group") {
      const retiredMark = element.group.retired ? " (retired)" : "";
      return new vscode.TreeItem(
        `${element.group.name}${retiredMark} (${element.group.items.length})`,
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
    if (element.type === "user-section") {
      return new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "user") {
      const inactiveMark = element.user.active ? "" : " (inactive)";
      const item = new vscode.TreeItem(
        `${element.user.name}${inactiveMark}`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: SHOW_IAM_DETAIL_COMMAND,
        title: "Show detail",
        arguments: [element.corpusRoot, "user", element.user.name],
      };
      return item;
    }
    if (element.type === "role-section") {
      return new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
    }
    if (element.type === "role") {
      const item = new vscode.TreeItem(
        element.role.name,
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: SHOW_IAM_DETAIL_COMMAND,
        title: "Show detail",
        arguments: [element.corpusRoot, "role", element.role.name],
      };
      return item;
    }
    if (element.type === "journal-entry") {
      const item = new vscode.TreeItem(
        "Open Journal",
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: OPEN_JOURNAL_COMMAND,
        title: "Open Journal",
        arguments: [element.corpusRoot],
      };
      return item;
    }
    if (element.type === "backlog-entry") {
      const item = new vscode.TreeItem(
        "Open Backlog",
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: OPEN_BACKLOG_COMMAND,
        title: "Open Backlog",
        arguments: [element.corpusRoot],
      };
      return item;
    }

    const pendingMark = element.pending ? "⏳ " : "";
    const item = new vscode.TreeItem(
      `${pendingMark}${element.node.id} — ${element.node.title}`,
      vscode.TreeItemCollapsibleState.None,
    );
    item.command = {
      command: SHOW_DETAIL_COMMAND,
      title: "Show detail",
      arguments: [element.corpusRoot, element.node.id],
    };
    return item;
  }

  private sectionsFor(view: DeploymentView): InspectorTreeItem[] {
    const sections: InspectorTreeItem[] = buildTreeSections(view.model).map(
      (section) => ({ type: "section", corpusRoot: view.corpusRoot, section }),
    );
    const roadmapNodes = [...view.model.nodes.values()].filter(
      (n): n is RoadmapNode => n.kind === "roadmap",
    );
    sections.push({
      type: "roadmap-section",
      corpusRoot: view.corpusRoot,
      section: buildRoadmapSection(roadmapNodes),
    });
    sections.push({
      type: "proposal-section",
      corpusRoot: view.corpusRoot,
      section: buildProposalSection(view.proposals),
    });
    sections.push({
      type: "run-section",
      corpusRoot: view.corpusRoot,
      section: buildRunSection(view.runs),
    });
    sections.push({
      type: "user-section",
      corpusRoot: view.corpusRoot,
      section: buildUserSection(view.users),
    });
    sections.push({
      type: "role-section",
      corpusRoot: view.corpusRoot,
      section: buildRoleSection(view.roles),
    });
    sections.push({ type: "journal-entry", corpusRoot: view.corpusRoot });
    sections.push({ type: "backlog-entry", corpusRoot: view.corpusRoot });
    return sections;
  }

  getChildren(element?: InspectorTreeItem): InspectorTreeItem[] {
    if (!element) {
      const views = [...this.deployments.values()];
      if (views.length === 0) return [];
      if (views.length === 1) return this.sectionsFor(views[0]);
      return views.map((view) => ({
        type: "deployment",
        corpusRoot: view.corpusRoot,
        folderName: view.folderName,
      }));
    }
    if (element.type === "deployment") {
      const view = this.deployments.get(element.corpusRoot);
      return view ? this.sectionsFor(view) : [];
    }
    if (element.type === "section") {
      const pendingTargets = this.getPendingTargets(element.corpusRoot);
      return element.section.nodes.map((node) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node,
        pending: pendingTargets.has(node.id),
      }));
    }
    if (element.type === "roadmap-section") {
      return element.section.groups.map((group) => ({
        type: "roadmap-group",
        corpusRoot: element.corpusRoot,
        group,
      }));
    }
    if (element.type === "roadmap-group") {
      const pendingTargets = this.getPendingTargets(element.corpusRoot);
      return element.group.items.map((node) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node,
        pending: pendingTargets.has(node.id),
      }));
    }
    if (element.type === "proposal-section") {
      return element.section.proposals.map((proposal) => ({
        type: "proposal",
        corpusRoot: element.corpusRoot,
        proposal,
      }));
    }
    if (element.type === "run-section") {
      return element.section.runs.map((run) => ({
        type: "run",
        corpusRoot: element.corpusRoot,
        run,
      }));
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
    if (element.type === "user-section") {
      return element.section.users.map((user) => ({
        type: "user",
        corpusRoot: element.corpusRoot,
        user,
      }));
    }
    if (element.type === "role-section") {
      return element.section.roles.map((role) => ({
        type: "role",
        corpusRoot: element.corpusRoot,
        role,
      }));
    }
    return [];
  }
}

function renderWebviewHtml(
  scriptUri: vscode.Uri,
  payload: WebviewPayload,
): string {
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

/**
 * Refreshes only the diagnostics this one deployment owns, tracked via
 * `ownedFiles` (mutated in place) — never a global `collection.clear()`,
 * which would wipe every other deployment's diagnostics the moment any
 * one watcher fires.
 */
function refreshDiagnosticsForDeployment(
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
            d.severity === "error"
              ? vscode.DiagnosticSeverity.Error
              : vscode.DiagnosticSeverity.Warning,
          ),
      ),
    );
  }

  ownedFiles.clear();
  for (const file of newFiles) ownedFiles.add(file);
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

/**
 * A workspace folder with no resolvable `*.catalyst` gets an actionable
 * offer rather than silence. Catalyst's own instantiation is agent-driven
 * (`BOOTSTRAP.md` is written to be followed by a reasoning coding agent,
 * not run as a script), so this never executes anything itself — it only
 * copies a ready prompt to the clipboard, for whichever agent the user
 * runs it through.
 */
async function offerToInstall(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const dismissKey = ONBOARDING_DISMISSED_PREFIX + folder.uri.fsPath;
  if (context.workspaceState.get<boolean>(dismissKey)) return;

  const choice = await vscode.window.showInformationMessage(
    `No catalyst deployment found in "${folder.name}".`,
    "Install catalyst…",
    "Don't ask again",
  );

  if (choice === "Don't ask again") {
    await context.workspaceState.update(dismissKey, true);
    return;
  }
  if (choice !== "Install catalyst…") return;

  const frameworkPath =
    findSiblingFrameworkRepo(folder.uri.fsPath) ??
    vscode.workspace.getConfiguration("catalyst").get<string>("frameworkPath");

  if (!frameworkPath) {
    const pick = await vscode.window.showWarningMessage(
      "Couldn't find the catalyst framework repo. Set catalyst.frameworkPath in Settings, or clone it as a sibling of this project.",
      "Open Settings",
    );
    if (pick === "Open Settings") {
      void vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "catalyst.frameworkPath",
      );
    }
    return;
  }

  await vscode.env.clipboard.writeText(
    buildInstantiationPrompt(frameworkPath, folder.uri.fsPath),
  );
  void vscode.window.showInformationMessage(
    "Instantiation prompt copied — paste it into your coding agent.",
  );
}

interface RegisteredDeployment {
  handle: WatcherHandle;
  disposables: vscode.Disposable[];
  ownedDiagnosticFiles: Set<string>;
}

/** Sets up one resolved deployment: its watcher plus its own Definition/CodeLens/CodeActions providers. */
function setupDeployment(
  folder: vscode.WorkspaceFolder,
  corpusRoot: string,
  provider: ChainInspectorProvider,
  diagnostics: vscode.DiagnosticCollection,
  codeLensChangeEmitter: vscode.EventEmitter<void>,
): RegisteredDeployment {
  const ownedDiagnosticFiles = new Set<string>();
  let latestReport: ValidationReport | undefined;

  const handle = watchCorpus(
    corpusRoot,
    ({ model, report, proposals, runs, users, roles }) => {
      provider.setState(
        corpusRoot,
        folder.name,
        model,
        proposals,
        runs,
        users,
        roles,
      );
      latestReport = report;
      refreshDiagnosticsForDeployment(
        diagnostics,
        ownedDiagnosticFiles,
        report,
        model,
      );
      codeLensChangeEmitter.fire();
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
        provideCodeActions(
          document: vscode.TextDocument,
          range: vscode.Range,
        ): vscode.CodeAction[] {
          if (!latestReport) return [];
          const openTargetIds = new Set(
            provider.getPendingTargets(corpusRoot).keys(),
          );
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

export function activate(context: vscode.ExtensionContext): void {
  const provider = new ChainInspectorProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(VIEW_ID, provider),
  );

  const diagnostics = vscode.languages.createDiagnosticCollection(
    DIAGNOSTIC_COLLECTION_NAME,
  );
  context.subscriptions.push(diagnostics);

  const codeLensChangeEmitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(codeLensChangeEmitter);

  const registeredDeployments = new Map<string, RegisteredDeployment>();

  function resolveFolder(folder: vscode.WorkspaceFolder): void {
    const corpusRoot = resolveCorpusRoot(folder.uri.fsPath);
    if (!corpusRoot) {
      void offerToInstall(context, folder);
      return;
    }
    if (registeredDeployments.has(corpusRoot)) return;
    registeredDeployments.set(
      corpusRoot,
      setupDeployment(
        folder,
        corpusRoot,
        provider,
        diagnostics,
        codeLensChangeEmitter,
      ),
    );
  }

  function teardownFolder(folder: vscode.WorkspaceFolder): void {
    const corpusRoot = resolveCorpusRoot(folder.uri.fsPath);
    if (!corpusRoot) return;
    const registered = registeredDeployments.get(corpusRoot);
    if (!registered) return;

    for (const file of registered.ownedDiagnosticFiles) {
      diagnostics.delete(vscode.Uri.file(file));
    }
    void registered.handle.close();
    for (const disposable of registered.disposables) disposable.dispose();
    registeredDeployments.delete(corpusRoot);
    provider.removeDeployment(corpusRoot);
  }

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    resolveFolder(folder);
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders((event) => {
      for (const folder of event.added) resolveFolder(folder);
      for (const folder of event.removed) teardownFolder(folder);
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      for (const registered of registeredDeployments.values()) {
        void registered.handle.close();
        for (const disposable of registered.disposables) disposable.dispose();
      }
    },
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      PROPOSE_FIX_COMMAND,
      async (corpusRoot: string, issue: ValidationIssue) => {
        const id = nextProposalId(provider.getAllProposals(corpusRoot));
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
      const corpusRoots = provider.getCorpusRoots();
      if (corpusRoots.length === 0) return;

      let corpusRoot = corpusRoots[0];
      if (corpusRoots.length > 1) {
        const pick = await vscode.window.showQuickPick(
          corpusRoots.map((root) => ({
            label: provider.getFolderName(root) ?? root,
            corpusRoot: root,
          })),
          { placeHolder: "Which catalyst deployment?" },
        );
        if (!pick) return;
        corpusRoot = pick.corpusRoot;
      }

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

      const id = nextProposalId(provider.getAllProposals(corpusRoot));
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

  const agentTerminals = new Map<string, vscode.Terminal>();
  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((closed) => {
      for (const [projectRoot, terminal] of agentTerminals) {
        if (terminal === closed) {
          agentTerminals.delete(projectRoot);
          break;
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(RUN_SLASH_COMMAND_COMMAND, async () => {
      const folders = vscode.workspace.workspaceFolders ?? [];
      const candidates = folders
        .map((folder) => ({
          folder,
          commands: discoverSlashCommands(folder.uri.fsPath),
        }))
        .filter((entry) => entry.commands.length > 0);

      if (candidates.length === 0) {
        void vscode.window.showInformationMessage(
          "No .claude/commands found in this workspace.",
        );
        return;
      }

      let chosen = candidates[0];
      if (candidates.length > 1) {
        const pick = await vscode.window.showQuickPick(
          candidates.map((entry) => ({ label: entry.folder.name, entry })),
          { placeHolder: "Which project?" },
        );
        if (!pick) return;
        chosen = pick.entry;
      }

      const commandPick = await vscode.window.showQuickPick(
        chosen.commands.map((cmd) => ({
          label: `/${cmd.name}`,
          description: cmd.description ?? "",
          detail: cmd.argumentHint,
          cmd,
        })),
        { placeHolder: "Which catalyst command?", matchOnDescription: true },
      );
      if (!commandPick) return;

      let args = "";
      if (commandPick.cmd.argumentHint) {
        args =
          (await vscode.window.showInputBox({
            prompt: `Arguments for /${commandPick.cmd.name}`,
            placeHolder: commandPick.cmd.argumentHint,
          })) ?? "";
      }

      const projectRoot = chosen.folder.uri.fsPath;
      const agentCommand = resolveAgentCommand(projectRoot);
      if (!agentCommand) {
        void vscode.window.showErrorMessage(
          'Couldn\'t determine which agent runs this deployment — no *.catalyst pointer with an "agent" field found.',
        );
        return;
      }

      const composed = composeSlashCommand(commandPick.cmd.name, args);

      // One terminal per project — reusing a stale one could send this
      // command into a different project's still-running agent process.
      let terminal = agentTerminals.get(projectRoot);
      if (!terminal) {
        terminal = vscode.window.createTerminal({
          name: `Catalyst: ${chosen.folder.name}`,
          iconPath: vscode.Uri.joinPath(
            context.extensionUri,
            "resources",
            "catalyst.svg",
          ),
          cwd: projectRoot,
          location: { viewColumn: vscode.ViewColumn.Beside },
        });
        agentTerminals.set(projectRoot, terminal);
        terminal.sendText(agentCommand, true);
      }
      terminal.show();
      terminal.sendText(composed, false);
    }),
  );

  let detailPanel: vscode.WebviewPanel | undefined;
  context.subscriptions.push({ dispose: () => detailPanel?.dispose() });

  /**
   * Shared by every command that opens the single bundled webview
   * (node/IAM detail, journal). Reuses the one panel the same way node
   * detail always has — opening one replaces whatever was showing.
   */
  function showDetailPanel(title: string, payload: WebviewPayload): void {
    if (detailPanel) {
      detailPanel.title = title;
      detailPanel.reveal(undefined, true);
    } else {
      detailPanel = vscode.window.createWebviewPanel(
        "catalystNodeDetail",
        title,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
        },
      );
      detailPanel.onDidDispose(() => {
        detailPanel = undefined;
      });
    }

    const scriptUri = detailPanel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "dist", "webview.js"),
    );
    detailPanel.webview.html = renderWebviewHtml(scriptUri, payload);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      SHOW_DETAIL_COMMAND,
      (corpusRoot: string, nodeId: string) => {
        const model = provider.getModel(corpusRoot);
        if (!model) return;
        const payload = buildNodeDetail(
          model,
          nodeId,
          provider.getPendingTargets(corpusRoot),
        );
        if (!payload) return;
        showDetailPanel(`Node: ${nodeId}`, { type: "node", ...payload });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      SHOW_IAM_DETAIL_COMMAND,
      (corpusRoot: string, kind: "user" | "role", name: string) => {
        if (kind === "user") {
          const user = provider
            .getUsers(corpusRoot)
            .find((u) => u.name === name);
          if (!user) return;
          const detail = buildIamUserDetail(
            user,
            provider.getRoles(corpusRoot),
          );
          showDetailPanel(`User: ${name}`, { type: "iam-user", ...detail });
        } else {
          const role = provider
            .getRoles(corpusRoot)
            .find((r) => r.name === name);
          if (!role) return;
          const detail = buildIamRoleDetail(
            role,
            provider.getUsers(corpusRoot),
          );
          showDetailPanel(`Role: ${name}`, { type: "iam-role", ...detail });
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      OPEN_JOURNAL_COMMAND,
      (corpusRoot: string) => {
        // The full, unfiltered list — filtering happens reactively inside the
        // webview itself, not via a host round-trip; journal size is bounded
        // by project lifetime, not unbounded, so shipping it all up front is
        // cheap and simpler than the alternative.
        const entries = parseJournal(corpusRoot);
        showDetailPanel("Journal", { type: "journal", entries });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      OPEN_BACKLOG_COMMAND,
      async (corpusRoot: string) => {
        const backlogPath = vscode.Uri.file(
          join(corpusRoot, "development", "BACKLOG.md"),
        );
        try {
          await vscode.window.showTextDocument(backlogPath, { preview: false });
        } catch {
          void vscode.window.showWarningMessage(
            "No BACKLOG.md found — run /show-backlog first.",
          );
        }
      },
    ),
  );
}

export function deactivate(): void {}
