import { COMMAND_NAME, type AgentRun, type RunEvent } from "catalyst-core";

/** What the Studio asks of its host (studio-SHELL-000015). */
export type StudioMessage =
  | { catalyst: "studio"; type: "hello" }
  | { catalyst: "studio"; type: "run"; id: string; command: string; arguments: string }
  | { catalyst: "studio"; type: "cancel"; id: string };

/** What the host tells the Studio. */
export type HostMessage =
  | { catalyst: "host"; type: "hello"; runs: boolean; agent?: string }
  | { catalyst: "host"; type: "run-event"; id: string; event: RunEvent }
  | { catalyst: "host"; type: "run-declined"; id: string };

export interface RunDeps {
  /** Asks the person, in the host's own dialog; true only on an explicit yes. */
  confirm: (question: string) => Promise<boolean>;
  start: (command: string, args: string, onEvent: (event: RunEvent) => void) => AgentRun;
  post: (message: HostMessage) => void;
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
        ...(this.deps.agent ? { agent: this.deps.agent } : {}),
      });
      return;
    }
    if (m.type === "cancel" && typeof m.id === "string") {
      this.runs.get(m.id)?.cancel();
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

  /** Stops every run still going (the panel closed). */
  dispose(): void {
    for (const run of this.runs.values()) run.cancel();
    this.runs.clear();
  }
}
