import type { ChainNode, RuleNode } from "catalyst-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NodeDetail } from "./NodeDetail.js";

function rule(overrides: Partial<RuleNode> & { id: string }): ChainNode {
  return {
    kind: "rule",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    docPrefix: "env",
    domain: "RUNTIME",
    status: "",
    registeredInRulesIndex: true,
    references: [],
    ...overrides,
  } as ChainNode;
}

describe("NodeDetail", () => {
  it("renders the node's id, kind, title, and status", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: rule({
          id: "env-RUNTIME-001",
          title: "Language and runtime",
          status: "✅",
        }),
        upstream: [],
        downstream: [],
      }),
    );

    expect(html).toContain("env-RUNTIME-001");
    expect(html).toContain("Language and runtime");
    expect(html).toContain("✅");
  });

  it("renders upstream and downstream node lists", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: rule({ id: "env-RUNTIME-001", title: "Language and runtime" }),
        upstream: [rule({ id: "rr-META-003", title: "Unique ids" })],
        downstream: [rule({ id: "env-RUNTIME-002", title: "Downstream rule" })],
      }),
    );

    expect(html).toContain("Justified by");
    expect(html).toContain("rr-META-003");
    expect(html).toContain("Produces");
    expect(html).toContain("env-RUNTIME-002");
  });

  it("renders 'None.' for empty upstream/downstream lists", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: rule({ id: "env-RUNTIME-001", title: "x" }),
        upstream: [],
        downstream: [],
      }),
    );

    const noneCount = html.split("None.").length - 1;
    expect(noneCount).toBe(2);
  });
});
