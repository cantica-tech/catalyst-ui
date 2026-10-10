import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";

import { parseIamRoles, parseIamUsers } from "./iam.js";
import { buildShortFormIndex, resolveIdReference } from "./ids.js";
import { sectionLines } from "./markdown.js";
import { parseProposals } from "./proposals.js";
import { parseRuns } from "./runs.js";
import type {
  ChainModel,
  ChainNode,
  DevArtifactType,
  IssueKind,
  RoadmapStatus,
  SourceLocation,
  StepStatus,
  ValidationIssue,
  ValidationReport,
  WatchUpdate,
} from "./types.js";
import { coerceJournal } from "./journal.js";

/**
 * The chain model and its validation, read through catalyst (REQ-000019)
 * instead of this package's parser: `catalyst serve --local` answers
 * `graph` and `check` for the project, and its `events` say when to read
 * again. The hosts keep consuming `ChainModel` and `ValidationReport`;
 * `watchProject` falls back to the old watcher when catalyst cannot serve
 * (missing, or a kernel before `graph` and `serve --local`).
 */

/** A running watch: `refresh` reads again at once, `close` stops it. */
export interface WatcherHandle {
  close(): Promise<void>;
  refresh(): void;
}

/** The catalyst release this package reads through: `graph` and `serve --local` arrived in 0.54.0. */
export const CATALYST_SERVE_FLOOR = "0.54.0";

/** What `catalyst graph --json` prints (kernel `views.graph`). */
export interface CatalystGraph {
  rules: {
    id: string;
    title: string;
    status: string;
    file: string;
    line: number;
    retired: boolean;
    domain: string | null;
    mentions: string[];
  }[];
  domains: { code: string; file: string | null; title: string }[];
  artifacts: ({
    id: string;
    type: string;
    title?: string;
    file: string;
    line?: number;
    row?: boolean;
    fields?: Record<string, string>;
    links: Record<string, string[]>;
    mentions: string[];
  } & Record<string, unknown>)[];
  types: Record<string, { name: string; closed_states: string[] }>;
}

/** What `catalyst check --json` prints. */
export interface CatalystCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// The software-engineering module's types, as this package has always drawn them.
const DEV_ARTIFACT: Partial<Record<string, DevArtifactType>> = {
  BUG: "bug",
  REQ: "requirement",
  HK: "house-keeping",
  TEST: "test",
};
const ROADMAP_STATUSES = new Set<string>(["Not triaged", "Triaged", "In progress", "Done"]);
const STEP_STATUSES = new Set<string>(["planned", "in-progress", "done", "abandoned"]);
const RETIRED_HEADER_RE = /^\*\*Retired:\*\*/m;

