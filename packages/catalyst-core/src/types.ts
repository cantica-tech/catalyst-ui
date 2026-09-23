/**
 * The core↔UI message protocol: the typed chain model, validation report,
 * and watcher shapes every later package (both hosts, catalyst-ui itself)
 * consumes. Defined once here, before any host exists — see the roadmap's
 * "Architecture" decision (one protocol, three packages).
 */

export type NodeKind =
  | "work-item"
  | "dev-artifact"
  | "rule"
  | "domain"
  | "feature"
  | "roadmap"
  | "step";

export type DevArtifactType = "bug" | "requirement" | "house-keeping" | "test";

export interface SourceLocation {
  file: string;
  line: number;
}

interface ChainNodeBase {
  id: string;
  kind: NodeKind;
  title: string;
  /** Short summary summarizing the entity's purpose (from `Name` field, slug, or title). */
  name?: string;
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
  /** `artifactType: "test"` only: `(0,n)` `REQ-NNNNNN` this test verifies (`Rules-of-Rules.md` §22). Undefined for every other artifact type. */
  requirements?: string[];
  /** `artifactType: "test"` only: `(0,n)` `STEP-NNNNNN` this test verifies (`Rules-of-Rules.md` §22). Undefined for every other artifact type — in particular, a *requirement's or bug's own* `Steps` field (the steps opened against it) is deliberately not read into this field; that relationship is already derivable from `StepNode.parent` via the chain model's reverse edges. */
  steps?: string[];
  signedOffBy?: string;
  /** Listed in this artifact type's index table (requirements.md/bugs.md/house-keeping.md/tests.md). */
  registered: boolean;
  /** Backing .md file exists on disk. */
  fileExists: boolean;
  /** The document's own `## Description` section (`## Summary` for a requirement) — empty when index-only (no file) or the section is missing. */
  description: string;
  /** The backing .md file's complete raw text, every field and section — empty when index-only (no file). */
  content: string;
}

export interface RuleNode extends ChainNodeBase {
  kind: "rule";
  /** The rule document's short prefix (`env`, `core`, `rr`, ...). */
  docPrefix: string;
  domain: string;
  status: string;
  signedOffBy?: string;
  /** Listed in the global rules/rules.md "Rule IDs" index. Always true for `rr` (self-governing). */
  registeredInRulesIndex: boolean;
  /** The rule's own text, as written between its heading and the next. */
  description: string;
}

export interface DomainNode extends ChainNodeBase {
  kind: "domain";
  code: string;
  /** The domain's own doc file (rules/domains/<file>) exists on disk. */
  hasDoc: boolean;
  /** The domain doc's own `## Scope` section — empty when it has no doc file or no Scope section. */
  description: string;
  /** The domain doc's complete raw text — empty when it has no doc file. */
  content: string;
}

export interface FeatureNode extends ChainNodeBase {
  kind: "feature";
  status: string;
  signedOffBy?: string;
  registered: boolean;
  fileExists: boolean;
  /** The document's own `## Description` section — empty when index-only (no file) or the section is missing. */
  description: string;
  /** The backing .md file's complete raw text, every field and section — empty when index-only (no file). */
  content: string;
}

export type StepStatus = "planned" | "in-progress" | "done" | "abandoned";

/**
 * `STEP-NNNNNN` (`Rules-of-Rules.md` §21, framework 0.29.0, widened to a
 * bug parent at 0.31.0) — one concrete unit of implementation work
 * performed toward a specific requirement or bug. Never rule-linked (no
 * `targets`/`domain` of its own — it inherits its parent's); `parent`
 * (a `REQ-NNNNNN` or `BUG-NNNNNN` id) is the one required
 * cross-reference.
 */
export interface StepNode extends ChainNodeBase {
  kind: "step";
  parent: string;
  status: StepStatus;
  signedOffBy?: string;
  /** Listed in `steps/steps.md`. */
  registered: boolean;
  /** Backing .md file exists on disk. */
  fileExists: boolean;
  /** The document's own `## Description` section — empty when index-only (no file) or the section is missing. */
  description: string;
  /** The backing .md file's complete raw text, every field and section — empty when index-only (no file). */
  content: string;
}

export type RoadmapStatus = "Not triaged" | "Triaged" | "In progress" | "Done";

/**
 * One `RM-NNNNNN` row inside a `development/roadmaps/<name>.md` file
 * (`rr-META-010`) — a row, not its own file, so `registered`/`fileExists`
 * (meaningful for dev-artifacts/features) don't apply here.
 */
export interface RoadmapNode extends ChainNodeBase {
  kind: "roadmap";
  /** Which named roadmap file this row lives in (that file's basename). */
  roadmapName: string;
  /** True iff the owning roadmap file's header carries a `**Retired:**` field. */
  roadmapRetired: boolean;
  /** A sentence or two summarizing the item — distinct from `title`'s short label (framework `0.20.0`+ shape). */
  description: string;
  status: RoadmapStatus;
  /** The row's `Linked` cell's `FEAT-`/`REQ-` id, if any — also present in `references`. */
  linked?: string;
  signedOffBy: string;
  notes: string;
}

export type ChainNode =
  | WorkItemNode
  | DevArtifactNode
  | RuleNode
  | DomainNode
  | FeatureNode
  | RoadmapNode
  | StepNode;

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

export type ProposalStatus =
  "proposed" | "applying" | "applied" | "partial" | "stale";

/**
 * A reviewable, agent-mediated write request — the only path from a
 * read-only view to an actual change on a governed file. A host only
 * ever creates and displays these; executing `expectations` and
 * advancing `status` is an agent's job, never a host's or core's own.
 */
