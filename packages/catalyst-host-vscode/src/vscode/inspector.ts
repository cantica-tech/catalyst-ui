import type { ChainModel, ChainNode, EntityDefinition, ModuleType } from "catalyst-core";
import * as vscode from "vscode";

import { codiconFor } from "../codicons.js";
import { permissionSuffix, type StatusPermission } from "../bug-status.js";
import { entityContextValue, isTurningBug, typeSlug } from "../entity-items.js";
import { Hourglass } from "../hourglass.js";
import { visibleRoot } from "../instances-visibility.js";
import type { SearchEntry } from "../instance-search.js";
import {
  OPEN_BACKLOG_COMMAND,
  OPEN_JOURNAL_COMMAND,
  OPEN_STUDIO_COMMAND,
  SHOW_DETAIL_COMMAND,
  SET_UP_FOLDER_COMMAND,
} from "../constants.js";
import { type RowGroup, type RowSection } from "catalyst-app-model";
import { breadthFirst, childId, itemKey } from "catalyst-app-model";
import {
  buildSidebar,
  formatNodeLabel,
  healthLine,
  type AttentionItem,
  type EntityEntry,
  type InboxLike,
  type PhaseFolder,
  type RuleTypeSection,
  type Sidebar,
  type TypeFolder,
} from "catalyst-app-model";

export interface DeploymentView {
  corpusRoot: string;
  folderName: string;
  projectRoot: string;
  model: ChainModel;
  /** The deployed definitions, as catalyst serves them. */
  definitions: EntityDefinition[];
  /** What `catalyst check` last reported, for the deployment's line (`REQ-000123-UVqkd7cL`). */
  report?: { errorCount: number; warningCount: number };
  /** The deployed kernel's version (`version.txt`). */
  kernel?: string | null;
  /** What waits for a person, as catalyst's inbox last reported it. */
  inbox?: InboxLike;
}

/** What else a deployment's update brings beside its model, for the sidebar (`REQ-000123-UVqkd7cL`). */
export type DeploymentExtras = Pick<DeploymentView, "report" | "kernel" | "inbox">;

/** The sidebar's top-level groups, in order (`REQ-000123-UVqkd7cL`). */
export type GroupKey = "needs-you" | "work" | "governance" | "record";

const GROUP_LABELS: Record<GroupKey, string> = {
  "needs-you": "Needs you",
  work: "Work",
  governance: "Governance",
  record: "Record",
};

export type InspectorTreeItem =
  | { type: "deployment"; corpusRoot: string; folderName: string }
  | { type: "unset-folder"; folderUri: string; folderName: string }
  | { type: "group"; corpusRoot: string; group: { key: GroupKey } }
  | { type: "attention"; corpusRoot: string; item: AttentionItem }
  | { type: "type-folder"; corpusRoot: string; folder: TypeFolder }
  | { type: "phase-folder"; corpusRoot: string; typePrefix: string; folder: PhaseFolder }
  | { type: "rule-type-section"; corpusRoot: string; section: RuleTypeSection }
  | { type: "domain-section"; corpusRoot: string; nodes: ChainNode[] }
  | { type: "node"; corpusRoot: string; node: ChainNode; children?: EntityEntry[] }
  | { type: "row-section"; corpusRoot: string; section: RowSection }
  | { type: "row-group"; corpusRoot: string; group: RowGroup }
  | { type: "journal-entry"; corpusRoot: string }
  | { type: "backlog-entry"; corpusRoot: string };

/** The icon an inbox item shows, by its kind (`spec/inbox.schema.json`). */
const ATTENTION_ICONS: Record<string, string> = {
  "unrecorded-commit": "git-commit",
  "unrecorded-change": "git-commit",
  reconciliation: "git-merge",
  analysis: "search",
  approval: "pass",
  proposal: "diff",
  overdue: "watch",
};

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

