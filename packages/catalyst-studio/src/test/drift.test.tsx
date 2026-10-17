import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError, type Finding, type RunRecord, type StudioClient } from "../client.js";
import { DriftBadge, driftOf, DriftProvider, DriftSection } from "../drift.js";
import { OverviewView } from "../Overview.js";
import { costByCommand, RunHistory, RunHistoryView } from "../RunHistory.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const findings: Finding[] = [
  { level: "warning", text: "REQ-000004: `Targets` cites retired rule br-X", entity: "REQ-000004" },
  { level: "error", text: "REQ-000004: no Signed-off-by", entity: "REQ-000004" },
  { level: "warning", text: "STEP-000001: stale index", entity: "STEP-000001" },
  { level: "warning", text: "format: no `format`", entity: null },
];

function run(command: string, ok: boolean, cost: number | null, more: Partial<RunRecord> = {}): RunRecord {
  return {
    timestamp: "2026-10-17T08:00:00Z",
    actor: "ada",
    agent: "claude-code",
    command,
    arguments: "",
    ok,
    turns: 2,
    usage: { input: 10, output: 20, cache_read: 100, cache_write: 5 },
    cost_usd: cost,
    duration_ms: 100,
    denied: [],
    ...more,
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

describe("drift where the entity is (studio-SHELL-000017)", () => {
  it("maps each entity to its findings, leaving out those about no entity", () => {
    const d = driftOf(findings);
    expect([...d.keys()]).toEqual(["REQ-000004", "STEP-000001"]);
    expect(d.get("REQ-000004")).toHaveLength(2);
    expect(driftOf(undefined).size).toBe(0);
  });

  it("marks an entity with its errors first, else its warnings, and lists them on its page", async () => {
    act(() => {
      root.render(
        <DriftProvider value={driftOf(findings)}>
          <p>
            REQ-000004 <DriftBadge id="REQ-000004" />
          </p>
          <p>
            STEP-000001 <DriftBadge id="STEP-000001" />
          </p>
          <p>
            OTHER <DriftBadge id="OTHER-000001" />
          </p>
          <DriftSection id="REQ-000004" />
        </DriftProvider>,
      );
    });
    const text = el.textContent;
    expect(text).toContain("REQ-000004 ✕1 error");
    expect(text).toContain("STEP-000001 !1 warning");
    expect(el.querySelectorAll(".drift-badge")).toHaveLength(2);
    expect(text).toContain("Problems catalyst reports");
    expect(text).toContain("no Signed-off-by");
    const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("says on the dashboard how many project rules are cited", () => {
    act(() => {
      root.render(
        <OverviewView
          data={{
            check: { ok: true, errors: [], warnings: [] },
            inbox: { items: [], counts: {} },
            backlog: { open: {}, missing_links: [], rules_without_open_work: [], coverage: { rules: 32, cited: 25 } },
          }}
        />,
      );
    });
    expect(el.textContent).toContain("25 of 32 project rules cited");
    expect(el.textContent).toContain("(78% have an artifact grounded on them)");
  });
});

describe("the run history (studio-SHELL-000017, R6.22)", () => {
  const runs = [
    run("check-rules", true, 0.1),
    run("help", false, 0.02, { denied: ["Write"] }),
    run("check-rules", true, 0.3),
  ];

  it("sums the cost per command, most expensive first", () => {
    expect(costByCommand(runs)).toEqual([
      { command: "check-rules", runs: 2, cost: 0.4 },
      { command: "help", runs: 1, cost: 0.02 },
    ]);
  });

  it("lists the runs newest first with their tokens and cost, and the total", async () => {
    act(() => {
      root.render(<RunHistoryView runs={runs} />);
    });
    expect(el.textContent).toContain("3 runs, $0.4200 in all.");
    expect(el.textContent).toContain("denied: Write");
    expect(el.textContent).toContain("115 in, 20 out, $0.1000");
    const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("shows nothing when the catalyst serving the page keeps no run log", async () => {
    const client = { runs: () => Promise.reject(new ApiError(404, "runs: 404")) } as unknown as StudioClient;
    await act(async () => {
      root.render(<RunHistory client={client} />);
      await Promise.resolve();
    });
    expect(el.textContent).toBe("");
  });
});
