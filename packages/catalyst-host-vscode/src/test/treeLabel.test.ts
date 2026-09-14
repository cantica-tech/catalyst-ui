import * as assert from "assert";

import type { ChainNode } from "catalyst-core";

import { formatNodeLabel } from "../tree.js";

function node(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    artifactType: "requirement",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    references: [],
    ...overrides,
  } as ChainNode;
}

describe("formatNodeLabel", () => {
  it("formats a node with name and username, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
      name: "Password Reset Flow",
      signedOffBy: "Olivier Steck",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "Password Reset Flow [REQ-000001 - _Olivier Steck_]",
    );
  });

  it("formats a node with name but no username, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
      name: "Password Reset Flow",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "Password Reset Flow [REQ-000001]",
    );
  });

  it("falls back to title when name is missing, stripping the userid from ID", () => {
    const n = node({
      id: "REQ-000001-yCNjAMXO",
      kind: "dev-artifact",
      title: "Password Reset Flow Title",
      signedOffBy: "Olivier Steck",
    });
    assert.strictEqual(
      formatNodeLabel(n),
      "Password Reset Flow Title [REQ-000001 - _Olivier Steck_]",
    );
  });
});
