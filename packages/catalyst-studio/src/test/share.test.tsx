import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { StudioClient, type Role, type ShareStatus, type User } from "../client.js";
import { HostContext, type ActionResult, type HostRuns, type StudioAction } from "../host.js";
import { shareState, ShareView } from "../Share.js";
import { TeamView } from "../Team.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const shared: ShareStatus = {
  driver: "git",
  location: "git@example.test:acme/criterion.git",
  branch: "criterion",
  dirty: ["development/journal/ada@Ab3xR9pQ/2026-10.jsonl"],
  ahead: 0,
  behind: 0,
  mode: "home",
};

const roles: Role[] = [
  { name: "Admin", actions: [], reconciliation: "full" },
  { name: "Developer", actions: [], reconciliation: "propose" },
];

const users: User[] = [{ name: "ada", userid: "Ab3xR9pQ", roles: ["Admin"], active: true }];

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

function type(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function submit(form: HTMLFormElement, why: string): Promise<void> {
  const input = form.querySelector<HTMLInputElement>("input");
  if (!input) throw new Error("no input");
  act(() => {
    type(input, why);
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function noViolations(): Promise<void> {
  const result = await axe.run(el, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

describe("the share panel (R6.25)", () => {
  it("says where the criterion stands", () => {
    expect(shareState({ ...shared, driver: "local", dirty: [] }).label).toBe("Not shared");
    expect(shareState(shared).label).toBe("Not published yet");
    expect(shareState({ ...shared, dirty: [], behind: 2 }).label).toBe("2 change(s) to pull");
    expect(shareState({ ...shared, dirty: [], ahead: null, behind: null }).label).toBe("Not compared yet");
    expect(shareState({ ...shared, dirty: [] }).label).toBe("Up to date");
  });

  it("reads the share status from catalyst, fetching on asking", async () => {
    const seen: string[] = [];
    const client = new StudioClient({ url: "http://127.0.0.1:5000", token: "t" }, (input) => {
      seen.push(input instanceof Request ? input.url : String(input));
      return Promise.resolve(new Response(JSON.stringify(shared), { status: 200 }));
    });
    expect(await client.share()).toEqual(shared);
    await client.share(true);
    expect(seen).toEqual(["http://127.0.0.1:5000/v1/share", "http://127.0.0.1:5000/v1/share?fetch=1"]);
  });

  it("lists what is not published; inside a host, pulls and publishes through it", async () => {
    const { h, asked } = host();
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <ShareView status={shared} onFetch={() => undefined} onChanged={() => undefined} />
        </HostContext.Provider>,
      );
    });
    expect(el.textContent).toContain("development/journal/ada@Ab3xR9pQ/2026-10.jsonl");
    expect(el.textContent).not.toContain("Try it"); // catalyst try makes no share push
    const pull = [...el.querySelectorAll("button")].find((b) => b.textContent === "Pull");
    await act(async () => {
      pull?.click();
      await Promise.resolve();
    });
    const form = el.querySelector("form");
    if (!form) throw new Error("no publish form");
    await submit(form, "The week's work");
    expect(asked).toEqual([{ verb: "share-pull" }, { verb: "share-push", intent: "The week's work" }]);
    await noViolations();
  });

  it("offers nothing to publish when everything is, and the commands without a host", () => {
    act(() => {
      root.render(
        <ShareView status={{ ...shared, dirty: [] }} onFetch={() => undefined} onChanged={() => undefined} />,
      );
    });
    expect(el.textContent).toContain("Nothing: every change here is published.");
    expect(el.textContent).toContain("catalyst share pull");
    expect(el.querySelector("form")).toBeNull();
  });
});

describe("user administration in the Team view (R6.25)", () => {
  it("registers a user and deactivates one through the host, never offering a try", async () => {
    const { h, asked } = host();
    act(() => {
      root.render(
        <HostContext.Provider value={h}>
          <TeamView users={users} entries={[]} since="2026-10-04" roles={roles} />
        </HostContext.Provider>,
      );
    });
    expect(el.textContent).not.toContain("Try it");
    const add = el.querySelector<HTMLElement>(".add-user");
    const name = add?.querySelector<HTMLInputElement>("input");
    if (!add || !name) throw new Error("no registration");
    act(() => {
      type(name, "Grace Hopper");
    });
    const register = add.querySelector("form");
    if (!register) throw new Error("no register form");
    await submit(register, "Joins the team");
    const deactivate = [...el.querySelectorAll("form")].find((f) => f.textContent.includes("Deactivate"));
    if (!deactivate) throw new Error("no deactivate form");
    await submit(deactivate, "Left");
    expect(asked).toEqual([
      { verb: "user-add", name: "Grace Hopper", role: "Admin", intent: "Joins the team" },
      { verb: "user-remove", name: "ada", intent: "Left" },
    ]);
    await noViolations();
  });

  it("offers no change without a host", () => {
    act(() => {
      root.render(<TeamView users={users} entries={[]} since="2026-10-04" roles={roles} />);
    });
    expect(el.querySelector("form")).toBeNull();
    expect(el.textContent).not.toContain("Register a user");
  });
});
