import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Graph, User } from "../client.js";
import { ganttSpans, position, roadmapTables, RoadmapView } from "../Roadmap.js";
import { openWork, TeamView, workOf } from "../Team.js";
import { art, entityType, makeGraph } from "./fixtures.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const graph: Graph = makeGraph({
  types: {
    PLAN: entityType({
      name: "Plan item",
      plural_name: "Plan items",
      states: ["Open", "Done"],
      initial: "Open",
      closed_states: ["Done"],
      fields: [
        { name: "Begins", kind: "date", required: false, target_type: null },
        { name: "Ends", kind: "date", required: false, target_type: null },
      ],
    }),
    WORK: entityType({
      name: "Work",
      plural_name: "Work",
      states: ["Open", "Done"],
      initial: "Open",
      closed_states: ["Done"],
      fields: [
        { name: "Owner", kind: "user", required: false, target_type: null },
        { name: "Helpers", kind: "user-list", required: false, target_type: null },
      ],
    }),
  },
  artifacts: [
    art({
      id: "PLAN-000001-Ab3xR9pQ",
      type: "PLAN",
      file: "plans/q4.md",
      line: 10,
      row: true,
      links: {},
      fields: { Title: "Design", Status: "Done", Begins: "2026-10-01", Ends: "2026-10-10" },
    }),
    art({
      id: "PLAN-000002-Ab3xR9pQ",
      type: "PLAN",
      file: "plans/q4.md",
      line: 11,
      row: true,
      links: {},
      fields: { Title: "Build", Status: "Open", Begins: "2026-10-11", Ends: "2026-11-30" },
    }),
    art({
      id: "PLAN-000003-Ab3xR9pQ",
      type: "PLAN",
      file: "plans/q4.md",
      line: 12,
      row: true,
      links: {},
      fields: { Title: "Launch", Status: "Open", Ends: "2026-12-01" },
    }),
    art({
      id: "PLAN-000004-Ab3xR9pQ",
      type: "PLAN",
      file: "plans/q4.md",
      line: 13,
      row: true,
      links: {},
      fields: { Title: "Someday", Status: "Open" },
    }),
    art({
      id: "WORK-000001-Ab3xR9pQ",
      type: "WORK",
      file: "w1.md",
      title: "Login",
      links: {},
      fields: { Status: "Open", Owner: "ada", Helpers: "Grace, ada" },
    }),
    art({
      id: "WORK-000002-Ab3xR9pQ",
      type: "WORK",
      file: "w2.md",
      title: "Old",
      links: {},
      fields: { Status: "Done", Owner: "ada" },
    }),
    art({
      id: "WORK-000003-Ab3xR9pQ",
      type: "WORK",
      file: "w3.md",
      title: "Unowned",
      links: {},
      fields: { Status: "Open", Owner: "*(none yet)*" },
    }),
  ],
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

describe("the roadmap's Gantt chart (decision B9)", () => {
  it("spans each dated row from its earlier date to its later, a single date a point", () => {
    const [t] = roadmapTables(graph);
    const g = ganttSpans(t.items);
    expect(g?.first).toBe("2026-10-01");
    expect(g?.last).toBe("2026-12-01");
    expect(g?.spans.map((s) => [s.title, s.from, s.to])).toEqual([
      ["Design", "2026-10-01", "2026-10-10"],
      ["Build", "2026-10-11", "2026-11-30"],
      ["Launch", "2026-12-01", "2026-12-01"],
    ]);
    expect(position("2026-10-01", "2026-10-01", "2026-12-01")).toBe(0);
    expect(position("2026-12-01", "2026-10-01", "2026-12-01")).toBe(100);
    expect(ganttSpans([])).toBeNull();
  });

  it("draws the chart with its dates in words and today marked", async () => {
    act(() => {
      root.render(<RoadmapView graph={graph} today="2026-10-18" />);
    });
    expect(el.querySelectorAll(".gantt-bar")).toHaveLength(3);
    expect(el.querySelectorAll(".gantt-today")).toHaveLength(3);
    expect(el.textContent).toContain("1 row(s) without a date are left out");
    expect(el.textContent).toContain("2026-10-11 to 2026-11-30");
    const result = await axe.run(el);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("the team's open work (R6.48)", () => {
  const ada: User = { name: "Ada Lovelace", userid: "Ab3xR9pQ", roles: ["Admin"], active: true, git_username: "ada" };

  it("collects what is open by the person its user fields name", () => {
    const work = openWork(graph);
    expect(work.get("ada")?.map((w) => [w.id, w.field])).toEqual([
      ["WORK-000001-Ab3xR9pQ", "Owner"],
      ["WORK-000001-Ab3xR9pQ", "Helpers"],
    ]);
    expect(work.get("Grace")?.map((w) => w.id)).toEqual(["WORK-000001-Ab3xR9pQ"]);
    expect(work.has("*(none yet)*")).toBe(false);
    expect(workOf(work, "Ada Lovelace", ada).map((w) => w.id)).toEqual(["WORK-000001-Ab3xR9pQ"]);
  });

  it("shows each person's open work", async () => {
    act(() => {
      root.render(<TeamView users={[ada]} entries={[]} since="2026-10-04" graph={graph} />);
    });
    expect(el.textContent).toContain("Open work (1)");
    expect(el.textContent).toContain("WORK-000001-Ab3xR9pQ");
    expect(el.textContent).not.toContain("WORK-000002-Ab3xR9pQ");
    const result = await axe.run(el);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
