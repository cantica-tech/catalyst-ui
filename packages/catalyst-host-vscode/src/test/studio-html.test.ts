import * as assert from "assert";

import { studioPanelHtml } from "../studio-html.js";

describe("studioPanelHtml (studio-SHELL-000001)", () => {
  const html = studioPanelHtml("http://127.0.0.1:52011/#token=cst_x", "n0nce");

  it("frames the page the server prints, with a title for assistive technology", () => {
    assert.ok(html.includes('<iframe src="http://127.0.0.1:52011/#token=cst_x" title="catalyst Studio">'));
  });

  it("allows only that origin to be framed, and runs no script of its own", () => {
    assert.ok(html.includes("default-src 'none'; frame-src http://127.0.0.1:52011; style-src 'nonce-n0nce'"));
    assert.ok(!html.includes("<script"));
  });

  it("escapes the URL it frames", () => {
    assert.ok(studioPanelHtml('http://127.0.0.1:1/#a"b&c', "n").includes('src="http://127.0.0.1:1/#a&quot;b&amp;c"'));
  });
});
