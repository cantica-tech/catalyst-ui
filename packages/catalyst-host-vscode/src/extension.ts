import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type {
  AgentBinding,
  ChainModel,
  ChainNode,
  IamRole,
  IamUser,
  Proposal,
  RoadmapNode,
  Run,
  RunStep,
  SlashCommandSpec,
  ValidationIssue,
  ValidationReport,
  WatcherHandle,
  WebviewPayload,
} from "catalyst-core";
import {
  AGENT_PRESETS,
  compareVersions,
  defaultAgentSource,
  defaultChatAgent,
  discoverSlashCommands,
  hasCatalystPointer,
  joinCriterionRepo,
  meetsRequiredFrameworkVersion,
  nextProposalId,
  openProposalsByTarget,
  parseChatAgents,
  parseJournal,
  readCatalystPointer,
  readDeployedFrameworkVersion,
  readEntityDefinition,
  REQUIRED_FRAMEWORK_VERSION,
  resolveCorpusRoot,
  suggestCriterionBranch,
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
const SHOW_DETAIL_COMMAND = "catalyst.showNodeDetail";
const SHOW_IAM_DETAIL_COMMAND = "catalyst.showIamDetail";
const OPEN_JOURNAL_COMMAND = "catalyst.openJournal";
const OPEN_BACKLOG_COMMAND = "catalyst.openBacklog";
const PROPOSE_FIX_COMMAND = "catalyst.proposeFix";
const COMPOSE_PROPOSAL_COMMAND = "catalyst.composeProposal";
const SEND_TO_AGENT_CHAT_COMMAND = "catalyst.sendToAgentChat";
const CONFIGURE_CRITERION_COMMAND = "catalyst.configureCriterion";
const REFRESH_CHAIN_INSPECTOR_COMMAND = "catalyst.refreshChainInspector";
const DIAGNOSTIC_COLLECTION_NAME = "catalyst";
const ONBOARDING_DISMISSED_PREFIX = "catalyst.onboarding.dismissed:";
const SYNC_OFFER_DISMISSED_PREFIX = "catalyst.syncOffer.dismissed:";
/**
 * The highest catalyst framework version this extension build has been
 * verified against — bumped by hand whenever that happens, same
 * "small, verified, hand-maintained" precedent as AGENT_PRESETS/
 * KNOWN_AGENT_COMMANDS. A deployment is only ever offered a sync to
 * exactly this version, never blindly to "latest" — this extension
 * should never tell a deployment to sync past what it's actually been
 * checked against.
 */
const MAX_COMPATIBLE_FRAMEWORK_VERSION = "0.31.0";
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
  test: "test",
  domain: "domain",
  feature: "features",
  step: "step",
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
  test: ["test"],
  domain: ["domain"],
  feature: ["feature"],
  step: ["step"],
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

  getTreeItem(element: InspectorTreeItem): vscode.TreeItem {
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
        "Open Journal",
        vscode.TreeItemCollapsibleState.None,
      );
      item.command = {
        command: OPEN_JOURNAL_COMMAND,
        title: "Open Journal",
        arguments: [element.corpusRoot],
      };
      item.iconPath = this.iconUris("journal");
      item.tooltip = sectionTooltip(element.corpusRoot, ["journal"]);
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
   * Artifacts" — a requirement's or bug's steps (`Rules-of-Rules.md` §21,
   * single required parent, so a step only ever nests under the one
   * requirement or bug it names) and both a requirement's/bug's and a
   * step's tests (`Rules-of-Rules.md` §22, `(0,n)` many-to-many, so the
   * same test can legitimately nest under more than one parent, or under
   * none).
   */
  private childKindsFor(node: ChainNode): Array<"step" | "test"> {
    if (
      node.kind === "dev-artifact" &&
      (node.artifactType === "requirement" || node.artifactType === "bug")
    ) {
      return ["step", "test"];
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
    sections.push({ type: "separator" });
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
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';" />
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
    "Don't ask again",
  );

  if (choice === "Don't ask again") {
    await context.workspaceState.update(dismissKey, true);
    return;
  }
  if (choice !== "Set up catalyst…") return;

  const pick = await vscode.window.showQuickPick(
    [
      {
        label: "Connect to an existing criterion repo",
        detail:
          "Clone an already-repoed deployment's branch — a git clone and a pointer file, no agent involved.",
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

  if (pick.action === "connect") {
    await connectExistingCriterionRepo(folder);
  } else {
    await offerAgentDrivenInstantiation(folder);
  }
}

/**
 * `/criterion get`'s mechanical half, done in code rather than handed to
 * an agent: cloning a branch and writing a pointer file needs no judgment
 * calls. Deliberately skips that command's identity-migration half
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
 * A resolved deployment behind the highest catalyst framework version
 * this extension build has been verified against gets an actionable
 * offer, mirroring `offerToInstall`'s own bar: nothing runs until the
 * user explicitly clicks "Sync now" — `/sync-framework` mutates real
 * deployment files, so this must never fire silently. The dismiss key
 * includes the target version, so a future bump of
 * `MAX_COMPATIBLE_FRAMEWORK_VERSION` re-prompts even if an earlier
 * offer was dismissed.
 *
 * One notification path covers both thresholds on the same scale —
 * never two separate popups for what's really one situation. Below
 * `REQUIRED_FRAMEWORK_VERSION` (`catalyst-core`'s declared floor, a
 * version specifier the same way a `uv.lock`'s `requires-python` states
 * one) the wording says so explicitly, since parsing may actually be
 * wrong, not just missing newer sections; between the required floor
 * and `MAX_COMPATIBLE_FRAMEWORK_VERSION` the wording stays the softer
 * "supports syncing to" — a deployment there parses correctly today,
 * syncing just gets it the newer entity types.
 */
async function offerToSyncFramework(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  corpusRoot: string,
  outputChannel: vscode.OutputChannel,
): Promise<void> {
  const dismissKey = `${SYNC_OFFER_DISMISSED_PREFIX}${folder.uri.fsPath}:${MAX_COMPATIBLE_FRAMEWORK_VERSION}`;
  if (context.workspaceState.get<boolean>(dismissKey)) return;

  const deployed = readDeployedFrameworkVersion(corpusRoot);
  if (!deployed) return; // can't safely compare — don't guess

  if (compareVersions(deployed, MAX_COMPATIBLE_FRAMEWORK_VERSION) >= 0) return;

  const message = meetsRequiredFrameworkVersion(deployed)
    ? `"${folder.name}" is on catalyst ${deployed}; this extension supports syncing to ${MAX_COMPATIBLE_FRAMEWORK_VERSION}.`
    : `"${folder.name}" is on catalyst ${deployed}, below the ${REQUIRED_FRAMEWORK_VERSION} this extension requires — some entities may not parse correctly. Sync to ${MAX_COMPATIBLE_FRAMEWORK_VERSION}?`;

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

  const agentDef = resolveChatAgentDef(folder.uri.fsPath);
  if (!agentDef) {
    void vscode.window.showErrorMessage(
      'Couldn\'t determine which agent to chat with — no *.catalyst pointer with an "agent" or "chatAgents" field found.',
    );
    return;
  }

  await resolveAndInvoke(
    agentDef,
    "/sync-framework",
    MAX_COMPATIBLE_FRAMEWORK_VERSION,
    outputChannel,
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
        folder.uri.fsPath,
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
  const provider = new ChainInspectorProvider(context.extensionUri);
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

  const agentBridgeOutputChannel =
    vscode.window.createOutputChannel("Catalyst");
  context.subscriptions.push(agentBridgeOutputChannel);

  function resolveFolder(folder: vscode.WorkspaceFolder): void {
    if (!hasCatalystPointer(folder.uri.fsPath)) {
      void offerToInstall(context, folder);
      return;
    }
    const corpusRoot = resolveCorpusRoot(folder.uri.fsPath);
    if (!corpusRoot) return;
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
    void offerToSyncFramework(
      context,
      folder,
      corpusRoot,
      agentBridgeOutputChannel,
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
        if (!existsSync(backlogPath.fsPath)) {
          void vscode.window.showWarningMessage(
            "No BACKLOG.md found — run /show-backlog first.",
          );
          return;
        }
        // Rendered, not raw source — BACKLOG.md is generated prose for a
        // human to read, not something authored/edited by hand in place.
        await vscode.commands.executeCommand(
          "markdown.showPreview",
          backlogPath,
        );
      },
    ),
  );
}

export function deactivate(): void {}
