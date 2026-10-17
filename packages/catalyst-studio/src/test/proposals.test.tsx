import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EntityView, InboxItem } from "../client.js";
import { describeEvidence } from "../evidence.js";
import { HostContext, type ActionResult, type HostRuns, type StudioAction } from "../host.js";
import { inboxGroups, InboxItemPage } from "../Inbox.js";
import { ProposalDiff } from "../Proposals.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CASE = "RECON-000003-Ab3xR9pQ";
const ITEM = "REQ-000004-Ab3xR9pQ";

const item: InboxItem = {
  kind: "proposal",
  id: CASE,
  title: "Proposed change to REQ-000004",
  evidence: {
    status: "Open",
    entity: ITEM,
    path: "requirements/REQ-000004-login.md",
    base: "a".repeat(40),
    proposed: "b".repeat(40),
    author: "bob",
  },
  settle: [`catalyst reconcile ${CASE} accept`, `catalyst reconcile ${CASE} accept-with-edits --from <file>`],
};

const artifact: EntityView = {
  id: CASE,
  type: "RECON",
  title: "Proposed change to REQ-000004",
  file: "reconciliations/RECON-000003-proposed-change.md",
  links: {},
  linked_from: [],
  journal: [],
  sections: [{ heading: "Revisions", text: "| 1 | Bob | … | Initial proposal |" }],
  proposal: {
    entity: ITEM,
    path: "requirements/REQ-000004-login.md",
    base: "a".repeat(40),
    proposed: "b".repeat(40),
    author: "bob",
    content_base: "# Login\n\nUsers sign in.\n",
    content_proposed: "# Login\n\nUsers sign in with a passkey.\n",
  },
};

function host(result: ActionResult = { ok: true, output: "", error: "" }) {
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

async function submit(form: HTMLFormElement, why: string): Promise<void> {
  const input = form.querySelector<HTMLInputElement>("input");
  if (!input) throw new Error("no input");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, why);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("proposals in the Studio (studio-SHELL-000019)", () => {
  it("lists a proposal under its own heading, said by its entity and author", () => {
    expect(inboxGroups({ items: [item], counts: {} }).map((g) => g.heading)).toEqual(["Proposals to decide"]);
    expect(describeEvidence(item)).toBe(`to ${ITEM}, by bob, Open`);
  });

  it("shows the proposed change beside the text it was proposed against", async () => {
    act(() => {
      root.render(<ProposalDiff proposal={artifact.proposal} />);
    });
    expect(el.textContent).toContain(`To ${ITEM} (requirements/REQ-000004-login.md), written by bob`);
    expect(el.textContent).toContain("1 line removed, 1 line added");
    const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    act(() => {
      root.render(<ProposalDiff />);
    });
    expect(el.textContent).toBe("");
  });

  it("decides it through the host, never accepting with edits, and says catalyst's refusal", async () => {
    const { h, asked } = host({ ok: false, output: "", error: "catalyst: bob wrote this proposal's version" });
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <InboxItemPage item={item} artifact={artifact} onBack={() => undefined} copy={() => Promise.resolve()} />
        </HostContext.Provider>,
      );
    });
    expect(el.textContent).toContain("The proposed change");
    const forms = [...el.querySelectorAll<HTMLFormElement>("#item-settle-here ~ ul form")];
    expect(forms.map((f) => f.querySelector("button[type=submit]")?.textContent)).toEqual([
      "Accept: write it to the entity",
      "Reject",
      "Propose a revision",
      "Withdraw (its author)",
    ]);
    await submit(forms[0], "Reads right");
    expect(asked).toEqual([{ verb: "reconcile", case: CASE, decision: "accept", intent: "Reads right" }]);
    expect(el.textContent).toContain("wrote this proposal's version");
    expect(el.textContent).toContain(`catalyst reconcile ${CASE} accept-with-edits --from <file>`);
  });
});