export { typeSlug };

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
  private readonly changeEmitter = new vscode.EventEmitter<InspectorTreeItem[] | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  /** A bug under way turns its hourglass until it is closed (REQ-000121-UVqkd7cL); only those items redraw. */
  private readonly hourglass: Hourglass<InspectorTreeItem>;

  /**
   * @param extensionUri the extension's root, for its icons.
   * @param reduceMotion whether VS Code's `workbench.reduceMotion` is `on`: then no hourglass turns.
   */
  constructor(
    private readonly extensionUri: vscode.Uri,
    reduceMotion: () => boolean = () =>
      vscode.workspace.getConfiguration("workbench").get<string>("reduceMotion") === "on",
  ) {
    this.hourglass = new Hourglass((elements) => {
      this.changeEmitter.fire(elements);
    }, reduceMotion);
  }

  /** The whole tree changed: its elements are rebuilt, so the turning bugs are found again as they are shown. */
  private refresh(): void {
    this.hourglass.reset();
    this.changeEmitter.fire(undefined);
  }

  /**
   * Whether someone is logged in to catalyst-users (BUG-000049-UhmQ897l): the view shows only what the logged-in
   * person can see, so with no one logged in — or before catalyst-users has answered — it shows nothing.
   */
  private someoneLoggedIn = false;

  /** Who is logged in changed: the tree shows the instances, or nothing. */
  setLoggedIn(loggedIn: boolean): void {
    if (this.someoneLoggedIn === loggedIn) return;
    this.someoneLoggedIn = loggedIn;
    this.refresh();
  }

  /** Whether the tree shows any instance: only while someone is logged in. */
  get showsInstances(): boolean {
    return this.someoneLoggedIn;
  }

  /** The Instances view was shown or hidden: a hidden view turns no hourglass. */
  setVisible(visible: boolean): void {
    this.hourglass.setVisible(visible);
  }

  /** Stops the hourglass's timer, with the extension. */
  dispose(): void {
    this.hourglass.dispose();
    this.changeEmitter.dispose();
  }

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
    extras: DeploymentExtras = {},
  ): void {
    this.deployments.set(corpusRoot, {
      corpusRoot,
      folderName,
      projectRoot,
      model,
      definitions,
      ...extras,
    });
    this.sidebars.delete(corpusRoot);
    this.refresh();
  }

  /** Each deployment's sidebar, built once per update (`REQ-000123-UVqkd7cL`). */
  private readonly sidebars = new Map<string, Sidebar>();

  private sidebarOf(corpusRoot: string): Sidebar | undefined {
    const cached = this.sidebars.get(corpusRoot);
    if (cached) return cached;
    const view = this.deployments.get(corpusRoot);
    if (!view) return undefined;
    const sidebar = buildSidebar(view.model, view.inbox);
    this.sidebars.set(corpusRoot, sidebar);
    return sidebar;
  }

  removeDeployment(corpusRoot: string): void {
    this.deployments.delete(corpusRoot);
    this.sidebars.delete(corpusRoot);
    this.statusPermissions.delete(corpusRoot);
    this.refresh();
  }

  /** Offer `folderUri` a set-up in the tree, or stop offering it (`name` undefined). */
  setUnsetFolder(folderUri: string, name: string | undefined): void {
    if (name === undefined ? !this.unsetFolders.delete(folderUri) : this.unsetFolders.get(folderUri) === name) return;
    if (name !== undefined) this.unsetFolders.set(folderUri, name);
    this.refresh();
  }

  /** Whether the signer may change a status in each deployment, as catalyst says (REQ-000077-UVqkd7cL). */
  private readonly statusPermissions = new Map<string, StatusPermission>();

  setStatusPermission(corpusRoot: string, permission: StatusPermission): void {
    const before = this.statusPermissions.get(corpusRoot);
    this.statusPermissions.set(corpusRoot, permission);
    if (JSON.stringify(before) !== JSON.stringify(permission)) this.refresh();
  }

  getStatusPermission(corpusRoot: string): StatusPermission | undefined {
    return this.statusPermissions.get(corpusRoot);
  }

  refreshTree(): void {
    this.refresh();
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
      const item = new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.Expanded);
      const view = this.deployments.get(element.corpusRoot);
      // its health and kernel on its own line (REQ-000123-UVqkd7cL)
      const health = healthLine(view?.report, view?.kernel);
      if (health) item.description = health;
      return item;
    }
    if (element.type === "unset-folder") {
      const item = new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.None);
      item.description = "no catalyst — set up…";
      item.iconPath = new vscode.ThemeIcon("add");
      item.command = { command: SET_UP_FOLDER_COMMAND, title: "Set up catalyst…", arguments: [element.folderUri] };
      return item;
    }
    if (element.type === "group") {
      return this.groupItem(element.corpusRoot, element.group.key);
    }
    if (element.type === "attention") {
      const item = new vscode.TreeItem(element.item.title, vscode.TreeItemCollapsibleState.None);
      item.description = element.item.id;
      item.tooltip = `${element.item.kind}: ${element.item.title}`;
      item.iconPath = new vscode.ThemeIcon(ATTENTION_ICONS[element.item.kind] ?? "bell");
      // a reference: it opens the entity, whose one node stays in its own place (REQ-000123-UVqkd7cL)
      item.command = element.item.entityId
        ? { command: SHOW_DETAIL_COMMAND, title: "Show detail", arguments: [element.corpusRoot, element.item.entityId] }
        : { command: OPEN_STUDIO_COMMAND, title: "Open Studio" };
      return item;
    }
    if (element.type === "type-folder") {
      const item = new vscode.TreeItem(
        `${element.folder.label} (${String(element.folder.count)})`,
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      const model = this.getModel(element.corpusRoot);
      if (model) item.iconPath = this.typeIcon(model, element.folder.typePrefix);
      const type = model?.types?.get(element.folder.typePrefix);
      if (type) item.tooltip = sectionTooltip(this.definitionsOf(element.corpusRoot), [typeSlug(type.name)], type.name);
      return item;
    }
    if (element.type === "phase-folder") {
      return new vscode.TreeItem(
        `${element.folder.glyph} ${element.folder.label} (${String(element.folder.entries.length)})`,
        element.folder.phase === "under-way"
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed,
      );
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
    // An entity has one node; the entities whose grounding it carries (a requirement's steps) are
    // listed under it (REQ-000123-UVqkd7cL). A bug under way turns its hourglass until it is closed (REQ-000121-UVqkd7cL).
    const turnedOver = this.hourglass.show(element, isTurningBug(element.node, nodeType));
    const item = new vscode.TreeItem(
      formatNodeLabel(element.node, nodeType, turnedOver),
      element.children?.length ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    );
    // Its type and whether it is closed, for its context menu: a bug's Close Bug / Reopen Bug (REQ-000077-UVqkd7cL).
    item.contextValue = entityContextValue(
      element.node,
      nodeType,
      permissionSuffix(this.statusPermissions.get(element.corpusRoot)),
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

  /** A top-level group's item: its label and count, open or closed by what it holds (REQ-000123-UVqkd7cL). */
  private groupItem(corpusRoot: string, key: GroupKey): vscode.TreeItem {
    const sidebar = this.sidebarOf(corpusRoot);
    const Collapsible = vscode.TreeItemCollapsibleState;
    if (key === "needs-you") {
      const n = sidebar?.needsYou.length ?? 0;
      const item = new vscode.TreeItem(
        `${GROUP_LABELS[key]} (${String(n)})`,
        n > 0 ? Collapsible.Expanded : Collapsible.None,
      );
      if (n === 0) item.description = "nothing waiting";
      item.iconPath = new vscode.ThemeIcon(n > 0 ? "bell-dot" : "bell");
      return item;
    }
    const item = new vscode.TreeItem(GROUP_LABELS[key], key === "work" ? Collapsible.Expanded : Collapsible.Collapsed);
    item.iconPath = this.iconUris(key);
    return item;
  }

  /** A deployment's top level: Needs you, Work, Governance, Record (REQ-000123-UVqkd7cL). */
  private sectionsFor(view: DeploymentView): InspectorTreeItem[] {
    return (["needs-you", "work", "governance", "record"] as const).map((key) => ({
      type: "group",
      corpusRoot: view.corpusRoot,
      group: { key },
    }));
  }

  /** What a top-level group lists. */
  private groupChildren(corpusRoot: string, key: GroupKey): InspectorTreeItem[] {
    const sidebar = this.sidebarOf(corpusRoot);
    if (!sidebar) return [];
    const folders = (list: TypeFolder[]): InspectorTreeItem[] =>
      list.map((folder) => ({ type: "type-folder", corpusRoot, folder }));
    if (key === "needs-you") return sidebar.needsYou.map((item) => ({ type: "attention", corpusRoot, item }));
    if (key === "work") {
      return [
        ...sidebar.work.rows.map((section): InspectorTreeItem => ({ type: "row-section", corpusRoot, section })),
        ...folders(sidebar.work.types),
        { type: "backlog-entry", corpusRoot },
      ];
    }
    if (key === "governance") {
      return [
        ...sidebar.governance.rules.map((section): InspectorTreeItem => ({
          type: "rule-type-section",
          corpusRoot,
          section,
        })),
        { type: "domain-section", corpusRoot, nodes: sidebar.governance.domains },
        ...folders(sidebar.governance.types),
      ];
    }
    return [{ type: "journal-entry", corpusRoot }, ...folders(sidebar.record.types)];
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
        if (item.type === "attention") return []; // a reference, never the entity's node
        if ("corpusRoot" in item && item.corpusRoot !== corpusRoot) return [];
        return this.getChildren(item);
      },
      (item) => item.type === "node" && item.corpusRoot === corpusRoot && item.node.id === nodeId,
    );
  }

  /**
   * Every entity node the tree holds, every deployment, in the tree's order, with its deployment's name and type
   * (the search, REQ-000076-UVqkd7cL). Walking through getChildren gives each node the identity a reveal needs.
   */
  entityNodes(): SearchEntry[] {
    const found: SearchEntry[] = [];
    const walk = (items: InspectorTreeItem[]): void => {
      for (const item of items) {
        if (item.type === "node") {
          const view = this.deployments.get(item.corpusRoot);
          const type =
            item.node.kind === "artifact" || item.node.kind === "row"
              ? view?.model.types?.get(item.node.typePrefix)
              : undefined;
          found.push({
            corpusRoot: item.corpusRoot,
            deployment: view?.folderName ?? item.corpusRoot,
            node: item.node,
            ...(type ? { type } : {}),
          });
          walk(this.getChildren(item)); // the entities listed under it
        } else if (item.type !== "attention") {
          walk(this.getChildren(item));
        }
      }
    };
    walk(this.getChildren().filter((item) => item.type === "deployment"));
    return found;
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
      // With no one logged in, nothing: the view's welcome text offers the login (package.json).
      return visibleRoot(this.someoneLoggedIn, [...instances, ...unset]);
    }
    if (element.type === "deployment") {
      const view = this.deployments.get(element.corpusRoot);
      return view ? this.sectionsFor(view) : [];
    }
    if (element.type === "group") return this.groupChildren(element.corpusRoot, element.group.key);
    if (element.type === "type-folder") {
      return element.folder.phases.map((folder) => ({
        type: "phase-folder",
        corpusRoot: element.corpusRoot,
        typePrefix: element.folder.typePrefix,
        folder,
      }));
    }
    if (element.type === "phase-folder") {
      return element.folder.entries.map((entry) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node: entry.node,
        children: entry.children,
      }));
    }
    if (element.type === "node") {
      return (element.children ?? []).map((entry) => ({
        type: "node",
        corpusRoot: element.corpusRoot,
        node: entry.node,
        children: entry.children,
      }));
    }
    if (element.type === "rule-type-section") {
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
