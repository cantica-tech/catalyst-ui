import * as assert from "assert";

import { SHOW_DETAIL_COMMAND } from "../constants.js";
import {
  buildSearchItems,
  NO_DEPLOYMENT,
  SEARCH_OPTIONS,
  searchSelection,
  shortId,
  type SearchEntry,
} from "../instance-search.js";
import { artifact, BUG, domain, REQ, rule } from "./fixtures-entities.js";

/** Catalyst: Search Items (REQ-000076-UVqkd7cL). */

const ui = (node: SearchEntry["node"], type?: SearchEntry["type"]): SearchEntry => ({
  corpusRoot: "/c/ui",
  deployment: "catalyst-ui",
  node,
  ...(type ? { type } : {}),
});

describe("the search's items (REQ-000076-UVqkd7cL)", () => {
  it("labels an item <ID> · <title>, its status and type as the description, no detail with one deployment", () => {
    const [bug, req] = buildSearchItems([
      ui(artifact("BUG-000004-UVqkd7cL", BUG, "Closed", "The audit pack counts a meta-rule"), BUG),
      ui(artifact("REQ-000076-UVqkd7cL", REQ, "Active", "Search the Instances view"), REQ),
    ]);
    assert.deepStrictEqual(bug, {
      label: "BUG-000004 · The audit pack counts a meta-rule",
      description: "Closed · Bug",
      corpusRoot: "/c/ui",
      id: "BUG-000004-UVqkd7cL",
    });
    assert.strictEqual(req.label, "REQ-000076 · Search the Instances view");
    assert.strictEqual(req.description, "Active · Requirement");
    assert.ok(!("detail" in req));
  });

  it("gives a rule its first status words and a domain its code without repeating it", () => {
    const [r, d] = buildSearchItems([
      ui(rule("vscode-INSPECTOR-000001-UVqkd7cL", "Read-only chain tree", "✅ working (catalyst UI 0.47.0; long)")),
      ui(domain("AGENT", "`AGENT` — Run slash commands via a per-project agent terminal")),
    ]);
    assert.strictEqual(r.label, "vscode-INSPECTOR-000001 · Read-only chain tree");
    assert.strictEqual(r.description, "✅ working · Rule");
    assert.strictEqual(d.label, "AGENT · Run slash commands via a per-project agent terminal");
    assert.strictEqual(d.description, "Domain");
  });

  it("names the deployment as the detail only when several are open, and lists each entity once", () => {
    const bug = artifact("BUG-000001-UVqkd7cL", BUG, "Open");
    const items = buildSearchItems([
      ui(bug, BUG),
      ui(bug, BUG),
      { corpusRoot: "/c/kb", deployment: "catalyst-kb", node: bug, type: BUG },
    ]);
    assert.deepStrictEqual(
      items.map((i) => [i.detail, i.corpusRoot]),
      [
        ["catalyst-ui", "/c/ui"],
        ["catalyst-kb", "/c/kb"],
      ],
    );
  });

  it("matches on the description and the detail, so a status, a type or a deployment typed filters", () => {
    assert.strictEqual(SEARCH_OPTIONS.matchOnDescription, true);
    assert.strictEqual(SEARCH_OPTIONS.matchOnDetail, true);
  });

  it("says so when no deployment is open", () => {
    assert.deepStrictEqual(buildSearchItems([]), []);
    assert.match(NO_DEPLOYMENT, /no catalyst deployment is open/);
  });

  it("strips only a userid suffix from an ID", () => {
    assert.strictEqual(shortId("REQ-000076-UVqkd7cL"), "REQ-000076");
    assert.strictEqual(shortId("REQ-000076"), "REQ-000076");
  });
});

describe("choosing a search item (REQ-000076-UVqkd7cL)", () => {
  it("selects and focuses its node in the tree, then opens it as a click on the node does", () => {
    const plan = searchSelection({ corpusRoot: "/c/ui", id: "BUG-000004-UVqkd7cL" });
    assert.deepStrictEqual(plan.reveal, { corpusRoot: "/c/ui", id: "BUG-000004-UVqkd7cL" });
    assert.deepStrictEqual(plan.revealOptions, { select: true, focus: true, expand: false });
    assert.deepStrictEqual(plan.open, { command: SHOW_DETAIL_COMMAND, args: ["/c/ui", "BUG-000004-UVqkd7cL"] });
  });
});
