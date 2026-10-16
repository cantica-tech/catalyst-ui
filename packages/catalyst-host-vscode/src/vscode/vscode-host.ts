import type {
  HostFolder,
  HostMemento,
  HostPort,
  InputOptions,
  NotifyLevel,
  PickItem,
  PickOptions,
} from "catalyst-core";
import * as vscode from "vscode";

/** The host port over the VS Code API (catalyst roadmap R6.1). */
export class VscodeHost implements HostPort {
  readonly memento: HostMemento;

  constructor(context: vscode.ExtensionContext) {
    this.memento = {
      get: (key: string) => context.globalState.get(key),
      update: (key: string, value: unknown) => Promise.resolve(context.globalState.update(key, value)),
    };
  }

  notify(level: NotifyLevel, message: string, ...actions: string[]): Promise<string | undefined> {
    const show =
      level === "error"
        ? vscode.window.showErrorMessage
        : level === "warning"
          ? vscode.window.showWarningMessage
          : vscode.window.showInformationMessage;
    return Promise.resolve(show(message, ...actions));
  }

  pick<T extends PickItem>(items: readonly T[], options?: PickOptions): Promise<T | undefined> {
    return Promise.resolve(vscode.window.showQuickPick([...items], options));
  }

  input(options: InputOptions): Promise<string | undefined> {
    return Promise.resolve(vscode.window.showInputBox(options));
  }

  copy(text: string): Promise<void> {
    return Promise.resolve(vscode.env.clipboard.writeText(text));
  }

  openExternal(url: string): Promise<boolean> {
    return Promise.resolve(vscode.env.openExternal(vscode.Uri.parse(url)));
  }

  isTrusted(): boolean {
    return vscode.workspace.isTrusted;
  }

  setting(key: string, folder?: HostFolder): unknown {
    return vscode.workspace.getConfiguration("catalyst", folder && vscode.Uri.file(folder.path)).get(key);
  }

  updateSetting(key: string, value: unknown, folder?: HostFolder): Promise<void> {
    const config = vscode.workspace.getConfiguration("catalyst", folder && vscode.Uri.file(folder.path));
    return Promise.resolve(
      config.update(key, value, folder ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global),
    );
  }

  run(command: string, ...args: unknown[]): Promise<unknown> {
    return Promise.resolve(vscode.commands.executeCommand(command, ...args));
  }

  folders(): HostFolder[] {
    return (vscode.workspace.workspaceFolders ?? []).map(hostFolder);
  }
}

export function hostFolder(folder: vscode.WorkspaceFolder): HostFolder {
  return { name: folder.name, path: folder.uri.fsPath };
}
