import {
  ActionError,
  actionArgs,
  COMMAND_NAME,
  describeAction,
  tryArgs,
  type ActionResult,
  type AgentRun,
  type RunEvent,
} from "catalyst-core";

/** What the Studio asks of its host (studio-SHELL-000015). */
export type StudioMessage =
  | { catalyst: "studio"; type: "hello" }
  | { catalyst: "studio"; type: "run"; id: string; command: string; arguments: string }
  | { catalyst: "studio"; type: "cancel"; id: string }
  | { catalyst: "studio"; type: "action"; id: string; action: unknown }
  | { catalyst: "studio"; type: "batch"; id: string; actions: unknown }
  | { catalyst: "studio"; type: "try"; id: string; action: unknown };

/** What the host tells the Studio. */
export type HostMessage =
  | { catalyst: "host"; type: "hello"; runs: boolean; actions: boolean; tries?: boolean; agent?: string }
  | { catalyst: "host"; type: "run-event"; id: string; event: RunEvent }
  | { catalyst: "host"; type: "run-declined"; id: string }
  | { catalyst: "host"; type: "try-result"; id: string; ok: boolean; output: string; error: string }
  | {
      catalyst: "host";
      type: "action-result";
      id: string;
      ok: boolean;
      output: string;
      error: string;
      declined?: boolean;
    }
  | {
      catalyst: "host";
      type: "batch-result";
      id: string;
      results: ActionResult[];
      error: string;
      declined?: boolean;
    };

/** The most actions one batch may hold: one dialog has to stay readable. */
export const BATCH_LIMIT = 50;

export interface RunDeps {
  /** Asks the person, in the host's own dialog; true only on an explicit yes. */
  confirm: (question: string) => Promise<boolean>;
  start: (command: string, args: string, onEvent: (event: RunEvent) => void) => AgentRun;
  post: (message: HostMessage) => void;
  /** Runs `catalyst <args>` from the project (studio-SHELL-000016); absent: the host offers no action. */
  act?: (args: string[]) => Promise<ActionResult>;
  agent?: string;
}

/**
 * The host's side of the console: one per panel. Each run is confirmed by
 * the person first; the runs still going are stopped with `dispose`.
 */
export class StudioRuns {
  private readonly runs = new Map<string, AgentRun>();

  constructor(private readonly deps: RunDeps) {}

  async handle(message: unknown): Promise<void> {
    if (!message || typeof message !== "object") return;
    const m = message as Partial<StudioMessage> & Record<string, unknown>;
    if (m.catalyst !== "studio") return;
    if (m.type === "hello") {
      this.deps.post({
        catalyst: "host",
        type: "hello",
        runs: true,
        actions: this.deps.act !== undefined,
        tries: this.deps.act !== undefined,
        ...(this.deps.agent ? { agent: this.deps.agent } : {}),
      });
      return;
    }
    if (m.type === "cancel" && typeof m.id === "string") {
      this.runs.get(m.id)?.cancel();
      return;
    }
    if (m.type === "batch" && typeof m.id === "string") {
      await this.batch(m.id, m.actions);
      return;
    }
    if (m.type === "action" && typeof m.id === "string") {
      await this.action(m.id, m.action);
      return;
    }
    if (m.type === "try" && typeof m.id === "string") {
      await this.tryAction(m.id, m.action);
      return;
    }
    if (m.type !== "run" || typeof m.id !== "string" || typeof m.command !== "string") return;
    const id = m.id;
    const command = m.command;
    const args = typeof m.arguments === "string" ? m.arguments.trim() : "";
    if (!COMMAND_NAME.test(command) || this.runs.has(id)) return;
    const asked = `Run /${command}${args ? ` ${args}` : ""} with ${this.deps.agent ?? "your agent"}? It works in this project under your agent's own settings, and uses tokens.`;
    if (!(await this.deps.confirm(asked))) {
      this.deps.post({ catalyst: "host", type: "run-declined", id });
      return;
    }
    const run = this.deps.start(command, args, (event) => {
      this.deps.post({ catalyst: "host", type: "run-event", id, event });
    });
    this.runs.set(id, run);
    void run.done.finally(() => this.runs.delete(id));
  }

  /**
   * One action (studio-SHELL-000016): checked field by field, shown to the
   * person as the exact command, run only on their yes, its result returned.
   */
  private async action(id: string, action: unknown): Promise<void> {
    if (!this.deps.act) return;
    const reply = (ok: boolean, output: string, error: string, declined = false) => {
      this.deps.post({
        catalyst: "host",
        type: "action-result",
        id,
        ok,
        output,
        error,
        ...(declined ? { declined } : {}),
      });
    };
    let args: string[];
    try {
      args = actionArgs(action);
    } catch (err) {
      reply(false, "", err instanceof ActionError ? `Not done: ${err.message}` : String(err));
      return;
    }
    if (!(await this.deps.confirm(`Run this in the project?\n\n${describeAction(args)}`))) {
      reply(false, "", "", true);
      return;
    }
    const result = await this.deps.act(args);
    reply(result.ok, result.output, result.error);
  }

  /**
   * An action tried (studio-SHELL-000020): its fields checked as for the
   * action itself, then `catalyst try` run with no dialog — it changes only a
   * scratch copy under catalyst's home — and its report returned.
   */
  private async tryAction(id: string, action: unknown): Promise<void> {
    if (!this.deps.act) return;
    const reply = (ok: boolean, output: string, error: string) => {
      this.deps.post({ catalyst: "host", type: "try-result", id, ok, output, error });
    };
    let args: string[];
    try {
      args = tryArgs(action);
    } catch (err) {
      reply(false, "", err instanceof ActionError ? `Not tried: ${err.message}` : String(err));
      return;
    }
    const result = await this.deps.act(args);
    reply(result.ok, result.output, result.error);
  }

  /**
   * A batch (R6.17): every action checked first — one that fails refuses the
   * whole batch, naming it — then one dialog listing each command, then each
   * run in order, its own journaled change; a failure does not stop the rest.
   */
  private async batch(id: string, actions: unknown): Promise<void> {
    const act = this.deps.act;
    if (!act) return;
    const reply = (results: ActionResult[], error: string, declined = false) => {
      this.deps.post({ catalyst: "host", type: "batch-result", id, results, error, ...(declined ? { declined } : {}) });
    };
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > BATCH_LIMIT) {
      reply([], `Not done: a batch holds 1 to ${String(BATCH_LIMIT)} actions`);
      return;
    }
    const all: string[][] = [];
    for (const [i, action] of actions.entries()) {
      try {
        all.push(actionArgs(action));
      } catch (err) {
        reply([], `Not done: action ${String(i + 1)}: ${err instanceof ActionError ? err.message : String(err)}`);
        return;
      }
    }
    const listed = all.map((args) => describeAction(args)).join("\n");
    if (
      !(await this.deps.confirm(`Run these ${String(all.length)} commands in the project, one by one?\n\n${listed}`))
    ) {
      reply([], "", true);
      return;
    }
    const results: ActionResult[] = [];
    for (const args of all) results.push(await act(args));
    reply(results, "");
  }

  /** Stops every run still going (the panel closed). */
  dispose(): void {
    for (const run of this.runs.values()) run.cancel();
    this.runs.clear();
  }
}
