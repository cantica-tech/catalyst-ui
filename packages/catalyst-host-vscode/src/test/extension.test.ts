import * as assert from "assert";
import { activate, deactivate } from "../extension.js";

describe("catalyst-host-vscode scaffold", () => {
  it("activate/deactivate exist and run without throwing", () => {
    assert.doesNotThrow(() => activate());
    assert.doesNotThrow(() => deactivate());
  });
});
