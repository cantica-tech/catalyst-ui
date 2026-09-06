import * as assert from "assert";

import type { ValidationIssue } from "catalyst-core";

import {
  buildProposeFixContent,
  canProposeFix,
  defaultExpectationFor,
} from "../codeactions.js";

function issue(overrides: Partial<ValidationIssue> = {}): ValidationIssue {
  return {
    kind: "orphaned-artifact",
    severity: "error",
    message: "no targets",
    nodeId: "REQ-000001",
    ...overrides,
  };
}

describe("canProposeFix", () => {
  it("allows a fix when nothing already targets the node", () => {
    assert.strictEqual(canProposeFix(issue(), new Set()), true);
  });

  it("refuses when an open proposal already targets the node", () => {
    assert.strictEqual(canProposeFix(issue(), new Set(["REQ-000001"])), false);
  });

  it("refuses when the issue has no concrete node to target", () => {
    assert.strictEqual(
      canProposeFix(issue({ nodeId: undefined }), new Set()),
      false,
    );
  });
});

describe("defaultExpectationFor", () => {
  it("has a distinct sentence for every issue kind", () => {
    const kinds: ValidationIssue["kind"][] = [
      "orphaned-artifact",
      "unbacked-rule",
      "id-reuse",
      "dangling-reference",
    ];
    const sentences = kinds.map(defaultExpectationFor);
    assert.strictEqual(new Set(sentences).size, kinds.length);
    for (const s of sentences) assert.ok(s.length > 0);
  });
});

describe("buildProposeFixContent", () => {
  it("targets the issue's node and cites the issue message as intent", () => {
    const content = buildProposeFixContent(
      issue({ message: "REQ-000001 has no Targets rule" }),
      "PROP-000001",
    );
    assert.match(content, /REQ-000001 has no Targets rule/);
    assert.match(content, /- `REQ-000001`/);
    assert.match(
      content,
      new RegExp(defaultExpectationFor("orphaned-artifact")),
    );
  });
});
