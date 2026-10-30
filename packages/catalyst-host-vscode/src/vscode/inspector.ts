import type { ChainModel, ChainNode, EntityDefinition, ModuleType, RowNode } from "catalyst-core";
import * as vscode from "vscode";

import { codiconFor } from "../codicons.js";
import {
  OPEN_BACKLOG_COMMAND,
  OPEN_JOURNAL_COMMAND,
  SHOW_DETAIL_COMMAND,
  SET_UP_FOLDER_COMMAND,
} from "../constants.js";
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
  /** The deployed definitions, as catalyst serves them. */
  definitions: EntityDefinition[];
}

export type InspectorTreeItem =
  | { type: "deployment"; corpusRoot: string; folderName: string }
  | { type: "unset-folder"; folderUri: string; folderName: string }
  | { type: "artifact-group"; corpusRoot: string; group: ArtifactGroup }
  | { type: "rule-group"; corpusRoot: string; group: RuleGroup }
  | { type: "rule-type-section"; corpusRoot: string; section: RuleTypeSection }
  | { type: "type-section"; corpusRoot: string; section: TypeSection }
  | { type: "domain-section"; corpusRoot: string; nodes: ChainNode[] }
  | { type: "node"; corpusRoot: string; node: ChainNode }
  | { type: "row-section"; corpusRoot: string; section: RowSection }
  | { type: "row-group"; corpusRoot: string; group: RowGroup }
  | { type: "separator" }
  | { type: "journal-entry"; corpusRoot: string }
  | { type: "backlog-entry"; corpusRoot: string };

/** Labels of the kernel's own entity types; a module type's label is its own name. */
export const ENTITY_TYPE_LABELS: Partial<Record<string, string>> = {
  rule: "Rule",
  domain: "Domain",
  journal: "Journal",
  backlog: "Backlog",
};

/**
 * Builds a root section's hover tooltip from its entity type(s)'
 * definitions as catalyst serves them (R5.3) — `undefined` (tooltip left unset, falling back to
 * the label) if none are found, e.g. a deployment that predates INV-23
 * and hasn't migrated yet.
 */
