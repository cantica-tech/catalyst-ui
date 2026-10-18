import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AnalysisList, AnalysisPage, fixCommand, passesLabel, phaseTone, trend, triage } from "../Analyses.js";
import type { AnalysisFinding, AnalysisReport, AnalysisSummary } from "../client.js";
import { HostContext, type HostRuns, type StudioAction } from "../host.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = "ANALYSIS-000002-Ab3xR9pQ";

function summary(over: Partial<AnalysisSummary> = {}): AnalysisSummary {
  return {
    id: ID,
    title: "login and sessions",
    phase: "Deciding",
    mode: "incremental",
    passes: 2,
    scope: ["src"],
    code_state: "0123456789abcdef",
    opened: "2026-10-18",
    closed: null,
    findings: 3,
    decided: 1,
    accepted: 1,
    rejected: 0,
    ...over,
  };
}

const items: AnalysisFinding[] = [
  {
    id: "F2",
    kind: "defect",
    title: "Session timeout is zero",
    statement: "Sessions never expire.",
    breaks: "br-AUTH-000001-Ab3xR9pQ",
    evidence: [{ path: "src/session.py", line: 1 }],
    sources: ["A:A2"],
    verification: "read src/session.py",
    decision: {
      verdict: "accept",
      artifact: "BUG-000001-Ab3xR9pQ",
      reason: "real",
      by: "Ada",
      at: "2026-10-18T10:00:00Z",
    },
  },
  { id: "F10", kind: "rule", title: "Passwords are checked", decision: null },
  { id: "F1", kind: "domain", title: "Session management", decision: null },
];

function report(over: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    ...summary(),
    recorded: { A: true, B: true },
    diff: { agreed: 1, conflicting: 1, a_only: 1, b_only: 1 },
    reconciled: true,
    dropped: [{ source: "B:B3", reason: "duplicate" }],
    items,
    problems: [],
    ...over,
  };
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

async function axeClean(): Promise<void> {
  const result = await axe.run(el);
  expect(result.violations.map((v) => v.id)).toEqual([]);
}

function type(input: HTMLInputElement | null, value: string): void {
  if (!input) throw new Error("no input");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("the analysis workspace's data (R6.23)", () => {
  it("names the passes and tones the phase", () => {
    expect(passesLabel(2)).toBe("four-eyes");
    expect(passesLabel(1)).toBe("single-pass");
    expect(phaseTone("Closed")).toBe("ok");
    expect(phaseTone("Deciding")).toBe("warn");
  });

  it("puts the undecided findings first, each in ID order", () => {
    const t = triage(items);
    expect(t.open.map((f) => f.id)).toEqual(["F1", "F10"]);
    expect(t.decided.map((f) => f.id)).toEqual(["F2"]);
  });

  it("keeps the closed analyses oldest first for the trend", () => {
    const rows = [
      summary({ id: "ANALYSIS-000003-Ab3xR9pQ", phase: "Closed" }),
      summary(),
      summary({ id: "ANALYSIS-000001-Ab3xR9pQ", phase: "Closed" }),
    ];
    expect(trend(rows).map((r) => r.id)).toEqual(["ANALYSIS-000001-Ab3xR9pQ", "ANALYSIS-000003-Ab3xR9pQ"]);
  });

  it("proposes a fix as a bug against the rule the defect breaks", () => {
    expect(fixCommand(ID, items[0])).toBe(
      `/create bug Session timeout is zero (${ID} F2 against br-AUTH-000001-Ab3xR9pQ)`,
    );
  });
});

describe("the analysis workspace (R6.23)", () => {
  it("lists the analyses with their passes and the trend", async () => {
    act(() => {
      root.render(
        <AnalysisList
          rows={[
            summary({ passes: 1 }),
            summary({ id: "ANALYSIS-000001-Ab3xR9pQ", phase: "Closed", accepted: 2, rejected: 1 }),
          ]}
          onOpen={() => undefined}
        />,
      );
    });
    expect(el.textContent).toContain("single-pass");
    expect(el.textContent).toContain("1/3");
    expect(el.textContent).toContain("2 accepted, 1 rejected");
    await axeClean();
  });

  it("shows an analysis's passes, diff, findings and dropped ones", async () => {
    act(() => {
      root.render(<AnalysisPage report={report()} onBack={() => undefined} />);
    });
    const text = el.textContent;
    expect(text).toContain("four-eyes");
    expect(text).toContain("1 agreed, 1 conflicting, 1 A-only, 1 B-only");
    expect(text).toContain("To decide (2)");
    expect(text).toContain("Decided (1)");
    expect(text).toContain("src/session.py:1");
    expect(text).toContain("B:B3");
    expect(text).toContain("Propose a fix");
    expect(text).toContain("catalyst analysis decide");
    await axeClean();
  });

  it("says a single-pass analysis has no pass B, and waits for the reconciliation", () => {
    act(() => {
      root.render(
        <AnalysisPage
          report={report({
            passes: 1,
            recorded: { A: true, B: null },
            diff: null,
            reconciled: false,
            items: [],
            dropped: [],
          })}
          onBack={() => undefined}
        />,
      );
    });
    expect(el.textContent).toContain("single-pass");
    expect(el.textContent).not.toContain("pass B");
    expect(el.textContent).toContain("once the passes are reconciled");
  });

  it("decides a finding through the host, an accepted one naming what it became", async () => {
    const asked: StudioAction[] = [];
    const h: HostRuns = {
      run: () => ({ cancel: () => undefined }),
      act: (a) => {
        asked.push(a);
        return Promise.resolve({ ok: true, output: "", error: "" });
      },
    };
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <AnalysisPage report={report()} onBack={() => undefined} />
        </HostContext.Provider>,
      );
    });
    const form = el.querySelector("form");
    const [why, became] = Array.from(form?.querySelectorAll("input") ?? []);
    const buttons = Array.from(form?.querySelectorAll("button") ?? []);
    const accept = buttons.find((b) => b.textContent === "Accept");
    const reject = buttons.find((b) => b.textContent === "Reject");
    expect(accept?.disabled).toBe(true);
    act(() => {
      type(why, "The domain is real");
    });
    expect(accept?.disabled).toBe(true);
    act(() => {
      type(became, "SESSION");
    });
    await act(async () => {
      accept?.click();
      await Promise.resolve();
    });
    expect(asked).toEqual([
      {
        verb: "analysis-decide",
        id: ID,
        finding: "F1",
        verdict: "accept",
        intent: "The domain is real",
        artifact: "SESSION",
      },
    ]);
    expect(el.textContent).toContain("Decided");
    expect(reject).toBeDefined();
  });
});
