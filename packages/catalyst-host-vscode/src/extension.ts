import type {
  AgentBinding,
  KernelVersionInfo,
  RemoteModuleInfo,
  UiModuleManifest,
  WebviewPayload,
} from "catalyst-core";
import {
  defaultChatAgent,
  downloadModuleZip,
  fetchRemoteUiModules,
  findDeployments,
  isIgnoredFolder,
  loadLocalSavedModule,
  meetsRequiredKernelVersion,
  optedOut,
  owningDeployment,
  packageUiModule,
  parseChatAgents,
  readCatalystPointer,
  readDeployedKernelVersion,
  REQUIRED_KERNEL_VERSION,
  restoreKernelVersion,
  saveModuleLocally,
  suggestCriterionBranch,
  UiModuleManager,
  VERIFIED_KERNEL_VERSION,
  workingCopyState,
} from "catalyst-core";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as vscode from "vscode";
import { resolveAndInvoke } from "./vscode/agent-bridge.js";
import { discoverCommandCandidates, pickCommandAndArgs } from "./command-picker.js";
import { openStudio } from "./vscode/studio-panel.js";
import { VscodeHost } from "./vscode/vscode-host.js";
import {
  CHECK_IAM_ACCOUNT_COMMAND,
  IAM_LOGIN_COMMAND,
  CONFIGURE_CRITERION_COMMAND,
  DIAGNOSTIC_COLLECTION_NAME,
  IGNORED_FOLDERS_SETTING,
  LOAD_UI_MODULE_COMMAND,
  OPEN_BACKLOG_COMMAND,
  OPEN_JOURNAL_COMMAND,
  OPEN_SETTINGS_COMMAND,
  REFRESH_CHAIN_INSPECTOR_COMMAND,
  SELECT_KERNEL_VERSION_COMMAND,
  OPEN_STUDIO_COMMAND,
  SEND_TO_AGENT_CHAT_COMMAND,
  SET_UP_FOLDER_COMMAND,
  SHOW_DETAIL_COMMAND,
  SHOW_IAM_DETAIL_COMMAND,
  SWITCH_UI_MODULE_COMMAND,
  TRACK_SETTING,
  VIEW_ID,
} from "./constants.js";
import type { DeploymentTarget, RegisteredDeployment } from "./vscode/deployments.js";
import { journalByCorpus, setupDeployment } from "./vscode/deployments.js";
import {
  buildIamRoleDetail,
  buildIamUserDetail,
  buildNodeDetail,
  buildReferenceTable,
  referencesForNode,
} from "catalyst-app-model";
import { ChainInspectorProvider } from "./vscode/inspector.js";
import type { PendingSync } from "./vscode/onboarding.js";
import {
  installOfferHidden,
  offerToInstall,
  offerToSyncKernels,
  pendingSyncFor,
  resolveChatAgentDef,
} from "./vscode/onboarding.js";
import { LEGACY_IAM_PASSWORD_SECRET, loginNameFor, passwordLogin, readIamSettings, systemWhoami } from "./iam.js";
import { PANEL_GROUPING_SETTING, readGrouping, targetColumn, type OpenDetailPanel } from "./panel-groups.js";
import { devcontainerMount, environmentLabel, unreachableAdvice } from "./remote.js";
import { renderWebviewHtml } from "./vscode/webview-html.js";
import { panelKeysFor, parseWebviewMessage } from "./webview-protocol.js";