function readText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function plain(value: unknown): string {
  return typeof value === "string" ? value.replace(/`/g, "").trim() : "";
}

function first(links: Partial<Record<string, string[]>>, ...names: string[]): string | undefined {
  for (const name of names) {
    const v = links[name]?.[0];
    if (v) return v;
  }
  return undefined;
}

function adder(map: Map<string, Set<string>>, key: string, value: string): void {
  const set = map.get(key);
  if (set) set.add(value);
  else map.set(key, new Set([value]));
}

/** `value`, unless it is missing or empty (catalyst writes "" for a field it found blank). */
const or = (value: string | undefined, fallback: string): string =>
  value !== undefined && value !== "" ? value : fallback;

/** A heading rule's own text: its line to the next heading of the same or a higher level. */
function ruleSection(text: string, line: number): string {
  const lines = text.split("\n");
  const start = Math.max(line - 1, 0);
  const level = /^(#+)/.exec(lines[start] ?? "")?.[1].length ?? 0;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const depth = /^(#+) /.exec(lines[i])?.[1].length ?? 0;
    if (depth > 0 && depth <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** `catalyst graph` as the hosts' `ChainModel`: nodes by kind as this package draws them, edges from field links, mentions and each rule's domain. */
export function modelFromGraph(graph: CatalystGraph, criterionRoot: string): ChainModel {
  const nodes = new Map<string, ChainNode>();
  const definitionsById = new Map<string, SourceLocation[]>();
  const add = (node: ChainNode) => {
    definitionsById.set(node.id, [...(definitionsById.get(node.id) ?? []), node.location]);
    if (!nodes.has(node.id)) nodes.set(node.id, node);
  };
  const at = (file: string, line = 1): SourceLocation => ({ file: join(criterionRoot, file), line });

  for (const d of graph.domains) {
    const content = d.file ? readText(join(criterionRoot, d.file)) : "";
    add({
      id: d.code,
      kind: "domain",
      title: or(d.title, d.code),
      name: d.code,
      location: at(d.file ?? "rules/domains/domains.md"),
      references: [],
      code: d.code,
      hasDoc: d.file !== null,
      description: d.title,
      content,
    });
  }

  for (const r of graph.rules) {
    const text = readText(join(criterionRoot, r.file));
    add({
      id: r.id,
      kind: "rule",
      title: or(r.title, r.id),
      name: or(r.title, r.id),
      location: at(r.file, r.line),
      references: r.mentions,
      docPrefix: r.id.split("-")[0],
      domain: r.domain ?? "",
      // A rule with no status line reads as working, as this package always showed it.
      status: or(r.status, r.retired ? "🗑 retired" : "✅ working"),
      registeredInRulesIndex: true,
      description: basename(r.file).startsWith(r.id) ? text : ruleSection(text, r.line),
    });
  }

  for (const a of graph.artifacts) {
    const fields: Partial<Record<string, string>> = (a.row ? a.fields : undefined) ?? {};
    const links: Partial<Record<string, string[]>> = a.links;
    const status = plain(a.row ? fields.Status : a.Status);
    const signedText = plain(a.row ? fields["Signed-off-by"] : a["Signed-off-by"]);
    const signed = signedText ? signedText : undefined;
    if (a.row) {
      const file = join(criterionRoot, a.file);
      const title = or(plain(fields.Title), a.id);
      add({
        id: a.id,
        kind: "roadmap",
        title,
        name: title,
        location: at(a.file, a.line ?? 1),
        references: a.mentions,
        roadmapName: basename(a.file, ".md"),
        roadmapRetired: RETIRED_HEADER_RE.test(readText(file)),
        description: plain(fields.Description),
        status: (ROADMAP_STATUSES.has(status) ? status : "Not triaged") as RoadmapStatus,
        linked: a.mentions.find((m) => (fields.Linked ?? "").includes(m)),
        signedOffBy: signed ?? "",
        notes: plain(fields.Notes),
      });
      continue;
    }
    const content = readText(join(criterionRoot, a.file));
    const base = {
      id: a.id,
      title: or(a.title, a.id),
      name: or(a.title, a.id),
      location: at(a.file),
      references: a.mentions,
    };
    const description = (heading: string) => sectionLines(content, heading).join(" ");
    const devType = DEV_ARTIFACT[a.type];
    if (devType) {
      add({
        ...base,
        kind: "dev-artifact",
        artifactType: devType,
        status,
        targets: links.Targets ?? [],
        feature: first(links, "Feature"),
        requirements: devType === "test" ? (links.Requirements ?? []) : undefined,
        steps: devType === "test" ? (links.Steps ?? []) : undefined,
        signedOffBy: signed,
        registered: true,
        fileExists: true,
        description: description(devType === "requirement" ? "Summary" : "Description"),
        content,
      });
    } else if (a.type === "FEAT") {
      add({
        ...base,
        kind: "feature",
        status,
        signedOffBy: signed,
        registered: true,
        fileExists: true,
        description: or(description("Description"), description("Summary")),
        content,
      });
    } else if (a.type === "STEP") {
      add({
        ...base,
        kind: "step",
        parent: first(links, "Parent", "Requirement") ?? "",
        status: (STEP_STATUSES.has(status) ? status : "planned") as StepStatus,
        signedOffBy: signed,
        registered: true,
        fileExists: true,
        description: description("Description"),
        content,
      });
    } else {
      add({ ...base, kind: "work-item" });
    }
  }

  const edges = new Map<string, Set<string>>();
  const reverseEdges = new Map<string, Set<string>>();
  const short = buildShortFormIndex(nodes.keys());
  const link = (from: string, ref: string) => {
    const to = resolveIdReference(nodes, ref, short);
    if (!to || to === from) return;
    adder(edges, from, to);
    adder(reverseEdges, to, from);
  };
  for (const r of graph.rules) {
    if (r.domain) link(r.id, r.domain);
    for (const m of r.mentions) link(r.id, m);
  }
  for (const a of graph.artifacts) {
    for (const cited of Object.values(a.links)) for (const ref of cited) link(a.id, ref);
    for (const m of a.mentions) link(a.id, m);
  }
  return { nodes, edges, reverseEdges, definitionsById };
}

const KINDS: Record<string, IssueKind> = {
  "dangling-ref": "dangling-reference",
  ungrounded: "orphaned-artifact",
  "duplicate-id": "id-reuse",
};

/**
 * `catalyst check` as the hosts' `ValidationReport`: every error and
 * warning, located at the file it names and, when one node is defined in
 * that file, naming it (so "Propose fix" can target it).
 */
export function reportFromCheck(check: CatalystCheck, criterionRoot: string, model: ChainModel): ValidationReport {
  const byFile = new Map<string, string | null>();
  for (const node of model.nodes.values()) {
    const file = node.location.file;
    byFile.set(file, byFile.has(file) ? null : node.id); // a file of many nodes names none
  }
  const issue = (message: string, severity: "error" | "warning"): ValidationIssue => {
    const code = /^\S+\s+([a-z][a-z-]*):/.exec(message)?.[1] ?? "";
    const path = /(?:^|\s)\.criterion\/([^\s:]+\.(?:md|json|ya?ml|txt|jsonl))(?::(\d+))?/.exec(message);
    const file = path ? join(criterionRoot, path[1]) : undefined;
    return {
      kind: KINDS[code] ?? "catalyst",
      severity,
      nodeId: file ? (byFile.get(file) ?? undefined) : undefined,
      message,
      location: file && path ? { file, line: path[2] ? Number(path[2]) : 1 } : undefined,
    };
  };
  const issues = [...check.errors.map((m) => issue(m, "error")), ...check.warnings.map((m) => issue(m, "warning"))];
  return {
    issues,
    nodeCount: model.nodes.size,
    errorCount: check.errors.length,
    warningCount: check.warnings.length,
    durationMs: 0,
  };
}

/**
 * The `catalyst` command: `$CATALYST_BIN` (words), else catalyst's own
 * launcher (`$CATALYST_HOME/bin/catalyst`, by default under `~/.catalyst`;
 * an editor's environment often lacks the shell's PATH), else `catalyst` on
 * PATH.
 */
export function catalystCommand(): string[] {
  const bin = process.env.CATALYST_BIN;
  if (bin) return bin.split(" ").filter(Boolean);
  const home = process.env.CATALYST_HOME ?? join(homedir(), ".catalyst");
  const launcher = join(home, "bin", process.platform === "win32" ? "catalyst.cmd" : "catalyst");
  return [existsSync(launcher) ? launcher : "catalyst"];
}

export interface CatalystServer {
  url: string;
  token: string;
  child: ChildProcess;
}

/** Start `catalyst serve --local` for `project` and read the URL and token it prints. */
export function startLocalServe(
  project: string,
  command = catalystCommand(),
  timeoutMs = 15000,
): Promise<CatalystServer> {
  return new Promise((resolve, reject) => {
    const [cmd, ...pre] = command;
    const child = spawn(cmd, [...pre, "serve", "--local", "--project", project], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const fail = (why: string) => {
      clearTimeout(timer);
      child.kill();
      reject(new Error(`catalyst serve --local: ${why}${stderr ? `: ${stderr.trim()}` : ""}`));
    };
    const timer = setTimeout(() => {
      fail("no answer");
    }, timeoutMs);
    child.on("error", (e) => {
      fail(e.message);
    });
    child.on("exit", (code) => {
      fail(`exited with ${String(code)}`);
    });
    createInterface({ input: child.stdout }).once("line", (line) => {
      clearTimeout(timer);
      child.removeAllListeners("exit");
      try {
        const hello = JSON.parse(line) as { url: string; token: string };
        resolve({ url: hello.url, token: hello.token, child });
      } catch {
        fail(`printed no address (${line.slice(0, 80)})`);
      }
    });
  });
}

async function getJson(server: CatalystServer, path: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${server.url}/v1${path}`, { headers: { Authorization: `Bearer ${server.token}` }, signal });
  if (!res.ok) throw new Error(`catalyst serve ${path}: ${res.status}`);
  return res.json();
}

