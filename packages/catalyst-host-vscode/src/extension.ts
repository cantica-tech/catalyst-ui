import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type {
  AgentBinding,
  ChainModel,
  ChainNode,
  KernelVersionInfo,
  IamRole,
  IamUser,
  Proposal,
  RemoteModuleInfo,
  RoadmapNode,
  Run,
  RunStep,
  SlashCommandSpec,
  UiModuleManifest,
  ValidationIssue,
  ValidationReport,
  WatcherHandle,
  WebviewPayload,
} from "catalyst-core";
import {
  AGENT_PRESETS,
  defaultAgentSource,
  defaultChatAgent,
  discoverSlashCommands,
  downloadModuleZip,
  fetchRemoteUiModules,
  joinCriterionRepo,
  kernelSyncTarget,
  loadLocalSavedModule,
  meetsRequiredKernelVersion,
  nextProposalId,
  openProposalsByTarget,
  packageUiModule,
  parseChatAgents,
  parseJournal,
  readCatalystPointer,
  readDeployedKernelVersion,
  findDeployments,
  IGNORE_FILE,
  isIgnoredFolder,
  optedOut,
  owningDeployment,
  workingCopyState,
  readEntityDefinition,
  REQUIRED_KERNEL_VERSION,
  restoreKernelVersion,
  VERIFIED_KERNEL_VERSION,
  saveModuleLocally,
  suggestCriterionBranch,
  UiModuleManager,
  watchCorpus,
} from "catalyst-core";
import * as vscode from "vscode";

import {
  invokeChatParticipant,
  resolveAndInvoke,
  scanAvailableAgents,
} from "./agent-bridge.js";
import {
  buildAuthoringProposalContent,
  type ComposableArtifactType,
} from "./composer.js";
import { buildProposeFixContent, canProposeFix } from "./codeactions.js";
import { buildCodeLensesForFile } from "./codelens.js";
import { resolveDefinitionAt } from "./definitions.js";
import { breadthFirst, childId, itemKey } from "./tree-ids.js";
import {
  devcontainerMount,
  environmentLabel,
  unreachableAdvice,
} from "./remote.js";
import {
  PANEL_GROUPING_SETTING,
  readGrouping,
  targetColumn,
  type OpenDetailPanel,
} from "./panel-groups.js";
import { buildDiagnosticsByFile } from "./diagnostics.js";
import {
  panelKeysFor,
  parseWebviewMessage,
  proposalWriteBlockedMessage,
  webviewCsp,
} from "./webview-protocol.js";
import {
  buildIamRoleDetail,
  buildIamUserDetail,
  buildNodeDetail,
  buildReferenceTable,
  referencesForNode,
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
import {
  buildTreeSections,
  formatNodeLabel,
  type DevArtifactGroup,
  type RuleGroup,
  type RuleTypeSection,
  type TreeSection,
  type TreeSectionKind,
} from "./tree.js";

const VIEW_ID = "catalystChainInspector";
/** The chain inspector view slots, one per deployment (package.json `views`). */
const INSPECTOR_VIEW_IDS = [
  VIEW_ID,
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => `${VIEW_ID}${n}`),
];
const SHOW_DETAIL_COMMAND = "catalyst.showNodeDetail";
/** `catalyst.trackEntityInTree`: reveal the entity a detail panel shows (REQ-000017-UVqkd7cL). */
const TRACK_SETTING = "trackEntityInTree";
/** `catalyst.ignoredFolders`: folders this workspace leaves out of catalyst (REQ-000015-UVqkd7cL). */
const IGNORED_FOLDERS_SETTING = "ignoredFolders";
const SHOW_IAM_DETAIL_COMMAND = "catalyst.showIamDetail";
const OPEN_JOURNAL_COMMAND = "catalyst.openJournal";
const OPEN_BACKLOG_COMMAND = "catalyst.openBacklog";
const PROPOSE_FIX_COMMAND = "catalyst.proposeFix";
const COMPOSE_PROPOSAL_COMMAND = "catalyst.composeProposal";
const SEND_TO_AGENT_CHAT_COMMAND = "catalyst.sendToAgentChat";
const CONFIGURE_CRITERION_COMMAND = "catalyst.configureCriterion";
const REFRESH_CHAIN_INSPECTOR_COMMAND = "catalyst.refreshChainInspector";
const LOAD_UI_MODULE_COMMAND = "catalyst.loadUiModule";
const SELECT_KERNEL_VERSION_COMMAND = "catalyst.selectKernelVersion";
const SWITCH_UI_MODULE_COMMAND = "catalyst.switchUiModule";
const OPEN_SETTINGS_COMMAND = "catalyst.openSettings";
const DIAGNOSTIC_COLLECTION_NAME = "catalyst";
const ONBOARDING_DISMISSED_PREFIX = "catalyst.onboarding.dismissed:";
const SYNC_OFFER_DISMISSED_PREFIX = "catalyst.syncOffer.dismissed:";
const COMPOSABLE_TYPES: ComposableArtifactType[] = [
  "rule",
  "requirement",
  "bug",
  "house-keeping",
];

interface DeploymentView {
  corpusRoot: string;
  folderName: string;
  projectRoot: string;
  model: ChainModel;
  proposals: Proposal[];
  runs: Run[];
  users: IamUser[];
  roles: IamRole[];
  pendingTargets: Map<string, Proposal[]>;
}

type InspectorTreeItem =
  | { type: "deployment"; corpusRoot: string; folderName: string }
  | { type: "dev-artifact-group"; corpusRoot: string; group: DevArtifactGroup }
  | { type: "rule-group"; corpusRoot: string; group: RuleGroup }
  | { type: "rule-type-section"; corpusRoot: string; section: RuleTypeSection }
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
  | { type: "separator" }
  | { type: "journal-entry"; corpusRoot: string }
  | { type: "backlog-entry"; corpusRoot: string };

/**
 * Icon basename (under resources/icons/{light,dark}/<name>.svg) per tree
 * section kind. Dev-artifact sub-types each get their own section icon,
 * same one their individual nodes already use via `nodeIconName`.
 */
const SECTION_ICON_NAMES: Partial<Record<TreeSectionKind, string>> = {
  requirement: "requirements",
  bug: "bug",
  "house-keeping": "house-keeping",
  step: "step",
  test: "test",
  domain: "domain",
  feature: "features",
};

/**
 * Entity type (`definitions/<type>.md`, INV-23) backing each section's
 * hover tooltip. Proposals/Runs have no framework definition
 * (catalyst-ui-only conventions) and are deliberately absent here — they
 * simply get no tooltip.
 */
