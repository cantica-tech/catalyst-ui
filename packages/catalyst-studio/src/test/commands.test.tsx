import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Command } from "../client.js";
import { CommandPage, composeCommand, paletteEntries, PaletteSearch, searchPalette } from "../Commands.js";
import { Shell } from "../Shell.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commands: Command[] = [
  {
    name: "check-rules",
    usage: "/check-rules [<file>]",
    summary: "verify that rules, domains, and artifact links remain consistent",
    aliases: ["audit"],
    parts: [],
  },
  {
    name: "create",
    usage: "/create <type> <title>",
    summary: "create an artifact of a type the active modules declare",
    aliases: ["create-bug", "create-req", "create-requirement"],
    parts: [
      { part: "bug", usage: "/create bug <title>", summary: "a bug", aliases: ["create-bug"] },
      {
        part: "req",
        usage: "/create req <title>",
        summary: "a requirement",
        aliases: ["create-req", "create-requirement"],
      },
    ],
  },
  { name: "status", usage: "/status", summary: "update an artifact's Status field", aliases: [], parts: [] },
];

const entries = paletteEntries(commands);

describe("the palette's entries and search (studio-SHELL-000006)", () => {
  it("lists each command, then its parts, in catalyst's order", () => {
    expect(entries.map((e) => e.key)).toEqual(["check-rules", "create", "create bug", "create req", "status"]);
  });

  it("finds by name, alias, part and summary, names first", () => {
    const keys = (q: string) => searchPalette(entries, q).map((e) => e.key);
    expect(keys("")).toHaveLength(5);
    expect(keys("/cre")).toEqual(["create", "create bug", "create req"]);
    expect(keys("audit")).toEqual(["check-rules"]);
    expect(keys("create-requirement")).toEqual(["create req"]);
    expect(keys("create bug")).toEqual(["create bug"]);
    expect(keys("status")[0]).toBe("status"); // the name before a summary that holds the word
    expect(keys("artifact links")).toEqual(["check-rules"]);
    expect(keys("nothing like it")).toEqual([]);
  });

  it("composes the slash command with its arguments", () => {
    const bug = entries.find((e) => e.key === "create bug");
    expect(bug && composeCommand(bug, "  Sign-in fails ")).toBe("/create bug Sign-in fails");
    expect(composeCommand(entries[4], "")).toBe("/status");
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

async function axeClean(): Promise<void> {
  const result = await axe.run(host, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

function type(input: HTMLInputElement, value: string): void {
  // React reads a typed value through the element's own setter, then an input event
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function key(input: HTMLElement, k: string): void {
  input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
}

describe("the palette (studio-SHELL-000006)", () => {
  it("filters as one types, moves with the arrows and picks with Enter, the focus staying in the box", async () => {
    const picked: string[] = [];
    act(() => {
      root.render(<PaletteSearch entries={entries} onPick={(e) => picked.push(e.key)} inputId="search" />);
    });
    const input = host.querySelector<HTMLInputElement>("#search");
    if (!input) throw new Error("no search box");
    expect(input.getAttribute("role")).toBe("combobox");
    expect(host.textContent).toContain("5 commands");
    act(() => {
      type(input, "create");
    });
    expect(host.textContent).toContain("3 of 5 commands");
    const active = () => document.getElementById(input.getAttribute("aria-activedescendant") ?? "")?.textContent;
    expect(active()).toContain("/create <type> <title>");
    act(() => {
      key(input, "ArrowDown");
    });
    expect(active()).toContain("/create bug <title>");
    act(() => {
      key(input, "Enter");
    });
    expect(picked).toEqual(["create bug"]);
    await axeClean();
  });

  it("shows the chosen command's procedure and copies the composed command", async () => {
    const copied: string[] = [];
    const bug = entries.find((e) => e.key === "create bug");
    if (!bug) throw new Error("no part");
    act(() => {
      root.render(
        <CommandPage
          entry={bug}
          spec={{ command: "create", part: "bug", text: "# /create-bug\n\nRun catalyst new BUG." }}
          onBack={() => undefined}
          copy={(t) => {
            copied.push(t);
            return Promise.resolve();
          }}
        />,
      );
    });
    expect(host.textContent).toContain("Run catalyst new BUG.");
    const args = host.querySelector<HTMLInputElement>("article input");
    if (!args) throw new Error("no arguments field");
    act(() => {
      type(args, "Sign-in fails");
    });
    const copy = host.querySelector<HTMLButtonElement>('[aria-label="Copy /create bug Sign-in fails"]');
    await act(async () => {
      copy?.click();
      await Promise.resolve();
    });
    expect(copied).toEqual(["/create bug Sign-in fails"]);
    expect(host.textContent).toContain("Copied");
    await axeClean();
  });
});

describe("the shell's shortcut (studio-SHELL-000006)", () => {
  it("opens a view with Ctrl/⌘ and its key, and focuses what it names", () => {
    act(() => {
      root.render(
        <Shell
          project="p"
          onTheme={() => undefined}
          views={[
            { id: "overview", label: "Overview", render: () => <p>home</p> },
            {
              id: "commands",
              label: "Commands",
              render: () => <input id="find" aria-label="Find" />,
              shortcut: { key: "k", focus: "find" },
            },
          ]}
        />,
      );
    });
    expect(host.textContent).toContain("home");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
    });
    expect(document.activeElement?.id).toBe("find");
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe("Commands");
  });
});
