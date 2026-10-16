import type { SlashCommandSpec } from "catalyst-core";
import { discoverSlashCommands } from "catalyst-core";
import * as vscode from "vscode";

export interface CommandCandidate {
  folder: vscode.WorkspaceFolder;
  commands: SlashCommandSpec[];
}

export interface PickedCommand {
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
export async function pickCommandAndArgs(candidates: CommandCandidate[]): Promise<PickedCommand | undefined> {
  if (candidates.length === 0) {
    void vscode.window.showInformationMessage(
      "No catalyst commands found: is a catalyst criterion reachable for this workspace?",
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

export function discoverCommandCandidates(): CommandCandidate[] {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders
    .map((folder) => ({
      folder,
      commands: discoverSlashCommands(folder.uri.fsPath),
    }))
    .filter((entry) => entry.commands.length > 0);
}
