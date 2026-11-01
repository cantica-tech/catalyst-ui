import type { DirectoryGroup, DirectoryKind, DirectoryRole, DirectoryUser } from "catalyst-core";
import * as vscode from "vscode";

import { codiconFor } from "../codicons.js";
import { IAM_LOGIN_COMMAND, OPEN_DIRECTORY_COMMAND } from "../constants.js";
import { type Directory, readDirectory } from "../directory.js";
import type { IamSettings } from "../iam.js";

/**
 * The Users panel (vscode-IAM-000003-UVqkd7cL): the identity provider's users,
 * realm roles and groups, read through catalyst-users, each once and never with
 * children (vscode-INSPECTOR-000002-UVqkd7cL). Who holds what is in the
 * documents they open, as links.
 */
export type UsersTreeItem =
  | { type: "section"; kind: DirectoryKind }
  | { type: "user"; user: DirectoryUser }
  | { type: "role"; role: DirectoryRole }
  | { type: "group"; group: DirectoryGroup }
  | { type: "problem"; text: string }
  | { type: "login" };

const SECTIONS: { kind: DirectoryKind; label: string; icon: string }[] = [
  { kind: "user", label: "Users", icon: "users" },
  { kind: "role", label: "Roles", icon: "roles" },
  { kind: "group", label: "Groups", icon: "groups" },
];

export class UsersProvider implements vscode.TreeDataProvider<UsersTreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<UsersTreeItem | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;

  private directory: Directory | undefined;
  private problem: string | undefined;
  private reading: Promise<void> | undefined;
  private sections = new Map<DirectoryKind, UsersTreeItem>();
  private items = new Map<string, UsersTreeItem>();

  constructor(private readonly settings: () => IamSettings) {}

  /** Read the directory again when next shown (never in the background). */
  refresh(): void {
    this.directory = undefined;
    this.problem = undefined;
    this.reading = undefined;
    this.changeEmitter.fire(undefined);
  }

  /** The directory as last read, reading it first if it has not been. */
  async current(): Promise<Directory | undefined> {
    this.reading ??= readDirectory(this.settings()).then((answer) => {
      this.directory = answer.value;
      this.problem = answer.problem;
      this.sections.clear();
      this.items.clear();
    });
    await this.reading;
    return this.directory;
  }

  /** The panel's one item for a user, role or group, for `TreeView.reveal`. */
  async find(kind: DirectoryKind, name: string): Promise<UsersTreeItem | undefined> {
    const directory = await this.current();
    if (!directory) return undefined;
    if (this.items.size === 0) for (const section of SECTIONS) this.childrenOf(this.section(section.kind));
    return this.items.get(`${kind}:${name}`);
  }

  getTreeItem(element: UsersTreeItem): vscode.TreeItem {
    if (element.type === "section") {
      const section = SECTIONS.find((s) => s.kind === element.kind);
      const item = new vscode.TreeItem(section?.label ?? element.kind, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon(codiconFor([section?.icon ?? element.kind]));
      item.id = `section:${element.kind}`;
      return item;
    }
    if (element.type === "problem") {
      const item = new vscode.TreeItem(element.text, vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("warning");
      item.tooltip = element.text;
      return item;
    }
    if (element.type === "login") {
      const item = new vscode.TreeItem("Log in to catalyst-users…", vscode.TreeItemCollapsibleState.None);
      item.iconPath = new vscode.ThemeIcon("sign-in");
      item.command = { command: IAM_LOGIN_COMMAND, title: "Log in to catalyst-users" };
      return item;
    }
    const [kind, name, label, description, icon] =
      element.type === "user"
        ? [
            "user",
            element.user.username,
            element.user.username,
            [element.user.name, element.user.enabled ? "" : "disabled"].filter(Boolean).join(" · "),
            "users",
          ]
        : element.type === "role"
          ? ["role", element.role.name, element.role.name, element.role.description, "roles"]
          : ["group", element.group.path, element.group.path, "", "groups"];
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.id = `${kind}:${name}`;
    item.description = description || undefined;
    item.iconPath = new vscode.ThemeIcon(codiconFor([icon]));
    item.command = { command: OPEN_DIRECTORY_COMMAND, title: "Show detail", arguments: [kind, name] };
    return item;
  }

  getParent(element: UsersTreeItem): UsersTreeItem | undefined {
    if (element.type === "user" || element.type === "role" || element.type === "group") {
      return this.section(element.type);
    }
    return undefined;
  }

  async getChildren(element?: UsersTreeItem): Promise<UsersTreeItem[]> {
    if (!element) {
      const directory = await this.current();
      if (!directory) {
        return [{ type: "problem", text: this.problem ?? "catalyst-users did not answer" }, { type: "login" }];
      }
      return SECTIONS.map((s) => this.section(s.kind));
    }
    return this.childrenOf(element);
  }

  private section(kind: DirectoryKind): UsersTreeItem {
    let found = this.sections.get(kind);
    if (!found) {
      found = { type: "section", kind };
      this.sections.set(kind, found);
    }
    return found;
  }

  private childrenOf(element: UsersTreeItem): UsersTreeItem[] {
    if (element.type !== "section" || !this.directory) return [];
    const remember = (key: string, item: UsersTreeItem) => {
      const known = this.items.get(key);
      if (known) return known;
      this.items.set(key, item);
      return item;
    };
    if (element.kind === "user") {
      return this.directory.users.map((user) => remember(`user:${user.username}`, { type: "user", user }));
    }
    if (element.kind === "role") {
      return this.directory.roles.map((role) => remember(`role:${role.name}`, { type: "role", role }));
    }
    return this.directory.groups.map((group) => remember(`group:${group.path}`, { type: "group", group }));
  }
}
