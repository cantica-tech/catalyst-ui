import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Backlog } from "./Backlog.js";
import { renderMarkdown, safeUrl } from "./markdown.js";

describe("renderMarkdown (sanitised)", () => {
  it("still renders ordinary markdown", () => {
    const html = renderMarkdown(
      "# Title\n\n- **bold** and `code`\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[link](https://example.com)",
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<table>");
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  it("escapes raw block and inline HTML instead of emitting it", () => {
    const html = renderMarkdown(
      '<script>alert(1)</script>\n\ntext <img src=x onerror="alert(1)"> more\n\n<iframe src="https://evil"></iframe>',
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/<img/i);
    expect(html).not.toMatch(/<iframe/i);
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops javascript:, data: and vbscript: link targets but keeps the text", () => {
    for (const href of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox",
    ]) {
      const html = renderMarkdown(`[click](<${href}>)`);
      expect(html, href).not.toMatch(/<a /);
      expect(html, href).toContain("click");
    }
  });

  it("drops unsafe image sources", () => {
    const html = renderMarkdown("![alt](javascript:alert(1))");
    expect(html).not.toMatch(/<img/i);
  });

  it("keeps relative, anchor and mailto links", () => {
    expect(safeUrl("#section")).toBe("#section");
    expect(safeUrl("../rules/x.md")).toBe("../rules/x.md");
    expect(safeUrl("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(safeUrl("http://x")).toBe("http://x");
    expect(safeUrl("file:///etc/passwd")).toBeNull();
    expect(safeUrl("command:workbench.action.terminal.new")).toBeNull();
  });

  it("is what the Backlog view renders", () => {
    const html = renderToStaticMarkup(Backlog({ markdown: "<script>alert(1)</script>\n\n# ok" }));
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain("<h1>ok</h1>");
  });
});
