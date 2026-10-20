/**
 * The Studio's only way to catalyst (studio-SHELL-000001): the HTTP API of
 * `catalyst serve --local`, with the run's token as a bearer. Nothing here
 * writes; nothing reads a file.
 */

import type {
  AnalysesSummaryJson,
  AnalysisJson,
  ApprovalsJson,
  AuditJson,
  BacklogJson,
  CheckJson,
  CommandSpecJson,
  CommandsCommandJson,
  CommandsPartJson,
  GraphJson,
  GraphTypeJson,
  HistoryChangeJson,
  HistoryJson,
  ImpactJson,
  ImpactReachedJson,
  InboxItemJson,
  InboxJson,
  JournalJson,
  ListRoleJson,
  ListUserJson,
  ModuleListJson,
  ModuleReleasesJson,
  RunsJson,
  ShareStatusJson,
  Since,
  SyncPlanJson,
  ViewArtifactJson,
} from "catalyst-core";

export interface Connection {
  /** The server's origin, e.g. `http://127.0.0.1:52011`. */
  url: string;
  token: string;
}

/*
 * What each route returns is what catalyst's `spec/` describes (R6.50): the types below are the ones
 * generated from it in catalyst-core, named for the Studio. A field an older catalyst (down to the
 * Studio's floor) lacks is made optional with `Since`, its version noted; nothing else is written here.
 */
type El<T> = T extends readonly (infer E)[] ? E : never;

/** One error or warning of `check`, with the entity it is about (catalyst >= 0.78.0). */
export type Finding = El<CheckJson["findings"]>;

/** `GET /v1/check`: `catalyst check --json`. `findings` since catalyst 0.78.0. */
export type CheckReport = Since<CheckJson, "findings">;

/** One file an unrecorded commit changed: its content hash before and after (null when absent). */
export type ChangedFile = El<NonNullable<Evidence["files"]>>;

/** What catalyst shows for an item, by kind (`spec/inbox.schema.json`). */
export type Evidence = InboxItemJson["evidence"];

/**
 * One thing waiting for a person: its evidence, and the commands that settle it (a person chooses). A
 * newer catalyst may add a kind: the Studio shows it with its title and commands.
 */
export type InboxItem = Omit<InboxItemJson, "kind"> & { kind: InboxItemJson["kind"] | (string & {}) };

/** `GET /v1/inbox`: what waits for a person, counted by kind (a newer catalyst's kinds too). */
export interface InboxReport {
  items: InboxItem[];
  counts: Partial<InboxJson["counts"]> & Record<string, number>;
}

/** `GET /v1/backlog`: open work by type and status, and what it lacks. `coverage` since catalyst 0.78.0. */
export type Backlog = Since<BacklogJson, "coverage">;

/** One logged agent run, as `catalyst agent runs --json` gives it (catalyst >= 0.78.0). */
export type RunRecord = El<RunsJson>;

/** `GET /v1/head` (local): the change counter, and what the deployment runs (catalyst >= 0.74.0). */
export interface Head {
  seq: number;
  files: number;
  kernel?: string | null;
  /** The project's name (catalyst >= 0.86.0). */
  project?: string | null;
  modules?: { id: string; version: string }[];
  catalyst?: string;
}

/** One journal entry, as the journal holds it. */
export type JournalEntry = El<JournalJson>;

/** One entry that changed an entity's file, with the file before and after. */
export type HistoryEntry = HistoryChangeJson;

/** `GET /v1/history/<id>`: every change to an entity's file, in the journal's order (catalyst >= 0.62.0). */
export type History = HistoryJson;

/** One approval gate covering an entity, counted for its current version (catalyst >= 0.80.0). */
export type ApprovalGate = El<ApprovalsJson["gates"]>;

/** `GET /v1/approvals/<id>`: `catalyst approvals <id> --json` (catalyst >= 0.80.0). */
export type ApprovalsReport = ApprovalsJson;

/** One entity type as the module declares it (`graph.types[prefix]`); an older catalyst gives no transitions, guards or sections. */
export type EntityType = Since<GraphTypeJson, "transitions" | "guards" | "sections">;

/** One artifact in `graph`, or one row of a type kept as table rows. */
export type GraphArtifact = El<GraphJson["artifacts"]>;

/** One rule in `graph`: its title, its status line, its domain and the entities its text names. */
export type GraphRule = El<GraphJson["rules"]>;

/** One registered domain: its code, its file and that file's title. */
export type GraphDomain = El<GraphJson["domains"]>;

/** `GET /v1/graph`: the chain, and the module's types. */
export type Graph = Omit<GraphJson, "types"> & { types: Record<string, EntityType> };

