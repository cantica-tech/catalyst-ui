import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EntityView, InboxItem, InboxReport } from "../client.js";
import { fileChange, inboxGroups, InboxItemPage, InboxList, isCommand } from "../Inbox.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commit: InboxItem = {
  kind: "unrecorded-commit",
  id: "abc1234",
  title: "quick fix",
  evidence: {
    commit: "abc1234def5678",
    author: "ada",
    files: [
      { path: "src/a.py", before: "h1", after: "h2" },
      { path: "src/new.py", before: null, after: "h3" },
      { path: "src/old.py", before: "h4", after: null },
    ],
  },
  settle: ["catalyst journal adopt abc1234 --intent <why>", "git revert abc1234"],
};

const recon: InboxItem = {
  kind: "reconciliation",
  id: "RECON-000001",
  title: "Two versions of REQ-000001",
  evidence: { status: "Open", entity: "REQ-000001" },
  settle: ["catalyst reconcile RECON-000001 accept", "catalyst reconcile RECON-000001 reject"],
};

const report: InboxReport = {
  items: [
    recon,
    commit,
    { kind: "unrecorded-change", id: "src/b.py", title: "changed", evidence: { path: "src/b.py" }, settle: [] },
    { kind: "future-kind", id: "X-1", title: "new", evidence: { note: "hello" }, settle: [] },
  ],
  counts: {},
};

describe("the inbox's groups (studio-SHELL-000005)", () => {
  it("follows catalyst's kinds in its order, an unknown kind last, empty kinds left out", () => {
    expect(inboxGroups(report).map((g) => [g.kind, g.items.length])).toEqual([
      ["unrecorded-commit", 1],
      ["unrecorded-change", 1],
      ["reconciliation", 1],
      ["future-kind", 1],
    ]);
  });

  it("names how each file changed", () => {
    expect(fileChange({ path: "a", before: null, after: "x" })).toBe("added");
    expect(fileChange({ path: "a", before: "x", after: null })).toBe("deleted");
    expect(fileChange({ path: "a", before: "x", after: "y" })).toBe("changed");
  });

  it("offers to copy commands only, not words", () => {
    expect(isCommand("git revert abc1234")).toBe(true);
    expect(isCommand("catalyst reconcile RECON-000001 accept")).toBe(true);
    expect(isCommand("discard the change")).toBe(false);
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

async function axeClean(): Promise<void> {
  const result = await axe.run(host, { resultTypes: ["violations"], rules: { "color-contrast": { enabled: false } } });
  expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

describe("the inbox (studio-SHELL-000005)", () => {
  it("lists every item by kind with its evidence in words, each opening its page", async () => {
    const opened: string[] = [];
    act(() => {
      root.render(<InboxList report={report} onOpen={(i) => opened.push(i.id)} />);
    });
    const text = host.textContent;
    expect(text).toContain("4 decisions to take");
    expect(text).toContain("Commits the journal does not record (1)");
    expect(text).toContain("by ada, commit abc1234, 3 files");
    expect(text).toContain("note: hello");
    expect(text.split("src/b.py")).toHaveLength(2); // a changed path is not said twice
    const button = [...host.querySelectorAll("button")].find((b) => b.textContent.includes("RECON-000001"));
    act(() => {
      button?.click();
    });
    expect(opened).toEqual(["RECON-000001"]);
    await axeClean();
  });

  it("says so when nothing waits", () => {
    act(() => {
      root.render(<InboxList report={{ items: [], counts: {} }} onOpen={() => undefined} />);
    });
    expect(host.textContent).toContain("Nothing waits");
  });

  it("shows a commit's files and copies a settling command, saying it did", async () => {
    const copied: string[] = [];
    act(() => {
      root.render(
        <InboxItemPage
          item={commit}
          onBack={() => undefined}
          copy={(t) => {
            copied.push(t);
            return Promise.resolve();
          }}
        />,
      );
    });
    const rows = [...host.querySelectorAll("tbody tr")].map((r) => r.textContent);
    expect(rows).toEqual(["src/a.pychanged", "src/new.pyadded", "src/old.pydeleted"]);
    expect(host.textContent).toContain("abc1234def5678");
    const copy = host.querySelector<HTMLButtonElement>('[aria-label="Copy git revert abc1234"]');
    await act(async () => {
      copy?.click();
      await Promise.resolve();
    });
    expect(copied).toEqual(["git revert abc1234"]);
    expect(host.textContent).toContain("Copied");
    await axeClean();
  });

  it("says when the clipboard refuses, and shows a case's own sections", async () => {
    const artifact = {
      id: "RECON-000001",
      type: "RECON",
      file: "r.md",
      links: {},
      linked_from: [],
      journal: [],
      sections: [{ heading: "Version A", text: "Sign in with a password" }],
    } as EntityView;
    act(() => {
      root.render(
        <InboxItemPage
          item={recon}
          artifact={artifact}
          onBack={() => undefined}
          copy={() => Promise.reject(new Error("denied"))}
        />,
      );
    });
    expect(host.textContent).toContain("About");
    expect(host.textContent).toContain("Version A");
    expect(host.textContent).toContain("Sign in with a password");
    const copy = host.querySelector<HTMLButtonElement>('[aria-label="Copy catalyst reconcile RECON-000001 accept"]');
    await act(async () => {
      copy?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Could not copy");
    await axeClean();
  });
});
