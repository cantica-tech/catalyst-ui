import * as assert from "assert";

import type { Proposal } from "catalyst-core";

import { buildProposalSection, renderProposalContent } from "../proposals.js";

function proposal(overrides: Partial<Proposal> & { id: string }): Proposal {
  return {
    status: "proposed",
    intent: "x",
    targets: [],
    expectations: [],
    constraints: [],
    location: { file: "p.md", line: 1 },
    ...overrides,
  };
}

describe("buildProposalSection", () => {
  it("labels the section with the proposal count and carries them through", () => {
    const proposals = [proposal({ id: "PROP-000001" }), proposal({ id: "PROP-000002" })];
    const section = buildProposalSection(proposals);
    assert.strictEqual(section.label, "Proposals (2)");
    assert.deepStrictEqual(section.proposals, proposals);
  });

  it("handles an empty list", () => {
    assert.strictEqual(buildProposalSection([]).label, "Proposals (0)");
  });
});

describe("renderProposalContent", () => {
  it("renders id, intent, targets, expectations, and constraints", () => {
    const content = renderProposalContent({
      id: "PROP-000001",
      title: "Propose fix: orphaned-artifact",
      intent: "REQ-000001 has no Targets",
      targets: ["REQ-000001"],
      expectations: ["REQ-000001 has a resolvable Targets field."],
      constraints: ["CODE-OF-CONDUCT.md §1"],
    });

    assert.match(content, /\*\*ID\*\* \| `PROP-000001`/);
    assert.match(content, /\*\*Status\*\* \| proposed/);
    assert.match(content, /REQ-000001 has no Targets/);
    assert.match(content, /- `REQ-000001`/);
    assert.match(content, /- REQ-000001 has a resolvable Targets field\./);
    assert.match(content, /- CODE-OF-CONDUCT\.md §1/);
  });

  it("renders a placeholder for empty targets/constraints rather than an empty section", () => {
    const content = renderProposalContent({
      id: "PROP-000001",
      title: "x",
      intent: "x",
      targets: [],
      expectations: ["x"],
      constraints: [],
    });

    assert.match(content, /## Targets\n\n- \(none\)/);
    assert.match(content, /## Constraints\n\n- \(none\)/);
  });
});
