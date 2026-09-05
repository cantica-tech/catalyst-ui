export const VERSION = "0.0.0";

export * from "./types.js";
export { buildChainModel } from "./graph.js";
export { parseCorpus, parseRuleDocument, parseDomainsIndex } from "./parser.js";
export { validate } from "./validator.js";
export { watchCorpus } from "./watcher.js";
export type { WatcherHandle } from "./watcher.js";