/** `GET /v1/view/<id>` for an artifact (catalyst >= 0.73.0); an older catalyst gives no sections or next states. */
export type EntityView = Since<ViewArtifactJson, "sections" | "next">;

/** A proposal case's change, as `view` gives it (catalyst >= 0.81.0). */
export type ProposalView = NonNullable<EntityView["proposal"]>;

/** One analysis in brief (`GET /v1/analyses`, catalyst >= 0.85.0). */
export type AnalysisSummary = AnalysesSummaryJson;

/** One reconciled finding, as `ANALYSIS-PLAYBOOK.md` gives it, with its decision. */
export type AnalysisFinding = El<AnalysisJson["items"]>;

/** A person's decision on one reconciled finding. */
export type FindingDecision = NonNullable<AnalysisFinding["decision"]>;

/** `GET /v1/analyses/<id>`: one analysis in full (catalyst >= 0.85.0). */
export type AnalysisReport = AnalysisJson;

/** One installed module as its record and tree agree (`GET /v1/modules`, local mode, catalyst >= 0.86.0). */
export type InstalledModule = El<ModuleListJson>;

/** One role as IAM holds it (`GET /v1/list?type=role`). */
export type Role = ListRoleJson;

/** The criterion's sharing state (`GET /v1/share`, local mode, catalyst >= 0.90.0). */
export type ShareStatus = ShareStatusJson;

/** A module's releases at its recorded repository (`GET /v1/modules/<id>/available`). */
export type ModuleReleases = ModuleReleasesJson;

/** What upgrading a module to a release would change (`GET /v1/modules/<id>/plan?to=<tag>`): a sync plan, for one module. */
export type ModulePlan = SyncPlanJson & { id: string; to: string };

/** `GET /v1/audit` (local mode, catalyst >= 0.87.0): the audit pack. */
export type AuditPack = AuditJson;

/** One link of a rule's chain in the audit pack: an entity resting on it, how far, and what brought it in. */
export type AuditLink = El<El<AuditJson["rules"]>["chain"]>;

/** One entity `impact` reached: how far, and the link that reached it. */
export type Reached = ImpactReachedJson;

/** `GET /v1/impact/<id>`: what an entity rests on and what rests on it, transitively. */
export type Impact = ImpactJson;

/** One registered user, as `catalyst list users --json` gives them. */
export type User = ListUserJson;

/** One part of a command with parts (`/create bug`): read on its own. */
export type CommandPart = CommandsPartJson;

/** One command of the deployment, as `GET /v1/commands` gives it (catalyst >= 0.75.0). */
export type Command = CommandsCommandJson;

/** `GET /v1/spec/<command>[/<part>]`: the text `catalyst spec` prints for it. */
export type CommandSpec = CommandSpecJson;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

/**
 * Where the page finds its connection: a host that mounts the bundle hands
 * it over (`window.catalystStudio`); under `catalyst serve --static` it is
 * the page's own origin and the `#token=…` fragment. The fragment is then
 * cleared from the address bar, so a copied URL carries no token.
 */
export function connectionFromPage(win: Window = window): Connection | null {
  const handed = (win as Window & { catalystStudio?: Partial<Connection> }).catalystStudio;
  if (handed?.url && handed.token) return { url: handed.url, token: handed.token };
  const token = new URLSearchParams(win.location.hash.slice(1)).get("token");
  if (!token) return null;
  win.history.replaceState(null, "", win.location.pathname + win.location.search);
  return { url: win.location.origin, token };
}

export class StudioClient {
  constructor(
    private readonly connection: Connection,
    private readonly fetcher: Fetch = (...args) => fetch(...args),
  ) {}

  async get<T>(route: string): Promise<T> {
    const response = await this.fetcher(`${this.connection.url}/v1/${route}`, {
      headers: { Authorization: `Bearer ${this.connection.token}` },
    });
    if (!response.ok)
      throw new ApiError(response.status, `${route}: ${String(response.status)} ${response.statusText}`);
    return (await response.json()) as T;
  }

  check(): Promise<CheckReport> {
    return this.get<CheckReport>("check");
  }

  inbox(): Promise<InboxReport> {
    return this.get<InboxReport>("inbox");
  }

  head(): Promise<Head> {
    return this.get<Head>("head");
  }

  backlog(): Promise<Backlog> {
    return this.get<Backlog>("backlog");
  }

  /** The journal entries since `since` (an ISO date or time), oldest first. */
  journal(since?: string): Promise<JournalEntry[]> {
    return this.get<JournalEntry[]>(since ? `journal?since=${encodeURIComponent(since)}` : "journal");
  }

  graph(): Promise<Graph> {
    return this.get<Graph>("graph");
  }

