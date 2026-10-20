import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { boardColumns, boardTypes, BoardView, movesFrom } from "../Board.js";
import type { EntityType, Graph } from "../client.js";
import { Shell } from "../Shell.js";
import { art, entityType, makeGraph } from "./fixtures.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function type(
  name: string,
  states: string[],
  closed: string[],
  transitions?: { from: string; to: string }[],
): EntityType {
  return entityType({
    name,
    plural_name: `${name}s`,
    fields: [],
    states,
    initial: states[0] ?? null,
    closed_states: closed,
    transitions,
  });
}

const graph: Graph = makeGraph({
  types: {
    WORK: type(
      "Work item",
      ["Draft", "Active", "Done", "Dropped"],
      ["Done", "Dropped"],
      [
        { from: "Draft", to: "Active" },
        { from: "Active", to: "Done" },
        { from: "Active", to: "Dropped" },
      ],
    ),
    NOTE: type("Note", [], []),
    ITEM: type("Item", ["Open", "Closed"], ["Closed"]),
    ROW: type("Row", ["Open"], []),
  },
  artifacts: [
    art({ id: "WORK-000002", type: "WORK", title: "Second", file: "w2.md", links: {}, Status: "Active" }),
    art({ id: "WORK-000001", type: "WORK", title: "First", file: "w1.md", links: {}, Status: "Active" }),
    art({ id: "WORK-000003", type: "WORK", title: "Third", file: "w3.md", links: {}, Status: "Done" }),
    art({ id: "WORK-000004", type: "WORK", title: "Odd", file: "w4.md", links: {}, Status: "Parked" }),
    art({ id: "NOTE-000001", type: "NOTE", title: "n", file: "n.md", links: {} }),
    art({ id: "ITEM-000001", type: "ITEM", title: "i", file: "i.md", links: {}, Status: "`Open`" }),
    art({ id: "ROW-000001", type: "ROW", title: "r", file: "r.md", links: {}, row: true, Status: "Open" }),
  ],
});

describe("the board's columns (studio-SHELL-000008)", () => {
  it("offers the types with states and artifacts, by plural name", () => {
    expect(boardTypes(graph).map((t) => [t.prefix, t.count])).toEqual([
      ["ITEM", 1],
      ["WORK", 4],
    ]);
  });

  it("gives a column per state in the type's order, an undeclared status last, empty closed columns left out", () => {
    const cols = boardColumns(graph, "WORK");
    expect(cols.map((c) => [c.state, c.closed, c.cards.map((a) => a.id)])).toEqual([
      ["Draft", false, []],
      ["Active", false, ["WORK-000001", "WORK-000002"]],
      ["Done", true, ["WORK-000003"]],
      ["Parked", false, ["WORK-000004"]],
    ]);
    expect(boardColumns(graph, "ITEM")[0].cards.map((a) => a.id)).toEqual(["ITEM-000001"]); // a status in backticks
  });

  it("moves by the type's transitions, or to any other state when it declares none", () => {
    expect(movesFrom(graph.types.WORK, "Active")).toEqual(["Done", "Dropped"]);
    expect(movesFrom(graph.types.ITEM, "Open")).toEqual(["Closed"]);
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

describe("the board (studio-SHELL-000008)", () => {
  it("shows the cards by state, each move a copyable command, each card opening its page", async () => {
    const copied: string[] = [];
    act(() => {
      root.render(
        <Shell
          project="p"
          onTheme={() => undefined}
          initialView="board"
          views={[
            { id: "artifacts", label: "Artifacts", render: (target) => <p>page of {target}</p> },
            {
              id: "board",
              label: "Board",
              render: () => (
                <BoardView
                  graph={graph}
                  initialType="WORK"
                  copy={(t) => {
                    copied.push(t);
                    return Promise.resolve();
                  }}
                />
              ),
            },
          ]}
        />,
      );
    });
    expect([...host.querySelectorAll(".column h3")].map((h) => h.textContent)).toEqual([
      "Draft (0)",
      "Active (2)",
      "✓Done (1)",
      "Parked (1)",
    ]);
    const copy = host.querySelector<HTMLButtonElement>('[aria-label="Copy catalyst status set WORK-000001 Done"]');
    await act(async () => {
      copy?.click();
      await Promise.resolve();
    });
    expect(copied).toEqual(["catalyst status set WORK-000001 Done"]);
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    const first = [...host.querySelectorAll("button")].find((b) => b.textContent === "WORK-000001");
    act(() => {
      first?.click();
    });
    expect(host.textContent).toContain("page of WORK-000001");
  });

  it("says so when no type has work to show", () => {
    act(() => {
      root.render(<BoardView graph={makeGraph()} />);
    });
    expect(host.textContent).toContain("No type with states holds any artifact yet.");
  });
});
