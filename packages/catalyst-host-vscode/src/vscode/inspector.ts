import type { ChainModel, ChainNode, IamRole, IamUser, Proposal, RoadmapNode, Run, RunStep } from "catalyst-core";
import { openProposalsByTarget, readEntityDefinition } from "catalyst-core";
import * as vscode from "vscode";
import {
  OPEN_BACKLOG_COMMAND,
  OPEN_JOURNAL_COMMAND,
  SHOW_DETAIL_COMMAND,
  SHOW_IAM_DETAIL_COMMAND,
} from "../constants.js";
import { buildRoleSection, buildUserSection, type RoleSection, type UserSection } from "catalyst-app-model";
import { buildProposalSection, type ProposalSection } from "../proposals.js";
import { buildRoadmapSection, type RoadmapGroup, type RoadmapSection } from "catalyst-app-model";
import { buildRunSection, formatRunLabel, formatStepLabel, type RunSection } from "../runmonitor.js";
import { breadthFirst, childId, itemKey } from "catalyst-app-model";
import {
  buildTreeSections,
  formatNodeLabel,
  type DevArtifactGroup,
  type RuleGroup,
  type RuleTypeSection,
  type TreeSection,
  type TreeSectionKind,
} from "catalyst-app-model";

export interface DeploymentView {
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

export type InspectorTreeItem =
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
export const SECTION_ICON_NAMES: Partial<Record<TreeSectionKind, string>> = {
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
export const SECTION_ENTITY_TYPES: Partial<Record<TreeSectionKind, string[]>> = {
  requirement: ["requirement"],
  bug: ["bug"],
  "house-keeping": ["house-keeping"],
  step: ["step"],
  test: ["test"],
  domain: ["domain"],
  feature: ["feature"],
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
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
export function sectionTooltip(corpusRoot: string, entityTypes: string[]): vscode.MarkdownString | undefined {
  const blocks: string[] = [];
  for (const entityType of entityTypes) {
    const definition = readEntityDefinition(corpusRoot, entityType);
    if (!definition) continue;
    const label = ENTITY_TYPE_LABELS[entityType] ?? entityType;
    blocks.push(`**${label}**\n\n${definition.description}`);
  }
  return blocks.length > 0 ? new vscode.MarkdownString(blocks.join("\n\n")) : undefined;
}

/** Icon basename for an individual chain-model node, by its kind (and dev-artifact sub-type). */
export function nodeIconName(node: ChainNode): string | undefined {
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
export class InspectorPanelProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
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

export class ChainInspectorProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
  private readonly deployments = new Map<string, DeploymentView>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** Light/dark pair for an icon basename under resources/icons/. */
  private iconUris(name: string): { light: vscode.Uri; dark: vscode.Uri } {
    return {
      light: vscode.Uri.joinPath(this.extensionUri, "resources", "icons", "light", `${name}.svg`),
      dark: vscode.Uri.joinPath(this.extensionUri, "resources", "icons", "dark", `${name}.svg`),
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
    return this.deployments.get(corpusRoot)?.pendingTargets ?? new Map<string, Proposal[]>();
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
      return new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.Expanded);
    }
    if (element.type === "dev-artifact-group") {
      const total = element.group.sections.reduce((sum, s) => sum + s.nodes.length, 0);
      const item = new vscode.TreeItem(`${element.group.label} (${total})`, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = this.iconUris("dev-artifacts");
      return item;
    }
    if (element.type === "rule-group") {
      const total = element.group.sections.reduce((sum, s) => sum + s.nodes.length, 0);
      const item = new vscode.TreeItem(`${element.group.label} (${total})`, vscode.TreeItemCollapsibleState.Collapsed);
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
      const item = new vscode.TreeItem(element.section.label, vscode.TreeItemCollapsibleState.Collapsed);
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
      const item = new vscode.TreeItem(element.section.label, vscode.TreeItemCollapsibleState.Collapsed);
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
      const item = new vscode.TreeItem(element.section.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = this.iconUris("runs");
      return item;
    }
    if (element.type === "run") {
      const item = new vscode.TreeItem(formatRunLabel(element.run), vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = this.iconUris("runs");
      return item;
    }
    if (element.type === "run-step") {
      return new vscode.TreeItem(formatStepLabel(element.step), vscode.TreeItemCollapsibleState.None);
    }
    if (element.type === "run-ledger-entry") {
      const item = new vscode.TreeItem(element.text, vscode.TreeItemCollapsibleState.None);
      item.iconPath = this.iconUris("ledger");
      return item;
    }
    if (element.type === "user-section") {
      const item = new vscode.TreeItem(element.section.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = this.iconUris("users");
      item.tooltip = sectionTooltip(element.corpusRoot, ["user"]);
      return item;
    }
    if (element.type === "user") {
      const inactiveMark = element.user.active ? "" : " (inactive)";
      const item = new vscode.TreeItem(`${element.user.name}${inactiveMark}`, vscode.TreeItemCollapsibleState.None);
      item.command = {
        command: SHOW_IAM_DETAIL_COMMAND,
        title: "Show detail",
        arguments: [element.corpusRoot, "user", element.user.name],
      };
      item.iconPath = this.iconUris("users");
      return item;
    }
    if (element.type === "role-section") {
      const item = new vscode.TreeItem(element.section.label, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = this.iconUris("roles");
      item.tooltip = sectionTooltip(element.corpusRoot, ["role"]);
      return item;
    }
    if (element.type === "role") {
      const item = new vscode.TreeItem(element.role.name, vscode.TreeItemCollapsibleState.None);
      item.command = {
        command: SHOW_IAM_DETAIL_COMMAND,
        title: "Show detail",
        arguments: [element.corpusRoot, "role", element.role.name],
      };
      item.iconPath = this.iconUris("roles");
      return item;
    }
    if (element.type === "separator") {
      return new vscode.TreeItem("─".repeat(24), vscode.TreeItemCollapsibleState.None);
    }
    if (element.type === "journal-entry") {
      const item = new vscode.TreeItem("Journal", vscode.TreeItemCollapsibleState.None);
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
      const item = new vscode.TreeItem("Backlog", vscode.TreeItemCollapsibleState.None);
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
  private childKindsFor(node: ChainNode): ("step" | "test")[] {
    if (node.kind === "dev-artifact" && (node.artifactType === "requirement" || node.artifactType === "bug")) {
      return ["test"];
    }
    if (node.kind === "step") return ["test"];
    return [];
  }

  private isChildOfKind(candidate: ChainNode, kind: "step" | "test"): boolean {
    if (kind === "step") return candidate.kind === "step";
    return candidate.kind === "dev-artifact" && candidate.artifactType === "test";
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
  private childNodesFor(corpusRoot: string, node: ChainNode): InspectorTreeItem[] {
    const kinds = this.childKindsFor(node);
    if (kinds.length === 0) return [];
    const model = this.getModel(corpusRoot);
    const reverse = model?.reverseEdges.get(node.id);
    if (!model || !reverse) return [];
    return [...reverse]
      .map((id) => model.nodes.get(id))
      .filter((n): n is ChainNode => n !== undefined && kinds.some((k) => this.isChildOfKind(n, k)))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((childNode) => ({
        type: "node" as const,
        corpusRoot,
        node: childNode,
        pending: false,
      }));
  }

  private sectionsFor(view: DeploymentView): InspectorTreeItem[] {
    const { devArtifacts, rules, sections: otherSections } = buildTreeSections(view.model);
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
    const roadmapNodes = [...view.model.nodes.values()].filter((n): n is RoadmapNode => n.kind === "roadmap");
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
  private readonly parents = new WeakMap<InspectorTreeItem, InspectorTreeItem | undefined>();
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
      this.ids.set(child, childId(parentId, itemKey(child, text), taken));
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
      this.ids.set(child, childId(`panel:${corpusRoot}`, itemKey(child, text), taken));
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
      (item) => item.type === "node" && item.corpusRoot === corpusRoot && item.node.id === nodeId,
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
      const ledgerItems: InspectorTreeItem[] = element.run.ledger.map((text) => ({ type: "run-ledger-entry", text }));
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
