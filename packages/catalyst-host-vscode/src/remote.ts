/**
 * Remote environments (`REQ-000016-UVqkd7cL`) and a criterion not on this
 * machine (`REQ-000074-UVqkd7cL`). The extension runs where the workspace's
 * files are (`extensionKind: workspace`): over SSH, in WSL, a dev container
 * or a codespace. A project's criterion lives outside it, in catalyst's home
 * (`$HOME/.catalyst/projects/<name>/criterion`), so a fresh clone or another
 * machine may not have it yet: `catalyst open` readies it (law L5). A legacy
 * `.criterion` symlink may point into the agent-owned space of the machine
 * that installed it. This says what to do about either, for the environment
 * at hand. Pure, so it is unit-tested without VS Code.
 */
/** `vscode.env.remoteName` in words; undefined when running locally. */
export function environmentLabel(remoteName: string | undefined): string | undefined {
  switch (remoteName) {
    case undefined:
    case "":
      return undefined;
    case "wsl":
      return "WSL";
    case "ssh-remote":
      return "SSH";
    case "dev-container":
    case "attached-container":
      return "a dev container";
    case "codespaces":
      return "a codespace";
    default:
      return remoteName;
  }
}

/** The `devcontainer.json` mount that makes `target` reachable at the same path inside the container. */
export function devcontainerMount(target: string): string {
  return `"mounts": ["source=${target},target=${target},type=bind"]`;
}

export type UnreachableAction = "copy-mount" | "share" | "open";

export interface UnreachableAdvice {
  message: string;
  actions: UnreachableAction[];
}

/**
 * What to tell the user about a deployment whose criterion is not
 * reachable here: `target` is a legacy `.criterion` symlink's dangling
 * target, or undefined when the criterion is not on this machine at all —
 * then `catalyst open` readies it (it clones the shared criterion that
 * `catalyst.toml` names), and the extension never clones one itself.
 */
export function unreachableAdvice(
  name: string,
  target: string | undefined,
  remoteName: string | undefined,
): UnreachableAdvice {
  const where = environmentLabel(remoteName);
  const container = remoteName === "dev-container" || remoteName === "attached-container";
  if (!target) {
    return {
      message: `"${name}" is a catalyst deployment, but its criterion is not on this machine${where ? ` (${where})` : ""}. Run catalyst open to ready it: it fetches the shared criterion catalyst.toml names (or says what is missing).`,
      actions: ["open"],
    };
  }
  const lead = `"${name}" is a catalyst deployment, but its working copy (${target}) is not reachable${where ? ` from ${where}` : " here"}`;
  if (container) {
    return {
      message: `${lead}: it is in the agent-owned space of the machine that installed it. Mount it into the container at the same path (devcontainer.json), or share the criterion with /share create.`,
      actions: ["copy-mount", "share"],
    };
  }
  return {
    message: `${lead}. Share the criterion with /share create from where it lives, so every environment gets it with catalyst open — or install catalyst here.`,
    actions: ["share"],
  };
}
