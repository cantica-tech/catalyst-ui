/** This package's version; equals package.json and the repository's version.txt (tested). */
export const VERSION = "0.39.0";

export {
  KERNEL_VERSION_FLOOR,
  VERIFIED_KERNEL_VERSION,
  kernelSyncTarget,
  restoreKernelVersion,
} from "./kernel-version.js";

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
export { isAllowedAgentId, resolveAgentCommand, resolveAgentLaunch } from "./agent-launch.js";
export type { AgentLaunch } from "./agent-launch.js";
export {
  commandNames,
  discoverSlashCommands,
  parseSection4Commands,
  type SlashCommandSpec,
} from "./commands-discovery.js";
export { branchSafeName, suggestCriterionBranch } from "./criterion.js";
export {
  claudeCodeStoragePath,
  hasCatalystPointer,
  meetsRequiredKernelVersion,
  readCatalystPointer,
  readDeployedKernelVersion,
  readEntityDefinition,
  REQUIRED_KERNEL_VERSION,
  resolveCorpusRoot,
  workingCopyState,
} from "./discover.js";
export type { WorkingCopyState } from "./discover.js";
export {
  BACKTICK_DEV_ARTIFACT_ID_RE,
  BACKTICK_FEATURE_ID_RE,
  BACKTICK_RULE_ID_RE,
  BACKTICK_ROADMAP_ID_RE,
} from "./ids.js";
export { parseIamUsers, parseIamRoles } from "./iam.js";
export {
  CRITERION_GITIGNORE_ENTRY,
  defaultAgentSource,
  ensureCriterionGitignored,
  joinCriterionRepo,
  repoNameFromUrl,
  writeCatalystPointer,
  writeProjectToml,
  type JoinCriterionOptions,
} from "./join-criterion.js";
export { parseProposals, nextProposalId, openProposalsByTarget } from "./proposals.js";
export { parseRuns, hasDrift } from "./runs.js";
export { composeCommandRequest, composeSlashCommand } from "./slash-command.js";
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
  readManifestKernelVersion,
  UiModuleManager,
  type ActiveUiModule,
  type RawUiModuleManifest,
  type UiModuleLoadResult,
  type UiModuleManifest,
} from "./ui-module-manager.js";
export {
  downloadModuleZip,
  fetchRemoteUiModules,
  loadLocalSavedModule,
  parseArtifactSourceLocation,
  saveModuleLocally,
  syncGitRepoToCache,
  DEFAULT_MODULE_SOURCE_URL,
  type ArtifactSourceLocation,
  type RemoteModuleInfo,
} from "./remote-module-store.js";

export * from "./workspace.js";
export {
  PROJECT_FILE,
  catalystHome,
  findProjectFile,
  hasProjectFile,
  homeCriterion,
  parseProjectToml,
  projectName,
  readProjectFile,
} from "./project-file.js";
export { coerceJournal, queryJournal } from "./journal.js";
export { bulletItems, cleanRuleTitle, extractSlugFromRuleId, parseFieldTable, sectionLines } from "./markdown.js";
export {
  CATALYST_SERVE_FLOOR,
  type CatalystCheck,
  type CatalystGraph,
  type CatalystServer,
  type WatcherHandle,
  modelFromGraph,
  readThroughCatalyst,
  reportFromCheck,
  startLocalServe,
  watchCatalyst,
  watchProject,
} from "./catalyst-source.js";
