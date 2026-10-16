import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { HistoryEntry, JournalEntry } from "../client.js";
import { diffStat, hunks, lineDiff } from "../diff.js";
import { changeKind, DiffView, EntityHistory } from "../History.js";
import { byDay, fileKind, filterJournal, JournalTimeline } from "../Journal.js";
import { Shell } from "../Shell.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the line diff (studio-SHELL-000007)", () => {
  it("keeps common lines and marks what was removed and added, with line numbers", () => {
    const d = lineDiff("a\nb\nc\n", "a\nB\nc\nd\n");
    expect(d.map((l) => `${l.kind}:${l.text}`)).toEqual(["same:a", "del:b", "add:B", "same:c", "add:d"]);
    expect(d[1].before).toBe(2);
    expect(d[2].after).toBe(2);
    expect(diffStat(d)).toEqual({ removed: 1, added: 2 });
  });

  it("reads no file as empty: all added, or all removed", () => {
    expect(lineDiff(null, "x\ny").map((l) => l.kind)).toEqual(["add", "add"]);
    expect(lineDiff("x", null).map((l) => l.kind)).toEqual(["del"]);
  });

  it("shows each change with two lines of context, joining close changes", () => {
    const before = Array.from({ length: 20 }, (_, i) => `l${String(i)}`).join("\n");
    const after = before.replace("l3", "L3").replace("l5", "L5").replace("l17", "L17");
    const runs = hunks(lineDiff(before, after));
    expect(runs).toHaveLength(2);
    expect(runs[0].lines[0].text).toBe("l1");
    expect(runs[1].lines.at(-1)?.text).toBe("l19");
    expect(hunks(lineDiff("same", "same"))).toEqual([]);
  });
});

function entry(at: string, timestamp: string, actor: string, more: Partial<JournalEntry> = {}): JournalEntry {
  return { at, timestamp, actor, action: "update", intent: ["why"], ...more };
}

const entries: JournalEntry[] = [
  entry("j:1", "2026-10-15T09:00:00Z", "ada", { artifact: "REQ-000001-Ab3xR9pQ", intent: ["Open the sign-in work"] }),
  entry("j:2", "2026-10-16T08:00:00Z", "bob", {
    artifact: "DEPLOYMENT.md history: kernel 0.75.0",
    files: [
      { path: "DEPLOYMENT.md", before: "h1", after: "h2" },
      { path: "new.md", before: null, after: "h3" },
    ],
  }),
  entry("j:3", "2026-10-16T10:30:00Z", "ada", { artifact: "br-AUTH-000001-Ab3xR9pQ", tier: "feature" }),
];

describe("the journal's filters (studio-SHELL-000007)", () => {
  it("groups by day, newest first, and filters by actor and words", () => {
    expect(byDay(entries).map((d) => [d.day, d.entries.map((e) => e.at)])).toEqual([
      ["2026-10-16", ["j:3", "j:2"]],
      ["2026-10-15", ["j:1"]],
    ]);
    expect(filterJournal(entries, "ada", "").map((e) => e.at)).toEqual(["j:1", "j:3"]);
    expect(filterJournal(entries, "", "sign-in").map((e) => e.at)).toEqual(["j:1"]);
    expect(filterJournal(entries, "", "new.md").map((e) => e.at)).toEqual(["j:2"]);
    expect(fileKind({ before: null, after: "x" })).toBe("added");
    expect(fileKind({ before: "x", after: null })).toBe("removed");
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

describe("the journal timeline (studio-SHELL-000007)", () => {
  it("shows each day's entries and opens an entity's page in the Artifacts view", async () => {
    const opened: (string | undefined)[] = [];
    act(() => {
      root.render(
        <Shell
          project="p"
          onTheme={() => undefined}
          initialView="journal"
          views={[
            {
              id: "artifacts",
              label: "Artifacts",
              render: (target) => {
                opened.push(target);
                return <p>page of {target}</p>;
              },
            },
            {
              id: "journal",
              label: "Journal",
              render: () => <JournalTimeline entries={entries} since="2026-10-01" />,
            },
          ]}
        />,
      );
    });
    const text = host.textContent;
    expect(text).toContain("3 of 3 entries since 2026-10-01");
    expect(text).toContain("2026-10-16");
    expect(text).toContain("Open the sign-in work");
    expect(text).toContain("DEPLOYMENT.md history: kernel 0.75.0"); // a free label, not a link
    expect([...host.querySelectorAll("button code")].map((c) => c.textContent)).toEqual([
      "br-AUTH-000001-Ab3xR9pQ",
      "REQ-000001-Ab3xR9pQ",
    ]);
    await axeClean();
    const req = [...host.querySelectorAll("button")].find((b) => b.textContent === "REQ-000001-Ab3xR9pQ");
    act(() => {
      req?.click();
    });
    expect(host.textContent).toContain("page of REQ-000001-Ab3xR9pQ");
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe("Artifacts");
    expect(document.activeElement?.id).toBe("studio-main");
  });
});

function change(more: Partial<HistoryEntry>): HistoryEntry {
  return {
    timestamp: "2026-10-16T08:00:00Z",
    actor: "ada",
    command: "/status",
    action: "update",
    artifact: "REQ-000001",
    tier: "feature",
    intent: ["Move it on"],
    before: "b1",
    after: "b2",
    content_before: "| Status | Draft |\n",
    content_after: "| Status | Active |\n",
    redacted: false,
    ...more,
  };
}

describe("an entity's history (studio-SHELL-000007)", () => {
  it("lists each change newest first, each opening to its diff said in words", async () => {
    act(() => {
      root.render(
        <EntityHistory
          entries={[
            change({ before: null, content_before: null, intent: ["Create it"] }),
            change({}),
            change({ redacted: true, content_before: null, content_after: null, intent: ["Redacted one"] }),
            change({ content_before: null, intent: ["Lost one"] }),
          ]}
        />,
      );
    });
    const items = [...host.querySelectorAll("ol.history > li")];
    expect(items.map((li) => li.querySelector("summary")?.textContent)).toEqual([
      expect.stringContaining("Lost one"),
      expect.stringContaining("Redacted one"),
      expect.stringContaining("changed"),
      expect.stringContaining("created"),
    ]);
    expect(items[0].textContent).toContain("catalyst no longer holds this version");
    expect(items[1].textContent).toContain("redacted");
    expect(items[2].textContent).toContain("removed: | Status | Draft |");
    expect(items[2].textContent).toContain("added: | Status | Active |");
    expect(items[2].textContent).toContain("1 line removed, 1 line added");
    expect(changeKind(change({ after: null }))).toBe("removed");
    await axeClean();
  });

  it("says when nothing changed", () => {
    act(() => {
      root.render(<DiffView before="x" after="x" label="The change" />);
    });
    expect(host.textContent).toContain("did not change");
  });
});