export function sectionTooltip(
  definitions: readonly EntityDefinition[],
  entityTypes: string[],
  label?: string,
): vscode.MarkdownString | undefined {
  const blocks: string[] = [];
  for (const entityType of entityTypes) {
    const definition = definitions.find((d) => d.slug === entityType);
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
 * The Instances view (REQ-000068-UVqkd7cL): one top-level entry per
 * resolved deployment, labelled with its name, expanding into its own
 * sections — node ids are only unique within one corpus, so every item
 * below the root carries which deployment it came from.
 */
export class ChainInspectorProvider implements vscode.TreeDataProvider<InspectorTreeItem> {
  private readonly deployments = new Map<string, DeploymentView>();
  /** Workspace folders with no catalyst yet, offered a set-up (REQ-000069-UVqkd7cL): uri → name. */
  private readonly unsetFolders = new Map<string, string>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(private readonly extensionUri: vscode.Uri) {}

  /** The icon a module type shows: the first of its candidate names this extension ships, else the generic one. */
  private typeIcon(model: ChainModel, prefix: string): vscode.ThemeIcon {
    return new vscode.ThemeIcon(codiconFor(typeIconCandidates(model.types?.get(prefix), prefix)));
  }

  /** VS Code's own icon for a section or a node kind (`codicons.ts`). */
  private iconUris(name: string): vscode.ThemeIcon {
    return new vscode.ThemeIcon(codiconFor([name]));
  }

  setState(
    corpusRoot: string,
    folderName: string,
    projectRoot: string,
    model: ChainModel,
    definitions: EntityDefinition[] = [],
  ): void {
    this.deployments.set(corpusRoot, {
      corpusRoot,
      folderName,
      projectRoot,
      model,
      definitions,
    });
    this.changeEmitter.fire();
  }

  removeDeployment(corpusRoot: string): void {
    this.deployments.delete(corpusRoot);
    this.changeEmitter.fire();
  }

  /** Offer `folderUri` a set-up in the tree, or stop offering it (`name` undefined). */
  setUnsetFolder(folderUri: string, name: string | undefined): void {
    if (name === undefined ? !this.unsetFolders.delete(folderUri) : this.unsetFolders.get(folderUri) === name) return;
    if (name !== undefined) this.unsetFolders.set(folderUri, name);
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

  /** The deployment's definitions, as catalyst served them; none before it answers. */
  private definitionsOf(corpusRoot: string): EntityDefinition[] {
    return this.deployments.get(corpusRoot)?.definitions ?? [];
  }

  /** Every currently-registered deployment's corpus root, in insertion order. */
  getCorpusRoots(): string[] {
    return [...this.deployments.keys()];
  }

  private treeItemOf(element: InspectorTreeItem): vscode.TreeItem {
    if (element.type === "deployment") {
      return new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.Expanded);
    }
    if (element.type === "unset-folder") {
      const item = new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.None);
      item.description = "no catalyst — set up…";
      item.iconPath = new vscode.ThemeIcon("add");
      item.command = { command: SET_UP_FOLDER_COMMAND, title: "Set up catalyst…", arguments: [element.folderUri] };
      return item;
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
      item.tooltip = sectionTooltip(this.definitionsOf(element.corpusRoot), ["rule"]);
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
      if (type) item.tooltip = sectionTooltip(this.definitionsOf(element.corpusRoot), [typeSlug(type.name)], type.name);
      return item;
    }
    if (element.type === "domain-section") {
      const item = new vscode.TreeItem(
        `Domains (${String(element.nodes.length)})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      item.iconPath = this.iconUris("domain");
      item.tooltip = sectionTooltip(this.definitionsOf(element.corpusRoot), ["domain"]);
      return item;
    }
    if (element.type === "row-section") {
      const item = new vscode.TreeItem(element.section.label, vscode.TreeItemCollapsibleState.Collapsed);
      const model = this.getModel(element.corpusRoot);
      if (model) item.iconPath = this.typeIcon(model, element.section.typePrefix);
      const type = model?.types?.get(element.section.typePrefix);
      if (type) item.tooltip = sectionTooltip(this.definitionsOf(element.corpusRoot), [typeSlug(type.name)], type.name);
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
      item.tooltip = sectionTooltip(this.definitionsOf(element.corpusRoot), ["journal"]);
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
      item.tooltip = sectionTooltip(this.definitionsOf(element.corpusRoot), ["backlog"]);
      return item;
    }

    const nodeModel = this.getModel(element.corpusRoot);
    const nodeType =
      element.node.kind === "artifact" || element.node.kind === "row"
        ? nodeModel?.types?.get(element.node.typePrefix)
        : undefined;
    // An entity has one node, never with children: its relationships are
    // links in the document it opens (vscode-INSPECTOR-000002-UVqkd7cL).
    const item = new vscode.TreeItem(formatNodeLabel(element.node, nodeType), vscode.TreeItemCollapsibleState.None);
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

  /** An entity's one node under its deployment. */
  findNode(corpusRoot: string, nodeId: string): InspectorTreeItem | undefined {
    const deployment = this.getChildren().find((item) => item.type === "deployment" && item.corpusRoot === corpusRoot);
    if (!deployment) return undefined;
    return breadthFirst(
      this.getChildren(deployment),
      (item) => {
        if (item.type === "node") return []; // an entity node has no children
        if ("corpusRoot" in item && item.corpusRoot !== corpusRoot) return [];
        return this.getChildren(item);
      },
      (item) => item.type === "node" && item.corpusRoot === corpusRoot && item.node.id === nodeId,
    );
  }

  private childrenOf(element?: InspectorTreeItem): InspectorTreeItem[] {
    if (!element) {
      const instances: InspectorTreeItem[] = [...this.deployments.values()].map((view) => ({
        type: "deployment",
        corpusRoot: view.corpusRoot,
        folderName: view.folderName,
      }));
      const unset: InspectorTreeItem[] = [...this.unsetFolders].map(([folderUri, folderName]) => ({
        type: "unset-folder",
        folderUri,
        folderName,
      }));
      return [...instances, ...unset];
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
    return [];
  }
}
