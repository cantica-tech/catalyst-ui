import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ActionForm } from "../ActionForm.js";
import type { ActionResult, HostRuns, StudioAction } from "../host.js";
import { forewarns, KernelProvider } from "../kernel.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function report(added: number) {
  return JSON.stringify({
    change: "catalyst status set REQ-000001 Done",
    ok: true,
    refused: null,
    output: "",
    files: [{ path: "requirements/REQ-000001-x.md", before: "a", after: "b" }],
    check: {
      added: Array.from({ length: added }, (_, i) => ({ level: "error", text: `finding ${String(i)}`, entity: null })),
      cleared: [],
    },
    impact: null,
    gates: [],
    scratch: null,
  });
}

function host(added: number) {
  const tried: StudioAction[] = [];
  const acted: StudioAction[] = [];
  const h: HostRuns = {
    run: () => ({ cancel: () => undefined }),
    act: (a) => {
      acted.push(a);
      return Promise.resolve({ ok: true, output: "", error: "" });
    },
    tryIt: (a) => {
      tried.push(a);
      return Promise.resolve({ ok: true, output: report(added), error: "" } satisfies ActionResult);
    },
  };
  return { h, tried, acted };
}

let el: HTMLElement;
let root: Root;

beforeEach(() => {
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

function render(h: HostRuns, kernel: string | null): void {
  act(() => {
    root.render(
      <KernelProvider value={kernel}>
        <ActionForm host={h} label="Move to Done" action={{ verb: "status-set", id: "REQ-000001", state: "Done" }} />
      </KernelProvider>,
    );
  });
  const input = el.querySelector("input");
  if (!input) throw new Error("no input");
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Finished");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(text: string): Promise<void> {
  const button = [...el.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!button) throw new Error(`no ${text}`);
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function submit(): Promise<void> {
  const form = el.querySelector("form");
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("an admin's write is tried before it is permanent (studio-SHELL-000029)", () => {
  it("forewarns from kernel 0.112.0", () => {
    expect(forewarns("0.112.0")).toBe(true);
    expect(forewarns("0.111.0")).toBe(false);
    expect(forewarns(null)).toBe(false);
  });

  it("tries on submit, makes nothing, then makes it forewarned on the person's yes", async () => {
    const { h, tried, acted } = host(0);
    render(h, "0.112.0");
    await submit();
    expect(tried).toHaveLength(1);
    expect(acted).toEqual([]);
    expect(el.textContent).toContain("On a scratch copy; nothing changed.");
    await click("Make it permanent");
    expect(acted).toEqual([
      { verb: "status-set", id: "REQ-000001", state: "Done", intent: "Finished", forewarned: true },
    ]);
  });

  it("says 'anyway' when the change adds findings, and Cancel makes nothing", async () => {
    const { h, acted } = host(2);
    render(h, "0.112.0");
    await submit();
    expect(el.textContent).toContain("2 findings added");
    expect([...el.querySelectorAll("button")].map((b) => b.textContent)).toContain("Make it permanent anyway");
    await click("Cancel");
    expect(acted).toEqual([]);
    expect([...el.querySelectorAll("button")].map((b) => b.textContent)).not.toContain("Make it permanent anyway");
  });

  it("with an older kernel, submitting makes the action as before", async () => {
    const { h, tried, acted } = host(0);
    render(h, "0.111.0");
    await submit();
    expect(tried).toEqual([]);
    expect(acted).toEqual([{ verb: "status-set", id: "REQ-000001", state: "Done", intent: "Finished" }]);
  });
});
