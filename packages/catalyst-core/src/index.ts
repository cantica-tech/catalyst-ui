export const VERSION = "0.19.0";

export * from "./types.js";
export * from "./module-loader.js";
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
export { branchSafeName, suggestCriterionBranch } from "./criterion.js";
export { buildChainModel } from "./graph.js";
export {
  claudeCodeStoragePath,
  hasCatalystPointer,
  meetsRequiredFrameworkVersion,
  readCatalystPointer,
  readDeployedFrameworkVersion,
  readEntityDefinition,
  REQUIRED_FRAMEWORK_VERSION,
  resolveCorpusRoot,
} from "./discover.js";
export {
  BACKTICK_DEV_ARTIFACT_ID_RE,
  BACKTICK_FEATURE_ID_RE,
  BACKTICK_RULE_ID_RE,
  BACKTICK_ROADMAP_ID_RE,
} from "./ids.js";
export { parseIamUsers, parseIamRoles } from "./iam.js";
export {
  defaultAgentSource,
  joinCriterionRepo,
  repoNameFromUrl,
  writeCatalystPointer,
  type JoinCriterionOptions,
} from "./join-criterion.js";
export { parseJournal, queryJournal } from "./journal.js";
export {
  cleanRuleTitle,
  extractSlugFromRuleId,
  parseCorpus,
  parseRuleDocument,
  parseDomainsIndex,
} from "./parser.js";
export {
  parseProposals,
  nextProposalId,
  openProposalsByTarget,
} from "./proposals.js";
export { parseRuns, hasDrift } from "./runs.js";
export { composeSlashCommand } from "./slash-command.js";
export { validate } from "./validator.js";
export {
  compareVersions,
  parseVersionSpecifier,
  satisfiesVersionSpecifier,
  satisfiesUvVersionSpecifier,
} from "./versioning.js";
export {
  createZipArchive,
  readZipArchive,
  packageUiModule,
  parseUiModuleFromZip,
  UiModuleManager,
  type ActiveUiModule,
  type UiModuleLoadResult,
  type UiModuleManifest,
} from "./ui-module-manager.js";
export {
  fetchRemoteUiModules,
  loadLocalSavedModule,
  saveModuleLocally,
  type RemoteModuleInfo,
} from "./remote-module-store.js";
export { watchCorpus } from "./watcher.js";
export type { WatcherHandle } from "./watcher.js";
