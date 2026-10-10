import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GraphView } from "./GraphView.js";
import type { GraphLayout } from "./graph.js";

describe("GraphView", () => {
  it("renders every node and every resolvable edge", () => {
    const layout: GraphLayout = {
      nodes: [
        {
          id: "REQ-000006",
          kind: "dev-artifact",
          title: "Electron host",
          x: 0,
          y: 0,
        },
        {
          id: "electron-DESKTOP-001",
          kind: "rule",
          title: "Desktop",
          x: 220,
          y: 0,
        },
      ],
      edges: [{ from: "REQ-000006", to: "electron-DESKTOP-001" }],
    };

    const html = renderToStaticMarkup(GraphView({ layout }));

    expect(html).toContain("REQ-000006");
    expect(html).toContain("electron-DESKTOP-001");
    expect(html).toContain("<line");
  });

  it("skips an edge whose endpoint isn't in the layout's nodes, without throwing", () => {
    const layout: GraphLayout = {
      nodes: [
        {
          id: "REQ-000006",
          kind: "dev-artifact",
          title: "Electron host",
          x: 0,
          y: 0,
        },
      ],
      edges: [{ from: "REQ-000006", to: "nowhere" }],
    };

    const html = renderToStaticMarkup(GraphView({ layout }));
    expect(html).not.toContain("<line");
  });

  it("renders an empty layout without throwing", () => {
    const html = renderToStaticMarkup(GraphView({ layout: { nodes: [], edges: [] } }));
    expect(html).toContain("<svg");
  });
});
