import { existsSync } from "node:fs";

import type { ChainModel, ChainNode, IamRole, IamUser, ModuleType, RowNode } from "catalyst-core";
import { readEntityDefinition } from "catalyst-core";
import * as vscode from "vscode";
import {
  OPEN_BACKLOG_COMMAND,
  OPEN_JOURNAL_COMMAND,
  SHOW_DETAIL_COMMAND,
  SHOW_IAM_DETAIL_COMMAND,
} from "../constants.js";
import { buildRoleSection, buildUserSection, type RoleSection, type UserSection } from "catalyst-app-model";
import { buildRowSections, type RowGroup, type RowSection } from "catalyst-app-model";
import { breadthFirst, childId, itemKey } from "catalyst-app-model";
import {
  buildTreeSections,
  formatNodeLabel,
  type ArtifactGroup,
  type RuleGroup,
  type RuleTypeSection,
  type TypeSection,
} from "catalyst-app-model";

export interface DeploymentView {
  corpusRoot: string;
  folderName: string;
  projectRoot: string;
  model: ChainModel;
  users: IamUser[];
  roles: IamRole[];
}

export type InspectorTreeItem =
  | { type: "deployment"; corpusRoot: string; folderName: string }
  | { type: "artifact-group"; corpusRoot: string; group: ArtifactGroup }
  | { type: "rule-group"; corpusRoot: string; group: RuleGroup }
  | { type: "rule-type-section"; corpusRoot: string; section: RuleTypeSection }
  | { type: "type-section"; corpusRoot: string; section: TypeSection }
  | { type: "domain-section"; corpusRoot: string; nodes: ChainNode[] }
  | { type: "node"; corpusRoot: string; node: ChainNode }
  | { type: "row-section"; corpusRoot: string; section: RowSection }
  | { type: "row-group"; corpusRoot: string; group: RowGroup }
  | { type: "user-section"; corpusRoot: string; section: UserSection }
  | { type: "user"; corpusRoot: string; user: IamUser }
  | { type: "role-section"; corpusRoot: string; section: RoleSection }
  | { type: "role"; corpusRoot: string; role: IamRole }
  | { type: "separator" }
  | { type: "journal-entry"; corpusRoot: string }
  | { type: "backlog-entry"; corpusRoot: string };

