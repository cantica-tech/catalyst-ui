import * as assert from "assert";

import type {
  ChainModel,
  ChainNode,
  IamRole,
  IamUser,
  Proposal,
} from "catalyst-core";

import {
  buildIamRoleDetail,
  buildIamUserDetail,
  buildNodeDetail,
} from "../detail.js";

const noProposals = new Map<string, Proposal[]>();

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

function user(overrides: Partial<IamUser> & { name: string }): IamUser {
  return {
    roles: [],
    registered: "2026-01-01",
    active: true,
    notes: "",
    ...overrides,
  };
}

function role(overrides: Partial<IamRole> & { name: string }): IamRole {
  return { actions: [], ...overrides };
}

describe("buildNodeDetail", () => {
  it("returns null for an id not in the model", () => {
    const model: ChainModel = {
      nodes: new Map(),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };
    assert.strictEqual(buildNodeDetail(model, "nowhere", noProposals), null);
  });

  it("resolves upstream and downstream from the model's edges", () => {
    const req = node({ id: "REQ-000002", kind: "dev-artifact" });
    const rule = node({
      id: "vscode-INSPECTOR-001",
      kind: "rule",
      docPrefix: "vscode",
      domain: "INSPECTOR",
    });

    const model: ChainModel = {
      nodes: new Map([
        [req.id, req],
        [rule.id, rule],
      ]),
      edges: new Map([[req.id, new Set([rule.id])]]),
      reverseEdges: new Map([[rule.id, new Set([req.id])]]),
      definitionsById: new Map(),
    };

    const reqDetail = buildNodeDetail(model, req.id, noProposals)!;
    assert.strictEqual(reqDetail.node.id, "REQ-000002");
    assert.deepStrictEqual(
      reqDetail.upstream.map((n) => n.id),
      ["vscode-INSPECTOR-001"],
    );
    assert.deepStrictEqual(reqDetail.downstream, []);

    const ruleDetail = buildNodeDetail(model, rule.id, noProposals)!;
    assert.deepStrictEqual(ruleDetail.upstream, []);
    assert.deepStrictEqual(
      ruleDetail.downstream.map((n) => n.id),
      ["REQ-000002"],
    );
  });

  it("includes any open proposal targeting the node", () => {
    const req = node({ id: "REQ-000001", kind: "dev-artifact" });
    const model: ChainModel = {
      nodes: new Map([[req.id, req]]),
      edges: new Map(),
      reverseEdges: new Map(),
      definitionsById: new Map(),
    };
    const proposal: Proposal = {
      id: "PROP-000001",
      status: "proposed",
      intent: "Fix it",
      targets: ["REQ-000001"],
      expectations: [],
      constraints: [],
      location: { file: "p.md", line: 1 },
    };
    const byTarget = new Map([["REQ-000001", [proposal]]]);

    const detail = buildNodeDetail(model, req.id, byTarget)!;
    assert.deepStrictEqual(detail.openProposals, [proposal]);
  });

  it("includes a requirement's steps in its downstream, resolved from reverseEdges", () => {
    const req = node({ id: "REQ-000001", kind: "dev-artifact" });
    const step: ChainNode = {
      id: "STEP-000001",
      kind: "step",
      title: "STEP-000001",
      location: { file: "f.md", line: 1 },
      references: [],
      parent: "REQ-000001",
      status: "done",
      registered: true,
      fileExists: true,
      description: "",
      content: "",
    } as ChainNode;
    const model: ChainModel = {
      nodes: new Map([
        [req.id, req],
        [step.id, step],
      ]),
      edges: new Map([[step.id, new Set([req.id])]]),
      reverseEdges: new Map([[req.id, new Set([step.id])]]),
      definitionsById: new Map(),
    };

    const reqDetail = buildNodeDetail(model, req.id, noProposals)!;
    assert.deepStrictEqual(
      reqDetail.downstream.map((n) => n.id),
      ["STEP-000001"],
    );

    const stepDetail = buildNodeDetail(model, step.id, noProposals)!;
    assert.deepStrictEqual(
      stepDetail.upstream.map((n) => n.id),
      ["REQ-000001"],
    );
  });

  it("includes a requirement's and a step's tests in their downstream, resolved from reverseEdges", () => {
    const req = node({ id: "REQ-000001", kind: "dev-artifact" });
    const step: ChainNode = {
      id: "STEP-000001",
      kind: "step",
      title: "STEP-000001",
      location: { file: "f.md", line: 1 },
      references: [],
      parent: "REQ-000001",
      status: "done",
      registered: true,
      fileExists: true,
      description: "",
      content: "",
    } as ChainNode;
    const test = node({
      id: "TEST-000001",
      kind: "dev-artifact",
      artifactType: "test",
      status: "passing",
      targets: ["env-RUNTIME-001"],
      requirements: ["REQ-000001"],
      steps: ["STEP-000001"],
      registered: true,
      fileExists: true,
      description: "",
      content: "",
    });
    const model: ChainModel = {
      nodes: new Map([
        [req.id, req],
        [step.id, step],
        [test.id, test],
      ]),
      edges: new Map([[test.id, new Set([req.id, step.id])]]),
      reverseEdges: new Map([
        [req.id, new Set([test.id])],
        [step.id, new Set([test.id])],
      ]),
      definitionsById: new Map(),
    };

    const reqDetail = buildNodeDetail(model, req.id, noProposals)!;
    assert.deepStrictEqual(
      reqDetail.downstream.map((n) => n.id),
      ["TEST-000001"],
    );

    const stepDetail = buildNodeDetail(model, step.id, noProposals)!;
    assert.deepStrictEqual(
      stepDetail.downstream.map((n) => n.id),
      ["TEST-000001"],
    );

    const testDetail = buildNodeDetail(model, test.id, noProposals)!;
    assert.deepStrictEqual(
      testDetail.upstream.map((n) => n.id),
      ["REQ-000001", "STEP-000001"],
    );
  });
});

describe("buildIamUserDetail", () => {
  it("resolves the role objects a user's roles array names, sorted by name", () => {
    const alice = user({ name: "alice", roles: ["Tech Lead", "Developer"] });
    const roles = [
      role({ name: "Developer" }),
      role({ name: "Tech Lead" }),
      role({ name: "QA" }),
    ];

    const detail = buildIamUserDetail(alice, roles);
    assert.strictEqual(detail.user, alice);
    assert.deepStrictEqual(
      detail.roles.map((r) => r.name),
      ["Developer", "Tech Lead"],
    );
  });

  it("returns an empty roles list when none of the user's role names match", () => {
    const alice = user({ name: "alice", roles: ["Ghost Role"] });
    const detail = buildIamUserDetail(alice, [role({ name: "Developer" })]);
    assert.deepStrictEqual(detail.roles, []);
  });
});

describe("buildIamRoleDetail", () => {
  it("resolves every user whose roles array names this role, sorted by name", () => {
    const developer = role({ name: "Developer" });
    const users = [
      user({ name: "bob", roles: ["Developer"] }),
      user({ name: "alice", roles: ["Developer"] }),
      user({ name: "carol", roles: ["Tech Lead"] }),
    ];

    const detail = buildIamRoleDetail(developer, users);
    assert.strictEqual(detail.role, developer);
    assert.deepStrictEqual(
      detail.users.map((u) => u.name),
      ["alice", "bob"],
    );
  });

  it("returns an empty users list when no user has this role", () => {
    const detail = buildIamRoleDetail(role({ name: "Orphan Role" }), [
      user({ name: "alice", roles: ["Developer"] }),
    ]);
    assert.deepStrictEqual(detail.users, []);
  });
});
