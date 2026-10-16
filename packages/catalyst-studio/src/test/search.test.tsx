import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Graph } from "../client.js";
import { findables, search, SearchView } from "../Search.js";
import { Shell } from "../Shell.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const graph: Graph = {
  types: {
    REQ: { name: "Requirement", plural_name: "Requirements", fields: [], states: [], initial: null, closed_states: [] },
  },
  artifacts: [
    {
      id: "REQ-000001",
      type: "REQ",
      title: "Sign in",
      file: "a",
      links: {},
      Status: "Active",
      Notes: "uses a password",
    },
    { id: "REQ-000002", type: "REQ", title: "Sign out", file: "b", links: {}, Status: "Draft" },
    { id: "RM-000001", type: "RM", file: "t.md", links: {}, row: true, fields: { Title: "Phase 1", Status: "Done" } },
  ],
  rules: [
    {
      id: "br-AUTH-000001",
      title: "Passwords are hashed",
      status: "✅ working.",
      file: "r",
      line: 1,
      retired: false,
      domain: "AUTH",
      mentions: [],
    },
  ],
};

describe("the search's ranking (studio-SHELL-000013)", () => {
  it("needs every word, and ranks an ID match, then a title match, then the rest", () => {
    const items = findables(graph);
    expect(items).toHaveLength(4);
    expect(search(items, "")).toEqual([]);
    expect(search(items, "req-000002").map((f) => f.id)).toEqual(["REQ-000002"]);
    expect(search(items, "password").map((f) => f.id)).toEqual(["br-AUTH-000001", "REQ-000001"]);
    expect(search(items, "sign active").map((f) => f.id)).toEqual(["REQ-000001"]);
    expect(search(items, "phase").map((f) => [f.id, f.page])).toEqual([["RM-000001", false]]);
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

function type(input: HTMLInputElement, value: string): void {
  // React reads a typed value through the element's own setter, then an input event
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("the search (studio-SHELL-000013)", () => {
  it("opens from any view with Ctrl/⌘+/, groups what it finds, and opens a page", async () => {
    act(() => {
      root.render(
        <Shell
          project="p"
          onTheme={() => undefined}
          views={[
            { id: "home", label: "Home", render: () => <p>home</p> },
            { id: "artifacts", label: "Artifacts", render: (t) => <p>page of {t}</p> },
            {
              id: "search",
              label: "Search",
              render: () => <SearchView graph={graph} />,
              shortcut: { key: "/", focus: "studio-search" },
            },
          ]}
        />,
      );
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true, bubbles: true }));
    });
    const input = document.activeElement as HTMLInputElement;
    expect(input.id).toBe("studio-search");
    act(() => {
      type(input, "sign");
    });
    expect(host.textContent).toContain("2 found among 4");
    expect(host.textContent).toContain("Requirements (2)");
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    const hit = [...host.querySelectorAll("button")].find((b) => b.textContent.startsWith("REQ-000002"));
    act(() => {
      hit?.click();
    });
    expect(host.textContent).toContain("page of REQ-000002");
  });
});
