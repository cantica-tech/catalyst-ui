export const VERSION = "0.12.0";

export * from "./types.js";
export {
  AGENT_PRESETS,
  declaresCommand,
  defaultChatAgent,
  findExactMatch,
  parseChatAgents,
  resolveBinding,
  resolveParticipant,
  type AgentPreset,
} from "./agent-bridge.js";
export { resolveAgentCommand } from "./agent-launch.js";
export {
  discoverSlashCommands,
  type SlashCommandSpec,
} from "./commands-discovery.js";
export { buildChainModel } from "./graph.js";
export { readDeployedFrameworkVersion, resolveCorpusRoot } from "./discover.js";
export {
  BACKTICK_DEV_ARTIFACT_ID_RE,
  BACKTICK_FEATURE_ID_RE,
  BACKTICK_RULE_ID_RE,
  BACKTICK_ROADMAP_ID_RE,
} from "./ids.js";
export { parseIamUsers, parseIamRoles } from "./iam.js";
export { parseJournal, queryJournal } from "./journal.js";
export { parseCorpus, parseRuleDocument, parseDomainsIndex } from "./parser.js";
export {
  parseProposals,
  nextProposalId,
  openProposalsByTarget,
} from "./proposals.js";
export { parseRuns, hasDrift } from "./runs.js";
export { composeSlashCommand } from "./slash-command.js";
export { validate } from "./validator.js";
export { compareVersions } from "./versioning.js";
export { watchCorpus } from "./watcher.js";
export type { WatcherHandle } from "./watcher.js";
