import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BoardView } from "../Board.js";
import type { EntityType, Graph, HistoryEntry, Impact, JournalEntry, Reached } from "../client.js";
import { lineDiff, sideBySide } from "../diff.js";
import { CompareVersions, DiffView } from "../History.js";
import { WithImpact } from "../impact.js";
import { groupJournal } from "../Journal.js";
import { pruneTree, Trace, traceTree } from "../Trace.js";
import { tint } from "../TypeMap.js";
import { art, entityType, makeGraph } from "./fixtures.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

describe("diffs side by side and two versions compared (R6.37)", () => {
  it("pairs each removal with the addition that replaces it; a lone line stands alone", () => {
    const rows = sideBySide(lineDiff("a\nb\nc\nd\n", "a\nB\nc\n"));
    expect(rows.map((r) => [r.left?.text ?? null, r.right?.text ?? null])).toEqual([
      ["a", "a"],
      ["b", "B"],
      ["c", "c"],
      ["d", null],
    ]);
  });

  it("switches the view to two columns, and compares any two held versions", async () => {
    act(() => {
      root.render(<DiffView before={"x\ny\n"} after={"x\nY\n"} label="The change" />);
    });
    const side = [...el.querySelectorAll("button")].find((b) => b.textContent === "Side by side");
    act(() => {
      side?.click();
    });
    expect(el.querySelector("table.diff-side")).not.toBeNull();
    expect(side?.getAttribute("aria-pressed")).toBe("true");
    await axeClean();
    const v = (n: number, text: string | null, more: Partial<HistoryEntry> = {}): HistoryEntry => ({
      timestamp: `2026-10-1${String(n)}T00:00:00Z`,
      actor: "ada",
      command: null,
      action: "update",
      artifact: null,
      tier: null,
      intent: [],
      before: n === 1 ? null : "b",
      after: "a",
      content_before: null,
      content_after: text,
      redacted: false,
      ...more,
    });
    act(() => {
      root.render(<CompareVersions entries={[v(1, "one\n"), v(2, null, { redacted: true }), v(3, "three\n")]} />);
    });
    expect([...el.querySelectorAll("select option")].map((o) => o.textContent)).toEqual([
      "#1 · 2026-10-11T00:00:00Z",
      "#3 · 2026-10-13T00:00:00Z",
      "#1 · 2026-10-11T00:00:00Z",
      "#3 · 2026-10-13T00:00:00Z",
    ]);
    expect(el.textContent).toContain("From #1 to #3: 1 line removed, 1 line added");
  });
});

describe("the journal grouped (R6.38)", () => {
  const e = (at: string, artifact: string, tier: string | null, day: string): JournalEntry => ({
    at,
    artifact,
    tier,
    timestamp: `${day}T08:00:00Z`,
    actor: "ada",
  });
  const entries = [
    e("1", "REQ-000001-Ab3xR9pQ", "feature", "2026-10-15"),
    e("2", "BUG-000001-Ab3xR9pQ", "fix", "2026-10-16"),
    e("3", "REQ-000002-Ab3xR9pQ", "feature", "2026-10-16"),
    e("4", "DEPLOYMENT.md history", null, "2026-10-16"),
  ];
  it("groups by day newest first, by entity type or by tier, the largest group first", () => {
    expect(groupJournal(entries, "day").map((g) => [g.key, g.entries.length])).toEqual([
      ["2026-10-16", 3],
      ["2026-10-15", 1],
    ]);
    expect(groupJournal(entries, "type").map((g) => [g.key, g.entries.length])).toEqual([
      ["REQ", 2],
      ["BUG", 1],
      ["other", 1],
    ]);
    expect(groupJournal(entries, "tier").map((g) => g.key)).toEqual(["feature", "fix", "no tier"]);
  });
});

function reached(id: string, from: string, type: string): Reached {
  return { id, type, title: id, status: null, depth: 1, via: { id: from, field: "Parent", on: from } };
}

const impact: Impact = {
  id: "REQ-000001",
  type: "REQ",
  title: "Sign in",
  status: "Active",
  upstream: [],
  downstream: [reached("STEP-000001", "REQ-000001", "STEP"), reached("TEST-000001", "STEP-000001", "TEST")],
  mentions: [],
  mentioned_by: [],
};

describe("the trace filtered, and what a change would reach marked (R6.36, R6.41)", () => {
  it("keeps an entity of a hidden type only as the way to a shown one", () => {
    const tree = traceTree(impact.id, impact.downstream ?? []);
    const onlyTests = pruneTree(tree, new Set(["TEST"]));
    expect(onlyTests.map((n) => [n.reached.id, n.dim, n.children.map((c) => c.reached.id)])).toEqual([
      ["STEP-000001", true, ["TEST-000001"]],
    ]);
    expect(pruneTree(tree, new Set(["BUG"]))).toEqual([]);
  });

  it("marks what a change would reach on the board until cleared", async () => {
    const work: EntityType = entityType({
      name: "Step",
      plural_name: "Steps",
      fields: [],
      states: ["Open", "Done"],
      initial: "Open",
      closed_states: ["Done"],
    });
    const graph: Graph = makeGraph({
      types: { STEP: work },
      artifacts: [
        art({ id: "STEP-000001", type: "STEP", title: "Reached", file: "s1", links: {}, Status: "Open" }),
        art({ id: "STEP-000002", type: "STEP", title: "Untouched", file: "s2", links: {}, Status: "Open" }),
      ],
    });
    act(() => {
      root.render(
        <WithImpact>
          <Trace impact={impact} onOpen={() => undefined} />
          <BoardView graph={graph} />
        </WithImpact>,
      );
    });
    const mark = [...el.querySelectorAll("button")].find((b) =>
      b.textContent.startsWith("Mark what a change would reach"),
    );
    expect(mark?.textContent).toBe("Mark what a change would reach (2)");
    act(() => {
      mark?.click();
    });
    expect(el.textContent).toContain("Marked: the 2 entities a change to REQ-000001 would reach.");
    expect(el.querySelectorAll(".impact-mark")).toHaveLength(1); // the board holds one of the two
    await axeClean();
    const clear = [...el.querySelectorAll("button")].find((b) => b.textContent === "Clear");
    act(() => {
      clear?.click();
    });
    expect(el.querySelectorAll(".impact-mark")).toHaveLength(0);
    const box = [...el.querySelectorAll<HTMLInputElement>('fieldset input[type="checkbox"]')];
    expect(box.map((b) => b.parentElement?.textContent.trim())).toEqual(["STEP", "TEST"]);
  });
});

describe("the map tinted by open work (R6.35)", () => {
  it("reads none, some or most of a type's work as open", () => {
    const n = (open: number, closed: number) => ({ id: "X", label: "X", open, closed, board: true });
    expect([tint(n(0, 4)), tint(n(1, 4)), tint(n(3, 1)), tint(n(0, 0))]).toEqual([
      "map-tint-none",
      "map-tint-some",
      "map-tint-most",
      "map-tint-none",
    ]);
  });
});
