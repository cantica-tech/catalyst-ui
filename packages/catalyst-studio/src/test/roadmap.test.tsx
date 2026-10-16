import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Graph } from "../client.js";
import { roadmapTables, RoadmapView } from "../Roadmap.js";
import { Shell } from "../Shell.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const graph: Graph = {
  types: {
    PLAN: {
      name: "Plan item",
      plural_name: "Plan items",
      states: ["Open", "Done"],
      initial: "Open",
      closed_states: ["Done"],
      fields: [{ name: "Linked", kind: "ref-list", required: false, target_type: "REQ" }],
    },
  },
  artifacts: [
    {
      id: "PLAN-000002-Ab3xR9pQ",
      type: "PLAN",
      file: "plans/beta.md",
      line: 12,
      row: true,
      links: {},
      fields: { Title: "Second", Status: "Open", Linked: "`REQ-000002-Ab3xR9pQ`, `REQ-000003`", Target: "2026-12-01" },
    },
    {
      id: "PLAN-000001-Ab3xR9pQ",
      type: "PLAN",
      file: "plans/beta.md",
      line: 11,
      row: true,
      links: {},
      fields: { Title: "First", Status: "`Done`", Description: "The base." },
    },
    { id: "REQ-000002-Ab3xR9pQ", type: "REQ", file: "r.md", links: {}, Status: "Active" },
  ],
};

describe("the roadmap's tables (studio-SHELL-000011)", () => {
  it("orders each table's rows as written, reads status, dates and linked IDs", () => {
    const [t] = roadmapTables(graph);
    expect(t.kind).toBe("Plan items");
    expect(t.closed).toBe(1);
    expect(t.items.map((i) => [i.title, i.status, i.closed])).toEqual([
      ["First", "Done", true],
      ["Second", "Open", false],
    ]);
    expect(t.items[1].dates).toEqual([["Target", "2026-12-01"]]);
    expect(t.items[1].linked).toEqual(["REQ-000002-Ab3xR9pQ", "REQ-000003"]);
  });
});

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  document.documentElement.lang = "en";
  document.title = "catalyst Studio";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
});

describe("the roadmap timeline (studio-SHELL-000011)", () => {
  it("shows each table's progress and items, a linked entity with its status opening its page", async () => {
    act(() => {
      root.render(
        <Shell
          project="p"
          onTheme={() => undefined}
          initialView="roadmap"
          views={[
            { id: "artifacts", label: "Artifacts", render: (target) => <p>page of {target}</p> },
            { id: "roadmap", label: "Roadmap", render: () => <RoadmapView graph={graph} /> },
          ]}
        />,
      );
    });
    expect(host.textContent).toContain("beta (Plan items)");
    expect(host.textContent).toContain("1 of 2 closed");
    expect(host.textContent).toContain("Target 2026-12-01");
    expect(host.textContent).toContain("REQ-000002-Ab3xR9pQ (Active)");
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    const link = [...host.querySelectorAll("button")].find((b) => b.textContent === "REQ-000002-Ab3xR9pQ");
    act(() => {
      link?.click();
    });
    expect(host.textContent).toContain("page of REQ-000002-Ab3xR9pQ");
  });

  it("says so when there is no table of rows", () => {
    act(() => {
      root.render(<RoadmapView graph={{ types: {}, artifacts: [] }} />);
    });
    expect(host.textContent).toContain("keeps no table of rows");
  });
});
