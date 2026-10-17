import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ActionForm } from "../ActionForm.js";
import type { ActionResult, HostRuns, StudioAction } from "../host.js";
import { tryReport } from "../Trial.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const report = {
  change: "catalyst status set REQ-000001 Done --intent='Trying it' --json",
  ok: true,
  refused: null,
  output: "",
  files: [{ path: "requirements/REQ-000001-x.md", before: "a", after: "b" }],
  check: {
    added: [{ level: "error", text: "chain closed-incomplete: REQ-000001 …", entity: "REQ-000001" }],
    cleared: [{ level: "warning", text: "index: out of date", entity: null }],
  },
  impact: null,
  gates: [{ id: "REQ-000001", gate: "req-done", missing: 1 }],
  scratch: null,
};

function host(tried: ActionResult) {
  const asked: StudioAction[] = [];
  const acted: StudioAction[] = [];
  const h: HostRuns = {
    run: () => ({ cancel: () => undefined }),
    act: (a) => {
      acted.push(a);
      return Promise.resolve({ ok: true, output: "", error: "" });
    },
    tryIt: (a) => {
      asked.push(a);
      return Promise.resolve(tried);
    },
  };
  return { h, asked, acted };
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

async function clickTry(): Promise<void> {
  const button = [...el.querySelectorAll("button")].find((b) => b.textContent === "Try it");
  if (!button) throw new Error("no Try it");
  await act(async () => {
    button.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Try it (studio-SHELL-000020)", () => {
  it("reads catalyst try's report, and nothing else", () => {
    expect(tryReport({ ok: true, output: JSON.stringify(report), error: "" })?.files).toHaveLength(1);
    expect(tryReport({ ok: false, output: "usage: catalyst …", error: "" })).toBeNull();
  });

  it("tries the action before it is made, showing what it would do, and makes nothing", async () => {
    const { h, asked, acted } = host({ ok: true, output: JSON.stringify(report), error: "" });
    act(() => {
      root.render(
        <ActionForm host={h} label="Move to Done" action={{ verb: "status-set", id: "REQ-000001", state: "Done" }} />,
      );
    });
    await clickTry();
    expect(asked).toEqual([{ verb: "status-set", id: "REQ-000001", state: "Done", intent: "Trying it" }]);
    expect(acted).toEqual([]);
    expect(el.textContent).toContain("Tried: 1 file written, 1 finding added, 1 finding cleared");
    expect(el.textContent).toMatch(/Adds error ?chain closed-incomplete/);
    expect(el.textContent).toMatch(/Clears warning ?index: out of date/);
    expect(el.textContent).toContain("REQ-000001 under gate req-done: 1 approval missing");
  });

  it("says when it would be refused, and when catalyst gave no report", async () => {
    const refused = { ...report, ok: false, refused: "catalyst: REQ-000001 is already Done" };
    const { h } = host({ ok: false, output: JSON.stringify(refused), error: "" });
    act(() => {
      root.render(
        <ActionForm host={h} label="Move" action={{ verb: "status-set", id: "REQ-000001", state: "Done" }} />,
      );
    });
    await clickTry();
    expect(el.textContent).toContain("It would be refused: catalyst: REQ-000001 is already Done");
    const old = host({ ok: false, output: "", error: "catalyst: argument command: invalid choice: 'try'" });
    act(() => {
      root.render(
        <ActionForm host={old.h} label="Move" action={{ verb: "status-set", id: "REQ-000001", state: "Done" }} />,
      );
    });
    await clickTry();
    expect(el.textContent).toContain("Not tried: catalyst: argument command: invalid choice");
  });

  it("offers no Try it where the host cannot try", () => {
    const { h } = host({ ok: true, output: "", error: "" });
    delete h.tryIt;
    act(() => {
      root.render(
        <ActionForm host={h} label="Move" action={{ verb: "status-set", id: "REQ-000001", state: "Done" }} />,
      );
    });
    expect([...el.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Move"]);
  });
});
