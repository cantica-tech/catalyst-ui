import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError, connectionFromPage, parseBatch, StudioClient } from "../client.js";
import { compareVersions, OverviewView, type OverviewData } from "../Overview.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const connection = { url: "http://127.0.0.1:5000", token: "cst_test" };

function jsonFetch(routes: Record<string, unknown>, seen: { url: string; auth: string | null }[] = []) {
  return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = input instanceof Request ? input.url : input.toString();
    seen.push({ url, auth: new Headers(init?.headers).get("Authorization") });
    const route = url.replace(`${connection.url}/v1/`, "");
    return Promise.resolve(
      route in routes
        ? new Response(JSON.stringify(routes[route]), { status: 200 })
        : new Response("{}", { status: 404, statusText: "Not Found" }),
    );
  };
}

describe("the Studio client (studio-SHELL-000001)", () => {
  it("calls /v1 with the token as a bearer", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const client = new StudioClient(connection, jsonFetch({ check: { ok: true, errors: [], warnings: [] } }, seen));
    expect(await client.check()).toEqual({ ok: true, errors: [], warnings: [] });
    expect(seen).toEqual([{ url: "http://127.0.0.1:5000/v1/check", auth: "Bearer cst_test" }]);
  });

  it("turns an HTTP failure into an ApiError with its status", async () => {
    const client = new StudioClient(connection, jsonFetch({}));
    await expect(client.inbox()).rejects.toEqual(new ApiError(404, "inbox: 404 Not Found"));
  });

  it("reads each batch of the events stream, across chunk boundaries", async () => {
    const chunks = ["event: batch\nda", "ta: 3\n\n: keep-alive\n\nevent: batch\ndata: 4\n\n"];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
        controller.close();
      },
    });
    const client = new StudioClient(connection, () => Promise.resolve(new Response(body, { status: 200 })));
    const batches: number[] = [];
    await client.events((n) => batches.push(n));
    expect(batches).toEqual([3, 4]);
    expect(parseBatch("event: other\ndata: 1")).toBeNull();
  });

  it("takes the token from the fragment and clears it from the address bar", () => {
    window.history.replaceState(null, "", "/studio?x=1#token=cst_page");
    expect(connectionFromPage(window)).toEqual({ url: window.location.origin, token: "cst_page" });
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?x=1");
    expect(connectionFromPage(window)).toBeNull();
  });

  it("prefers a connection the host hands over", () => {
    const win = window as Window & { catalystStudio?: unknown };
    win.catalystStudio = { url: "http://127.0.0.1:6000", token: "cst_host" };
    expect(connectionFromPage(window)).toEqual({ url: "http://127.0.0.1:6000", token: "cst_host" });
    delete win.catalystStudio;
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

describe("the dashboard (studio-SHELL-000003)", () => {
  const busy: OverviewData = {
    check: { ok: false, errors: ["INV-7 naming: x"], warnings: ["w1", "w2"] },
    inbox: {
      items: [
        {
          kind: "unrecorded-change",
          id: "src/a.py",
          title: "changed in the project, not in the journal",
          evidence: { path: "src/a.py" },
          settle: ["catalyst journal append --file src/a.py --intent <why> …", "discard the change"],
        },
        {
          kind: "unrecorded-commit",
          id: "abc1234",
          title: "quick fix",
          evidence: {
            commit: "abc1234def",
            author: "ada",
            files: [
              { path: "src/a.py", before: "h1", after: "h2" },
              { path: "src/b.py", before: null, after: "h3" },
            ],
          },
          settle: ["catalyst journal adopt abc1234 --intent <why>", "git revert abc1234"],
        },
        {
          kind: "reconciliation",
          id: "RECON-000001",
          title: "Two versions of REQ-000001",
          evidence: { status: "Open", entity: "REQ-000001" },
          settle: ["catalyst reconcile RECON-000001 accept"],
        },
        {
          kind: "analysis",
          id: "AN-000001",
          title: "Rules for auth",
          evidence: { status: "Deciding", scope: null },
          settle: ["catalyst analysis decide AN-000001 …"],
        },
      ],
      counts: { "unrecorded-change": 1, "unrecorded-commit": 1, reconciliation: 1, analysis: 1 },
    },
    backlog: {
      open: { REQ: { Draft: ["REQ-000001"], Active: ["REQ-000002", "REQ-000003"] }, BUG: {} },
      missing_links: [{ id: "REQ-000001", field: "Targets" }],
      rules_without_open_work: ["br-AUTH-000001"],
    },
    head: { seq: 3, files: 10, kernel: "0.73.0", modules: [{ id: "process", version: "3.2.0" }], catalyst: "0.74.0" },
    recent: [
      {
        at: "j:1",
        timestamp: "2026-10-16T08:00:00Z",
        actor: "ada",
        action: "create",
        artifact: "REQ-000001",
        intent: ["Create it"],
      },
    ],
    typeNames: { REQ: "Requirements" },
  };

  it("shows health, what waits with the commands that settle it, open work, versions and activity", async () => {
    act(() => {
      root.render(<OverviewView data={busy} />);
    });
    const text = host.textContent;
    expect(text).toContain("1 error");
    expect(text).toContain("2 warnings");
    expect(text).toContain("INV-7 naming: x");
    expect(text).toContain("4 decisions to take");
    expect(text).toContain("by ada, commit abc1234, 2 files");
    expect(text).toContain("Open, about REQ-000001");
    expect(text).toContain("catalyst journal adopt abc1234 --intent <why>");
    expect(text).toContain("git revert abc1234");
    expect(text).toContain("Requirements");
    expect(text).toContain("1 missing link");
    expect(text).toContain("1 rule with no open work.");
    expect(text).toContain("Kernel 0.73.0");
    expect(text).toContain("Behind");
    expect(text).toContain("catalyst sync plan");
    expect(text).toContain("Create it");
    const rows = [...host.querySelectorAll("tbody tr")].map((r) => r.textContent);
    expect(rows).toEqual(["RequirementsDraft1", "RequirementsActive2"]);
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("says so when all is well, and leaves out what an older catalyst does not serve", () => {
    act(() => {
      root.render(
        <OverviewView data={{ check: { ok: true, errors: [], warnings: [] }, inbox: { items: [], counts: {} } }} />,
      );
    });
    expect(host.textContent).toContain("No errors");
    expect(host.textContent).toContain("Nothing waiting");
    expect(host.textContent).not.toContain("Versions");
  });

  it("compares versions by number", () => {
    expect(compareVersions("0.73.0", "0.74.0")).toBeLessThan(0);
    expect(compareVersions("0.74.0", "0.74.0+gabc")).toBe(0);
    expect(compareVersions("0.100.0", "0.99.0")).toBeGreaterThan(0);
  });
});