export interface Proposal {
  id: string;
  name?: string;
  status: ProposalStatus;
  intent: string;
  targets: string[];
  expectations: string[];
  constraints: string[];
  location: SourceLocation;
}

export type RunStatus = "running" | "completed" | "failed";

export type RunStepStatus = "done" | "failed" | "pending" | "drift";

/** One `## Checklist` line, glyph-parsed into a status plus its text. */
export interface RunStep {
  status: RunStepStatus;
  text: string;
}

/**
 * An external agent's own live run-state — unlike a `Proposal`, never
 * created or edited by a host UI, only parsed and displayed. A `drift`
 * step is self-reported by the agent; `catalyst-core` never
 * independently verifies the claim, the same way it never executes a
 * proposal's `expectations`.
 */
export interface Run {
  id: string;
  name?: string;
  status: RunStatus;
  command: string;
  started: string;
  steps: RunStep[];
  ledger: string[];
  location: SourceLocation;
}

/** `IAM/users/users.json` — advisory registry, not access control (`rr-META-011`). Identity key is `name`. */
export interface IamUser {
  name: string;
  roles: string[];
  registered: string;
  active: boolean;
  notes: string;
}

/** `IAM/roles/roles.json` — a role's `name` is what a user's own `roles` array cites. */
export interface IamRole {
  name: string;
  actions: string[];
}

export type JournalAction =
  "create" | "update" | "close" | "retire" | "status-change" | "sync";

export interface JournalFileChange {
  path: string;
  before: string | null;
  after: string;
}

/** One append-only line of `development/journal.jsonl` (`rr-META-012`) — transaction-log-grade, not prose. */
export interface JournalEntry {
  timestamp: string;
  actor: string;
  command: string;
  action: JournalAction;
  artifact: string;
  targets: string[];
  intent: string[];
  files: JournalFileChange[];
}

/** Filters mirroring the `/journal` slash-command's `--since/--actor/--artifact/--rule` flags. */
export interface JournalFilters {
  since?: string;
  actor?: string;
  artifact?: string;
  rule?: string;
}

export interface WatchUpdate {
  model: ChainModel;
  report: ValidationReport;
  proposals: Proposal[];
  runs: Run[];
  users: IamUser[];
  roles: IamRole[];
}

/**
 * The extension-host <-> webview message payload for one node's detail
 * view: its own fields plus what it's justified by (upstream) and what
 * it produces (downstream), resolved from the chain model's edges, plus
 * any open proposal targeting it.
 */
export interface NodeDetailPayload {
  node: ChainNode;
  upstream: ChainNode[];
  downstream: ChainNode[];
  openProposals: Proposal[];
}

/**
 * Every shape the single bundled webview can be asked to render, tagged by
 * `type` so `webview-entry.tsx` can dispatch with one switch. Wraps
 * `NodeDetailPayload` rather than folding into it, so hosts/tests that only
 * know about node detail (e.g. `catalyst-host-electron`'s own independent
 * `detail.ts`) are unaffected by the IAM/journal/backlog additions.
 */
export type WebviewPayload =
  | ({ type: "node" } & NodeDetailPayload)
  | { type: "iam-user"; user: IamUser; roles: IamRole[] }
  | { type: "iam-role"; role: IamRole; users: IamUser[] }
  | { type: "journal"; entries: JournalEntry[] }
  | { type: "backlog"; markdown: string };

export type AgentBindingKind = "chat-participant" | "command" | "lm-model";

/**
 * One entry of a `*.catalyst` pointer's optional `chatAgents` array — a
 * VS-Code-specific, additive extension of the pointer format, separate
 * from the pointer's own `agent` field (which names the CLI agent that
 * runs this deployment's terminal-based commands, e.g. `resolveAgentCommand`
 * in `agent-launch.ts`). `chatAgents` instead names chat-participant/
 * command/language-model targets a host UI can route a slash command to.
 */
export interface AgentBinding {
  name: string;
  binding: AgentBindingKind;
  participant?: string;
  command?: string;
}

/**
 * A binding resolved to something a host can actually invoke. Kept as its
 * own type (not folded into `AgentBinding`) so a future `catalyst-host-
 * electron` adapter can consume the exact same resolved shape via a
 * `DirectApiAdapter` implementing the same `invoke()` contract, without
 * depending on `vscode` types at all.
 */
export type ResolvedBinding =
  | { kind: "chat-participant"; participant: string }
  | { kind: "command"; commandId: string }
  | { kind: "lm-model"; vendor?: string; family?: string };

/** One chat-participant extension actually present in this VS Code instance, from a manifest scan — no activation required. */
export interface DetectedAgent {
  extensionId: string;
  participant: string;
  commands: string[];
  active: boolean;
}

/**
 * The full `*.catalyst` pointer file a target project commits at its
 * root — one JSON object naming the agent-owned working copy (INV-6) and,
 * for a "repoed" deployment (`Rules-of-Rules.md` §13), the dedicated repo
 * its `.criterion/` mirrors through. Most consumers only need
 * `agent-source` (see `resolveCorpusRoot`); this is the full shape for
 * anything that needs the repoed-criterion fields too.
 */
export interface CatalystPointer {
  project_name: string;
  agent?: string;
  "agent-source": string;
  repoed?: boolean;
  catalyst_repo?: string;
  catalyst_repo_url?: string;
  criterion_branch?: string;
  created_by?: string;
  created?: string;
  updated?: string;
}
