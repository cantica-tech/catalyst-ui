import type { ReferenceInfo } from "catalyst-core";
import { describe, expect, it } from "vitest";

import { hoverText, linkifyReferences, referenceTarget } from "./references.js";

const info = (id: string, name = "login-flow", summary = "Users log in."): ReferenceInfo => ({
  id,
  kind: "dev-artifact",
  name,
  summary,
});

const table = {
  "REQ-000001-Ab3xR9pQ": info("REQ-000001-Ab3xR9pQ"),
  "REQ-000001": info("REQ-000001-Ab3xR9pQ"),
  "BUG-000002-Ab3xR9pQ": info("BUG-000002-Ab3xR9pQ", 'x < y & "z"', ""),
};

describe("linkifyReferences (REQ-000014)", () => {
  it("links known IDs in text and inline code, with the hover text", () => {
    const html = linkifyReferences("<p>See <code>REQ-000001-Ab3xR9pQ</code> and REQ-000001.</p>", table);
    expect(html).toBe(
      '<p>See <code><a href="#" class="catalyst-ref" data-ref="REQ-000001-Ab3xR9pQ" ' +
        'title="login-flow — Users log in.">REQ-000001-Ab3xR9pQ</a></code> and ' +
        '<a href="#" class="catalyst-ref" data-ref="REQ-000001-Ab3xR9pQ" ' +
        'title="login-flow — Users log in.">REQ-000001</a>.</p>',
    );
  });

  it("prefers the longest token, never matches inside a longer one", () => {
    const html = linkifyReferences("<p>REQ-000001-Ab3xR9pQ XREQ-000001 REQ-0000011</p>", table);
    expect(html.match(/catalyst-ref/g)).toHaveLength(1);
    expect(html).toContain(">REQ-000001-Ab3xR9pQ</a>");
  });

  it("leaves <pre> blocks, existing links and unknown IDs alone", () => {
    const src = '<pre><code>REQ-000001-Ab3xR9pQ</code></pre><p><a href="x">REQ-000001</a> BUG-000009-Ab3xR9pQ</p>';
    expect(linkifyReferences(src, table)).toBe(src);
  });

  it("escapes the hover text and handles an empty table", () => {
    expect(linkifyReferences("<p>BUG-000002-Ab3xR9pQ</p>", table)).toContain('title="x &lt; y &amp; &quot;z&quot;"');
    expect(linkifyReferences("<p>REQ-000001</p>", {})).toBe("<p>REQ-000001</p>");
    expect(hoverText(info("A-000001-Ab3xR9pQ", "n", ""))).toBe("n");
  });

  it("finds the ID a click hit", () => {
    const root = document.createElement("div");
    root.innerHTML = linkifyReferences("<p><code>REQ-000001</code> other</p>", table);
    const code = root.querySelector("a")!;
    expect(referenceTarget(code)).toBe("REQ-000001-Ab3xR9pQ");
    expect(referenceTarget(root.querySelector("p"))).toBeNull();
  });
});
