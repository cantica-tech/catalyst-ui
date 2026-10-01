import type {
  ChainNode,
  DevArtifactNode,
  RoadmapNode,
  RuleNode,
  StepNode,
} from "catalyst-core";
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

function bug(overrides: Partial<DevArtifactNode> & { id: string }): ChainNode {
  return {
    kind: "dev-artifact",
    artifactType: "bug",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    status: "open",
    targets: [],
    registered: true,
    fileExists: true,
    description: "",
    content: "",
    references: [],
    ...overrides,
  } as ChainNode;
}

function step(overrides: Partial<StepNode> & { id: string }): ChainNode {
  return {
    kind: "step",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    parent: "REQ-000001",
    status: "in-progress",
    registered: true,
    fileExists: true,
    description: "",
    content: "",
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

  it("lists a requirement's steps in its downstream (Produces) section", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: bug({
          id: "REQ-000001",
          artifactType: "requirement",
          title: "Core parser",
        }),
        upstream: [],
        downstream: [
          step({ id: "STEP-000001", title: "Wire up the tokenizer" }),
        ],
        openProposals: [],
      }),
    );

    expect(html).toContain("Produces");
    expect(html).toContain("STEP-000001");
  });

  it("lists a requirement's tests in its downstream (Produces) section", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: bug({
          id: "REQ-000001",
          artifactType: "requirement",
          title: "Core parser",
        }),
        upstream: [],
        downstream: [
          bug({
            id: "TEST-000001",
            artifactType: "test",
            status: "passing",
            title: "Parser round trip",
          }),
        ],
        openProposals: [],
      }),
    );

    expect(html).toContain("Produces");
    expect(html).toContain("TEST-000001");
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

  it("renders the full backing document's content, not just the short description, as formatted HTML", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: bug({
          id: "BUG-000001",
          description: "Login silently fails on an expired token.",
          content:
            "# `BUG-000001` — Broken login\n\n## Description\n\nLogin silently fails on an expired token.\n\n## Reproduction\n\n- Sign in\n- Wait for the token to expire\n- Refresh the page\n\n## Root cause\n\n`auth.ts:42`",
        }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );

    expect(html).toContain("Details");
    expect(html).toContain("<h2>Reproduction</h2>");
    expect(html).toContain("<li>Sign in</li>");
    expect(html).toContain("<h2>Root cause</h2>");
    expect(html).toContain("<code>auth.ts:42</code>");
  });

  it("prefers the full content over the short description when both are present", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: bug({
          id: "BUG-000001",
          description: "Short summary.",
          content:
            "## Description\n\nShort summary.\n\n## Fix plan\n\nRevert the change.",
        }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );

    expect(html).toContain("Fix plan");
    expect(html).toContain("Revert the change.");
  });

  it("shows no Details section when a node has neither content nor description", () => {
    const html = renderToStaticMarkup(
      NodeDetail({
        node: bug({ id: "BUG-000001", description: "", content: "" }),
        upstream: [],
        downstream: [],
        openProposals: [],
      }),
    );

    expect(html).not.toContain("Details");
  });
});

describe("NodeDetail entity references (REQ-000014)", () => {
  it("links cited IDs in the details and the upstream list, with the hover", () => {
    const target = rule({
      id: "env-RUNTIME-000001-Ab3xR9pQ",
      title: "Node 20",
    });
    const html = renderToStaticMarkup(
      NodeDetail({
        node: bug({
          id: "BUG-000001-Ab3xR9pQ",
          content:
            "Breaks `env-RUNTIME-000001-Ab3xR9pQ`.\n\n```\nenv-RUNTIME-000001-Ab3xR9pQ\n```",
        }),
        upstream: [target],
        downstream: [],
        openProposals: [],
        references: {
          "env-RUNTIME-000001-Ab3xR9pQ": {
            id: "env-RUNTIME-000001-Ab3xR9pQ",
            kind: "rule",
            name: "Node 20",
            summary: "The runtime is Node 20.",
          },
        },
      }),
    );
    // the details and the upstream list; never inside the code block
    expect(html.match(/class="catalyst-ref"/g)).toHaveLength(2);
    expect(html).toContain('title="Node 20 — The runtime is Node 20."');
    expect(html).toContain("<pre><code>env-RUNTIME-000001-Ab3xR9pQ");
  });
});
