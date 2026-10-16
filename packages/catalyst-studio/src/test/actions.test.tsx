import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ActionForm } from "../ActionForm.js";
import { BoardView } from "../Board.js";
import type { EntityType, Graph, InboxItem } from "../client.js";
import { connectHost, HostContext, type ActionResult, type HostRuns, type StudioAction } from "../host.js";
import { InboxItemPage } from "../Inbox.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function host(result: ActionResult = { ok: true, output: "{}", error: "" }) {
  const asked: StudioAction[] = [];
  const h: HostRuns = {
    run: () => ({ cancel: () => undefined }),
    act: (a) => {
      asked.push(a);
      return Promise.resolve(result);
    },
  };
  return { h, asked };
}

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

/** The first input the selector finds, or a failure that says so. */
function inputOf(scope: ParentNode | null | undefined, selector = "input"): HTMLInputElement {
  const found = scope?.querySelector<HTMLInputElement>(selector);
  if (!found) throw new Error(`no ${selector}`);
  return found;
}

function type(input: HTMLInputElement, value: string): void {
  // React reads a typed value through the element's own setter, then an input event
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submit(form: HTMLFormElement | null): Promise<void> {
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("the host's actions (studio-SHELL-000016)", () => {
  it("carries an action to the parent and its result back, by id, from the parent only", async () => {
    const posted: { type: string; id: string; action?: unknown }[] = [];
    const parent = {
      postMessage: (data: { type: string; id: string; action?: unknown }) => {
        posted.push(data);
        if (data.type === "hello")
          queueMicrotask(() => {
            window.dispatchEvent(
              new MessageEvent("message", {
                data: { catalyst: "host", type: "hello", runs: true, actions: true },
                source: parent as unknown as Window,
              }),
            );
          });
      },
    };
    const win = { parent, addEventListener: window.addEventListener.bind(window) } as unknown as Window;
    const h = await connectHost(win, 200);
    expect(h?.act).toBeDefined();
    const pending = h?.act?.({ verb: "status-set", id: "REQ-000001", state: "Done", intent: "x" });
    const ask = posted[1];
    expect([ask.type, ask.action]).toEqual([
      "action",
      { verb: "status-set", id: "REQ-000001", state: "Done", intent: "x" },
    ]);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { catalyst: "host", type: "action-result", id: ask.id, ok: true, output: "o", error: "" },
        source: {} as Window,
      }),
    );
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { catalyst: "host", type: "action-result", id: ask.id, ok: false, output: "", error: "", declined: true },
        source: parent as unknown as Window,
      }),
    );
    expect(await pending).toEqual({ ok: false, output: "", error: "", declined: true });
  });

  it("asks why, the tier and what it serves for a change it journals, then says how it went", async () => {
    const { h, asked } = host();
    act(() => {
      root.render(
        <ActionForm
          host={h}
          label="Record in the journal"
          action={{ verb: "journal-append", path: "src/a.py" }}
          journals
        />,
      );
    });
    const inputs = el.querySelectorAll<HTMLInputElement>("input");
    act(() => {
      type(inputs[0], "A quick fix");
      type(inputs[1], "br-AUTH-000001");
    });
    const select = el.querySelector("select");
    act(() => {
      if (select) {
        select.value = "fix";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await submit(el.querySelector("form"));
    expect(asked).toEqual([
      { verb: "journal-append", path: "src/a.py", intent: "A quick fix", tier: "fix", target: "br-AUTH-000001" },
    ]);
    expect(el.textContent).toContain("Done; catalyst journaled it");
    const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("says what catalyst refused, or that the person declined", async () => {
    const refused = host({
      ok: false,
      output: "",
      error: "catalyst: cannot become Done: `## Verification` is not written",
    });
    act(() => {
      root.render(
        <ActionForm
          host={refused.h}
          label="Move to Done"
          action={{ verb: "status-set", id: "STEP-000001", state: "Done" }}
        />,
      );
    });
    act(() => {
      type(inputOf(el), "Finished");
    });
    await submit(el.querySelector("form"));
    expect(el.textContent).toContain("Not done: catalyst: cannot become Done");
    const declined = host({ ok: false, output: "", error: "", declined: true });
    act(() => {
      root.render(
        <ActionForm host={declined.h} label="Move" action={{ verb: "status-set", id: "X-000001", state: "Done" }} />,
      );
    });
    act(() => {
      type(inputOf(el), "x");
    });
    await submit(el.querySelector("form"));
    expect(el.textContent).toContain("Not done: you declined");
  });
});

const commit: InboxItem = {
  kind: "unrecorded-commit",
  id: "abc1234",
  title: "quick fix",
  evidence: { commit: "abc1234def", author: "ada", files: [] },
  settle: ["catalyst journal adopt abc1234 --intent <why>", "git revert abc1234"],
};

function workType(): EntityType {
  return {
    name: "Work",
    plural_name: "Works",
    fields: [],
    states: ["Open", "Done"],
    initial: "Open",
    closed_states: ["Done"],
  };
}

describe("the views act only with a host that acts (studio-SHELL-000016)", () => {
  it("settles an inbox item here when the host acts, and only offers the commands otherwise", async () => {
    const { h, asked } = host();
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <InboxItemPage item={commit} onBack={() => undefined} copy={() => Promise.resolve()} />
        </HostContext.Provider>,
      );
    });
    expect(el.textContent).toContain("Settle it here");
    act(() => {
      type(inputOf(el, "form input"), "A hotfix, now journaled");
    });
    await submit(el.querySelector("form"));
    expect(asked[0]).toMatchObject({
      verb: "journal-adopt",
      commit: "abc1234def",
      intent: "A hotfix, now journaled",
      tier: "chore",
    });
    act(() => {
      root.render(<InboxItemPage item={commit} onBack={() => undefined} copy={() => Promise.resolve()} />);
    });
    expect(el.textContent).not.toContain("Settle it here");
    expect(el.textContent).toContain("Settle it with");
  });

  it("moves a board card through the host", async () => {
    const { h, asked } = host();
    const graph: Graph = {
      types: { WORK: workType() },
      artifacts: [{ id: "WORK-000001", type: "WORK", title: "First", file: "w", links: {}, Status: "Open" }],
    };
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <BoardView graph={graph} />
        </HostContext.Provider>,
      );
    });
    const form = [...el.querySelectorAll("form")].find((f) => f.textContent.includes("Move to Done"));
    act(() => {
      type(inputOf(form), "Shipped");
    });
    await submit(form ?? null);
    expect(asked).toEqual([{ verb: "status-set", id: "WORK-000001", state: "Done", intent: "Shipped" }]);
  });
});