export function activate(context: vscode.ExtensionContext): void {
  const host = new VscodeHost(context);
  const uiModuleManager = new UiModuleManager();
  let inMemoryKernelVersion: string | null = null;
  const storagePath = context.globalStorageUri.fsPath;

  const provider = new ChainInspectorProvider(context.extensionUri);

  // One Instance(s) view, every deployment a top-level entry of it
  // (REQ-000068-UVqkd7cL). A TreeView, so a node can be revealed in it
  // (REQ-000017-UVqkd7cL).
  const instancesView = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: provider });
  context.subscriptions.push(instancesView);
  /** Select a node under its deployment — only while the view is visible, never moving focus. */
  function revealNode(corpusRoot: string, nodeId: string): void {
    if (!vscode.workspace.getConfiguration("catalyst").get<boolean>(TRACK_SETTING, true)) return;
    if (!instancesView.visible) return;
    const element = provider.findNode(corpusRoot, nodeId);
    if (element)
      void instancesView.reveal(element, {
        select: true,
        focus: false,
        expand: false,
      });
  }

  const diagnostics = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_COLLECTION_NAME);
  context.subscriptions.push(diagnostics);

  const codeLensChangeEmitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(codeLensChangeEmitter);

  const registeredDeployments = new Map<string, RegisteredDeployment>();

  const agentBridgeOutputChannel = vscode.window.createOutputChannel("Catalyst");
  context.subscriptions.push(agentBridgeOutputChannel);

  // Every deployment of a workspace folder, nested ones included, by the
  // kernel's scope rule (REQ-000015-UVqkd7cL): folder -> its corpus roots,
  // and each corpus root's project directory and display name.
  const folderDeployments = new Map<string, string[]>();
  const deploymentTargets = new Map<string, DeploymentTarget>();

  const ignoredFoldersFor = (folder: vscode.WorkspaceFolder): string[] =>
    vscode.workspace.getConfiguration("catalyst", folder.uri).get<string[]>(IGNORED_FOLDERS_SETTING, []);

  // A deployment whose working copy is not reachable here (a remote
  // environment without the installing machine's agent-owned space) is
  // reported once, with the fix that fits (REQ-000016-UVqkd7cL).
  const reportedUnreachable = new Set<string>();
  function reportUnreachable(name: string, projectRoot: string, target: string | undefined): void {
    if (reportedUnreachable.has(projectRoot)) return;
    reportedUnreachable.add(projectRoot);
    const advice = unreachableAdvice(name, target, vscode.env.remoteName);
    const labels: Record<string, string> = {
      "copy-mount": "Copy devcontainer mount",
      share: "Share with /share create",
    };
    void vscode.window
      .showWarningMessage(advice.message, ...advice.actions.map((a) => labels[a]))
      .then(async (choice) => {
        if (choice === labels["copy-mount"] && target) {
          await vscode.env.clipboard.writeText(devcontainerMount(target));
          void vscode.window.showInformationMessage(
            "Copied a devcontainer.json mounts entry: add it, then rebuild the container.",
          );
        } else if (choice === labels.share) {
          const agentDef = resolveChatAgentDef(projectRoot);
          if (!agentDef) {
            void vscode.window.showErrorMessage(
              'Couldn\'t determine which agent to run — no *.catalyst pointer with an "agent" or "chatAgents" field found.',
            );
            return;
          }
          await resolveAndInvoke(agentDef, "/share", "create", agentBridgeOutputChannel);
        }
      });
  }

  // The sync offers of every instance resolved together share one
  // notification, each offered once per session — re-resolving the
  // folders never asks again (REQ-000069-UVqkd7cL).
  const offeredSync = new Set<string>();
  let pendingSyncs: PendingSync[] = [];
  function queueSyncOffer(target: DeploymentTarget, corpusRoot: string): void {
    const offer = pendingSyncFor(context, target, corpusRoot);
    if (!offer || offeredSync.has(offer.dismissKey)) return;
    offeredSync.add(offer.dismissKey);
    if (pendingSyncs.length === 0) {
      setTimeout(() => {
        const offers = pendingSyncs;
        pendingSyncs = [];
        void offerToSyncKernels(context, offers, agentBridgeOutputChannel);
      }, 0);
    }
    pendingSyncs.push(offer);
  }

  function resolveFolder(folder: vscode.WorkspaceFolder): void {
    // Virtual and other non-file folders have no file system to read.
    if (folder.uri.scheme !== "file") return;
    const ignored = ignoredFoldersFor(folder);
    const found = findDeployments(folder.uri.fsPath, folder.name, { ignored });
    const roots: string[] = [];
    folderDeployments.set(folder.uri.toString(), roots);
    if (found.length === 0) {
      const leftOut = optedOut(folder.uri.fsPath) || isIgnoredFolder(folder.uri.fsPath, ignored, folder.uri.fsPath);
      // Untrusted, catalyst only reads: no install offer (Workspace Trust).
      // The offer is an entry of the Instance(s) view, never a
      // notification (REQ-000069-UVqkd7cL). No automatic module download
      // here (B-06): fetching remote UI modules is only ever started by
      // the user ("Switch Process UI Module").
      const offered = !leftOut && vscode.workspace.isTrusted && !installOfferHidden(context, folder);
      provider.setUnsetFolder(folder.uri.toString(), offered ? folder.name : undefined);
      return;
    }
    provider.setUnsetFolder(folder.uri.toString(), undefined);
    for (const deployment of found) {
      const wc = workingCopyState(deployment.projectRoot);
      if (wc.state !== "reachable") {
        reportUnreachable(deployment.name, deployment.projectRoot, wc.state === "dangling" ? wc.target : undefined);
        continue;
      }
      const corpusRoot = wc.path;
      roots.push(corpusRoot);
      if (registeredDeployments.has(corpusRoot)) continue;
      const target = { name: deployment.name, path: deployment.projectRoot };
      deploymentTargets.set(corpusRoot, target);
      registeredDeployments.set(
        corpusRoot,
        setupDeployment(
          target,
          corpusRoot,
          provider,
          diagnostics,
          codeLensChangeEmitter,
          (root) => {
            refreshDetailPanelsFor(root);
          },
          (message) => {
            agentBridgeOutputChannel.appendLine(message);
          },
        ),
      );
      if (vscode.workspace.isTrusted) {
        queueSyncOffer(target, corpusRoot);
      }
    }
    updateStatusBar();
  }

  function teardownDeployment(corpusRoot: string): void {
    const registered = registeredDeployments.get(corpusRoot);
    if (!registered) return;
    for (const file of registered.ownedDiagnosticFiles) {
      diagnostics.delete(vscode.Uri.file(file));
    }
    void registered.handle.close();
    for (const disposable of registered.disposables) disposable.dispose();
    registeredDeployments.delete(corpusRoot);
    deploymentTargets.delete(corpusRoot);
    provider.removeDeployment(corpusRoot);
  }

  function teardownFolder(folder: vscode.WorkspaceFolder): void {
    for (const corpusRoot of folderDeployments.get(folder.uri.toString()) ?? []) {
      teardownDeployment(corpusRoot);
    }
    folderDeployments.delete(folder.uri.toString());
    provider.setUnsetFolder(folder.uri.toString(), undefined);
    updateStatusBar();
  }

  function reresolveAll(): void {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      teardownFolder(folder);
      resolveFolder(folder);
    }
  }

  // The deployment owning the active editor's file, if any.
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  context.subscriptions.push(statusBar);
  function updateStatusBar(): void {
    const file = vscode.window.activeTextEditor?.document.uri;
    const roots = [...deploymentTargets.values()].map((t) => t.path);
    const owner = file?.scheme === "file" ? owningDeployment(roots, file.fsPath) : null;
    const entry = owner ? [...deploymentTargets.entries()].find(([, t]) => t.path === owner) : undefined;
    if (!entry) {
      statusBar.hide();
      return;
    }
    const [corpusRoot, target] = entry;
    const version = readDeployedKernelVersion(corpusRoot);
    statusBar.text = `$(beaker) ${target.name}`;
    const where = environmentLabel(vscode.env.remoteName);
    statusBar.tooltip = `catalyst deployment "${target.name}"${version ? ` — kernel ${version}` : ""}${where ? `, in ${where}` : ""}. Click for its backlog.`;
    statusBar.command = {
      title: "Open backlog",
      command: OPEN_BACKLOG_COMMAND,
      arguments: [corpusRoot],
    };
    statusBar.show();
  }
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      updateStatusBar();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`catalyst.${IGNORED_FOLDERS_SETTING}`)) {
        reresolveAll();
      }
    }),
    // Trust granted: the offers and agent commands an untrusted
    // workspace held back become available.
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      reresolveAll();
    }),
  );

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    resolveFolder(folder);
  }

  // Restore the saved UI module only once deployments are resolved, and
  // against an actual kernel version — the first deployment's version.txt,
  // else the floor — never the required range string (B-07).
  const localRes = loadLocalSavedModule(
    storagePath,
    uiModuleManager,
    restoreKernelVersion([...deploymentTargets.keys()].map((root) => readDeployedKernelVersion(root))),
  );
  if (localRes && localRes.success) {
    // Reported, not notified (REQ-000069-UVqkd7cL).
    agentBridgeOutputChannel.appendLine(
      `Automatically activated saved local UI module "${localRes.module.manifest.name}" (v${localRes.module.manifest.version}).`,
    );
  } else if (localRes && !localRes.success) {
    agentBridgeOutputChannel.appendLine(`Saved UI module not restored: ${localRes.error}`);
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
    vscode.commands.registerCommand(OPEN_STUDIO_COMMAND, async () => {
      const projects = provider.getCorpusRoots().map((corpusRoot) => ({
        label: provider.getFolderName(corpusRoot) ?? corpusRoot,
        projectRoot: provider.getProjectRoot(corpusRoot) ?? corpusRoot,
      }));
      if (projects.length === 0) {
        void host.notify("info", "No catalyst project is open.");
        return;
      }
      const project =
        projects.length === 1 ? projects[0] : await host.pick(projects, { placeHolder: "Which project?" });
      if (!project) return;
      await openStudio(context, project.projectRoot, project.label, (message) => {
        agentBridgeOutputChannel.appendLine(message);
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(SEND_TO_AGENT_CHAT_COMMAND, async () => {
      const picked = await pickCommandAndArgs(host, discoverCommandCandidates(host));
      if (!picked) return;

      const projectRoot = picked.folder.path;
      const chatAgents = parseChatAgents(projectRoot);
      let agentDef: AgentBinding | null = chatAgents[0] ?? null;
      if (chatAgents.length > 1) {
        const pick = await vscode.window.showQuickPick(
          chatAgents.map((a) => ({ label: a.name, description: a.binding, a })),
          { placeHolder: "Which configured agent?" },
        );
        if (!pick) return;
        agentDef = pick.a;
      }
      if (!agentDef) agentDef = defaultChatAgent(projectRoot);

      if (!agentDef) {
        void vscode.window.showErrorMessage(
          'Couldn\'t determine which agent to chat with — no *.catalyst pointer with an "agent" or "chatAgents" field found.',
        );
        return;
      }

      await resolveAndInvoke(agentDef, `/${picked.cmd.name}`, picked.args, agentBridgeOutputChannel);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(CONFIGURE_CRITERION_COMMAND, async () => {
      const corpusRoots = provider.getCorpusRoots();
      if (corpusRoots.length === 0) {
        void vscode.window.showErrorMessage("No catalyst deployment is open in this workspace.");
        return;
      }

      let corpusRoot = corpusRoots[0];
      if (corpusRoots.length > 1) {
        const picked = await vscode.window.showQuickPick(
          corpusRoots.map((root) => ({
            label: provider.getFolderName(root) ?? root,
            root,
          })),
          { placeHolder: "Which deployment?" },
        );
        if (!picked) return;
        corpusRoot = picked.root;
      }

      const projectRoot = provider.getProjectRoot(corpusRoot);
      if (!projectRoot) return;

      // Gathers the repository's URL, then dispatches the real /share
      // command — this never mutates catalyst.toml or runs git itself; the
      // agent running /share create owns that, including the preview and the
      // user's assent before anything is published (Rules-of-Rules §13). This
      // UI only ever drives "create" — "join" (catalyst open) is the path for
      // a machine without the criterion, which doesn't apply to a deployment
      // already resolved here.
      const pointer = readCatalystPointer(projectRoot);
      const statusText = pointer?.repoed
        ? `Currently linked to ${pointer.catalyst_repo_url ?? pointer.catalyst_repo} (pushing to ${pointer.criterion_branch ?? "an unrecorded branch"}).`
        : "Not yet linked to a criterion repo.";

      const name = await vscode.window.showInputBox({
        title: "Configure Criterion Repo",
        prompt: `${statusText} Repository name`,
        value: pointer?.catalyst_repo ?? "",
        placeHolder: `${provider.getFolderName(corpusRoot) ?? "project"}-criterion`,
      });
      if (!name) return;

      const gitInfo = await vscode.window.showInputBox({
        title: "Configure Criterion Repo",
        prompt: "Git URL or location for this repo",
        value: pointer?.catalyst_repo_url ?? "",
        placeHolder: "git@github.com:you/repo.git",
      });
      if (!gitInfo) return;

      if (!pointer?.repoed) {
        const users = provider.getUsers(corpusRoot);
        const suggested = users[0] ? suggestCriterionBranch(users[0].name) : undefined;
        if (suggested) {
          void vscode.window.showInformationMessage(
            `The agent will ask which branch to push to — the suggested default is "${suggested}"; choosing "criterion" itself is also valid (single-maintainer mode).`,
          );
        }
      }

      const agentDef = resolveChatAgentDef(projectRoot);
      if (!agentDef) {
        void vscode.window.showErrorMessage(
          'Couldn\'t determine which agent to chat with — no *.catalyst pointer with an "agent" or "chatAgents" field found.',
        );
        return;
      }

      await resolveAndInvoke(agentDef, "/share", `create ${gitInfo}`, agentBridgeOutputChannel);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(REFRESH_CHAIN_INSPECTOR_COMMAND, () => {
      if (registeredDeployments.size === 0) {
        void vscode.window.showInformationMessage("No catalyst deployment is open in this workspace.");
        return;
      }
      // Bypasses the watcher's own debounce for an immediate re-parse —
      // the watcher already catches ordinary file changes on its own;
      // this is for the case it might have missed one (an external tool,
      // a bulk git operation) or the user just wants certainty right now.
      for (const registered of registeredDeployments.values()) {
        registered.handle.refresh();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(SET_UP_FOLDER_COMMAND, async (folderUri: string) => {
      const folder = vscode.workspace.workspaceFolders?.find((f) => f.uri.toString() === folderUri);
      if (folder && (await offerToInstall(context, folder))) {
        teardownFolder(folder);
        resolveFolder(folder);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_SETTINGS_COMMAND, () => {
      void vscode.commands.executeCommand("workbench.action.openSettings", "catalyst");
    }),
  );

  // The local system account (REQ-000064-UVqkd7cL): whoever catalyst-users
  // signs in; the extension runs its command and holds no credential. A
  // password 0.60/0.61 kept in secret storage is no longer used: delete it.
  void context.secrets.delete(LEGACY_IAM_PASSWORD_SECRET);
  context.subscriptions.push(
    vscode.commands.registerCommand(CHECK_IAM_ACCOUNT_COMMAND, async () => {
      const config = vscode.workspace.getConfiguration("catalyst");
      const settings = readIamSettings((key) => config.get(key));
      const answer = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: "Catalyst: signing the IAM system account in…" },
        () => systemWhoami(settings),
      );
      if (answer.problem !== undefined) {
        void vscode.window.showWarningMessage(`IAM system account: ${answer.problem}.`);
        return;
      }
      const who = answer.value;
      const list = (values: string[]) => (values.length ? values.join(", ") : "none");
      void vscode.window.showInformationMessage(
        `IAM system account: ${who.username} at ${who.issuer} (via ${settings.command}); roles ${list(who.roles)}; grants ${list(who.grants)}.`,
      );
    }),
  );

  // A person's login through catalyst-users (vscode-IAM-000002-UVqkd7cL): a username and a password asked here,
  // handed to catalyst-users on standard input; no provider page, nothing kept.
  let loggingIn = false;
  context.subscriptions.push(
    vscode.commands.registerCommand(IAM_LOGIN_COMMAND, async (element?: { user?: { name?: unknown } }) => {
      if (loggingIn) {
        void vscode.window.showInformationMessage("Catalyst: a catalyst-users login is already running.");
        return;
      }
      const config = vscode.workspace.getConfiguration("catalyst");
      const settings = readIamSettings((key) => config.get(key));
      const named = typeof element?.user?.name === "string" ? element.user.name : "";
      const username = await vscode.window.showInputBox({
        title: "Log in to catalyst-users",
        prompt: "Your username",
        value: loginNameFor(named),
        ignoreFocusOut: true,
        validateInput: (value) => (value.trim() ? undefined : "A username is needed"),
      });
      if (!username?.trim()) return;
      const password = await vscode.window.showInputBox({
        title: `Log in to catalyst-users as ${username.trim()}`,
        prompt: "Your password: sent to catalyst-users, which sends it only to the identity provider",
        password: true,
        ignoreFocusOut: true,
      });
      if (!password) return;
      loggingIn = true;
      try {
        const answer = await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: `Catalyst: logging ${username.trim()} in…` },
          () => passwordLogin(settings, username.trim(), password),
        );
        if (answer.problem !== undefined) void vscode.window.showWarningMessage(`Catalyst: ${answer.problem}.`);
        else
          void vscode.window.showInformationMessage(
            `Catalyst: logged in to catalyst-users as ${answer.value.username} (${answer.value.name}).`,
          );
      } finally {
        loggingIn = false;
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(SELECT_KERNEL_VERSION_COMMAND, async () => {
      const picks = [
        {
          label: VERIFIED_KERNEL_VERSION,
          description: `Kernel this extension is verified against (requires ${REQUIRED_KERNEL_VERSION})`,
        },
        {
          label: "Specify custom version...",
          description: "Enter a custom kernel version string",
        },
      ];
      const pick = await vscode.window.showQuickPick(picks, {
        placeHolder: "Select a Catalyst kernel version to load into extension memory:",
      });
      if (!pick) return;

      let version = pick.label;
      if (pick.label.startsWith("Specify")) {
        const input = await vscode.window.showInputBox({
          prompt: "Enter kernel version",
          value: VERIFIED_KERNEL_VERSION,
          placeHolder: `e.g. ${VERIFIED_KERNEL_VERSION}`,
        });
        if (!input) return;
        version = input.trim();
      }

      inMemoryKernelVersion = version;

      const defaultManifest: UiModuleManifest = {
        id: "software-engineering-ui",
        name: "Software Engineering Process UI Module",
        version: "1.0.0",
        description: "UI components for software engineering processes",
        kernelVersion: `>=${version}`,
        entry: "dist/webview.js",
      };

      const zipBuf = packageUiModule(defaultManifest);
      const res = uiModuleManager.loadAndActivateZipModule(zipBuf, version);

      if (res.success) {
        void vscode.window.showInformationMessage(
          `Loaded Catalyst kernel v${version} into extension memory. Activated UI module "${res.module.manifest.name}" (v${res.module.manifest.version}, requires ${res.module.manifest.kernelVersion}).`,
        );
      } else {
        void vscode.window.showWarningMessage(
          `Loaded Catalyst kernel v${version}, but UI module activation failed: ${res.error}`,
        );
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(LOAD_UI_MODULE_COMMAND, async () => {
      const uris = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: { "Zip Modules": ["zip"] },
        title: "Select Zipped Catalyst UI Module",
      });
      if (!uris || uris.length === 0) return;

      const zipPath = uris[0].fsPath;

      let currentKernelVersion = inMemoryKernelVersion;
      if (!currentKernelVersion) {
        for (const root of provider.getCorpusRoots()) {
          const v = readDeployedKernelVersion(root);
          if (v) {
            currentKernelVersion = v;
            break;
          }
        }
      }
      if (!currentKernelVersion) {
        currentKernelVersion = REQUIRED_KERNEL_VERSION;
      }

      const res = uiModuleManager.loadAndActivateZipModule(zipPath, currentKernelVersion);

      if (res.success) {
        saveModuleLocally(storagePath, readFileSync(zipPath));
        refreshAllDetailPanels();
        provider.refreshTree();
        void vscode.window.showInformationMessage(
          `Successfully loaded UI module "${res.module.manifest.name}" (v${res.module.manifest.version}) for kernel version ${currentKernelVersion}.`,
        );
      } else {
        void vscode.window.showErrorMessage(`Failed to load UI module: ${res.error}`);
      }
    }),
  );

  const detailPanels = new Map<string, vscode.WebviewPanel>();
  // Which project each open detail panel belongs to, and when it was
  // last focused — what targetColumn() places a new panel by.
  const panelMeta = new Map<string, { project: string; lastActive: number }>();
  let panelFocusClock = 0;
  context.subscriptions.push({
    dispose: () => {
      for (const panel of detailPanels.values()) panel.dispose();
      detailPanels.clear();
    },
  });

  // How to rebuild each open panel's payload, and which deployment owns
  // it — so a watcher update can push fresh content (B-10).
  const panelBuilders = new Map<string, () => WebviewPayload | null>();
  const panelOwners = new Map<string, string>();

  /** Pushes a rebuilt payload into an open panel without reloading it. */
  function refreshPanel(key: string): void {
    const panel = detailPanels.get(key);
    const payload = panelBuilders.get(key)?.();
    if (panel && payload) void panel.webview.postMessage(payload);
  }

  /** Every open panel of one deployment, after its watcher fired. */
  function refreshDetailPanelsFor(corpusRoot: string): void {
    for (const key of panelKeysFor(panelOwners, corpusRoot)) refreshPanel(key);
  }

  function refreshAllDetailPanels(): void {
    for (const key of detailPanels.keys()) refreshPanel(key);
  }

  async function promptAndSwitchUiModule(): Promise<void> {
    let currentKernelVersion = inMemoryKernelVersion;
    if (!currentKernelVersion) {
      for (const root of provider.getCorpusRoots()) {
        const v = readDeployedKernelVersion(root);
        if (v) {
          currentKernelVersion = v;
          break;
        }
      }
    }
    if (!currentKernelVersion) {
      currentKernelVersion = REQUIRED_KERNEL_VERSION;
    }

    const moduleSourceUrl =
      vscode.workspace.getConfiguration("catalyst").get<string>("moduleSourceUrl") ||
      "git@github.com:cantica-tech/cantica-tech.git/catalyst/";

    const remoteModules = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fetching available UI modules...",
      },
      async () => fetchRemoteUiModules(moduleSourceUrl),
    );

    if (remoteModules.length === 0) {
      void vscode.window.showErrorMessage(`No process UI modules found at ${moduleSourceUrl}`);
      return;
    }

    const items: {
      label: string;
      description?: string;
      detail?: string;
      module: RemoteModuleInfo;
    }[] = remoteModules.map((m) => ({
      label: `$(symbol-module) ${m.name} (v${m.version})`,
      description: `[${m.id}] Kernel ${m.kernelVersion}`,
      detail: m.description || `Module ID: ${m.id}`,
      module: m,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select a Catalyst Process UI Module to download & activate from cantica-tech (kernel ${currentKernelVersion}):`,
    });

    if (!selected) return;

    const mod = selected.module;
    try {
      const zipBuffer = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Downloading UI module "${mod.name}" v${mod.version}...`,
        },
        async () => downloadModuleZip(mod.downloadUrl),
      );

      const loadRes = uiModuleManager.loadAndActivateZipModule(zipBuffer, currentKernelVersion);

      if (loadRes.success) {
        saveModuleLocally(storagePath, zipBuffer);
        refreshAllDetailPanels();
        provider.refreshTree();
        void vscode.window.showInformationMessage(
          `Successfully activated UI module "${loadRes.module.manifest.name}" (v${loadRes.module.manifest.version}). Display refreshed!`,
        );
      } else {
        void vscode.window.showErrorMessage(`Failed to activate downloaded module: ${loadRes.error}`);
      }
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Failed to download module: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(SWITCH_UI_MODULE_COMMAND, async () => {
      await promptAndSwitchUiModule();
    }),
  );

  /**
   * Shared by every command that opens the single bundled webview (node/
   * IAM detail, journal, backlog) — but never a single shared panel
   * across *different* things: `key` identifies the specific thing being
   * opened (a node id, a user/role name, "journal", "backlog", each
   * scoped to its own `corpusRoot` since ids are only unique within one
   * corpus). Opening the same thing again reveals/updates its own
   * existing panel; opening something different always gets its own new
   * panel, never clobbering what was already showing.
   */
  function showDetailPanel(key: string, project: string, title: string, build: () => WebviewPayload | null): void {
    const payload = build();
    if (!payload) return;
    panelBuilders.set(key, build);
    panelOwners.set(key, project);
    let panel = detailPanels.get(key);
    if (panel) {
      panel.title = title;
      panel.reveal(undefined, true);
    } else {
      // At most one editor group per project (or one for all): only a
      // project's first panel opens beside; later ones join its group as
      // tabs (REQ-000013-UVqkd7cL, panel-groups.ts).
      const grouping = readGrouping(vscode.workspace.getConfiguration("catalyst").get(PANEL_GROUPING_SETTING));
      const open: OpenDetailPanel[] = [];
      for (const [openKey, openPanel] of detailPanels.entries()) {
        const meta = panelMeta.get(openKey);
        if (meta) open.push({ ...meta, column: openPanel.viewColumn });
      }
      const target = targetColumn(open, project, grouping);
      panel = vscode.window.createWebviewPanel(
        "catalystNodeDetail",
        title,
        target === "beside" ? vscode.ViewColumn.Beside : target,
        {
          enableScripts: true,
          // Only the bundled webview script is loadable.
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist")],
        },
      );
      const created = panel;
      detailPanels.set(key, created);
      panelMeta.set(key, { project, lastActive: ++panelFocusClock });
      // The entity this panel shows, tracked in the tree when the panel
      // comes to the front (REQ-000017-UVqkd7cL).
      const shownNode = payload.type === "node" ? payload.node.id : undefined;
      created.onDidChangeViewState((event) => {
        const meta = panelMeta.get(key);
        if (meta && event.webviewPanel.active) {
          meta.lastActive = ++panelFocusClock;
          if (shownNode) revealNode(project, shownNode);
        }
      });
      // A click on an entity reference opens that entity, in this
      // project (REQ-000014-UVqkd7cL); anything else is ignored.
      created.webview.onDidReceiveMessage((message: unknown) => {
        const msg = parseWebviewMessage(message);
        if (msg) {
          const target = msg.id;
          void vscode.commands.executeCommand(SHOW_DETAIL_COMMAND, project, target).then(() => {
            revealNode(project, target);
          });
        }
      });
      created.onDidDispose(() => {
        detailPanels.delete(key);
        panelMeta.delete(key);
        panelBuilders.delete(key);
        panelOwners.delete(key);
      });
    }

    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "dist", "webview.js"));
    panel.webview.html = renderWebviewHtml(scriptUri, payload, panel.webview.cspSource);
  }

  function getKernelVersionInfo(corpusRoot: string): KernelVersionInfo {
    const version = readDeployedKernelVersion(corpusRoot);
    const meets = meetsRequiredKernelVersion(version);
    let explanation: string | undefined;
    if (!version) {
      explanation = `Kernel version.txt is missing or unreadable in .criterion/. Expected requirement: ${REQUIRED_KERNEL_VERSION}.`;
    } else if (!meets) {
      explanation = `Kernel version ${version} does not match expected required version (${REQUIRED_KERNEL_VERSION}). Some entities may fail to parse or validate correctly.`;
    } else {
      explanation = `Kernel version ${version} meets expected requirement (${REQUIRED_KERNEL_VERSION}).`;
    }
    return {
      version,
      requiredVersion: REQUIRED_KERNEL_VERSION,
      meetsRequirement: meets,
      explanation,
    };
  }

  // Each command passes a payload *builder*, re-run when the deployment's
  // watcher fires so an open panel follows the files (B-10).
  context.subscriptions.push(
    vscode.commands.registerCommand(SHOW_DETAIL_COMMAND, (corpusRoot: string, nodeId: string) => {
      showDetailPanel(`node:${corpusRoot}:${nodeId}`, corpusRoot, `Node: ${nodeId}`, () => {
        const model = provider.getModel(corpusRoot);
        if (!model) return null;
        const payload = buildNodeDetail(model, nodeId);
        if (!payload) return null;
        return {
          type: "node",
          kernelVersionInfo: getKernelVersionInfo(corpusRoot),
          references: referencesForNode(model, payload),
          ...payload,
        };
      });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      SHOW_IAM_DETAIL_COMMAND,
      (corpusRoot: string, kind: "user" | "role", name: string) => {
        if (kind === "user") {
          showDetailPanel(`iam-user:${corpusRoot}:${name}`, corpusRoot, `User: ${name}`, () => {
            const user = provider.getUsers(corpusRoot).find((u) => u.name === name);
            if (!user) return null;
            return {
              type: "iam-user",
              kernelVersionInfo: getKernelVersionInfo(corpusRoot),
              ...buildIamUserDetail(user, provider.getRoles(corpusRoot)),
            };
          });
        } else {
          showDetailPanel(`iam-role:${corpusRoot}:${name}`, corpusRoot, `Role: ${name}`, () => {
            const role = provider.getRoles(corpusRoot).find((r) => r.name === name);
            if (!role) return null;
            return {
              type: "iam-role",
              kernelVersionInfo: getKernelVersionInfo(corpusRoot),
              ...buildIamRoleDetail(role, provider.getUsers(corpusRoot)),
            };
          });
        }
      },
    ),
  );

  /**
   * The deployment a command acts on: the one the tree passed, else (run
   * from the Command Palette, with no argument) the only deployment, or the
   * one the user picks among several.
   */
  async function chooseDeployment(arg: unknown): Promise<string | undefined> {
    if (typeof arg === "string" && arg) return arg;
    const roots = [...deploymentTargets.keys()];
    if (roots.length === 0) {
      void vscode.window.showWarningMessage("Catalyst: no catalyst project is open in this workspace.");
      return undefined;
    }
    if (roots.length === 1) return roots[0];
    const pick = await vscode.window.showQuickPick(
      roots.map((root) => ({ label: deploymentTargets.get(root)?.name ?? root, description: root, root })),
      { placeHolder: "Which catalyst project?" },
    );
    return pick?.root;
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_JOURNAL_COMMAND, async (arg: unknown) => {
      const corpusRoot = await chooseDeployment(arg);
      if (!corpusRoot) return;
      // The full, unfiltered list — filtering happens reactively inside the
      // webview itself, not via a host round-trip; journal size is bounded
      // by project lifetime, not unbounded, so shipping it all up front is
      // cheap and simpler than the alternative.
      showDetailPanel(`journal:${corpusRoot}`, corpusRoot, "Journal", () => ({
        type: "journal",
        kernelVersionInfo: getKernelVersionInfo(corpusRoot),
        entries: journalByCorpus.get(corpusRoot) ?? [],
      }));
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_BACKLOG_COMMAND, async (arg: unknown) => {
      const corpusRoot = await chooseDeployment(arg);
      if (!corpusRoot) return;
      const backlogPath = join(corpusRoot, "development", "BACKLOG.md");
      if (!existsSync(backlogPath)) {
        void vscode.window.showWarningMessage("No BACKLOG.md found — run /show-backlog first.");
        return;
      }
      // Rendered, not raw source — BACKLOG.md is generated prose for a
      // human to read, not something authored/edited by hand in place.
      // Through the same keyed panel mechanism as node/IAM/journal
      // detail, not `markdown.showPreview` — that command's own
      // built-in preview tab is a VS Code singleton shared across
      // *any* markdown file previewed anywhere in the workspace, which
      // is exactly the "everything lands in the same place" problem
      // this mechanism exists to avoid.
      showDetailPanel(`backlog:${corpusRoot}`, corpusRoot, "Backlog", () => {
        if (!existsSync(backlogPath)) return null;
        const markdown = readFileSync(backlogPath, "utf8");
        const backlogModel = provider.getModel(corpusRoot);
        return {
          type: "backlog",
          kernelVersionInfo: getKernelVersionInfo(corpusRoot),
          references: backlogModel ? buildReferenceTable(backlogModel, [markdown]) : undefined,
          markdown,
        };
      });
    }),
  );
}

export function deactivate(): void {
  // nothing to release: every disposable is registered in context.subscriptions
}
