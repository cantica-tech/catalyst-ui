import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EntityType, Graph } from "../client.js";
import { layoutMap, typeMap, TypeMapDrawing, TypeMapTable } from "../TypeMap.js";
import { art, entityType } from "./fixtures.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function type(plural: string, states: string[], closed: string[], refs: [string, string][]): EntityType {
  return entityType({
    name: plural.slice(0, -1),
    plural_name: plural,
    states,
    initial: states[0] ?? null,
    closed_states: closed,
    fields: refs.map(([name, target]) => ({ name, kind: "ref", required: false, target_type: target })),
  });
}

const graph: Graph = {
  types: {
    WORK: type(
      "Works",
      ["Open", "Done"],
      ["Done"],
      [
        ["Targets", "rule"],
        ["Parent", "WORK|GOAL"],
      ],
    ),
    GOAL: type("Goals", [], [], [["Domain", "domain"]]),
    NOTE: type("Notes", ["Open"], [], []),
  },
  artifacts: [
    art({ id: "WORK-1", type: "WORK", file: "a", links: {}, Status: "Open" }),
    art({ id: "WORK-2", type: "WORK", file: "b", links: {}, Status: "Done" }),
    art({ id: "GOAL-1", type: "GOAL", file: "c", links: {} }),
  ],
  rules: [
    { id: "br-A-1", title: "t", status: "", file: "r", line: 1, retired: false, domain: "A", mentions: [] },
    { id: "br-A-2", title: "t", status: "", file: "r", line: 2, retired: true, domain: "A", mentions: [] },
  ],
  domains: [{ code: "A", file: "d", title: "A" }],
};

describe("the type map's content (studio-SHELL-000010)", () => {
  it("has a node per type, rules and domains when named, and an arrow per reference target", () => {
    const map = typeMap(graph);
    expect(map.nodes.map((n) => [n.id, n.open, n.closed, n.board])).toEqual([
      ["domain", 1, 0, false],
      ["GOAL", 1, 0, false],
      ["NOTE", 0, 0, false],
      ["rule", 1, 1, false],
      ["WORK", 1, 1, true],
    ]);
    expect(map.edges).toEqual([
      { from: "WORK", to: "rule", field: "Targets" },
      { from: "WORK", to: "WORK", field: "Parent" },
      { from: "WORK", to: "GOAL", field: "Parent" },
      { from: "GOAL", to: "domain", field: "Domain" },
    ]);
  });

  it("is laid out with every node placed and every arrow routed", async () => {
    const placed = await layoutMap(typeMap(graph));
    expect(placed.nodes).toHaveLength(5);
    expect(placed.edges.every((e) => e.points.length >= 2)).toBe(true);
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

describe("the type map (studio-SHELL-000010)", () => {
  it("opens a type's board from the drawing or the table, and is axe-clean", async () => {
    const placed = await layoutMap(typeMap(graph));
    const opened: string[] = [];
    act(() => {
      root.render(
        <>
          <TypeMapDrawing placed={placed} onOpen={(p) => opened.push(p)} />
          <TypeMapTable map={typeMap(graph)} onOpen={(p) => opened.push(p)} />
        </>,
      );
    });
    const node = host.querySelector('[aria-label="Open the board of Works"]');
    act(() => {
      node?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const row = [...host.querySelectorAll("tbody tr")].find((r) => r.textContent.startsWith("Works"));
    expect(row?.textContent).toContain("Targets → Rules, Parent → Works, Parent → Goals");
    act(() => {
      row?.querySelector("button")?.click();
    });
    expect(opened).toEqual(["WORK", "WORK"]);
    expect(host.querySelectorAll('[role="button"]')).toHaveLength(1); // only a type with a board is operable
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
