import * as assert from "assert";

import { breadthFirst, childId, itemKey } from "../tree-ids.js";

describe("tree identities (REQ-000017)", () => {
  it("keys items structurally", () => {
    assert.strictEqual(itemKey({ type: "node", node: { id: "REQ-000001-Ab3xR9pQ" } }, "x"), "node:REQ-000001-Ab3xR9pQ");
    assert.strictEqual(itemKey({ type: "deployment", corpusRoot: "/a/.criterion" }, "a"), "deployment:/a/.criterion");
    assert.strictEqual(
      itemKey({ type: "section", section: { kind: "requirement", nodes: [] } }, "Requirements (3)"),
      "section:requirement",
    );
    assert.strictEqual(itemKey({ type: "separator" }, "———"), "separator:———");
  });

  it("makes sibling ids unique", () => {
    const taken = new Map<string, number>();
    assert.strictEqual(childId("/root", "separator:-", taken), "/root/separator:-");
    assert.strictEqual(childId("/root", "separator:-", taken), "/root/separator:-#1");
    assert.strictEqual(childId("/root", "node:A", taken), "/root/node:A");
  });

  it("finds the shallowest match, bounded", () => {
    interface T {
      name: string;
      kids?: T[];
    }
    const deep: T = { name: "target" };
    const tree: T[] = [
      { name: "a", kids: [{ name: "b", kids: [deep] }] },
      { name: "c", kids: [{ name: "target" }] },
    ];
    const found = breadthFirst(
      tree,
      (t) => t.kids ?? [],
      (t) => t.name === "target",
    );
    assert.ok(found && found !== deep); // c's child (depth 1) before b's child (depth 2)
    assert.strictEqual(
      breadthFirst(
        tree,
        (t) => t.kids ?? [],
        (t) => t.name === "target",
        2,
      ),
      undefined,
    );
    assert.strictEqual(
      breadthFirst(
        tree,
        (t) => t.kids ?? [],
        () => false,
      ),
      undefined,
    );
  });
});
