import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EntityPage } from "../Artifacts.js";
import type { EntityView, Graph, GraphRule } from "../client.js";
import { breachIs, citers, groupRules, RuleBrowser, ruleStatus, ruleStrength, searchRules } from "../Rules.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function rule(id: string, title: string, status: string, retired = false): GraphRule {
  return { id, title, status, file: "r.md", line: 1, retired, domain: id.split("-")[1], mentions: [] };
}

const graph: Graph = {
  types: {},
  artifacts: [
    { id: "REQ-000001", type: "REQ", file: "q.md", links: { Targets: ["br-AUTH-000001"] } },
    { id: "BUG-000001", type: "BUG", file: "b.md", links: { Targets: ["br-AUTH-000001", "ui-FORM-000001"] } },
  ],
  rules: [
    rule("ui-FORM-000001", "Forms validate on blur", "⏳ in progress."),
    rule("br-AUTH-000002", "🗑 Old sign-in", "🗑 Status: retired", true),
    rule("br-AUTH-000001", "Sign in with a password", "✅ working."),
    rule("br-PAY-000001", "Refunds within 30 days", ""),
  ],
  domains: [{ code: "AUTH", file: "d.md", title: "`AUTH` — Who may sign in" }],
};

describe("a rule's strength (studio-SHELL-000021)", () => {
  it("is must when catalyst gives none, and says what a breach is reported as", () => {
    expect(ruleStrength({})).toBe("must");
    expect(ruleStrength({ strength: "should" })).toBe("should");
    expect(breachIs("must")).toBe("a breach is a violation");
    expect(breachIs("should")).toBe("a breach is a warning");
    expect(breachIs("may")).toBe("a breach is a note");
  });

  it("filters and is searched", () => {
    const rules = [
      { ...rule("br-AUTH-000001", "Sign in", "✅"), strength: "should" },
      rule("br-AUTH-000003", "Lock out", "✅"),
    ];
    expect(searchRules(rules, "", false, "should").map((r) => r.id)).toEqual(["br-AUTH-000001"]);
    expect(searchRules(rules, "", false, "must").map((r) => r.id)).toEqual(["br-AUTH-000003"]);
    expect(searchRules(rules, "should", false).map((r) => r.id)).toEqual(["br-AUTH-000001"]);
  });
});

describe("the rule browser's data (studio-SHELL-000009)", () => {
  it("reads a status from its mark", () => {
    expect(ruleStatus({ status: "✅ working.", retired: false }).label).toBe("Working");
    expect(ruleStatus({ status: "⏳", retired: false }).tone).toBe("warn");
    expect(ruleStatus({ status: "", retired: true }).label).toBe("Retired");
    expect(ruleStatus({ status: "", retired: false }).label).toBe("No status");
  });

  it("counts who cites each rule, groups by document then domain, and searches", () => {
    const c = citers(graph);
    expect([...(c.get("br-AUTH-000001") ?? [])].sort()).toEqual(["BUG-000001", "REQ-000001"]);
    const rules = graph.rules ?? [];
    expect(groupRules(searchRules(rules, "", false)).map((d) => [d.document, d.domains.map((x) => x.code)])).toEqual([
      ["br", ["AUTH", "PAY"]],
      ["ui", ["FORM"]],
    ]);
    expect(searchRules(rules, "", true)).toHaveLength(4);
    expect(searchRules(rules, "in progress", false).map((r) => r.id)).toEqual(["ui-FORM-000001"]);
    expect(searchRules(rules, "auth sign", false).map((r) => r.id)).toEqual(["br-AUTH-000001"]);
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

async function axeClean(): Promise<void> {
  const result = await axe.run(host, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

describe("the rule browser (studio-SHELL-000009)", () => {
  it("lists the rules by document and domain, retired hidden until asked", async () => {
    act(() => {
      root.render(<RuleBrowser graph={graph} />);
    });
    expect(host.textContent).toContain("3 of 4 rules");
    expect(host.textContent).toContain("`AUTH` — Who may sign in");
    expect(host.textContent).toContain("cited by 2");
    expect(host.textContent).not.toContain("Old sign-in");
    const box = host.querySelector<HTMLInputElement>('input[type="checkbox"]');
    act(() => {
      box?.click();
    });
    expect(host.textContent).toContain("4 of 4 rules");
    expect(host.textContent).toContain("Old sign-in");
    await axeClean();
  });

  it("marks a rule weaker than must and filters by strength (studio-SHELL-000021)", async () => {
    const weak: Graph = {
      ...graph,
      rules: [{ ...rule("br-AUTH-000001", "Sign in", "✅"), strength: "may" }, rule("br-PAY-000001", "Refunds", "✅")],
    };
    act(() => {
      root.render(<RuleBrowser graph={weak} />);
    });
    expect(host.querySelector(".strength")?.textContent).toBe("may");
    expect(host.querySelector(".strength")?.getAttribute("title")).toBe("a breach is a note");
    const select = host.querySelector<HTMLSelectElement>("select");
    act(() => {
      if (select) {
        select.value = "must";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(host.textContent).toContain("1 of 2 rules");
    expect(host.textContent).toContain("Refunds");
    expect(host.textContent).not.toContain("Sign in");
    await axeClean();
  });

  it("shows a rule's own text, domain and status on its page", async () => {
    const view = {
      id: "br-AUTH-000001",
      type: "rule",
      title: "Sign in with a password",
      file: "r.md",
      links: {},
      linked_from: [{ id: "REQ-000001", field: "Targets" }],
      journal: [],
      domain: "AUTH",
      status: "✅ working.",
      text: "### `br-AUTH-000001` Sign in with a password\n\n✅ working. A user signs in with a password.",
    } as EntityView;
    act(() => {
      root.render(<EntityPage entity={view} type={undefined} onOpen={() => undefined} onBack={() => undefined} />);
    });
    expect(host.textContent).toContain("Rule · domain AUTH");
    expect(host.textContent).toContain("Working");
    expect(host.textContent).toContain("must (a breach is a violation)");
    expect(host.textContent).toContain("A user signs in with a password.");
    expect(host.textContent).not.toContain("Fields");
    await axeClean();
  });
});
