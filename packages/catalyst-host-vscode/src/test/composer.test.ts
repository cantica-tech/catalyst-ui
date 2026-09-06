import * as assert from "assert";

import {
  buildAuthoringProposalContent,
  type ComposerInput,
} from "../composer.js";

function input(overrides: Partial<ComposerInput> = {}): ComposerInput {
  return {
    type: "requirement",
    domain: "CONTRACT",
    targets: ["core-CONTRACT-001"],
    title: "New requirement",
    description: "Because we need it.",
    ...overrides,
  };
}

describe("buildAuthoringProposalContent", () => {
  it("describes creating the requested artifact type and title", () => {
    const content = buildAuthoringProposalContent(input(), "PROP-000001");
    assert.match(content, /Create a new requirement artifact: New requirement/);
    assert.match(content, /Because we need it\./);
  });

  it("includes the given targets and domain constraint", () => {
    const content = buildAuthoringProposalContent(
      input({ targets: ["core-CONTRACT-001", "REQ-000001"] }),
      "PROP-000001",
    );
    assert.match(content, /- `core-CONTRACT-001`/);
    assert.match(content, /- `REQ-000001`/);
    assert.match(content, /Domain: `CONTRACT`/);
  });

  it("states the never-reused-id expectation, matching the roadmap's exit criterion", () => {
    const content = buildAuthoringProposalContent(
      input({ type: "rule" }),
      "PROP-000001",
    );
    assert.match(
      content,
      /new rule artifact exists with a valid, never-reused id/,
    );
  });
});
