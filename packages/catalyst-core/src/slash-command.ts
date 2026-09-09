/** Formats a picked slash command plus optional arguments into the literal text sent to an agent, e.g. `/create-bug <title>`. */
export function composeSlashCommand(name: string, args: string): string {
  const trimmed = args.trim();
  return trimmed.length > 0 ? `/${name} ${trimmed}` : `/${name}`;
}
