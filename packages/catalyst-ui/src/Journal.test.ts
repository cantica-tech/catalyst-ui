import type { JournalEntry } from "catalyst-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Journal, matches } from "./Journal.js";

function entry(
  overrides: Partial<JournalEntry> & { artifact: string },
): JournalEntry {
  return {
    timestamp: "2026-08-01T00:00:00Z",
    actor: "alice",
    command: "/create-req",
    action: "create",
    targets: [],
    intent: ["Fixture intent."],
    files: [],
    ...overrides,
  };
}

describe("Journal", () => {
  it("renders every entry newest-first on initial (unfiltered) render", () => {
    // Journal uses hooks, so it must go through React's own element tree
    // (createElement) rather than being called directly as a plain
    // function the way the hookless NodeDetail/IamDetail components are
    // tested — calling it directly would invoke useState outside of any
    // React render pass.
    const html = renderToStaticMarkup(
      createElement(Journal, {
        entries: [
          entry({
            artifact: "REQ-000001",
            timestamp: "2026-08-01T00:00:00Z",
          }),
          entry({
            artifact: "REQ-000002",
            timestamp: "2026-08-15T00:00:00Z",
          }),
        ],
      }),
    );

    expect(html).toContain("REQ-000001");
    expect(html).toContain("REQ-000002");
    expect(html).toContain("2 of 2 entries");
    expect(html.indexOf("REQ-000002")).toBeLessThan(html.indexOf("REQ-000001"));
  });

  it("renders 'None.' when there are no entries", () => {
    const html = renderToStaticMarkup(createElement(Journal, { entries: [] }));
    expect(html).toContain("None.");
    expect(html).toContain("0 of 0 entries");
  });
});

describe("matches", () => {
  const e = entry({
    artifact: "REQ-000001",
    actor: "alice",
    timestamp: "2026-08-10T00:00:00Z",
    targets: ["fw-STRUCTURE-003"],
  });

  it("matches when every filter is blank", () => {
    expect(matches(e, "", "", "", "")).toBe(true);
  });

  it("filters by since", () => {
    expect(matches(e, "2026-08-01T00:00:00Z", "", "", "")).toBe(true);
    expect(matches(e, "2026-08-11T00:00:00Z", "", "", "")).toBe(false);
  });

  it("filters by actor", () => {
    expect(matches(e, "", "alice", "", "")).toBe(true);
    expect(matches(e, "", "bob", "", "")).toBe(false);
  });

  it("filters by artifact", () => {
    expect(matches(e, "", "", "REQ-000001", "")).toBe(true);
    expect(matches(e, "", "", "REQ-000002", "")).toBe(false);
  });

  it("filters by rule membership in targets", () => {
    expect(matches(e, "", "", "", "fw-STRUCTURE-003")).toBe(true);
    expect(matches(e, "", "", "", "fw-STRUCTURE-004")).toBe(false);
  });
});
