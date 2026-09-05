/**
 * The core↔UI message protocol: the typed chain model, validation report,
 * and watcher shapes every later package (both hosts, catalyst-ui itself)
 * consumes. Defined once here, before any host exists — see the roadmap's
 * "Architecture" decision (one protocol, three packages).
 */

export type NodeKind =
  "work-item" | "dev-artifact" | "rule" | "domain" | "feature";

export type DevArtifactType = "bug" | "requirement" | "house-keeping";

export interface SourceLocation {
  file: string;
  line: number;
}

interface ChainNodeBase {
  id: string;
  kind: NodeKind;
  title: string;
  location: SourceLocation;
  /** Raw ID-shaped tokens cited from this node's own content, before resolution. */
  references: string[];
}

/**
 * Reserved for the work-items layer (epic/story/task/...). Always parses to
 * an empty list in this deployment: work-items/ is plugin-territory and no
 * project-management plugin is active here.
 */
export interface WorkItemNode extends ChainNodeBase {
  kind: "work-item";
}

export interface DevArtifactNode extends ChainNodeBase {
  kind: "dev-artifact";
  artifactType: DevArtifactType;
  status: string;
  targets: string[];
  feature?: string;
  /** Listed in this artifact type's index table (requirements.md/bugs.md/house-keeping.md). */
  registered: boolean;
  /** Backing .md file exists on disk. */
  fileExists: boolean;
}

export interface RuleNode extends ChainNodeBase {
  kind: "rule";
  /** The rule document's short prefix (`env`, `core`, `rr`, ...). */
  docPrefix: string;
  domain: string;
  status: string;
  /** Listed in the global rules/rules.md "Rule IDs" index. Always true for `rr` (self-governing). */
  registeredInRulesIndex: boolean;
}

export interface DomainNode extends ChainNodeBase {
  kind: "domain";
  code: string;
  /** The domain's own doc file (rules/domains/<file>) exists on disk. */
  hasDoc: boolean;
}

export interface FeatureNode extends ChainNodeBase {
  kind: "feature";
  status: string;
  registered: boolean;
  fileExists: boolean;
}

export type ChainNode =
  WorkItemNode | DevArtifactNode | RuleNode | DomainNode | FeatureNode;

export interface ChainModel {
  nodes: Map<string, ChainNode>;
  /** id -> ids it resolves a reference to (dangling refs excluded). */
  edges: Map<string, Set<string>>;
  /** id -> ids that resolve a reference to it. */
  reverseEdges: Map<string, Set<string>>;
  /** Every definition site seen per id; more than one entry means the id was reused. */
  definitionsById: Map<string, SourceLocation[]>;
}

export type IssueSeverity = "error" | "warning";

export type IssueKind =
  "orphaned-artifact" | "unbacked-rule" | "id-reuse" | "dangling-reference";

export interface ValidationIssue {
  kind: IssueKind;
  severity: IssueSeverity;
  nodeId?: string;
  message: string;
  location?: SourceLocation;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  nodeCount: number;
  errorCount: number;
  warningCount: number;
  durationMs: number;
}

export interface ParsedFile {
  file: string;
  mtimeMs: number;
  nodes: ChainNode[];
}

export interface ParseResult {
  root: string;
  files: ParsedFile[];
  durationMs: number;
}

export interface ParseOptions {
  /** Checked between files during a parse; returning false aborts early (a newer change landed mid-parse). */
  shouldContinue?: () => boolean;
}

export interface WatcherOptions {
  /** Trailing debounce/coalesce window in ms. Default 180 (within the 150-200ms contract). */
  debounceMs?: number;
}
