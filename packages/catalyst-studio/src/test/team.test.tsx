import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { JournalEntry, User } from "../client.js";
import { activity, TeamView } from "../Team.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function e(at: string, actor: string, artifact: string, timestamp: string): JournalEntry {
  return { at, actor, artifact, timestamp, action: "update", intent: [`work on ${artifact}`] };
}

const entries = [
  e("j:1", "ada", "REQ-000001-Ab3xR9pQ", "2026-10-15T09:00:00Z"),
  e("j:2", "ada", "REQ-000001-Ab3xR9pQ", "2026-10-15T10:00:00Z"),
  e("j:3", "ada", "BUG-000002-Ab3xR9pQ", "2026-10-16T08:00:00Z"),
  e("j:4", "ghost", "DEPLOYMENT.md history", "2026-10-16T09:00:00Z"),
];

const users: User[] = [
  { name: "bob", userid: "Bb3xR9pQ", roles: ["Developer"], active: false, registered: "2026-09-01" },
  { name: "ada", userid: "Ab3xR9pQ", roles: ["Admin"], active: true, registered: "2026-09-01" },
];

describe("the team's activity (studio-SHELL-000012)", () => {
  it("counts each actor's entries, last time, most-touched entities and latest entries", () => {
    const a = activity(entries).get("ada");
    expect(a?.entries).toBe(3);
    expect(a?.last).toBe("2026-10-16T08:00:00Z");
    expect(a?.top).toEqual([
      ["REQ-000001-Ab3xR9pQ", 2],
      ["BUG-000002-Ab3xR9pQ", 1],
    ]);
    expect(a?.latest.map((x) => x.at)).toEqual(["j:3", "j:2", "j:1"]);
    expect(activity(entries).get("ghost")?.top).toEqual([]); // a free label is no entity
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

describe("the team (studio-SHELL-000012)", () => {
  it("lists the active users first, each with their work, and the unregistered apart", async () => {
    act(() => {
      root.render(<TeamView users={users} entries={entries} since="2026-10-02" />);
    });
    expect([...host.querySelectorAll("article h3")].map((h) => h.textContent)).toEqual(["ada", "bob", "ghost"]);
    expect(host.textContent).toContain("3 entries, the last 2026-10-16T08:00:00Z");
    expect(host.textContent).toContain("Nothing in the journal in this window.");
    expect(host.textContent).toContain("In the journal, not registered");
    expect(host.textContent).toContain("Not registered");
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
