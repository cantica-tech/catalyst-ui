import { createContext, useContext } from "react";

/**
 * The Studio's host, when it runs commands (studio-SHELL-000015, owner
 * decision C2): the VS Code panel that frames the page. The Studio asks by
 * message; only the frame's parent answers, and a run is the host's to
 * confirm and start. In a browser there is no such host: no run is offered.
 */

/** One event of a run, as `catalyst agent run --json` gives it. */
export interface RunEvent {
  event: "start" | "session" | "text" | "tool" | "tool_result" | "end";
  [field: string]: unknown;
}

export interface RunHandle {
  cancel: () => void;
}

/** What an action returned (studio-SHELL-000016): catalyst's output, or why it was not done. */
export interface ActionResult {
  ok: boolean;
  output: string;
  error: string;
  /** The person said no in the host's dialog. */
  declined?: boolean;
}

/** An action the Studio may ask for: a verb of the host's allow-list and its named fields. */
export type StudioAction = { verb: string } & Record<string, string | undefined>;

export interface HostRuns {
  /** Asks the host to run `/command arguments`; `onDeclined` when the person says no. */
  run: (command: string, args: string, onEvent: (event: RunEvent) => void, onDeclined: () => void) => RunHandle;
  /** Asks the host to run one catalyst verb (W1); undefined when this host offers no action. */
  act?: (action: StudioAction) => Promise<ActionResult>;
}

interface Incoming {
  catalyst: "host";
  type: string;
  id?: string;
  runs?: boolean;
  actions?: boolean;
  event?: RunEvent;
  ok?: boolean;
  output?: string;
  error?: string;
  declined?: boolean;
}

function newId(): string {
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The host's runs, or null when the page has no host that runs them (not
 * framed, or no answer within `timeoutMs`).
 */
export function connectHost(win: Window = window, timeoutMs = 1500): Promise<HostRuns | null> {
  if (win.parent === win) return Promise.resolve(null);
  const parent = win.parent;
  const listeners = new Map<string, { onEvent: (e: RunEvent) => void; onDeclined: () => void }>();
  const pending = new Map<string, (result: ActionResult) => void>();
  return new Promise((resolve) => {
    let answered = false;
    const timer = setTimeout(() => {
      if (!answered) resolve(null);
    }, timeoutMs);
    win.addEventListener("message", (event: MessageEvent) => {
      if (event.source !== parent) return;
      const data = event.data as Partial<Incoming> | null;
      if (data?.catalyst !== "host") return;
      if (data.type === "hello" && !answered) {
        answered = true;
        clearTimeout(timer);
        resolve(data.runs ? { run, ...(data.actions ? { act } : {}) } : null);
      } else if (data.type === "run-event" && data.id && data.event) {
        listeners.get(data.id)?.onEvent(data.event);
        if (data.event.event === "end") listeners.delete(data.id);
      } else if (data.type === "action-result" && data.id) {
        pending.get(data.id)?.({
          ok: data.ok === true,
          output: data.output ?? "",
          error: data.error ?? "",
          ...(data.declined ? { declined: true } : {}),
        });
        pending.delete(data.id);
      } else if (data.type === "run-declined" && data.id) {
        listeners.get(data.id)?.onDeclined();
        listeners.delete(data.id);
      }
    });
    // the parent's origin is the editor's own: nothing secret is in these messages
    parent.postMessage({ catalyst: "studio", type: "hello" }, "*");

    function act(action: StudioAction): Promise<ActionResult> {
      const id = newId();
      return new Promise((done) => {
        pending.set(id, done);
        parent.postMessage({ catalyst: "studio", type: "action", id, action }, "*");
      });
    }

    function run(command: string, args: string, onEvent: (e: RunEvent) => void, onDeclined: () => void): RunHandle {
      const id = newId();
      listeners.set(id, { onEvent, onDeclined });
      parent.postMessage({ catalyst: "studio", type: "run", id, command, arguments: args }, "*");
      return {
        cancel: () => {
          parent.postMessage({ catalyst: "studio", type: "cancel", id }, "*");
        },
      };
    }
  });
}

/** The host the views reach, set once the host has answered (none in a browser). */
export const HostContext = createContext<HostRuns | null>(null);

export function useHost(): HostRuns | null {
  return useContext(HostContext);
}