  impact(id: string): Promise<Impact> {
    return this.get<Impact>(`impact/${encodeURIComponent(id)}`);
  }

  view(id: string): Promise<EntityView> {
    return this.get<EntityView>(`view/${encodeURIComponent(id)}`);
  }

  history(id: string): Promise<History> {
    return this.get<History>(`history/${encodeURIComponent(id)}`);
  }

  /** The gates covering an entity and what each lacks (catalyst >= 0.80.0). */
  approvals(id: string): Promise<ApprovalsReport> {
    return this.get<ApprovalsReport>(`approvals/${encodeURIComponent(id)}`);
  }

  /** Every analysis in brief, newest first (catalyst >= 0.85.0). */
  async analyses(): Promise<AnalysisSummary[]> {
    return (await this.get<{ analyses: AnalysisSummary[] }>("analyses")).analyses;
  }

  /** One analysis in full: its passes, diff, findings and their decisions (catalyst >= 0.85.0). */
  analysis(id: string): Promise<AnalysisReport> {
    return this.get<AnalysisReport>(`analyses/${encodeURIComponent(id)}`);
  }

  /** The audit pack: each rule's chain and the record's integrity (local mode, catalyst >= 0.87.0). */
  audit(): Promise<AuditPack> {
    return this.get<AuditPack>("audit");
  }

  /** The installed modules (local mode, catalyst >= 0.86.0). */
  async modules(): Promise<InstalledModule[]> {
    return (await this.get<{ modules: InstalledModule[] }>("modules")).modules;
  }

  /** A module's releases at its repository: the network, local mode (catalyst >= 0.86.0). */
  moduleReleases(id: string): Promise<ModuleReleases> {
    return this.get<ModuleReleases>(`modules/${encodeURIComponent(id)}/available`);
  }

  /** What upgrading a module to one of its releases would change, written nowhere (catalyst >= 0.86.0). */
  modulePlan(id: string, tag: string): Promise<ModulePlan> {
    return this.get<ModulePlan>(`modules/${encodeURIComponent(id)}/plan?to=${encodeURIComponent(tag)}`);
  }

  /** Where the criterion is shared and what is not published yet; `fetch` asks the shared copy first (catalyst >= 0.90.0). */
  share(fetch = false): Promise<ShareStatus> {
    return this.get<ShareStatus>(fetch ? "share?fetch=1" : "share");
  }

  /** The roles (`GET /v1/list?type=role`). */
  roles(): Promise<Role[]> {
    return this.get<Role[]>("list?type=role");
  }

  /** The registered users (`GET /v1/list?type=users`). */
  users(): Promise<User[]> {
    return this.get<User[]>("list?type=users");
  }

  /** This user's logged agent runs for the project, oldest first (catalyst >= 0.78.0, local mode). */
  async runs(): Promise<RunRecord[]> {
    return (await this.get<{ runs: RunRecord[] }>("runs")).runs;
  }

  /** The deployment's commands (catalyst >= 0.75.0). */
  async commands(): Promise<Command[]> {
    return (await this.get<{ commands: Command[] }>("commands")).commands;
  }

  /** One command's procedure, or one part's (catalyst >= 0.75.0). */
  spec(command: string, part?: string): Promise<CommandSpec> {
    const route = `spec/${encodeURIComponent(command)}` + (part ? `/${encodeURIComponent(part)}` : "");
    return this.get<CommandSpec>(route);
  }

  /**
   * Follows `/v1/events` (server-sent events: `event: batch`, `data: <n>`)
   * and calls `onBatch` with each batch. Read through `fetch`, since an
   * `EventSource` cannot send the bearer. Resolves when the stream ends or
   * `signal` aborts.
   */
  async events(onBatch: (batch: number) => void, signal?: AbortSignal): Promise<void> {
    const response = await this.fetcher(`${this.connection.url}/v1/events`, {
      headers: { Authorization: `Bearer ${this.connection.token}`, Accept: "text/event-stream" },
      signal,
    });
    if (!response.ok || !response.body) throw new ApiError(response.status, `events: ${String(response.status)}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let end = buffer.indexOf("\n\n");
      while (end >= 0) {
        const batch = parseBatch(buffer.slice(0, end));
        if (batch !== null) onBatch(batch);
        buffer = buffer.slice(end + 2);
        end = buffer.indexOf("\n\n");
      }
    }
  }
}

/** The batch number of one server-sent event, or null when it is not a batch. */
export function parseBatch(event: string): number | null {
  const lines = event.split("\n");
  if (!lines.includes("event: batch")) return null;
  const data = lines.find((l) => l.startsWith("data: "));
  const n = data ? Number(data.slice(6)) : NaN;
  return Number.isInteger(n) ? n : null;
}
