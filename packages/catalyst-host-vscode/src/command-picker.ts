import type { HostFolder, HostPort, SlashCommandSpec } from "catalyst-core";
import { discoverSlashCommands } from "catalyst-core";

export interface CommandCandidate {
  folder: HostFolder;
  commands: SlashCommandSpec[];
}

export interface PickedCommand {
  folder: HostFolder;
  cmd: SlashCommandSpec;
  args: string;
}

/**
 * Shared by every command that needs "which project, which catalyst
 * command, what arguments" — today just `SEND_TO_AGENT_CHAT_COMMAND`.
 * Returns `undefined` if the user dismissed a picker, or there was
 * nothing to pick from (already reported to the user in that case).
 */
export async function pickCommandAndArgs(
  host: HostPort,
  candidates: CommandCandidate[],
): Promise<PickedCommand | undefined> {
  if (candidates.length === 0) {
    void host.notify("info", "No catalyst commands found: is a catalyst criterion reachable for this workspace?");
    return undefined;
  }

  let chosen = candidates[0];
  if (candidates.length > 1) {
    const pick = await host.pick(
      candidates.map((entry) => ({ label: entry.folder.name, entry })),
      { placeHolder: "Which project?" },
    );
    if (!pick) return undefined;
    chosen = pick.entry;
  }

  const commandPick = await host.pick(
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
      (await host.input({
        prompt: `Arguments for /${commandPick.cmd.name}`,
        placeHolder: commandPick.cmd.argumentHint,
      })) ?? "";
  }

  return { folder: chosen.folder, cmd: commandPick.cmd, args };
}

export function discoverCommandCandidates(host: HostPort): CommandCandidate[] {
  return host
    .folders()
    .map((folder) => ({
      folder,
      commands: discoverSlashCommands(folder.path),
    }))
    .filter((entry) => entry.commands.length > 0);
}