const SECTION_ENTITY_TYPES: Partial<Record<TreeSectionKind, string[]>> = {
  requirement: ["requirement"],
  bug: ["bug"],
  "house-keeping": ["house-keeping"],
  step: ["step"],
  test: ["test"],
  domain: ["domain"],
  feature: ["feature"],
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  requirement: "Requirement",
  "house-keeping": "House-keeping",
  test: "Test",
  rule: "Rule",
  domain: "Domain",
  feature: "Feature",
  step: "Step",
  roadmap: "Roadmap",
  user: "User",
  role: "Role",
  journal: "Journal",
  backlog: "Backlog",
};

/**
 * Builds a root section's hover tooltip from its entity type(s)'
 * deployed definitions — `undefined` (tooltip left unset, falling back to
 * the label) if none are found, e.g. a deployment that predates INV-23
 * and hasn't migrated yet.
 */
function sectionTooltip(
  corpusRoot: string,
  entityTypes: string[],
): vscode.MarkdownString | undefined {
  const blocks: string[] = [];
  for (const entityType of entityTypes) {
    const definition = readEntityDefinition(corpusRoot, entityType);
    if (!definition) continue;
    const label = ENTITY_TYPE_LABELS[entityType] ?? entityType;
    blocks.push(`**${label}**\n\n${definition.description}`);
  }
  return blocks.length > 0
    ? new vscode.MarkdownString(blocks.join("\n\n"))
    : undefined;
}

/** Icon basename for an individual chain-model node, by its kind (and dev-artifact sub-type). */
function nodeIconName(node: ChainNode): string | undefined {
  switch (node.kind) {
    case "dev-artifact":
      switch (node.artifactType) {
        case "bug":
          return "bug";
        case "requirement":
          return "requirements";
        case "house-keeping":
          return "house-keeping";
        case "test":
          return "test";
      }
      return undefined;
    case "rule":
      return "rule";
    case "domain":
      return "domain";
    case "feature":
      return "features";
    case "roadmap":
      return "roadmap";
    case "step":
      return "step";
    default:
      return undefined;
  }
}

/**
 * Deployment-aware: with exactly one resolved deployment its root shows
 * that deployment's sections directly (today's single-folder UX,
 * unchanged); with more than one, the root shows one collapsible entry
 * per deployment (named after its workspace folder) expanding into its
 * own sections — node ids are only unique within one corpus, so every
 * item below the root carries which deployment it came from.
 */
/**
 * One chain inspector panel, showing one deployment (REQ-000017-UVqkd7cL):
 * a view slot of its own, delegating to the shared provider.
 */
class InspectorPanelProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
  corpusRoot: string | undefined;
  readonly onDidChangeTreeData: vscode.Event<void>;

  constructor(private readonly shared: ChainInspectorProvider) {
    this.onDidChangeTreeData = shared.onDidChangeTreeData;
  }

  getTreeItem(element: InspectorTreeItem): vscode.TreeItem {
    return this.shared.getTreeItem(element);
  }

  getChildren(element?: InspectorTreeItem): InspectorTreeItem[] {
    if (element) return this.shared.getChildren(element);
    return this.corpusRoot ? this.shared.rootFor(this.corpusRoot) : [];
  }

  getParent(element: InspectorTreeItem): InspectorTreeItem | undefined {
    return this.shared.getParent(element);
  }
}

class ChainInspectorProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
  private readonly deployments = new Map<string, DeploymentView>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Light/dark pair for an icon basename under resources/icons/. */
  private iconUris(name: string): { light: vscode.Uri; dark: vscode.Uri } {
    return {
      light: vscode.Uri.joinPath(
        this.extensionUri,
        "resources",
        "icons",
        "light",
        `${name}.svg`,
      ),
      dark: vscode.Uri.joinPath(
        this.extensionUri,
        "resources",
        "icons",
        "dark",
        `${name}.svg`,
      ),
    };
  }

  setState(
    corpusRoot: string,
    folderName: string,
    projectRoot: string,
    model: ChainModel,
    proposals: Proposal[],
    runs: Run[],
    users: IamUser[],
    roles: IamRole[],
  ): void {
    this.deployments.set(corpusRoot, {
      corpusRoot,
      folderName,
      projectRoot,
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

  refreshTree(): void {
    this.changeEmitter.fire();
  }

  getModel(corpusRoot: string): ChainModel | undefined {
    return this.deployments.get(corpusRoot)?.model;
  }

  /** The resolved deployment's workspace-folder path — where its `*.catalyst` pointer lives, one level up from `corpusRoot`. */
  getProjectRoot(corpusRoot: string): string | undefined {
    return this.deployments.get(corpusRoot)?.projectRoot;
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

  private treeItemOf(element: InspectorTreeItem): vscode.TreeItem {
    if (element.type === "deployment") {
      return new vscode.TreeItem(
        element.folderName,
        vscode.TreeItemCollapsibleState.Expanded,
      );
    }
    if (element.type === "dev-artifact-group") {
      const total = element.group.sections.reduce(
        (sum, s) => sum + s.nodes.length,
        0,
      );
      const item = new vscode.TreeItem(
        `${element.group.label} (${total})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("dev-artifacts");
      return item;
    }
    if (element.type === "rule-group") {
      const total = element.group.sections.reduce(
        (sum, s) => sum + s.nodes.length,
        0,
      );
      const item = new vscode.TreeItem(
        `${element.group.label} (${total})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("rule");
      return item;
    }
    if (element.type === "rule-type-section") {
      const item = new vscode.TreeItem(
        `${element.section.label} (${element.section.nodes.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("rule");
      item.tooltip = sectionTooltip(element.corpusRoot, ["rule"]);
      return item;
    }
    if (element.type === "section") {
      const item = new vscode.TreeItem(
        `${element.section.label} (${element.section.nodes.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      const iconName = SECTION_ICON_NAMES[element.section.kind];
      if (iconName) item.iconPath = this.iconUris(iconName);
      const entityTypes = SECTION_ENTITY_TYPES[element.section.kind];
      if (entityTypes) {
        item.tooltip = sectionTooltip(element.corpusRoot, entityTypes);
      }
      return item;
    }
    if (element.type === "roadmap-section") {
      const item = new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("roadmap");
      item.tooltip = sectionTooltip(element.corpusRoot, ["roadmap"]);
      return item;
    }
    if (element.type === "roadmap-group") {
      const retiredMark = element.group.retired ? " (retired)" : "";
      const item = new vscode.TreeItem(
        `${element.group.name}${retiredMark} (${element.group.items.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("roadmap");
      return item;
    }
    if (element.type === "proposal-section") {
      const item = new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("proposals");
      return item;
    }
    if (element.type === "proposal") {
      const item = new vscode.TreeItem(
        `${element.proposal.id} — ${element.proposal.intent} (${element.proposal.status})`,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = this.iconUris("proposals");
      return item;
    }
    if (element.type === "run-section") {
      const item = new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("runs");
      return item;
    }
    if (element.type === "run") {
      const item = new vscode.TreeItem(
        formatRunLabel(element.run),
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("runs");
      return item;
    }
    if (element.type === "run-step") {
      return new vscode.TreeItem(
        formatStepLabel(element.step),
        vscode.TreeItemCollapsibleState.None,
      );
    }
    if (element.type === "run-ledger-entry") {
      const item = new vscode.TreeItem(
        element.text,
        vscode.TreeItemCollapsibleState.None,
      );
      item.iconPath = this.iconUris("ledger");
      return item;
    }
    if (element.type === "user-section") {
      const item = new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("users");
      item.tooltip = sectionTooltip(element.corpusRoot, ["user"]);
      return item;
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
      item.iconPath = this.iconUris("users");
      return item;
    }
    if (element.type === "role-section") {
      const item = new vscode.TreeItem(
        element.section.label,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("roles");
      item.tooltip = sectionTooltip(element.corpusRoot, ["role"]);
      return item;
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
      item.iconPath = this.iconUris("roles");
      return item;
    }
    if (element.type === "separator") {
      return new vscode.TreeItem(
        "─".repeat(24),
        vscode.TreeItemCollapsibleState.None,
      );
    }
    if (element.type === "journal-entry") {
      const item = new vscode.TreeItem(
        "Journal",
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: OPEN_JOURNAL_COMMAND,
        title: "Journal",
        arguments: [element.corpusRoot],
      };
      item.iconPath = this.iconUris("journal");
      item.tooltip = sectionTooltip(element.corpusRoot, ["journal"]);
      return item;
    }
    if (element.type === "backlog-entry") {
      const item = new vscode.TreeItem(
        "Backlog",
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: OPEN_BACKLOG_COMMAND,
        title: "Backlog",
        arguments: [element.corpusRoot],
      };
      item.iconPath = this.iconUris("backlog");
      item.tooltip = sectionTooltip(element.corpusRoot, ["backlog"]);
      return item;
    }

    const pendingMark = element.pending ? "⏳ " : "";
    const item = new vscode.TreeItem(
      `${pendingMark}${formatNodeLabel(element.node)}`,
      this.hasChildNodes(element.corpusRoot, element.node)
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    item.command = {
      command: SHOW_DETAIL_COMMAND,
      title: "Show detail",
      arguments: [element.corpusRoot, element.node.id],
    };
    const iconName = nodeIconName(element.node);
    if (iconName) item.iconPath = this.iconUris(iconName);
    return item;
  }

  /**
   * Which reverse-edge node kinds nest under a given node in the tree, for
   * discoverability on top of that kind's own flat section under "Dev
   * Artifacts". Steps deliberately do **not** nest here, even though a
   * step names exactly one parent requirement or bug
   * (`Rules-of-Rules.md` §21) — a step is assembled under the flat
   * "Steps" section and nowhere else, never duplicated as a nested
   * child too. Tests still nest under both a requirement's/bug's and a
   * step's own tree node (`Rules-of-Rules.md` §22, `(0,n)` many-to-many,
   * so the same test can legitimately nest under more than one parent,
   * or under none) — that's on top of the flat "Tests" section, not a
   * duplicate of it, since `(0,n)` doesn't single out one owner the way
   * a step's own required parent does.
   */
  private childKindsFor(node: ChainNode): Array<"step" | "test"> {
    if (
      node.kind === "dev-artifact" &&
      (node.artifactType === "requirement" || node.artifactType === "bug")
    ) {
      return ["test"];
    }
    if (node.kind === "step") return ["test"];
    return [];
  }

  private isChildOfKind(candidate: ChainNode, kind: "step" | "test"): boolean {
    if (kind === "step") return candidate.kind === "step";
    return (
      candidate.kind === "dev-artifact" && candidate.artifactType === "test"
    );
  }

  /** True when `node` has at least one child of a kind `childKindsFor` names, resolved via reverse edges. */
  private hasChildNodes(corpusRoot: string, node: ChainNode): boolean {
    const kinds = this.childKindsFor(node);
    if (kinds.length === 0) return false;
    const model = this.getModel(corpusRoot);
    const reverse = model?.reverseEdges.get(node.id);
    if (!model || !reverse) return false;
    for (const id of reverse) {
      const candidate = model.nodes.get(id);
      if (candidate && kinds.some((k) => this.isChildOfKind(candidate, k))) {
        return true;
      }
    }
    return false;
  }

  /** `node`'s own steps and/or tests, resolved via the chain model's reverse edges — sorted by id. */
  private childNodesFor(
    corpusRoot: string,
    node: ChainNode,
  ): InspectorTreeItem[] {
    const kinds = this.childKindsFor(node);
    if (kinds.length === 0) return [];
    const model = this.getModel(corpusRoot);
    const reverse = model?.reverseEdges.get(node.id);
    if (!model || !reverse) return [];
    return [...reverse]
      .map((id) => model.nodes.get(id))
      .filter(
        (n): n is ChainNode =>
          n !== undefined && kinds.some((k) => this.isChildOfKind(n, k)),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((childNode) => ({
        type: "node" as const,
        corpusRoot,
        node: childNode,
        pending: false,
      }));
  }

  private sectionsFor(view: DeploymentView): InspectorTreeItem[] {
    const {
      devArtifacts,
      rules,
      sections: otherSections,
    } = buildTreeSections(view.model);
    const sections: InspectorTreeItem[] = [
      {
        type: "dev-artifact-group",
        corpusRoot: view.corpusRoot,
        group: devArtifacts,
      },
      {
        type: "rule-group",
        corpusRoot: view.corpusRoot,
        group: rules,
      },
      ...otherSections.map((section): InspectorTreeItem => ({
        type: "section",
        corpusRoot: view.corpusRoot,
        section,
      })),
    ];
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

  // Stable identities, so TreeView.reveal can select a node
  // (REQ-000017-UVqkd7cL): each child remembers its parent and gets an id
  // from its parent's id and its structural key (tree-ids.ts).
  private readonly parents = new WeakMap<
    InspectorTreeItem,
    InspectorTreeItem | undefined
  >();
  private readonly ids = new WeakMap<InspectorTreeItem, string>();

  getTreeItem(element: InspectorTreeItem): vscode.TreeItem {
    const item = this.treeItemOf(element);
    const id = this.ids.get(element);
    if (id) item.id = id;
    return item;
  }

  getChildren(element?: InspectorTreeItem): InspectorTreeItem[] {
    const children = this.childrenOf(element);
    const parentId = element ? (this.ids.get(element) ?? "") : "";
    const taken = new Map<string, number>();
    for (const child of children) {
      const label = this.treeItemOf(child).label;
      const text = typeof label === "string" ? label : (label?.label ?? "");
      this.parents.set(child, element);
      this.ids.set(
        child,
        childId(parentId, itemKey(child as never, text), taken),
      );
    }
    return children;
  }

  getParent(element: InspectorTreeItem): InspectorTreeItem | undefined {
    return this.parents.get(element);
  }

  /**
   * The top level of one deployment's own chain inspector panel: its
   * sections, with no parent (REQ-000017-UVqkd7cL — every deployment has a
   * panel of its own).
   */
  rootFor(corpusRoot: string): InspectorTreeItem[] {
    const view = this.deployments.get(corpusRoot);
    const sections = view ? this.sectionsFor(view) : [];
    const taken = new Map<string, number>();
    for (const child of sections) {
      const label = this.treeItemOf(child).label;
      const text = typeof label === "string" ? label : (label?.label ?? "");
      this.parents.set(child, undefined);
      this.ids.set(
        child,
        childId(`panel:${corpusRoot}`, itemKey(child as never, text), taken),
      );
    }
    return sections;
  }

  /** A node's first, shallowest occurrence in its deployment's panel. */
  findNode(corpusRoot: string, nodeId: string): InspectorTreeItem | undefined {
    return breadthFirst(
      this.rootFor(corpusRoot),
      (item) => {
        if (item.type === "node") return []; // a node's own children never hold its first occurrence
        if ("corpusRoot" in item && item.corpusRoot !== corpusRoot) return [];
        return this.getChildren(item);
      },
      (item) =>
        item.type === "node" &&
        item.corpusRoot === corpusRoot &&
        item.node.id === nodeId,
    );
  }

  private childrenOf(element?: InspectorTreeItem): InspectorTreeItem[] {
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
    if (element.type === "dev-artifact-group") {
      return element.group.sections.map((section) => ({
        type: "section",
        corpusRoot: element.corpusRoot,
        section,
      }));
    }
    if (element.type === "rule-group") {
      return element.group.sections.map((section) => ({
        type: "rule-type-section",
        corpusRoot: element.corpusRoot,
        section,
      }));
    }
    if (element.type === "rule-type-section") {
      const pendingTargets = this.getPendingTargets(element.corpusRoot);
      return element.section.nodes.map((node) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node,
        pending: pendingTargets.has(node.id),
      }));
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
    if (element.type === "node") {
      return this.childNodesFor(element.corpusRoot, element.node);
    }
    return [];
  }
}

/**
 * Theme-aware styling for a node's rendered markdown (`marked` output in
 * `NodeDetail`'s `DetailsSection`) plus the surrounding webview chrome.
 * Uses only VS Code's own `--vscode-*` custom properties (injected into
 * every webview automatically, no extra wiring) rather than hardcoded
 * colors, so headings/tables/code blocks/links look native in both
 * light and dark themes instead of the browser's bare unstyled default
 * (plain white background, borderless tables, no code-block styling) —
 * without this, formatted HTML still *reads* like unformatted markup.
 */
const WEBVIEW_STYLES = `
body {
  font-family: var(--vscode-font-family, sans-serif);
  font-size: var(--vscode-font-size, 13px);
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-editor-background);
  padding: 16px 20px;
  line-height: 1.5;
}
h1, h2, h3, h4 { font-weight: 600; margin: 20px 0 8px; }
h1 { font-size: 1.5em; margin-top: 0; }
h2 {
  font-size: 1.2em;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--vscode-panel-border, #808080);
}
h3 { font-size: 1.05em; }
p { margin: 0 0 8px; }
ul, ol { margin: 0 0 8px; padding-left: 1.4em; }
li { margin-bottom: 4px; }
code {
  font-family: var(--vscode-editor-font-family, monospace);
  background-color: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.2));
  padding: 1px 4px;
  border-radius: 3px;
}
pre {
  background-color: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, 0.2));
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}
pre code { background: none; padding: 0; }
table { border-collapse: collapse; margin: 0 0 12px; width: 100%; }
th, td {
  border: 1px solid var(--vscode-panel-border, #808080);
  padding: 4px 10px;
  text-align: left;
  vertical-align: top;
}
th { background-color: var(--vscode-list-hoverBackground, rgba(127, 127, 127, 0.1)); }
a { color: var(--vscode-textLink-foreground); }
a:hover { color: var(--vscode-textLink-activeForeground); }
blockquote {
  margin: 0 0 8px;
  padding-left: 12px;
  border-left: 3px solid var(--vscode-panel-border, #808080);
  color: var(--vscode-descriptionForeground);
}
`;

function renderWebviewHtml(
  scriptUri: vscode.Uri,
  payload: WebviewPayload,
  cspSource: string,
): string {
  const nonce = randomBytes(16).toString("hex");
  // A node's raw markdown content (full file text, since the description
  // feature) can legitimately contain the literal substring `</script>`
  // (a code sample, an HTML example) — unescaped, that would close this
  // script block early and corrupt the page. `<` isn't a JS/JSON
  // escape a parser treats specially, so this is invisible to both.
  const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${webviewCsp(nonce, cspSource)}" />
<style nonce="${nonce}">${WEBVIEW_STYLES}</style>
</head>
<body>
<div id="root"></div>
<script nonce="${nonce}">window.__CATALYST_INITIAL_PAYLOAD__ = ${payloadJson};</script>
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

/**
 * Writes a PROP- file. Refused in an untrusted workspace (B-11), which
 * stays read-only; returns whether the file was written.
 */
async function writeProposal(
  corpusRoot: string,
  id: string,
  title: string,
  content: string,
): Promise<boolean> {
  const blocked = proposalWriteBlockedMessage(vscode.workspace.isTrusted);
  if (blocked) {
    void vscode.window.showWarningMessage(blocked);
    return false;
  }
  const filePath = join(corpusRoot, "proposals", `${id}-${slugify(title)}.md`);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(content, "utf8"),
  );
  return true;
}

/**
 * The chat participant for a known, detected coding-agent extension —
 * looked up by scanning installed extensions (`scanAvailableAgents`),
 * never by reading a `*.catalyst` pointer's `agent` field, since the
 * whole point here is resolving one for a project that has no pointer
 * yet. `null` when nothing in `AGENT_PRESETS` is actually installed.
 */
function detectDefaultAgentBinding(): {
  id: string;
  participant: string;
} | null {
  const detected = scanAvailableAgents();
  for (const [id, preset] of Object.entries(AGENT_PRESETS)) {
    if (detected.some((d) => d.extensionId === preset.extensionId)) {
      return { id, participant: preset.participant };
    }
  }
  return null;
}

/**
 * A workspace folder with no `*.catalyst` pointer file gets an actionable
 * offer rather than silence — gated purely on that file's existence
 * (`hasCatalystPointer`, checked by the caller), not on whether a working
 * copy can actually be located, since that's a different question with
 * its own richer fallback chain (`resolveCorpusRoot`). The two paths this
 * offers reflect the only two ways a project's catalyst-existence
 * question ever resolves: it's already backed by a repo somewhere
 * (`connectExistingCriterionRepo`, fully code-driven), or it genuinely
 * needs a first-time install (`offerAgentDrivenInstantiation`, which still
 * needs a reasoning agent for BOOTSTRAP.md's judgment calls).
 */
async function offerToInstall(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const dismissKey = ONBOARDING_DISMISSED_PREFIX + folder.uri.fsPath;
  if (context.workspaceState.get<boolean>(dismissKey)) return;

  const choice = await vscode.window.showInformationMessage(
    `No catalyst deployment found in "${folder.name}".`,
    "Set up catalyst…",
    "Never offer here",
    "Not in this workspace",
    "Don't ask again",
  );

  if (choice === "Don't ask again") {
    await context.workspaceState.update(dismissKey, true);
    return;
  }
  if (choice === "Never offer here") {
    // The kernel's own opt-out (fw-STRUCTURE-000017): every catalyst host
    // and agent leaves this folder alone, for everyone (REQ-000015-UVqkd7cL).
    writeFileSync(
      join(folder.uri.fsPath, IGNORE_FILE),
      "# This directory is not governed by catalyst (an empty .catalystignore opts it out).\n",
    );
    void vscode.window.showInformationMessage(
      `Wrote ${IGNORE_FILE} in "${folder.name}": catalyst leaves it alone. Commit it to share that choice.`,
    );
    return;
  }
  if (choice === "Not in this workspace") {
    // Personal, this workspace only: catalyst.ignoredFolders.
    const config = vscode.workspace.getConfiguration("catalyst", folder.uri);
    const ignored = config.get<string[]>(IGNORED_FOLDERS_SETTING, []);
    await config.update(
      IGNORED_FOLDERS_SETTING,
      [...ignored, folder.uri.fsPath],
      vscode.ConfigurationTarget.Workspace,
    );
    return;
  }
  if (choice !== "Set up catalyst…") return;

  const pick = await vscode.window.showQuickPick(
    [
      {
        label: "Load a specific kernel version in memory",
        detail:
          "Select a specific Catalyst kernel version to load into extension memory and activate a matching UI module.",
        action: "version" as const,
      },
      {
        label: "Connect to an existing criterion repo",
        detail:
          "Clone an already-repoed deployment's branch — a git clone, a .criterion link and a pointer file, no agent involved.",
        action: "connect" as const,
      },
      {
        label: "Create a brand new deployment",
        detail:
          "First-time instantiation — needs a reasoning agent to follow BOOTSTRAP.md.",
        action: "create" as const,
      },
    ],
    { placeHolder: `How should catalyst be set up for "${folder.name}"?` },
  );
  if (!pick) return;

  if (pick.action === "version") {
    await vscode.commands.executeCommand(SELECT_KERNEL_VERSION_COMMAND);
  } else if (pick.action === "connect") {
    await connectExistingCriterionRepo(folder);
  } else {
    await offerAgentDrivenInstantiation(folder);
  }
}

/**
 * `/criterion get`'s mechanical half, done in code rather than handed to
 * an agent: cloning a branch into agent-owned storage, linking it as the
 * project's gitignored `.criterion` and writing a (path-free) pointer file
 * needs no judgment calls. Deliberately skips that command's identity-migration half
 * (rewriting existing artifacts' `Signed-off-by` fields) — a project with
 * no deployment a moment ago has no local artifacts to migrate.
 */
async function connectExistingCriterionRepo(
  folder: vscode.WorkspaceFolder,
): Promise<void> {
  const repoUrl = await vscode.window.showInputBox({
    title: "Criterion repo",
    prompt: "Git URL of the existing criterion repo",
    placeHolder: "git@github.com:org/criterion.git",
    ignoreFocusOut: true,
  });
  if (!repoUrl) return;

  const branch = await vscode.window.showInputBox({
    title: "Branch to check out",
    prompt:
      'Your own "<name>.criterion" branch, or "criterion" itself for single-maintainer mode',
    value: "criterion",
    ignoreFocusOut: true,
  });
  if (!branch) return;

  const agentSource = defaultAgentSource(folder.uri.fsPath);
  const agentBinding = detectDefaultAgentBinding();

  try {
    await joinCriterionRepo({
      projectRoot: folder.uri.fsPath,
      repoUrl,
      branch,
      agentSource,
      agentId: agentBinding?.id,
    });
    void vscode.window.showInformationMessage(
      `Connected "${folder.name}" to ${repoUrl} (${branch}).`,
    );
  } catch (err) {
    void vscode.window.showErrorMessage(
      `Couldn't connect to the criterion repo: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

/**
 * A brand-new deployment still needs a reasoning agent: BOOTSTRAP.md's
 * install procedure has judgment calls (retrofit vs. greenfield,
 * bootstrapping rules from existing code evidence) that aren't
 * mechanically scriptable. What's code-driven now is the dispatch itself:
 * a detected agent extension is picked and invoked directly
 * (`invokeChatParticipant`) instead of copying a prompt to the clipboard
 * and asking the user to paste it in themselves. Clipboard-copy remains
 * only as the last-resort fallback when no known agent extension is
 * detected at all — there's nothing to dispatch to.
 */
async function offerAgentDrivenInstantiation(
  folder: vscode.WorkspaceFolder,
): Promise<void> {
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

  const instruction = buildInstantiationPrompt(
    frameworkPath,
    folder.uri.fsPath,
  );
  const agentBinding = detectDefaultAgentBinding();

  if (!agentBinding) {
    await vscode.env.clipboard.writeText(instruction);
    void vscode.window.showInformationMessage(
      "No known coding-agent extension detected — instantiation prompt copied to the clipboard instead. Paste it into your agent.",
    );
    return;
  }

  await invokeChatParticipant(agentBinding.participant, "", instruction);
  void vscode.window.showInformationMessage(
    `Sent the instantiation instruction to ${agentBinding.participant}.`,
  );
}

/** The chat-agent binding to target for a project root: its first configured `chatAgents` entry, or the zero-config default derived from the plain `agent` field. */
function resolveChatAgentDef(projectRoot: string): AgentBinding | null {
  const chatAgents = parseChatAgents(projectRoot);
  return chatAgents[0] ?? defaultChatAgent(projectRoot);
}

/**
 * A resolved deployment behind the highest catalyst kernel version
 * this extension build has been verified against gets an actionable
 * offer, mirroring `offerToInstall`'s own bar: nothing runs until the
 * user explicitly clicks "Sync now" — `/sync-framework` mutates real
 * deployment files, so this must never fire silently. The dismiss key
 * includes the target version, so a future bump of
 * `VERIFIED_KERNEL_VERSION` (catalyst-core `kernel-version.ts`) re-prompts even if an earlier
 * offer was dismissed.
 *
 * One notification path covers both thresholds on the same scale —
 * never two separate popups for what's really one situation. Below
 * `REQUIRED_KERNEL_VERSION` (`catalyst-core`'s declared floor, a
 * version specifier the same way a `uv.lock`'s `requires-python` states
 * one) the wording says so explicitly, since parsing may actually be
 * wrong, not just missing newer sections; between the required floor
 * and the verified version the wording stays the softer
 * "supports syncing to" — a deployment there parses correctly today,
 * syncing just gets it the newer entity types.
 */
async function offerToSyncKernel(
  context: vscode.ExtensionContext,
  target: DeploymentTarget,
  corpusRoot: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const deployed = readDeployedKernelVersion(corpusRoot);
  // Unknown version, or already at/above what this build was verified
  // against: nothing to offer — never a downgrade target (B-08).
  const syncTarget = kernelSyncTarget(deployed);
  if (!deployed || !syncTarget) return;

  const dismissKey = `${SYNC_OFFER_DISMISSED_PREFIX}${target.path}:${syncTarget}`;
  if (context.workspaceState.get<boolean>(dismissKey)) return;

  const message = meetsRequiredKernelVersion(deployed)
    ? `"${target.name}" is on catalyst ${deployed}; this extension supports syncing to ${syncTarget}.`
    : `"${target.name}" is on catalyst ${deployed}, below the ${REQUIRED_KERNEL_VERSION} this extension requires — some entities may not parse correctly. Sync to ${syncTarget}?`;

  const choice = await vscode.window.showInformationMessage(
    message,
    "Sync now",
    "Don't ask again",
  );

  if (choice === "Don't ask again") {
    await context.workspaceState.update(dismissKey, true);
    return;
  }
  if (choice !== "Sync now") return;

  const agentDef = resolveChatAgentDef(target.path);
  if (!agentDef) {
    void vscode.window.showErrorMessage(
      'Couldn\'t determine which agent to chat with — no *.catalyst pointer with an "agent" or "chatAgents" field found.',
    );
    return;
  }

  await resolveAndInvoke(
    agentDef,
    "/sync-framework",
    syncTarget,
    outputChannel,
  );
}

/** One deployment as the tree shows it: its display name and its project directory. */
interface DeploymentTarget {
  name: string;
  path: string;
}

interface RegisteredDeployment {
  handle: WatcherHandle;
  disposables: vscode.Disposable[];
  ownedDiagnosticFiles: Set<string>;
}

/** Sets up one resolved deployment: its watcher plus its own Definition/CodeLens/CodeActions providers. */
function setupDeployment(
  target: DeploymentTarget,
  corpusRoot: string,
  provider: ChainInspectorProvider,
  diagnostics: vscode.DiagnosticCollection,
  codeLensChangeEmitter: vscode.EventEmitter<void>,
  onUpdate: (corpusRoot: string) => void = () => {},
): RegisteredDeployment {
  const ownedDiagnosticFiles = new Set<string>();
  let latestReport: ValidationReport | undefined;

  const handle = watchCorpus(
    corpusRoot,
    ({ model, report, proposals, runs, users, roles }) => {
      provider.setState(
        corpusRoot,
        target.name,
        target.path,
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
      // Open detail panels of this deployment show the new state (B-10).
      onUpdate(corpusRoot);
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

interface CommandCandidate {
  folder: vscode.WorkspaceFolder;
  commands: SlashCommandSpec[];
}

interface PickedCommand {
  folder: vscode.WorkspaceFolder;
  cmd: SlashCommandSpec;
  args: string;
}

/**
 * Shared by every command that needs "which project, which catalyst
 * command, what arguments" — today just `SEND_TO_AGENT_CHAT_COMMAND`.
 * Returns `undefined` if the user dismissed a picker, or there was
 * nothing to pick from (already reported to the user in that case).
 */
async function pickCommandAndArgs(
  candidates: CommandCandidate[],
): Promise<PickedCommand | undefined> {
  if (candidates.length === 0) {
    void vscode.window.showInformationMessage(
      "No .claude/commands found in this workspace.",
    );
    return undefined;
  }

  let chosen = candidates[0];
  if (candidates.length > 1) {
    const pick = await vscode.window.showQuickPick(
      candidates.map((entry) => ({ label: entry.folder.name, entry })),
      { placeHolder: "Which project?" },
    );
    if (!pick) return undefined;
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
  if (!commandPick) return undefined;

  let args = "";
  if (commandPick.cmd.argumentHint) {
    args =
      (await vscode.window.showInputBox({
        prompt: `Arguments for /${commandPick.cmd.name}`,
        placeHolder: commandPick.cmd.argumentHint,
      })) ?? "";
  }

  return { folder: chosen.folder, cmd: commandPick.cmd, args };
}

function discoverCommandCandidates(): CommandCandidate[] {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders
    .map((folder) => ({
      folder,
      commands: discoverSlashCommands(folder.uri.fsPath),
    }))
    .filter((entry) => entry.commands.length > 0);
}

export function activate(context: vscode.ExtensionContext): void {
  const uiModuleManager = new UiModuleManager();
  let inMemoryKernelVersion: string | null = null;
  const storagePath = context.globalStorageUri.fsPath;

  const provider = new ChainInspectorProvider(context.extensionUri);

  // One chain inspector panel per deployment (REQ-000017-UVqkd7cL): view
  // slots declared in package.json, slot 0 always shown, the others shown
  // (context key catalyst.inspectorSlot<N>) as deployments are found. Each
  // is a TreeView, so a node can be revealed in it.
  const panels = INSPECTOR_VIEW_IDS.map((id) => {
    const panelProvider = new InspectorPanelProvider(provider);
    const view = vscode.window.createTreeView(id, {
      treeDataProvider: panelProvider,
    });
    context.subscriptions.push(view);
    return { provider: panelProvider, view };
  });
  let warnedTooMany = false;
  function assignPanels(targets: Map<string, DeploymentTarget>): void {
    const roots = [...targets.keys()];
    panels.forEach((panel, index) => {
      const root = roots[index];
      panel.provider.corpusRoot = root;
      panel.view.description = root ? targets.get(root)?.name : undefined;
      void vscode.commands.executeCommand(
        "setContext",
        `catalyst.inspectorSlot${index}`,
        index === 0 || !!root,
      );
    });
    if (roots.length > panels.length && !warnedTooMany) {
      warnedTooMany = true;
      void vscode.window.showWarningMessage(
        `catalyst shows ${panels.length} chain inspectors; ${roots.length - panels.length} more deployment(s) in this workspace are not shown.`,
      );
    }
    provider.refreshTree();
  }
  /** Select a node in its deployment's panel — only while that panel is visible, never moving focus. */
  function revealNode(corpusRoot: string, nodeId: string): void {
    if (
      !vscode.workspace
        .getConfiguration("catalyst")
        .get<boolean>(TRACK_SETTING, true)
    )
      return;
    const panel = panels.find((p) => p.provider.corpusRoot === corpusRoot);
    if (!panel || !panel.view.visible) return;
    const element = provider.findNode(corpusRoot, nodeId);
    if (element)
      void panel.view.reveal(element, {
        select: true,
        focus: false,
        expand: false,
      });
  }

  const diagnostics = vscode.languages.createDiagnosticCollection(
    DIAGNOSTIC_COLLECTION_NAME,
  );
  context.subscriptions.push(diagnostics);

  const codeLensChangeEmitter = new vscode.EventEmitter<void>();
  context.subscriptions.push(codeLensChangeEmitter);

  const registeredDeployments = new Map<string, RegisteredDeployment>();

  const agentBridgeOutputChannel =
    vscode.window.createOutputChannel("Catalyst");
  context.subscriptions.push(agentBridgeOutputChannel);

  // Every deployment of a workspace folder, nested ones included, by the
  // kernel's scope rule (REQ-000015-UVqkd7cL): folder -> its corpus roots,
  // and each corpus root's project directory and display name.
  const folderDeployments = new Map<string, string[]>();
  const deploymentTargets = new Map<string, DeploymentTarget>();

  const ignoredFoldersFor = (folder: vscode.WorkspaceFolder): string[] =>
    vscode.workspace
      .getConfiguration("catalyst", folder.uri)
      .get<string[]>(IGNORED_FOLDERS_SETTING, []);

  // A deployment whose working copy is not reachable here (a remote
  // environment without the installing machine's agent-owned space) is
  // reported once, with the fix that fits (REQ-000016-UVqkd7cL).
  const reportedUnreachable = new Set<string>();
  function reportUnreachable(
    name: string,
    projectRoot: string,
    target: string | undefined,
  ): void {
    if (reportedUnreachable.has(projectRoot)) return;
    reportedUnreachable.add(projectRoot);
    const advice = unreachableAdvice(name, target, vscode.env.remoteName);
    const labels: Record<string, string> = {
      "copy-mount": "Copy devcontainer mount",
      share: "Share with /criterion create",
    };
    void vscode.window
      .showWarningMessage(
        advice.message,
        ...advice.actions.map((a) => labels[a]),
      )
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
          await resolveAndInvoke(
            agentDef,
            "/criterion",
            "create",
            agentBridgeOutputChannel,
          );
        }
      });
  }

  function resolveFolder(folder: vscode.WorkspaceFolder): void {
    // Virtual and other non-file folders have no file system to read.
    if (folder.uri.scheme !== "file") return;
    const ignored = ignoredFoldersFor(folder);
    const found = findDeployments(folder.uri.fsPath, folder.name, { ignored });
    const roots: string[] = [];
    folderDeployments.set(folder.uri.toString(), roots);
    if (found.length === 0) {
      const leftOut =
        optedOut(folder.uri.fsPath) ||
        isIgnoredFolder(folder.uri.fsPath, ignored, folder.uri.fsPath);
      // Untrusted, catalyst only reads: no install offer (Workspace Trust).
      // No automatic module download here (B-06): fetching remote UI
      // modules is only ever started by the user ("Switch Process UI
      // Module").
      if (!leftOut && vscode.workspace.isTrusted) {
        void offerToInstall(context, folder);
      }
      return;
    }
    for (const deployment of found) {
      const wc = workingCopyState(deployment.projectRoot);
      if (wc.state !== "reachable") {
        reportUnreachable(
          deployment.name,
          deployment.projectRoot,
          wc.state === "dangling" ? wc.target : undefined,
        );
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
          (root) => refreshDetailPanelsFor(root),
        ),
      );
      if (vscode.workspace.isTrusted) {
        void offerToSyncKernel(
          context,
          target,
          corpusRoot,
          agentBridgeOutputChannel,
        );
      }
    }
    updateStatusBar();
    assignPanels(deploymentTargets);
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
    for (const corpusRoot of folderDeployments.get(folder.uri.toString()) ??
      []) {
      teardownDeployment(corpusRoot);
    }
    folderDeployments.delete(folder.uri.toString());
    updateStatusBar();
    assignPanels(deploymentTargets);
  }

  function reresolveAll(): void {
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      teardownFolder(folder);
      resolveFolder(folder);
    }
  }

  // The deployment owning the active editor's file, if any.
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50,
  );
  context.subscriptions.push(statusBar);
  function updateStatusBar(): void {
    const file = vscode.window.activeTextEditor?.document.uri;
    const roots = [...deploymentTargets.values()].map((t) => t.path);
    const owner =
      file?.scheme === "file" ? owningDeployment(roots, file.fsPath) : null;
    const entry = owner
      ? [...deploymentTargets.entries()].find(([, t]) => t.path === owner)
      : undefined;
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
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar()),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`catalyst.${IGNORED_FOLDERS_SETTING}`)) {
        reresolveAll();
      }
    }),
    // Trust granted: the offers and agent commands an untrusted
    // workspace held back become available.
    vscode.workspace.onDidGrantWorkspaceTrust(() => reresolveAll()),
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
    restoreKernelVersion(
      [...deploymentTargets.keys()].map((root) =>
        readDeployedKernelVersion(root),
      ),
    ),
  );
  if (localRes && localRes.success) {
    void vscode.window.showInformationMessage(
      `Automatically activated saved local UI module "${localRes.module.manifest.name}" (v${localRes.module.manifest.version}).`,
    );
  } else if (localRes && !localRes.success) {
    agentBridgeOutputChannel.appendLine(
      `Saved UI module not restored: ${localRes.error}`,
    );
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
        const written = await writeProposal(
          corpusRoot,
          id,
          `propose-fix-${issue.kind}`,
          content,
        );
        if (!written) return;
        void vscode.window.showInformationMessage(
          `Created ${id} — an agent still needs to act on it.`,
        );
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMPOSE_PROPOSAL_COMMAND, async () => {
      // Say so before asking five questions whose answer can't be saved.
      const blocked = proposalWriteBlockedMessage(vscode.workspace.isTrusted);
      if (blocked) {
        void vscode.window.showWarningMessage(blocked);
        return;
      }
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
      if (!(await writeProposal(corpusRoot, id, title, content))) return;
      void vscode.window.showInformationMessage(
        `Created ${id} — an agent still needs to act on it.`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(SEND_TO_AGENT_CHAT_COMMAND, async () => {
      const picked = await pickCommandAndArgs(discoverCommandCandidates());
      if (!picked) return;

      const projectRoot = picked.folder.uri.fsPath;
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

      await resolveAndInvoke(
        agentDef,
        `/${picked.cmd.name}`,
        picked.args,
        agentBridgeOutputChannel,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(CONFIGURE_CRITERION_COMMAND, async () => {
      const corpusRoots = provider.getCorpusRoots();
      if (corpusRoots.length === 0) {
        void vscode.window.showErrorMessage(
          "No catalyst deployment is open in this workspace.",
        );
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

      // Gathers <name>/<git-info>, then dispatches the real /criterion
      // command — this never mutates the pointer or runs git itself; the
      // agent running /criterion create owns that, including branch
      // selection and the already-repoed/branching cases (Rules-of-Rules
      // §13). This UI only ever drives "create" — "get" is the join path
      // for a folder with no local .criterion/ yet, which doesn't apply
      // to a deployment already resolved here.
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
        const suggested = users[0]
          ? suggestCriterionBranch(users[0].name)
          : undefined;
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

      await resolveAndInvoke(
        agentDef,
        "/criterion",
        `create ${name} ${gitInfo}`,
        agentBridgeOutputChannel,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(REFRESH_CHAIN_INSPECTOR_COMMAND, () => {
      if (registeredDeployments.size === 0) {
        void vscode.window.showInformationMessage(
          "No catalyst deployment is open in this workspace.",
        );
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
    vscode.commands.registerCommand(OPEN_SETTINGS_COMMAND, () => {
      void vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "catalyst",
      );
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
        placeHolder:
          "Select a Catalyst kernel version to load into extension memory:",
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

      const res = uiModuleManager.loadAndActivateZipModule(
        zipPath,
        currentKernelVersion,
      );

      if (res.success) {
        saveModuleLocally(storagePath, readFileSync(zipPath));
        refreshAllDetailPanels();
        provider.refreshTree();
        void vscode.window.showInformationMessage(
          `Successfully loaded UI module "${res.module.manifest.name}" (v${res.module.manifest.version}) for kernel version ${currentKernelVersion}.`,
        );
      } else {
        void vscode.window.showErrorMessage(
          `Failed to load UI module: ${res.error}`,
        );
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
      vscode.workspace
        .getConfiguration("catalyst")
        .get<string>("moduleSourceUrl") ||
      "git@github.com:oliben67/cantica-tech.git/catalyst/";

    const remoteModules = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Fetching available UI modules...",
      },
      async () => fetchRemoteUiModules(moduleSourceUrl),
    );

    if (remoteModules.length === 0) {
      void vscode.window.showErrorMessage(
        `No process UI modules found at ${moduleSourceUrl}`,
      );
      return;
    }

    const items: Array<{
      label: string;
      description?: string;
      detail?: string;
      module: RemoteModuleInfo;
    }> = remoteModules.map((m) => ({
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

      const loadRes = uiModuleManager.loadAndActivateZipModule(
        zipBuffer,
        currentKernelVersion,
      );

      if (loadRes.success) {
        saveModuleLocally(storagePath, zipBuffer);
        refreshAllDetailPanels();
        provider.refreshTree();
        void vscode.window.showInformationMessage(
          `Successfully activated UI module "${loadRes.module.manifest.name}" (v${loadRes.module.manifest.version}). Display refreshed!`,
        );
      } else {
        void vscode.window.showErrorMessage(
          `Failed to activate downloaded module: ${loadRes.error}`,
        );
      }
    } catch (err) {
      void vscode.window.showErrorMessage(
        `Failed to download module: ${
          err instanceof Error ? err.message : String(err)
        }`,
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
  function showDetailPanel(
    key: string,
    project: string,
    title: string,
    build: () => WebviewPayload | null,
  ): void {
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
      const grouping = readGrouping(
        vscode.workspace
          .getConfiguration("catalyst")
          .get(PANEL_GROUPING_SETTING),
      );
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
          localResourceRoots: [
            vscode.Uri.joinPath(context.extensionUri, "dist"),
          ],
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
          void vscode.commands
            .executeCommand(SHOW_DETAIL_COMMAND, project, target)
            .then(() => revealNode(project, target));
        }
      });
      created.onDidDispose(() => {
        detailPanels.delete(key);
        panelMeta.delete(key);
        panelBuilders.delete(key);
        panelOwners.delete(key);
      });
    }

    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "dist", "webview.js"),
    );
    panel.webview.html = renderWebviewHtml(
      scriptUri,
      payload,
      panel.webview.cspSource,
    );
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
    vscode.commands.registerCommand(
      SHOW_DETAIL_COMMAND,
      (corpusRoot: string, nodeId: string) => {
        showDetailPanel(
          `node:${corpusRoot}:${nodeId}`,
          corpusRoot,
          `Node: ${nodeId}`,
          () => {
            const model = provider.getModel(corpusRoot);
            if (!model) return null;
            const payload = buildNodeDetail(
              model,
              nodeId,
              provider.getPendingTargets(corpusRoot),
            );
            if (!payload) return null;
            return {
              type: "node",
              kernelVersionInfo: getKernelVersionInfo(corpusRoot),
              references: referencesForNode(model, payload),
              ...payload,
            };
          },
        );
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      SHOW_IAM_DETAIL_COMMAND,
      (corpusRoot: string, kind: "user" | "role", name: string) => {
        if (kind === "user") {
          showDetailPanel(
            `iam-user:${corpusRoot}:${name}`,
            corpusRoot,
            `User: ${name}`,
            () => {
              const user = provider
                .getUsers(corpusRoot)
                .find((u) => u.name === name);
              if (!user) return null;
              return {
                type: "iam-user",
                kernelVersionInfo: getKernelVersionInfo(corpusRoot),
                ...buildIamUserDetail(user, provider.getRoles(corpusRoot)),
              };
            },
          );
        } else {
          showDetailPanel(
            `iam-role:${corpusRoot}:${name}`,
            corpusRoot,
            `Role: ${name}`,
            () => {
              const role = provider
                .getRoles(corpusRoot)
                .find((r) => r.name === name);
              if (!role) return null;
              return {
                type: "iam-role",
                kernelVersionInfo: getKernelVersionInfo(corpusRoot),
                ...buildIamRoleDetail(role, provider.getUsers(corpusRoot)),
              };
            },
          );
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
        showDetailPanel(`journal:${corpusRoot}`, corpusRoot, "Journal", () => ({
          type: "journal",
          kernelVersionInfo: getKernelVersionInfo(corpusRoot),
          entries: parseJournal(corpusRoot),
        }));
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      OPEN_BACKLOG_COMMAND,
      (corpusRoot: string) => {
        const backlogPath = join(corpusRoot, "development", "BACKLOG.md");
        if (!existsSync(backlogPath)) {
          void vscode.window.showWarningMessage(
            "No BACKLOG.md found — run /show-backlog first.",
          );
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
            references: backlogModel
              ? buildReferenceTable(backlogModel, [markdown])
              : undefined,
            markdown,
          };
        });
      },
    ),
  );
}

export function deactivate(): void {}
