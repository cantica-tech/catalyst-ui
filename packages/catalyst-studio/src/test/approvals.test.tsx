import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ApprovalsView, reconciliationCases, signers } from "../Approvals.js";
import type { Graph, User } from "../client.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const graph: Graph = {
  types: {
    RECON: {
      name: "Reconciliation",
      plural_name: "Reconciliations",
      fields: [],
      states: ["Open", "Under Review", "Resolved-Accepted", "Closed"],
      initial: "Open",
      closed_states: ["Resolved-Accepted", "Closed"],
    },
    REQ: {
      name: "Requirement",
      plural_name: "Requirements",
      fields: [],
      states: ["Draft", "Done"],
      initial: "Draft",
      closed_states: ["Done"],
    },
  },
  artifacts: [
    {
      id: "RECON-000002",
      type: "RECON",
      title: "Two versions",
      file: "r2",
      links: {},
      Status: "Resolved-Accepted",
      Entity: "`REQ-000001`",
    },
    {
      id: "RECON-000001",
      type: "RECON",
      title: "Disputed",
      file: "r1",
      links: {},
      Status: "Under Review",
      Entity: "REQ-000002",
    },
    { id: "REQ-000001", type: "REQ", file: "a", links: {}, Status: "Done", "Signed-off-by": "ada" },
    { id: "REQ-000002", type: "REQ", file: "b", links: {}, Status: "Draft", "Signed-off-by": "ada" },
    { id: "REQ-000003", type: "REQ", file: "c", links: {}, Status: "Draft", "Signed-off-by": "mallory" },
  ],
};

const users: User[] = [{ name: "ada", userid: "Ab3xR9pQ", roles: ["Admin"], active: true }];

describe("the approvals' data (studio-SHELL-000014)", () => {
  it("lists the cases open first, by the type's closed states", () => {
    expect(reconciliationCases(graph).map((c) => [c.id, c.closed, c.entity])).toEqual([
      ["RECON-000001", false, "REQ-000002"],
      ["RECON-000002", true, "REQ-000001"],
    ]);
  });

  it("counts each signer's sign-offs and the closed ones, marking an unregistered signer", () => {
    expect(signers(graph, users)).toEqual([
      { name: "ada", signed: 2, closed: 1, registered: true },
      { name: "mallory", signed: 1, closed: 0, registered: false },
    ]);
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

describe("the approvals (studio-SHELL-000014)", () => {
  it("shows the cases and the signers", async () => {
    act(() => {
      root.render(<ApprovalsView graph={graph} users={users} />);
    });
    expect(host.textContent).toContain("1 open");
    expect([...host.querySelectorAll("tbody tr")].map((r) => r.textContent)).toEqual([
      "RECON-000001 DisputedREQ-000002!Under Review",
      "RECON-000002 Two versionsREQ-000001✓Resolved-Accepted",
      "ada 21",
      "mallory ✕Not a registered user10",
    ]);
    const result = await axe.run(host, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it("says so when there is nothing to approve", () => {
    act(() => {
      root.render(<ApprovalsView graph={{ types: {}, artifacts: [] }} users={[]} />);
    });
    expect(host.textContent).toContain("No reconciliation case.");
    expect(host.textContent).toContain("No entity names a signer.");
  });
});
