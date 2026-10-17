import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApprovalsView } from "../Approvals.js";
import { StudioClient, type ApprovalsReport, type InboxItem } from "../client.js";
import { describeEvidence } from "../evidence.js";
import { gateCount, gateCovers, GatesSection } from "../Gates.js";
import { HostContext, type ActionResult, type HostRuns, type StudioAction } from "../host.js";
import { inboxGroups, InboxItemPage } from "../Inbox.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RULE = "br-AUTH-000001-Ab3xR9pQ";

const report: ApprovalsReport = {
  id: RULE,
  version: "0123456789abcdef0123456789abcdef01234567",
  gates: [
    {
      gate: "auth-rules",
      role: "Reviewer",
      approvals: 2,
      covers: { rules: { domain: "AUTH" } },
      counted: ["bob"],
      missing: 1,
    },
    {
      gate: "item-done",
      role: "Owner",
      approvals: 1,
      covers: { type: "ITEM", to: "Done" },
      counted: ["cy"],
      missing: 0,
    },
  ],
};

const waiting: InboxItem = {
  kind: "approval",
  id: RULE,
  title: "1 of 2 approval(s) from Reviewer missing (the rules of AUTH)",
  evidence: {
    gate: "auth-rules",
    role: "Reviewer",
    approvals: 2,
    counted: ["bob"],
    missing: 1,
    version: report.version,
  },
  settle: [`catalyst approve ${RULE} --gate auth-rules`],
};

function host(result: ActionResult = { ok: true, output: "{}", error: "" }) {
  const asked: StudioAction[] = [];
  const h: HostRuns = {
    run: () => ({ cancel: () => undefined }),
    act: (a) => {
      asked.push(a);
      return Promise.resolve(result);
    },
  };
  return { h, asked };
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

async function approve(why: string): Promise<void> {
  const input = el.querySelector<HTMLInputElement>("form input");
  if (!input) throw new Error("no form");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, why);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await act(async () => {
    el.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("approval gates in the Studio (studio-SHELL-000018)", () => {
  it("says what a gate covers and what its version has and lacks", () => {
    expect(report.gates.map(gateCovers)).toEqual(["the rules of AUTH", "ITEM entering Done"]);
    expect(report.gates.map(gateCount)).toEqual([
      "1 of 2 from Reviewer (bob); 1 missing",
      "1 of 1 from Owner (cy); passed",
    ]);
    expect(describeEvidence(waiting)).toBe("gate auth-rules, 1 approval missing");
    expect(inboxGroups({ items: [waiting], counts: {} }).map((g) => g.heading)).toEqual(["Approvals waiting"]);
  });

  it("reads an entity's gates from catalyst", async () => {
    const seen: string[] = [];
    const client = new StudioClient({ url: "http://127.0.0.1:5000", token: "t" }, (input) => {
      seen.push(input instanceof Request ? input.url : String(input));
      return Promise.resolve(new Response(JSON.stringify(report), { status: 200 }));
    });
    expect(await client.approvals(RULE)).toEqual(report);
    expect(seen).toEqual([`http://127.0.0.1:5000/v1/approvals/${RULE}`]);
  });

  it("lists an entity's gates; inside a host, approves only what is waiting, through the host", async () => {
    const { h, asked } = host();
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <GatesSection report={report} />
        </HostContext.Provider>,
      );
    });
    expect(el.textContent).toContain("auth-rules (the rules of AUTH): 1 of 2 from Reviewer (bob); 1 missing");
    expect(el.querySelectorAll("form")).toHaveLength(1); // the passed gate asks for nothing
    await approve("Read it");
    expect(asked).toEqual([{ verb: "approve", id: RULE, gate: "auth-rules", intent: "Read it" }]);
    const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("says the command, and offers no action, without a host; shows nothing when no gate covers it", () => {
    act(() => {
      root.render(<GatesSection report={report} />);
    });
    expect(el.textContent).toContain(`catalyst approve ${RULE} --gate auth-rules`);
    expect(el.querySelector("form")).toBeNull();
    act(() => {
      root.render(<GatesSection report={{ ...report, gates: [] }} />);
    });
    expect(el.textContent).toBe("");
  });

  it("shows a waiting approval's evidence in the inbox, and the host says why catalyst refused", async () => {
    const { h, asked } = host({ ok: false, output: "", error: "catalyst: bob already approved this version" });
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <InboxItemPage item={waiting} onBack={() => undefined} copy={() => Promise.resolve()} />
        </HostContext.Provider>,
      );
    });
    expect(el.textContent).toContain("Approvals waiting");
    expect(el.textContent).toContain("1 of 2 from Reviewer (bob); 1 missing");
    expect(el.textContent).toContain("0123456789ab");
    await approve("Looks right");
    expect(asked[0]).toEqual({ verb: "approve", id: RULE, gate: "auth-rules", intent: "Looks right" });
    expect(el.textContent).toContain("already approved this version");
  });

  it("lists what waits for an approval in the Approvals view", () => {
    act(() => {
      root.render(<ApprovalsView graph={{ types: {}, artifacts: [] }} users={[]} waiting={[waiting]} />);
    });
    expect(el.textContent).toContain("Waiting for an approval");
    expect([...el.querySelectorAll("#gates-waiting ~ table tbody tr")].map((r) => r.textContent)).toEqual([
      `${RULE}auth-rules${waiting.title}`,
    ]);
  });
});
