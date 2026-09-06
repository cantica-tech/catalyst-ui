export const VERSION = "0.4.0";

export * from "./types.js";
export { buildChainModel } from "./graph.js";
export { resolveCorpusRoot } from "./discover.js";
export {
  BACKTICK_DEV_ARTIFACT_ID_RE,
  BACKTICK_FEATURE_ID_RE,
  BACKTICK_RULE_ID_RE,
} from "./ids.js";
export { parseCorpus, parseRuleDocument, parseDomainsIndex } from "./parser.js";
export {
  parseProposals,
  nextProposalId,
  openProposalsByTarget,
} from "./proposals.js";
export { parseRuns, hasDrift } from "./runs.js";
export { validate } from "./validator.js";
export { watchCorpus } from "./watcher.js";
export type { WatcherHandle } from "./watcher.js";
