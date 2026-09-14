import type { ChainNode, RoadmapNode, RuleNode } from "catalyst-core";
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
    description: "",
    references: [],
    ...overrides,
  } as ChainNode;
}

function roadmap(overrides: Partial<RoadmapNode> & { id: string }): ChainNode {
  return {
    kind: "roadmap",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    roadmapName: "product",
    roadmapRetired: false,
    description: "",
    status: "Not triaged",
    signedOffBy: "alice",
    notes: "",
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
        openProposals: [],
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
        openProposals: [],
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
        openProposals: [],
      }),
    );

    const noneCount = html.split("None.").length - 1;
    expect(noneCount).toBe(2);
  });

  it("renders open proposals when present, and nothing when there are none", () => {
    const withProposal = renderToStaticMarkup(
      NodeDetail({
        node: rule({ id: "env-RUNTIME-001", title: "x" }),
        upstream: [],
        downstream: [],
        openProposals: [
          {
            id: "PROP-000001",
            status: "proposed",
            intent: "Fix it",
            targets: ["env-RUNTIME-001"],
            expectations: [],
            constraints: [],
            location: { file: "p.md", line: 1 },
          },
        ],
      }),
    );
    expect(withProposal).toContain("PROP-000001");
    expect(withProposal).toContain("Fix it");

    const withoutProposal = renderToStaticMarkup(
      NodeDetail({
        node: rule({ id: "env-RUNTIME-001", title: "x" }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );
    expect(withoutProposal).not.toContain("Open proposals");
  });

  it("renders a node's own description when present, for any entity kind", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: rule({
          id: "env-RUNTIME-001",
          description: "Runtime must pin an exact Node version.",
        }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );

    expect(html).toContain("Runtime must pin an exact Node version.");
  });

  it("renders nothing extra when a node has no description", () => {
    const withDescription = renderToStaticMarkup(
      NodeDetail({
        node: rule({ id: "env-RUNTIME-001", description: "Some text." }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );
    const withoutDescription = renderToStaticMarkup(
      NodeDetail({
        node: rule({ id: "env-RUNTIME-001", description: "" }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );

    const paragraphDelta =
      withDescription.split("<p>").length -
      withoutDescription.split("<p>").length;
    expect(paragraphDelta).toBe(1);
    expect(withoutDescription).not.toContain("Some text.");
  });

  it("renders a roadmap node's description exactly once, not duplicated by RoadmapDetails", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: roadmap({
          id: "RM-000001",
          description: "A longer summary of this idea.",
        }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );

    const occurrences = html.split("A longer summary of this idea.").length - 1;
    expect(occurrences).toBe(1);
  });
});
