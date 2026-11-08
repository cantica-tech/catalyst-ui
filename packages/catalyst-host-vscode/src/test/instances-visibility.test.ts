import * as assert from "assert";
import { readFileSync } from "fs";
import { join } from "path";

import { NOT_LOGGED_IN } from "../instance-search.js";
import { visibleRoot } from "../instances-visibility.js";

/** The extension's manifest, read from the package root (tests run from dist/test). */
const manifest = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf8")) as {
  contributes: { viewsWelcome?: { view: string; contents: string; when?: string }[] };
};

describe("the Instances view shows nothing while no one is logged in (BUG-000049-UhmQ897l)", () => {
  it("shows every entry while someone is logged in, none otherwise", () => {
    const entries = ["deployment a", "deployment b", "folder to set up"];
    assert.deepStrictEqual(visibleRoot(true, entries), entries);
    assert.deepStrictEqual(visibleRoot(false, entries), []);
    assert.deepStrictEqual(visibleRoot(false, []), []);
  });

  it("offers the login in the empty view, only while no one is logged in", () => {
    const welcome = manifest.contributes.viewsWelcome?.find((w) => w.view === "catalystChainInspector");
    assert.ok(welcome, "the Instances view has welcome content");
    assert.strictEqual(welcome.when, "!catalyst.users.loggedIn");
    assert.match(welcome.contents, /\(command:catalyst\.iam\.login\)/);
  });

  it("tells the search and a document's opener to log in", () => {
    assert.match(NOT_LOGGED_IN, /no one is logged in to catalyst-users/);
  });
});