/** Read the model and report once (also what `watchCatalyst` delivers). */
export async function readThroughCatalyst(
  server: CatalystServer,
  criterionRoot: string,
  signal?: AbortSignal,
): Promise<WatchUpdate> {
  const [graph, check, journal] = await Promise.all([
    getJson(server, "/graph", signal),
    getJson(server, "/check", signal),
    getJson(server, "/journal", signal),
  ]);
  const model = modelFromGraph(graph as CatalystGraph, criterionRoot);
  return {
    model,
    report: reportFromCheck(check as CatalystCheck, criterionRoot, model),
    journal: coerceJournal(journal),
    proposals: parseProposals(criterionRoot),
    runs: parseRuns(criterionRoot),
    users: parseIamUsers(criterionRoot),
    roles: parseIamRoles(criterionRoot),
  };
}

/**
 * Follow a project through `catalyst serve --local`: an update on start and
 * after each change catalyst reports. Rejects when catalyst cannot serve.
 */
export async function watchCatalyst(
  project: string,
  criterionRoot: string,
  onUpdate: (update: WatchUpdate) => void,
  command = catalystCommand(),
): Promise<WatcherHandle> {
  const server = await startLocalServe(project, command);
  const abort = new AbortController();
  // `again`: a change landed while reading; read once more when done.
  const state = { running: false, again: false };
  const changedMeanwhile = () => state.again; // read after the await, where it may have been set
  const update = async () => {
    if (state.running) {
      state.again = true;
      return;
    }
    state.running = true;
    try {
      do {
        state.again = false;
        onUpdate(await readThroughCatalyst(server, criterionRoot, abort.signal));
      } while (changedMeanwhile() && !abort.signal.aborted);
    } catch {
      // the next event retries; a closed watcher stops here
    } finally {
      state.running = false;
    }
  };
  const follow = async () => {
    try {
      const res = await fetch(`${server.url}/v1/events`, {
        headers: { Authorization: `Bearer ${server.token}` },
        signal: abort.signal,
      });
      if (!res.body) return;
      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk as Uint8Array, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.startsWith("data:")) void update();
        }
      }
    } catch {
      // closed, or the server stopped
    }
  };
  void follow();
  return {
    close() {
      abort.abort();
      server.child.kill();
      return Promise.resolve();
    },
    refresh() {
      void update();
    },
  };
}

