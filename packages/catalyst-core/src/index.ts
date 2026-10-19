/** This package's version; equals package.json and the repository's version.txt (tested). */
export const VERSION = "0.55.0";

export {
  KERNEL_VERSION_FLOOR,
  VERIFIED_KERNEL_VERSION,
  kernelSyncTarget,
  restoreKernelVersion,
} from "./kernel-version.js";

export * from "./types.js";
export {
  ScriptedHost,
  type HostFolder,
  type HostMemento,
  type HostPort,
  type InputOptions,
  type NotifyLevel,
  type PickItem,
  type PickOptions,
} from "./host-port.js";
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
  commandsFromCatalog,
  discoverSlashCommands,
  type RunCatalyst,
  type SlashCommandSpec,
} from "./commands-discovery.js";
export { branchSafeName, suggestCriterionBranch } from "./criterion.js";
export {
  claudeCodeStoragePath,
  hasCatalystPointer,
  meetsRequiredKernelVersion,
  readCatalystPointer,
  readDeployedKernelVersion,
  REQUIRED_KERNEL_VERSION,
  resolveCorpusRoot,
  workingCopyState,
} from "./discover.js";
export type { WorkingCopyState } from "./discover.js";
export { BACKTICK_ENTITY_ID_RE, BACKTICK_RULE_ID_RE } from "./ids.js";
export { rolesFrom, usersFrom } from "./iam.js";
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
export { cleanRuleTitle, sectionLines } from "./markdown.js";
export {
  CATALYST_SERVE_FLOOR,
  type CatalystCheck,
  type CatalystGraph,
  type AgentRun,
  type CatalystServer,
  type RunEvent,
  type WatcherHandle,
  COMMAND_NAME,
  catalystCommand,
  modelFromGraph,
  readThroughCatalyst,
  definitionsFrom,
  reportFromCheck,
  startAgentRun,
  startLocalServe,
  watchCatalyst,
  watchProject,
} from "./catalyst-source.js";
export {
  ActionError,
  actionArgs,
  describeAction,
  runAction,
  tryArgs,
  type ActionResult,
  type StudioAction,
} from "./actions.js";
export { BATCH_LIMIT, StudioRuns, type HostMessage, type RunDeps, type StudioMessage } from "./studio-host.js";
