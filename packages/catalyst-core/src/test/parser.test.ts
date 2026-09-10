import { afterEach, describe, expect, it } from "vitest";

import { parseCorpus } from "../parser.js";
import type {
  DevArtifactNode,
  DomainNode,
  FeatureNode,
  RoadmapNode,
  RuleNode,
} from "../types.js";
import {
  createFixtureCorpus,
  removeFixtureCorpus,
  writeRulesOfRules,
} from "./test-support.js";

let root: string | undefined;

afterEach(() => {
  if (root) removeFixtureCorpus(root);
  root = undefined;
});

describe("parseCorpus", () => {
  it("parses a clean, fully-linked corpus into the expected node shapes", () => {
    root = createFixtureCorpus({
      ruleDocs: [
        {
          prefix: "core",
          filename: "catalyst-core-rules.md",
          rules: [
            {
              id: "core-CONTRACT-001",
              title: "Typed chain model",
              domain: "CONTRACT",
            },
          ],
        },
      ],
      domains: [{ code: "CONTRACT" }],
      requirements: [
        {
          id: "REQ-000001",
          title: "Implement core",
          targets: ["core-CONTRACT-001"],
          feature: "FEAT-000001",
        },
      ],
      features: [{ id: "FEAT-000001", title: "Core" }],
    });

    const result = parseCorpus(root);
    expect(result).not.toBeNull();

    const allNodes = result!.files.flatMap((f) => f.nodes);
    const rule = allNodes.find((n) => n.id === "core-CONTRACT-001") as RuleNode;
    expect(rule.kind).toBe("rule");
    expect(rule.domain).toBe("CONTRACT");
    expect(rule.docPrefix).toBe("core");
    expect(rule.registeredInRulesIndex).toBe(true);

    const domain = allNodes.find((n) => n.id === "CONTRACT") as DomainNode;
    expect(domain.hasDoc).toBe(true);

    const req = allNodes.find((n) => n.id === "REQ-000001") as DevArtifactNode;
    expect(req.artifactType).toBe("requirement");
    expect(req.targets).toEqual(["core-CONTRACT-001"]);
    expect(req.feature).toBe("FEAT-000001");
    expect(req.registered).toBe(true);
    expect(req.fileExists).toBe(true);

    const feature = allNodes.find((n) => n.id === "FEAT-000001") as FeatureNode;
    expect(feature.kind).toBe("feature");
  });

  it("marks an artifact registered in the index but missing its file", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Ghost", createFile: false }],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const req = allNodes.find((n) => n.id === "REQ-000001") as DevArtifactNode;
    expect(req.registered).toBe(true);
    expect(req.fileExists).toBe(false);
  });

  it("marks an artifact file on disk but missing from the index", () => {
    root = createFixtureCorpus({
      requirements: [
        {
          id: "REQ-000001",
          title: "Unregistered",
          registerInIndex: false,
          targets: ["env-RUNTIME-001"],
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const req = allNodes.find((n) => n.id === "REQ-000001") as DevArtifactNode;
    expect(req.registered).toBe(false);
    expect(req.fileExists).toBe(true);
  });

  it("captures rr-META rules from Rules-of-Rules.md and exempts them from the rules.md index requirement", () => {
    root = createFixtureCorpus({});
    writeRulesOfRules(root, [
      {
        id: "rr-META-003",
        title: "Every rule has a unique id",
        domain: "META",
      },
    ]);

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const metaRule = allNodes.find((n) => n.id === "rr-META-003") as RuleNode;
    expect(metaRule.docPrefix).toBe("rr");
    expect(metaRule.domain).toBe("META");
    expect(metaRule.registeredInRulesIndex).toBe(true);
  });

  it("does not scan rr-META rule bodies for dangling references (they cite illustrative example ids, not real ones)", () => {
    root = createFixtureCorpus({});
    writeRulesOfRules(root, [
      {
        id: "rr-META-003",
        title: "Every rule has a unique id",
        domain: "META",
        extraBody: "e.g. `br-AUTH-003-login-flow`.",
      },
    ]);

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const metaRule = allNodes.find((n) => n.id === "rr-META-003") as RuleNode;
    expect(metaRule.references).toEqual([]);
  });

  it("collects free-text id citations from a rule body as references", () => {
    root = createFixtureCorpus({
      ruleDocs: [
        {
          prefix: "env",
          filename: "dev-environment-rules.md",
          rules: [
            {
              id: "env-RUNTIME-002",
              title: "New rule",
              domain: "RUNTIME",
              extraBody: "Superseded by `env-RUNTIME-003`.",
            },
          ],
        },
      ],
      domains: [{ code: "RUNTIME" }],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const rule = allNodes.find((n) => n.id === "env-RUNTIME-002") as RuleNode;
    expect(rule.references).toContain("env-RUNTIME-003");
  });

  it("returns null when shouldContinue becomes false mid-parse", () => {
    root = createFixtureCorpus({
      ruleDocs: [
        {
          prefix: "env",
          filename: "dev-environment-rules.md",
          rules: [{ id: "env-RUNTIME-001", title: "x", domain: "RUNTIME" }],
        },
      ],
      domains: [{ code: "RUNTIME" }],
    });

    const result = parseCorpus(root, { shouldContinue: () => false });
    expect(result).toBeNull();
  });

  it("parses roadmap rows from every named roadmap file, skipping the roadmaps.md index itself", () => {
    root = createFixtureCorpus({
      roadmaps: [
        {
          name: "product",
          items: [
            {
              id: "RM-000001",
              title: "Idea one",
              description: "A longer summary of idea one.",
              status: "Triaged",
              linked: "FEAT-000001",
              signedOffBy: "alice",
              notes: "from the fixture",
            },
          ],
        },
        {
          name: "infra",
          retired: true,
          items: [{ id: "RM-000002", title: "Idea two" }],
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const roadmapNodes = allNodes.filter(
      (n): n is RoadmapNode => n.kind === "roadmap",
    );
    expect(roadmapNodes.map((n) => n.id).sort()).toEqual([
      "RM-000001",
      "RM-000002",
    ]);

    const item1 = roadmapNodes.find((n) => n.id === "RM-000001")!;
    expect(item1.roadmapName).toBe("product");
    expect(item1.roadmapRetired).toBe(false);
    expect(item1.description).toBe("A longer summary of idea one.");
    expect(item1.status).toBe("Triaged");
    expect(item1.linked).toBe("FEAT-000001");
    expect(item1.signedOffBy).toBe("alice");
    expect(item1.notes).toBe("from the fixture");
    expect(item1.references).toContain("FEAT-000001");

    const item2 = roadmapNodes.find((n) => n.id === "RM-000002")!;
    expect(item2.roadmapName).toBe("infra");
    expect(item2.roadmapRetired).toBe(true);
    expect(item2.status).toBe("Not triaged");
    expect(item2.linked).toBeUndefined();
  });
});