/**
 * The hosts' watcher: the project through catalyst. When catalyst cannot
 * serve it (not installed, or older than `CATALYST_SERVE_FLOOR`),
 * `onUnavailable` says why and how to fix it, and `refresh` tries again.
 * Returns at once; `log` says what runs.
 */
export function watchProject(
  project: string,
  criterionRoot: string,
  onUpdate: (update: WatchUpdate) => void,
  log: (message: string) => void = () => undefined,
  onUnavailable: (reason: string) => void = () => undefined,
): WatcherHandle {
  let inner: WatcherHandle | undefined;
  let starting = false;
  let closed = false;
  const start = () => {
    if (starting || closed) return;
    starting = true;
    const begun = existsSync(project)
      ? watchCatalyst(project, criterionRoot, onUpdate)
      : Promise.reject(new Error(`${project} does not exist`));
    begun.then(
      (handle) => {
        starting = false;
        if (closed) void handle.close();
        else {
          inner = handle;
          log(`reading ${criterionRoot} through catalyst serve`);
        }
      },
      (err: unknown) => {
        starting = false;
        if (closed) return;
        const reason =
          `catalyst cannot serve ${project}: ${err instanceof Error ? err.message : String(err)}. ` +
          `It needs catalyst ${CATALYST_SERVE_FLOOR} or later: run \`catalyst open\` in the project, then refresh.`;
        log(reason);
        onUnavailable(reason);
      },
    );
  };
  start();
  return {
    async close() {
      closed = true;
      await inner?.close();
    },
    refresh() {
      if (inner) inner.refresh();
      else start();
    },
  };
}
