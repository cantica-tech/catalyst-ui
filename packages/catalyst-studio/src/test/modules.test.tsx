import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InstalledModule, ModulePlan, ModuleReleases, StudioClient } from "../client.js";
import { ModulesView, moduleState, upgradeCommand } from "../Modules.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const installed: InstalledModule = {
  id: "software-engineering",
  state: "ok",
  version: "3.2.0",
  source: "https://example.test/acme/se.git",
  commit: "0123456789abcdef0123",
  sha256: "ab",
  actual: null,
};

const releases: ModuleReleases = {
  id: "software-engineering",
  installed: "3.2.0",
  source: "https://example.test/acme/se.git",
  releases: [
    { version: "3.3.0", tag: "3.3.0", newer: true, installed: false },
    { version: "3.2.0", tag: "3.2.0", newer: false, installed: true },
  ],
};

const plan: ModulePlan = {
  id: "software-engineering",
  to: "3.3.0",
  from_module: "3.2.0",
  to_module: "3.3.0",
  migrations: [{ path: "0.83.0/decisions-as-entities.md" }],
  actions: [
    { kind: "module", target: ".criterion/modules/software-engineering", change: "update", detail: "8 file(s)" },
  ],
};

function stub(): { client: StudioClient; asked: string[] } {
  const asked: string[] = [];
  const client = {
    moduleReleases: (id: string) => {
      asked.push(`available ${id}`);
      return Promise.resolve(releases);
    },
    modulePlan: (id: string, tag: string) => {
      asked.push(`plan ${id} ${tag}`);
      return Promise.resolve(plan);
    },
  } as unknown as StudioClient;
  return { client, asked };
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

function button(label: RegExp): HTMLButtonElement {
  const b = Array.from(el.querySelectorAll("button")).find((x) => label.test(x.textContent));
  if (!b) throw new Error(`no button ${String(label)}`);
  return b;
}

describe("module administration (R6.24)", () => {
  it("names a module's state", () => {
    expect(moduleState("ok").label).toBe("As recorded");
    expect(moduleState("changed").tone).toBe("error");
    expect(moduleState("unrecorded").tone).toBe("warn");
  });

  it("upgrades to a release of the module's own repository", () => {
    expect(upgradeCommand(releases, "3.3.0")).toBe(
      "catalyst module upgrade software-engineering https://example.test/acme/se.git@3.3.0",
    );
  });

  it("looks for releases on asking, then shows what one would change and how to upgrade", async () => {
    const { client, asked } = stub();
    act(() => {
      root.render(<ModulesView client={client} modules={[installed]} />);
    });
    expect(el.textContent).toContain("As recorded");
    expect(asked).toEqual([]); // the network only when asked
    await act(async () => {
      button(/Look for releases/).click();
      await Promise.resolve();
    });
    expect(el.textContent).toContain("1 newer release(s)");
    await act(async () => {
      button(/What would 3.3.0 change/).click();
      await Promise.resolve();
    });
    expect(asked).toEqual(["available software-engineering", "plan software-engineering 3.3.0"]);
    expect(el.textContent).toContain(".criterion/modules/software-engineering");
    expect(el.textContent).toContain("1 migration(s) with judgment steps");
    expect(el.textContent).toContain("catalyst module upgrade software-engineering");
    const result = await axe.run(el);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });

  it("says when no module is installed", () => {
    act(() => {
      root.render(<ModulesView client={stub().client} modules={[]} />);
    });
    expect(el.textContent).toContain("No module installed");
  });
});
