/** Formats a picked command plus optional arguments as its literal slash form, e.g. `/name <args>`. */
export function composeSlashCommand(name: string, args: string): string {
  const trimmed = args.trim();
  const bare = name.replace(/^\//, "");
  return trimmed.length > 0 ? `/${bare} ${trimmed}` : `/${bare}`;
}

/**
 * The text sent to an agent to run a catalyst command. catalyst writes no
 * command files into a project, so a bare `/name` resolves in no agent;
 * commands reach agents through catalyst's MCP server (`catalyst mcp`),
 * whose prompts are the project's §4 commands and whose `command` tool
 * returns a command's procedure. The request is plain, agent-agnostic
 * text pointing the agent at either, and a single line (a newline would
 * smuggle a second prompt into an agent's stdin).
 */
export function composeCommandRequest(name: string, args: string): string {
  const bare = name.replace(/^\//, "");
  const slash = composeSlashCommand(bare, args).replace(/[\r\n]+/g, " ");
  return `Run the catalyst command ${slash} (use the catalyst MCP server's "${bare}" prompt or its "command" tool).`;
}
