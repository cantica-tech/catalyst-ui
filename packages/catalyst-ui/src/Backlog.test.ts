import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Backlog } from "./Backlog.js";

describe("Backlog", () => {
  it("renders the markdown content as formatted HTML", () => {
    const html = renderToStaticMarkup(
      Backlog({
        markdown: "## Open requirements\n\n- REQ-000001 — Core parser\n",
      }),
    );

    expect(html).toContain("Backlog");
    expect(html).toContain("<h2>Open requirements</h2>");
    expect(html).toContain("REQ-000001");
    expect(html).toContain("<li>");
  });

  it("renders an empty document without throwing", () => {
    const html = renderToStaticMarkup(Backlog({ markdown: "" }));
    expect(html).toContain("Backlog");
  });
});
