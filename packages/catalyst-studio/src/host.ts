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

export interface HostRuns {
  /** Asks the host to run `/command arguments`; `onDeclined` when the person says no. */
  run: (command: string, args: string, onEvent: (event: RunEvent) => void, onDeclined: () => void) => RunHandle;
}

interface Incoming {
  catalyst: "host";
  type: string;
  id?: string;
  runs?: boolean;
  event?: RunEvent;
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
        resolve(data.runs ? { run } : null);
      } else if (data.type === "run-event" && data.id && data.event) {
        listeners.get(data.id)?.onEvent(data.event);
        if (data.event.event === "end") listeners.delete(data.id);
      } else if (data.type === "run-declined" && data.id) {
        listeners.get(data.id)?.onDeclined();
        listeners.delete(data.id);
      }
    });
    // the parent's origin is the editor's own: nothing secret is in these messages
    parent.postMessage({ catalyst: "studio", type: "hello" }, "*");

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
