import * as assert from "assert";

import { readGrouping, targetColumn, type OpenDetailPanel } from "../panel-groups.js";

const panel = (project: string, column: number | undefined, lastActive: number): OpenDetailPanel => ({
  project,
  column,
  lastActive,
});

describe("detail panel placement (REQ-000013)", () => {
  it("opens a project's first panel beside the active editor", () => {
    assert.strictEqual(targetColumn([], "/a", "perProject"), "beside");
    assert.strictEqual(targetColumn([panel("/b", 2, 1)], "/a", "perProject"), "beside");
  });

  it("joins the group its project's panels are in", () => {
    assert.strictEqual(targetColumn([panel("/a", 2, 1), panel("/b", 3, 5)], "/a", "perProject"), 2);
  });

  it("follows the most recently focused panel when the user moved some", () => {
    const open = [panel("/a", 2, 1), panel("/a", 4, 9), panel("/a", 3, 5)];
    assert.strictEqual(targetColumn(open, "/a", "perProject"), 4);
  });

  it("ignores hidden panels (no column)", () => {
    assert.strictEqual(targetColumn([panel("/a", undefined, 9), panel("/a", 2, 1)], "/a", "perProject"), 2);
    assert.strictEqual(targetColumn([panel("/a", undefined, 9)], "/a", "perProject"), "beside");
  });

  it("single: every project shares one group", () => {
    assert.strictEqual(targetColumn([panel("/b", 3, 5)], "/a", "single"), 3);
    assert.strictEqual(targetColumn([panel("/b", 3, 5), panel("/a", 2, 7)], "/c", "single"), 2);
  });

  it("reads the setting, defaulting to perProject", () => {
    assert.strictEqual(readGrouping("single"), "single");
    assert.strictEqual(readGrouping("perProject"), "perProject");
    assert.strictEqual(readGrouping(undefined), "perProject");
    assert.strictEqual(readGrouping("nonsense"), "perProject");
  });
});