/** Labels of the kernel's own entity types; a module type's label is its own name. */
export const ENTITY_TYPE_LABELS: Partial<Record<string, string>> = {
  rule: "Rule",
  domain: "Domain",
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
export function sectionTooltip(
  corpusRoot: string,
  entityTypes: string[],
  label?: string,
): vscode.MarkdownString | undefined {
  const blocks: string[] = [];
  for (const entityType of entityTypes) {
    const definition = readEntityDefinition(corpusRoot, entityType);
    if (!definition) continue;
    const shown = label ?? ENTITY_TYPE_LABELS[entityType] ?? entityType;
    blocks.push(`**${shown}**\n\n${definition.description}`);
  }
  return blocks.length > 0 ? new vscode.MarkdownString(blocks.join("\n\n")) : undefined;
}

/** A type's slug, as its definition file and an icon may be named: `House-keeping` → `house-keeping`. */
export function typeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The icon names worth trying for a module type, from its own names; the caller keeps the first that exists. */
export function typeIconCandidates(type: ModuleType | undefined, prefix: string): string[] {
  const names = type ? [typeSlug(type.name), typeSlug(type.plural_name)] : [];
  const first = names.map((n) => n.split("-")[0]);
  return [...new Set([...names, ...first, prefix.toLowerCase()])].filter(Boolean);
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

  /** The icon a module type shows: the first of its candidate names this extension ships, else the generic one. */
  private typeIcon(model: ChainModel, prefix: string): { light: vscode.Uri; dark: vscode.Uri } {
    const shipped = typeIconCandidates(model.types?.get(prefix), prefix).find((name) =>
      existsSync(vscode.Uri.joinPath(this.extensionUri, "resources", "icons", "light", `${name}.svg`).fsPath),
    );
    return this.iconUris(shipped ?? "dev-artifacts");
  }

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
    users: IamUser[],
    roles: IamRole[],
  ): void {
    this.deployments.set(corpusRoot, {
      corpusRoot,
      folderName,
      projectRoot,
      model,
      users,
      roles,
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
    if (element.type === "artifact-group") {
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
    if (element.type === "type-section") {
      const item = new vscode.TreeItem(
        `${element.section.label} (${String(element.section.nodes.length)})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      const model = this.getModel(element.corpusRoot);
      if (model) item.iconPath = this.typeIcon(model, element.section.typePrefix);
      const type = model?.types?.get(element.section.typePrefix);
      if (type) item.tooltip = sectionTooltip(element.corpusRoot, [typeSlug(type.name)], type.name);
      return item;
    }
    if (element.type === "domain-section") {
      const item = new vscode.TreeItem(
        `Domains (${String(element.nodes.length)})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("domain");
      item.tooltip = sectionTooltip(element.corpusRoot, ["domain"]);
      return item;
    }
    if (element.type === "row-section") {
      const item = new vscode.TreeItem(element.section.label, vscode.TreeItemCollapsibleState.Collapsed);
      const model = this.getModel(element.corpusRoot);
      if (model) item.iconPath = this.typeIcon(model, element.section.typePrefix);
      const type = model?.types?.get(element.section.typePrefix);
      if (type) item.tooltip = sectionTooltip(element.corpusRoot, [typeSlug(type.name)], type.name);
      return item;
    }
    if (element.type === "row-group") {
      const retiredMark = element.group.retired ? " (retired)" : "";
      const item = new vscode.TreeItem(
        `${element.group.name}${retiredMark} (${String(element.group.items.length)})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      const model = this.getModel(element.corpusRoot);
      const prefix = element.group.items[0]?.typePrefix;
      if (model && prefix) item.iconPath = this.typeIcon(model, prefix);
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

    const nodeModel = this.getModel(element.corpusRoot);
    const nodeType =
      element.node.kind === "artifact" || element.node.kind === "row"
        ? nodeModel?.types?.get(element.node.typePrefix)
        : undefined;
    const item = new vscode.TreeItem(
      formatNodeLabel(element.node, nodeType),
      this.hasChildNodes(element.corpusRoot, element.node)
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
    );
    item.command = {
      command: SHOW_DETAIL_COMMAND,
      title: "Show detail",
      arguments: [element.corpusRoot, element.node.id],
    };
    if (element.node.kind === "artifact" || element.node.kind === "row") {
      if (nodeModel) item.iconPath = this.typeIcon(nodeModel, element.node.typePrefix);
    } else if (element.node.kind === "rule" || element.node.kind === "domain") {
      item.iconPath = this.iconUris(element.node.kind);
    }
    return item;
  }

  /**
   * The artifacts that cite `node` through one of their reference fields
   * (a step's parent, a test's requirements…), nested under it in the tree
   * on top of their own type's section — whatever the module's types are.
   * Mentions in prose do not nest.
   */
  private citers(corpusRoot: string, node: ChainNode): ChainNode[] {
    if (node.kind !== "artifact") return [];
    const model = this.getModel(corpusRoot);
    const reverse = model?.reverseEdges.get(node.id);
    if (!model || !reverse) return [];
    const cites = (ref: string) => ref === node.id || node.id.startsWith(`${ref}-`);
    return [...reverse]
      .map((id) => model.nodes.get(id))
      .filter((n): n is ChainNode => n?.kind === "artifact" && Object.values(n.links).some((ids) => ids.some(cites)))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  private hasChildNodes(corpusRoot: string, node: ChainNode): boolean {
    return this.citers(corpusRoot, node).length > 0;
  }

  private childNodesFor(corpusRoot: string, node: ChainNode): InspectorTreeItem[] {
    return this.citers(corpusRoot, node).map((childNode) => ({ type: "node" as const, corpusRoot, node: childNode }));
  }

  private sectionsFor(view: DeploymentView): InspectorTreeItem[] {
    const { artifacts, rules, domains } = buildTreeSections(view.model);
    const sections: InspectorTreeItem[] = [
      { type: "artifact-group", corpusRoot: view.corpusRoot, group: artifacts },
      { type: "rule-group", corpusRoot: view.corpusRoot, group: rules },
      { type: "domain-section", corpusRoot: view.corpusRoot, nodes: domains },
    ];
    const rows = [...view.model.nodes.values()].filter((n): n is RowNode => n.kind === "row");
    for (const section of buildRowSections(rows, view.model.types)) {
      sections.push({ type: "row-section", corpusRoot: view.corpusRoot, section });
    }
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
    if (element.type === "artifact-group") {
      return element.group.sections.map((section) => ({
        type: "type-section",
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
      return element.section.nodes.map((node) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node,
      }));
    }
    if (element.type === "type-section") {
      return element.section.nodes.map((node) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node,
      }));
    }
    if (element.type === "domain-section") {
      return element.nodes.map((node) => ({ type: "node", corpusRoot: element.corpusRoot, node }));
    }
    if (element.type === "row-section") {
      return element.section.groups.map((group) => ({
        type: "row-group",
        corpusRoot: element.corpusRoot,
        group,
      }));
    }
    if (element.type === "row-group") {
      return element.group.items.map((node) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node,
      }));
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
