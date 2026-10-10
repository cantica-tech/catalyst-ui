/**
 * Remote environments (`REQ-000016-UVqkd7cL`). The extension runs where the
 * workspace's files are (`extensionKind: workspace`): over SSH, in WSL, a
 * dev container or a codespace. A local-only deployment's `.criterion` is a
 * symlink into the agent-owned space of the machine that installed it,
 * which such an environment usually lacks — this says what to do about it,
 * for the environment at hand. Pure, so it is unit-tested without VS Code.
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

export type UnreachableAction = "copy-mount" | "share";

export interface UnreachableAdvice {
  message: string;
  actions: UnreachableAction[];
}

/**
 * What to tell the user about a deployment whose working copy is not
 * reachable here: `target` is the dangling symlink's target, or undefined
 * when there is no `.criterion` at all.
 */
export function unreachableAdvice(
  name: string,
  target: string | undefined,
  remoteName: string | undefined,
): UnreachableAdvice {
  const where = environmentLabel(remoteName);
  const container = remoteName === "dev-container" || remoteName === "attached-container";
  const lead = target
    ? `"${name}" is a catalyst deployment, but its working copy (${target}) is not reachable${where ? ` from ${where}` : " here"}`
    : `"${name}" is a catalyst deployment, but it has no working copy${where ? ` in ${where}` : " here"} (no .criterion)`;
  if (container && target) {
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
