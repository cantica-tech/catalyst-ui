import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApiError, connectionFromPage, parseBatch, StudioClient } from "../client.js";
import { OverviewView, type OverviewData } from "../Overview.js";

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

describe("the overview (studio-SHELL-000001)", () => {
  const busy: OverviewData = {
    check: { ok: false, errors: ["INV-7 naming: x"], warnings: ["w1", "w2"] },
    inbox: { items: [], counts: { "unrecorded-change": 2, reconciliation: 1, analysis: 0 } },
  };

  it("shows the errors and warnings, and what waits for a person with the command that lists it", async () => {
    act(() => {
      root.render(<OverviewView data={busy} />);
    });
    const text = host.textContent;
    expect(text).toContain("1 error");
    expect(text).toContain("2 warnings");
    expect(text).toContain("INV-7 naming: x");
    expect(text).toContain("3 decisions to take");
    expect(text).toContain("Changes made outside catalyst: 2");
    expect(text).not.toContain("Analyses");
    expect(text).toContain("catalyst inbox");
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });

  it("says so when all is well", () => {
    act(() => {
      root.render(
        <OverviewView data={{ check: { ok: true, errors: [], warnings: [] }, inbox: { items: [], counts: {} } }} />,
      );
    });
    expect(host.textContent).toContain("No errors");
    expect(host.textContent).toContain("Nothing waiting");
  });
});
