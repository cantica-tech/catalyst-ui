import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CommandPage, paletteEntries } from "../Commands.js";
import { connectHost, type HostRuns, type RunEvent } from "../host.js";
import { RunConsole, runSummary } from "../RunConsole.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const end: RunEvent = {
  event: "end",
  ok: true,
  turns: 2,
  usage: { input: 12, output: 34, cache_read: 5000, cache_write: 600 },
  cost_usd: 0.0123,
  duration_ms: 10,
  denied: [],
  result: "No errors.",
};

const stream: RunEvent[] = [
  { event: "start", agent: "claude-code", command: "check-rules", arguments: "a.md" },
  { event: "session", model: "claude-opus-5-5", session: "s" },
  { event: "text", text: "Checking." },
  { event: "tool", name: "Bash", input: "catalyst check" },
  { event: "tool_result", name: "Bash", ok: false },
  end,
];

/** A stand-in parent frame: answers hello, records what the Studio posts. */
function framed(answer: { runs: boolean } | null) {
  const posted: unknown[] = [];
  const parent = {
    postMessage: (data: unknown) => {
      posted.push(data);
      const d = data as { type: string };
      if (d.type === "hello" && answer)
        queueMicrotask(() => {
          window.dispatchEvent(
            new MessageEvent("message", {
              data: { catalyst: "host", type: "hello", ...answer },
              source: parent as unknown as Window,
            }),
          );
        });
    },
  };
  const win = { parent, addEventListener: window.addEventListener.bind(window) } as unknown as Window;
  const send = (data: unknown, source: unknown = parent) => {
    window.dispatchEvent(new MessageEvent("message", { data, source: source as Window }));
  };
  return { win, posted, send };
}

describe("the host bridge (studio-SHELL-000015)", () => {
  it("offers no run outside a frame, or when the host does not answer", async () => {
    expect(await connectHost(window)).toBeNull();
    expect(await connectHost(framed(null).win, 20)).toBeNull();
    expect(await connectHost(framed({ runs: false }).win, 50)).toBeNull();
  });

  it("asks the host to run, and takes its events only from the parent, by run id", async () => {
    const f = framed({ runs: true });
    const host = await connectHost(f.win, 200);
    expect(host).not.toBeNull();
    const seen: RunEvent[] = [];
    let declined = false;
    host?.run(
      "check-rules",
      "a.md",
      (e) => seen.push(e),
      () => (declined = true),
    );
    const ask = f.posted[1] as { type: string; id: string; command: string; arguments: string };
    expect([ask.type, ask.command, ask.arguments]).toEqual(["run", "check-rules", "a.md"]);
    f.send({ catalyst: "host", type: "run-event", id: ask.id, event: stream[2] }, {}); // not the parent
    f.send({ catalyst: "host", type: "run-event", id: "other", event: stream[2] });
    f.send({ catalyst: "host", type: "run-event", id: ask.id, event: stream[2] });
    expect(seen).toEqual([stream[2]]);
    host?.run(
      "help",
      "",
      () => undefined,
      () => (declined = true),
    );
    const second = f.posted[2] as { id: string };
    f.send({ catalyst: "host", type: "run-declined", id: second.id });
    expect(declined).toBe(true);
  });
});

let el: HTMLElement;
let root: Root;

beforeEach(() => {
  document.documentElement.lang = "en";
  document.title = "catalyst Studio";
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  el.remove();
});

describe("the agent console (studio-SHELL-000015)", () => {
  it("sums a run up in turns, tokens and cost", () => {
    expect(runSummary(end)).toBe("2 turns; tokens 12 in, 34 out, cache 5000 read, 600 written, $0.0123");
  });

  it("runs a part as its command, shows the run as it streams and how it ended, axe-clean", async () => {
    const asked: [string, string][] = [];
    let feed: (e: RunEvent) => void = () => undefined;
    let stopped = false;
    const host: HostRuns = {
      run: (command, args, onEvent) => {
        asked.push([command, args]);
        feed = onEvent;
        return { cancel: () => (stopped = true) };
      },
    };
    const entry = paletteEntries([
      {
        name: "create",
        usage: "/create <type> <title>",
        summary: "create an artifact",
        aliases: [],
        parts: [{ part: "bug", usage: "/create bug <title>", summary: "a bug", aliases: ["create-bug"] }],
      },
    ])[1];
    act(() => {
      root.render(<CommandPage entry={entry} copy={() => Promise.resolve()} onBack={() => undefined} host={host} />);
    });
    const run = [...el.querySelectorAll("button")].find((b) => b.textContent === "Run with your agent");
    act(() => {
      run?.click();
    });
    expect(asked).toEqual([["create", "bug"]]);
    act(() => {
      for (const e of stream.slice(0, 4)) feed(e);
    });
    expect(el.textContent).toContain("Running");
    expect(el.textContent).toContain("Checking.");
    const stop = [...el.querySelectorAll("button")].find((b) => b.textContent === "Stop");
    act(() => {
      stop?.click();
    });
    expect(stopped).toBe(true);
    act(() => {
      for (const e of stream.slice(4)) feed(e);
    });
    expect(el.textContent).toContain("Bash failed");
    expect(el.textContent).toContain("Done in 2 turns; tokens 12 in, 34 out");
    expect(el.textContent).not.toContain("Stop");
    const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("offers no run without a host, and names what the settings denied", () => {
    act(() => {
      root.render(
        <>
          <CommandPage
            entry={paletteEntries([{ name: "help", usage: "/help", summary: "help", aliases: [], parts: [] }])[0]}
            copy={() => Promise.resolve()}
            onBack={() => undefined}
          />
          <RunConsole events={[{ ...end, ok: false, denied: ["Write"], result: "stopped" }]} declined={false} />
        </>,
      );
    });
    expect(el.textContent).not.toContain("Run with your agent");
    expect(el.textContent).toContain("inside VS Code, the Studio can run it");
    expect(el.textContent).toContain("Failed after 2 turns");
    expect(el.textContent).toContain("Denied by your agent settings: Write");
  });
});
