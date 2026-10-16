import { readFileSync } from "node:fs";
import { join } from "node:path";

import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyTheme, Shell, type View } from "../Shell.js";
import { Status } from "../Status.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const views: View[] = [
  { id: "overview", label: "Overview", render: () => <h2>Overview</h2> },
  {
    id: "inbox",
    label: "Inbox",
    render: () => (
      <>
        <h2>Inbox</h2>
        <Status tone="warn" label="2 waiting" />
      </>
    ),
  },
];

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
  document.documentElement.removeAttribute("data-theme");
});

function render(node: React.ReactNode) {
  act(() => {
    root.render(node);
  });
}

function button(name: string): HTMLButtonElement {
  const found = [...host.querySelectorAll("button")].find((b) => b.textContent === name);
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

describe("the Studio shell (studio-SHELL-000001)", () => {
  it("has a skip link, a banner, a labelled navigation and the main region", () => {
    render(<Shell project="app" views={views} />);
    expect(host.querySelector('a.skip-link[href="#studio-main"]')).not.toBeNull();
    expect(host.querySelector("header h1")?.textContent).toBe("app");
    expect(host.querySelector('nav[aria-label="Views"]')).not.toBeNull();
    expect(host.querySelector("main#studio-main")).not.toBeNull();
  });

  it("switches views from the navigation and marks the current one", () => {
    render(<Shell project="app" views={views} />);
    expect(button("Overview").getAttribute("aria-current")).toBe("page");
    act(() => {
      button("Inbox").click();
    });
    expect(button("Inbox").getAttribute("aria-current")).toBe("page");
    expect(button("Overview").hasAttribute("aria-current")).toBe(false);
    expect(host.querySelector("main h2")?.textContent).toBe("Inbox");
  });

  it("picks a theme, and system follows the operating system", () => {
    render(<Shell project="app" views={views} />);
    act(() => {
      button("Dark").click();
    });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(button("Dark").getAttribute("aria-pressed")).toBe("true");
    act(() => {
      button("System").click();
    });
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("shows a status as an icon, a word and a colour, the icon hidden from screen readers", () => {
    render(<Status tone="error" label="2 errors" />);
    const status = host.querySelector(".status.status-error");
    expect(status?.textContent).toContain("2 errors");
    expect(status?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  for (const theme of ["light", "dark"] as const) {
    it(`is axe-clean in the ${theme} theme`, async () => {
      applyTheme(theme);
      render(<Shell project="app" views={views} initialView="inbox" />);
      const result = await axe.run(document, {
        resultTypes: ["violations"],
        rules: { "color-contrast": { enabled: false } }, // no layout in jsdom: the token test below covers it
      });
      expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  }
});

// jsdom has no layout, so axe cannot measure contrast: the tokens are checked here instead.
const css = readFileSync(join(__dirname, "..", "..", "static", "studio.css"), "utf8");

function tokens(block: string): Record<string, string> {
  return Object.fromEntries([...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("the design tokens (studio-SHELL-000001)", () => {
  const light = tokens(css.slice(css.indexOf(":root {"), css.indexOf(":root[data-theme")));
  const dark = tokens(css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf("@media")));
  const media = tokens(css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("* {")));

  it("defines the same dark theme for the system and for the switch", () => {
    expect(media).toEqual(dark);
  });

  for (const [name, theme] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it(`gives every text colour a contrast of at least 4.5:1 on both backgrounds (${name})`, () => {
      const low: string[] = [];
      for (const fg of ["text", "text-muted", "accent", "ok", "warn", "error", "info"])
        for (const bg of ["bg", "surface"]) {
          const ratio = contrast(theme[fg], theme[bg]);
          if (ratio < 4.5) low.push(`${fg} on ${bg}: ${ratio.toFixed(2)}`);
        }
      expect(low).toEqual([]);
    });
  }
});
