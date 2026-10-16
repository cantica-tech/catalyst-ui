import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Impact, Reached } from "../client.js";
import { Trace, traceTree } from "../Trace.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function reached(id: string, from: string, field: string, depth: number): Reached {
  return { id, type: id.split("-")[0], title: `${id} title`, status: null, depth, via: { id: from, field, on: from } };
}

const impact: Impact = {
  id: "REQ-000001",
  type: "REQ",
  title: "Sign in",
  status: "Active",
  upstream: [reached("br-AUTH-000001", "REQ-000001", "Targets", 1), reached("AUTH", "br-AUTH-000001", "domain", 2)],
  downstream: [
    reached("STEP-000002", "REQ-000001", "Parent", 1),
    reached("STEP-000001", "REQ-000001", "Parent", 1),
    reached("TEST-000001", "STEP-000001", "Steps", 2),
  ],
  mentions: ["FEAT-000001"],
  mentioned_by: [],
};

describe("traceTree (studio-SHELL-000004)", () => {
  it("hangs each entity under the one nearer that reached it, siblings by id", () => {
    const down = traceTree(impact.id, impact.downstream ?? []);
    expect(down.map((n) => n.reached.id)).toEqual(["STEP-000001", "STEP-000002"]);
    expect(down[0].children.map((n) => n.reached.id)).toEqual(["TEST-000001"]);
    const up = traceTree(impact.id, impact.upstream ?? []);
    expect(up[0].children[0].reached.via.field).toBe("domain");
  });

  it("never repeats an entity, even on a cycle", () => {
    const loop = [reached("A-000001", "ROOT", "x", 1), reached("ROOT", "A-000001", "y", 2)];
    expect(traceTree("ROOT", loop).map((n) => [n.reached.id, n.children.length])).toEqual([["A-000001", 0]]);
  });
});

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  document.documentElement.lang = "en";
  document.title = "catalyst Studio";
  host = document.createElement("main");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
});

describe("the trace (studio-SHELL-000004)", () => {
  it("shows both directions with the linking field, prose citations apart, each opening its page", async () => {
    const opened: string[] = [];
    act(() => {
      root.render(<Trace impact={impact} onOpen={(id) => opened.push(id)} />);
    });
    const text = host.textContent;
    expect(text).toContain("Rests on");
    expect(text).toContain("Targets → br-AUTH-000001");
    expect(text).toContain("Parent → STEP-000001");
    expect(text).toContain("Steps → TEST-000001");
    expect(text).toContain("Cited in prose only");
    const test = [...host.querySelectorAll("button")].find((b) => b.textContent === "TEST-000001");
    act(() => {
      test?.click();
    });
    expect(opened).toEqual(["TEST-000001"]);
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("says so when nothing is reached either way", () => {
    act(() => {
      root.render(
        <Trace impact={{ ...impact, upstream: [], downstream: [], mentions: [] }} onOpen={() => undefined} />,
      );
    });
    expect(host.textContent).toContain("it rests on no other entity");
    expect(host.textContent).toContain("Nothing rests on it.");
  });
});
