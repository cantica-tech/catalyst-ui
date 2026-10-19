import * as assert from "assert";

import { codiconFor, FALLBACK_ICON } from "../codicons.js";

describe("the chain inspector's icons are VS Code's own (brand roadmap item 4)", () => {
  it("names a Codicon for each section and each known type", () => {
    assert.strictEqual(codiconFor(["rule"]), "law");
    assert.strictEqual(codiconFor(["requirement", "requirements", "req"]), "checklist");
    assert.strictEqual(codiconFor(["Risk"]), "warning"); // case does not matter
  });

  it("takes the first name that has one, and the fallback for a type it does not know", () => {
    assert.strictEqual(codiconFor(["unknown", "incidents"]), "flame");
    assert.strictEqual(codiconFor(["widget", "w"]), FALLBACK_ICON);
    assert.strictEqual(codiconFor([]), FALLBACK_ICON);
  });
});
