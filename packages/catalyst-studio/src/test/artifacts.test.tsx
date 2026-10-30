import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArtifactList, EntityPage } from "../Artifacts.js";
import type { EntityType, EntityView, Graph } from "../client.js";
import { art, entityType, makeGraph } from "./fixtures.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const item: EntityType = entityType({
  name: "Item",
  plural_name: "Items",
  fields: [
    { name: "ID", kind: "id", required: true, target_type: null },
    { name: "Status", kind: "enum", required: true, target_type: null },
    { name: "Subs", kind: "ref-list", required: false, target_type: "SUB" },
    { name: "Severity", kind: "enum", required: false, target_type: null },
  ],
  states: ["Open", "Done"],
  initial: "Open",
  closed_states: ["Done"],
  transitions: [],
  guards: { Done: [{ condition: "section_written", argument: "Notes" }] },
  sections: ["Notes"],
});

const graph: Graph = makeGraph({
  types: { ITEM: item, SUB: { ...item, name: "Sub", plural_name: "Subs", guards: {} } },
  artifacts: [
    art({ id: "ITEM-000001", type: "ITEM", title: "First", file: "items/x.md", links: {}, Status: "Open" }),
    art({ id: "SUB-000001", type: "SUB", title: "Part", file: "subs/y.md", links: {}, Status: "Done" }),
    art({ id: "RM-000001", type: "RM", file: "roadmaps/r.md", row: true, links: {} }),
  ],
});

const entity: EntityView = {
  id: "ITEM-000001",
  type: "ITEM",
  title: "First",
  file: "items/x.md",
  Status: "Open",
  Severity: "High",
  links: { Subs: ["SUB-000001"] },
  linked_from: [{ id: "SUB-000001", field: "Parent" }],
  journal: [
    {
      timestamp: "2026-10-16T08:00:00Z",
      actor: "ada",
      command: "catalyst new",
      action: "create",
      intent: ["Create it"],
    },
  ],
  sections: [{ heading: "Notes", text: "" }],
  next: [{ state: "Done", blocked_by: ["`## Notes` is not written"] }],
};

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

function render(node: React.ReactNode) {
  act(() => {
    root.render(node);
  });
}

describe("the artifacts list (studio-SHELL-000002)", () => {
  it("groups artifacts under their type's own plural name, without table rows", () => {
    const opened: string[] = [];
    render(<ArtifactList graph={graph} onOpen={(id) => opened.push(id)} />);
    const headings = [...host.querySelectorAll("h3")].map((h) => h.textContent);
    expect(headings).toEqual(["Items (1)", "Subs (1)"]);
    expect(host.textContent).not.toContain("RM-000001");
    act(() => {
      host.querySelector<HTMLButtonElement>("button")?.click();
    });
    expect(opened).toEqual(["ITEM-000001"]);
  });

  it("lists every entity once, under its own type, never beneath what it cites (studio-SHELL-000030)", () => {
    const citing = makeGraph({
      types: graph.types,
      artifacts: [
        art({ id: "ITEM-000001", type: "ITEM", title: "First", file: "items/x.md", links: { Subs: ["SUB-000001"] } }),
        art({ id: "SUB-000001", type: "SUB", title: "Part", file: "subs/y.md", links: { Parent: ["ITEM-000001"] } }),
      ],
    });
    render(<ArtifactList graph={citing} onOpen={() => undefined} />);
    const entries = [...host.querySelectorAll("section")].map((s) => [
      s.querySelector("h3")?.textContent,
      [...s.querySelectorAll("li code")].map((c) => c.textContent),
    ]);
    expect(entries).toEqual([
      ["Items (1)", ["ITEM-000001"]],
      ["Subs (1)", ["SUB-000001"]],
    ]);
    expect(host.querySelectorAll("li li")).toHaveLength(0);
  });
});

describe("the entity page (studio-SHELL-000002, studio-SHELL-000030)", () => {
  it("shows the type's fields, citations, sections, moves, citers and journal", async () => {
    const opened: string[] = [];
    render(<EntityPage entity={entity} type={item} onOpen={(id) => opened.push(id)} onBack={() => undefined} />);
    const text = host.textContent;
    expect(text).toContain("Item");
    expect(text).toContain("Severity");
    expect(text).toContain("High");
    expect(text).toContain("Done, blocked");
    expect(text).toContain("catalyst status set ITEM-000001 Done");
    expect(text).toContain("`## Notes` is not written");
    expect(text).toContain("Not written.");
    expect(text).toContain("in Parent");
    expect(text).toContain("Create it");
    expect(text).not.toContain("Filename");
    const sub = [...host.querySelectorAll("button")].find((b) => b.textContent === "SUB-000001");
    act(() => {
      sub?.click();
    });
    expect(opened).toEqual(["SUB-000001"]);
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
