import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InboxItem, InboxReport, StudioClient } from "../client.js";
import { itemKey, knowProject, markSeen, seenStore, studioProject, unread, UnreadCount } from "../Unread.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function item(kind: string, id: string): InboxItem {
  return { kind, id, title: id, evidence: {}, settle: [] };
}

const a = item("approval", "REQ-000001-Ab3xR9pQ");
const b = item("reconciliation", "RECON-000002-Ab3xR9pQ");

function client(items: InboxItem[]): StudioClient {
  return {
    inbox: (): Promise<InboxReport> => Promise.resolve({ items, counts: {} }),
    events: () => new Promise<void>(() => undefined),
  } as unknown as StudioClient;
}

let el: HTMLElement;
let root: Root;

/** A browser's storage, in memory: this test environment has none of its own. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (k: string) => data.get(k) ?? null,
    key: (i: number) => [...data.keys()][i] ?? null,
    removeItem: (k: string) => {
      data.delete(k);
    },
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage() });
  studioProject.name = "default";
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

describe("the inbox's unread count (R6.26)", () => {
  it("counts the items this viewer has not seen, kept per project", () => {
    expect(itemKey(a)).toBe("approval:REQ-000001-Ab3xR9pQ");
    expect(unread([a, b], new Set([itemKey(a)]))).toEqual([b]);
    markSeen([a], "shop");
    expect([...seenStore.read("shop")]).toEqual([itemKey(a)]);
    expect(seenStore.read("other").size).toBe(0);
  });

  it("survives a browser that refuses storage", () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("denied");
      },
    });
    try {
      expect(seenStore.read("shop").size).toBe(0);
      expect(() => {
        seenStore.write("shop", ["x"]);
      }).not.toThrow();
    } finally {
      if (real) Object.defineProperty(window, "localStorage", real);
    }
  });

  it("shows the count beside the Inbox, and drops it once the Inbox has shown them", async () => {
    knowProject("shop");
    await act(async () => {
      root.render(<UnreadCount client={client([a, b])} />);
      await Promise.resolve();
    });
    expect(el.querySelector(".badge")?.textContent).toBe("2");
    expect(el.querySelector(".badge")?.getAttribute("aria-label")).toBe("2 unread");
    act(() => {
      markSeen([a, b]);
    });
    expect(el.querySelector(".badge")).toBeNull();
  });
});
