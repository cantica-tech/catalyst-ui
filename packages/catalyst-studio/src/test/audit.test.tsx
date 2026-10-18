import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AuditView, holds, rulesShown } from "../Audit.js";
import type { AuditPack } from "../client.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function pack(over: Partial<AuditPack["integrity"]> = {}): AuditPack {
  return {
    project: "shop",
    generated: "2026-10-18T14:00:00+00:00",
    catalyst: "0.87.0",
    kernel: "0.87.0",
    modules: [{ id: "software-engineering", version: "3.3.0" }],
    criterion_commit: "0123456789abcdef0123456789abcdef01234567",
    integrity: {
      journal: { entries: 12, errors: 0, warnings: 1 },
      check: { errors: 0, warnings: 2, first: [] },
      unapproved_rules: [],
      ...over,
    },
    signers: [{ name: "Ada", signed: 5 }],
    rules: [
      {
        id: "br-AUTH-000001-Ab3xR9pQ",
        title: "Sign in",
        status: "✅",
        strength: "must",
        domain: "AUTH",
        retired: false,
        chain: [
          {
            id: "REQ-000001-Ab3xR9pQ",
            type: "REQ",
            title: "Login",
            status: "Active",
            depth: 1,
            via: { id: "br-AUTH-000001-Ab3xR9pQ", field: "Targets", on: "REQ-000001-Ab3xR9pQ" },
          },
          {
            id: "TEST-000001-Ab3xR9pQ",
            type: "TEST",
            title: "Login works",
            status: "Passing",
            depth: 2,
            via: { id: "REQ-000001-Ab3xR9pQ", field: "Requirements", on: "TEST-000001-Ab3xR9pQ" },
          },
        ],
      },
      {
        id: "br-AUTH-000002-Ab3xR9pQ",
        title: "Lock out",
        status: "⏳",
        strength: "should",
        domain: "AUTH",
        retired: false,
        chain: [],
      },
      {
        id: "br-AUTH-000003-Ab3xR9pQ",
        title: "Old",
        status: "🗑",
        strength: "must",
        domain: "AUTH",
        retired: true,
        chain: [],
      },
    ],
  };
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

describe("the audit pack (R6.27)", () => {
  it("holds only when the journal, check and the gates all do", () => {
    expect(holds(pack())).toBe(true);
    expect(holds(pack({ unapproved_rules: ["br-AUTH-000001-Ab3xR9pQ"] }))).toBe(false);
    expect(holds(pack({ check: { errors: 1, warnings: 0, first: ["x"] } }))).toBe(false);
  });

  it("filters to the live rules nothing rests on", () => {
    expect(rulesShown(pack(), true).map((r) => r.id)).toEqual(["br-AUTH-000002-Ab3xR9pQ"]);
    expect(rulesShown(pack(), false)).toHaveLength(3);
  });

  it("shows each rule's chain, nearest first, and prints", async () => {
    let printed = 0;
    act(() => {
      root.render(
        <AuditView
          pack={pack()}
          print={() => {
            printed++;
          }}
        />,
      );
    });
    const text = el.textContent;
    expect(text).toContain("The record holds");
    expect(text).toContain("3 rules; 1 with nothing resting on them");
    expect(text).toContain("TEST-000001-Ab3xR9pQ");
    expect(text).toContain("Requirements of TEST-000001-Ab3xR9pQ");
    expect(text).toContain("Nothing rests on it");
    const printButton = Array.from(el.querySelectorAll("button")).find((b) => b.textContent.includes("Print"));
    act(() => {
      printButton?.click();
    });
    expect(printed).toBe(1);
    const result = await axe.run(el);
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});
