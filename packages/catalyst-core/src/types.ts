/**
 * The core↔UI message protocol: the typed chain model, validation report,
 * and watcher shapes every later package (both hosts, catalyst-ui itself)
 * consumes. Defined once here, before any host exists — see the roadmap's
 * "Architecture" decision (one protocol, three packages).
 */

export type NodeKind = "work-item" | "artifact" | "row" | "rule" | "domain";

/**
 * One entity type the module declares, as catalyst serves it (`graph`'s
 * `types`). The UI names no type of its own (catalyst roadmap R6.7): what an
 * artifact is, how it is labelled and when it is closed all come from here.
 */
export interface ModuleType {
  prefix: string;
  name: string;
  plural_name: string;
  states: string[];
  initial: string | null;
  closed_states: string[];
  fields: { name: string; kind: string; required: boolean; target_type: string | null }[];
}

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

/** An artifact of one of the module's types, kept as its own file. */
export interface ArtifactNode extends ChainNodeBase {
  kind: "artifact";
  /** Its type's ID prefix (`model.types` has the type). */
  typePrefix: string;
  status: string;
  /** The status is one of its type's closed states. */
  closed: boolean;
  /** Each reference field it fills, and the IDs it cites. */
  links: Record<string, string[]>;
  signedOffBy?: string;
  /** Listed in its type's index. */
  registered: boolean;
  /** Backing .md file exists on disk. */
  fileExists: boolean;
  /** Its `## Description` (or `## Summary`) section, when it has one. */
  description: string;
  /** The backing .md file's complete raw text. */
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

/** An item of a module type kept as rows of a table file (a roadmap's items, say). */
export interface RowNode extends ChainNodeBase {
  kind: "row";
  typePrefix: string;
  /** The file holding the table (its basename). */
  table: string;
  /** The file's header marks it `**Retired:**`. */
  tableRetired: boolean;
  status: string;
  closed: boolean;
  /** Its cells by header, as written. */
  fields: Record<string, string>;
  links: Record<string, string[]>;
  signedOffBy: string;
  description: string;
}

export type ChainNode = WorkItemNode | ArtifactNode | RowNode | RuleNode | DomainNode;

export interface ChainModel {
  nodes: Map<string, ChainNode>;
  /** id -> ids it resolves a reference to (dangling refs excluded). */
  edges: Map<string, Set<string>>;
  /** id -> ids that resolve a reference to it. */
  reverseEdges: Map<string, Set<string>>;
  /** Every definition site seen per id; more than one entry means the id was reused. */
  definitionsById: Map<string, SourceLocation[]>;
  /** The module's types by prefix, when the model came from catalyst. */
  types?: Map<string, ModuleType>;
}

export type IssueSeverity = "error" | "warning";

/** `catalyst`: a finding of `catalyst check` with no older kind of its own (its message says which check). */
export type IssueKind = "orphaned-artifact" | "unbacked-rule" | "id-reuse" | "dangling-reference" | "catalyst";

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

/** A person of the identity provider, as catalyst-users lists them (`users list`). */
export interface DirectoryUser {
  username: string;
  name: string;
  email: string | null;
  enabled: boolean;
}

/** A realm role of the identity provider (`roles list`). */
export interface DirectoryRole {
  name: string;
  description: string;
}

/** A group of the identity provider, named by its full path, with the realm roles granted to it (`groups list`). */
export interface DirectoryGroup {
  path: string;
  roles: string[];
}

/** How something is held (catalyst-users' `id-DIR-000008`): directly, and through which groups. */
export interface Holding {
  direct: boolean;
  groups: string[];
}

/** Which kind of directory entry a document or a link names. */
export type DirectoryKind = "user" | "role" | "group";

export type JournalAction = "create" | "update" | "close" | "retire" | "status-change" | "sync";

export interface JournalFileChange {
  path: string;
  before: string | null;
  after: string;
}

/** One append-only line of the journal (`development/journal/` shards, legacy `development/journal.jsonl`; `rr-META-012`) — transaction-log-grade, not prose. */
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
  /** The journal, oldest first, as catalyst serves it. */
  journal: JournalEntry[];
  users: IamUser[];
  roles: IamRole[];
  /** The deployed definitions as catalyst serves them (catalyst >= 0.88.0; none before). */
  definitions: EntityDefinition[];
}

/** One deployed definition (`definitions/<slug>.md`): what a type or a kernel record is, in a sentence or two. */
export interface EntityDefinition {
  slug: string;
  version: string | null;
  description: string;
}

/**
 * The extension-host <-> webview message payload for one node's detail
 * view: its own fields plus what it's justified by (upstream) and what
 * it produces (downstream), resolved from the chain model's edges.
 */
export interface NodeDetailPayload {
  node: ChainNode;
  upstream: ChainNode[];
  downstream: ChainNode[];
}

export interface KernelVersionInfo {
  version: string | null;
  requiredVersion: string;
  meetsRequirement: boolean;
  explanation?: string;
}

/**
 * Every shape the single bundled webview can be asked to render, tagged by
 * `type` so `webview-entry.tsx` can dispatch with one switch. Wraps
 * `NodeDetailPayload` rather than folding into it, so hosts/tests that only
 * know about node detail (e.g. `catalyst-host-electron`'s own independent
 * `detail.ts`) are unaffected by the IAM/journal/backlog additions.
 */
/**
 * One entity a panel's text cites (`REQ-000014-UVqkd7cL`): what a link to it
 * shows on hover. Keyed by the token as it appears in the text — the full
 * ID, or an unambiguous short form (`REQ-000014`) — so `id` is always the
 * full ID to open.
 */
export interface ReferenceInfo {
  id: string;
  kind: NodeKind;
  name: string;
  summary: string;
}

export type WebviewPayload = {
  kernelVersionInfo?: KernelVersionInfo;
  /** The entities the panel's text cites, by the token that cites them. */
  references?: Record<string, ReferenceInfo>;
} & (
  | ({ type: "node" } & NodeDetailPayload)
  | {
      type: "directory-user";
      user: DirectoryUser;
      roles: ({ name: string } & Holding)[];
      groups: string[];
    }
  | { type: "directory-role"; role: DirectoryRole; groups: string[]; users: ({ username: string } & Holding)[] }
  | { type: "directory-group"; group: DirectoryGroup; members: string[] }
  | { type: "journal"; entries: JournalEntry[] }
  | { type: "backlog"; markdown: string }
);

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
 * root — one JSON object declaring the deployment and, for a "repoed"
 * deployment (`Rules-of-Rules.md` §13), the dedicated repo its
 * `.criterion/` mirrors through. Since kernel 0.37.0 it carries no path:
 * the working copy is reached through the project's gitignored
 * `.criterion` (see `resolveCorpusRoot`).
 */
export interface CatalystPointer {
  project_name: string;
  agent?: string;
  /**
   * @deprecated Legacy (pre-0.37.0): an absolute, machine-specific path to
   * the agent-owned working copy. Read only as a `resolveCorpusRoot`
   * fallback for not-yet-migrated deployments; never written.
   */
  "agent-source"?: string;
  /** The deployment's catalyst kernel version, if declared. */
  kernel_version?: string;
  /** The active process module's id (MODULE-SPECIFICATION), if declared. */
  module?: string;
  repoed?: boolean;
  catalyst_repo?: string;
  catalyst_repo_url?: string;
  criterion_branch?: string;
  created_by?: string;
  created?: string;
  updated?: string;
}
