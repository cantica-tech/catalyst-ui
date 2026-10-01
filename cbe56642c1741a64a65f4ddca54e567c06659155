import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  cleanRuleTitle,
  detectRuleStatus,
  extractSlugFromRuleId,
  parseCorpus,
} from "../parser.js";
import type {
  DevArtifactNode,
  DomainNode,
  FeatureNode,
  RoadmapNode,
  RuleNode,
  StepNode,
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
              extraBody: "Every node on the wire carries a stable shape.",
            },
          ],
        },
      ],
      domains: [{ code: "CONTRACT", scope: "Covers the core wire protocol." }],
      requirements: [
        {
          id: "REQ-000001",
          title: "Implement core",
          targets: ["core-CONTRACT-001"],
          feature: "FEAT-000001",
          description: "Ship the typed chain model end to end.",
        },
      ],
      features: [
        {
          id: "FEAT-000001",
          title: "Core",
          description: "A typed model shared by every host.",
        },
      ],
    });

    const result = parseCorpus(root);
    expect(result).not.toBeNull();

    const allNodes = result!.files.flatMap((f) => f.nodes);
    const rule = allNodes.find((n) => n.id === "core-CONTRACT-001") as RuleNode;
    expect(rule.kind).toBe("rule");
    expect(rule.domain).toBe("CONTRACT");
    expect(rule.docPrefix).toBe("core");
    expect(rule.registeredInRulesIndex).toBe(true);
    expect(rule.description).toContain(
      "Every node on the wire carries a stable shape.",
    );

    const domain = allNodes.find((n) => n.id === "CONTRACT") as DomainNode;
    expect(domain.hasDoc).toBe(true);
    expect(domain.description).toBe("Covers the core wire protocol.");

    const req = allNodes.find((n) => n.id === "REQ-000001") as DevArtifactNode;
    expect(req.artifactType).toBe("requirement");
    expect(req.targets).toEqual(["core-CONTRACT-001"]);
    expect(req.feature).toBe("FEAT-000001");
    expect(req.registered).toBe(true);
    expect(req.fileExists).toBe(true);
    expect(req.description).toBe("Ship the typed chain model end to end.");
    expect(req.content).toContain("Ship the typed chain model end to end.");
    expect(req.content).toContain("**Targets**");

    const feature = allNodes.find((n) => n.id === "FEAT-000001") as FeatureNode;
    expect(feature.kind).toBe("feature");
    expect(feature.description).toBe("A typed model shared by every host.");
    expect(feature.content).toContain("A typed model shared by every host.");

    expect(domain.content).toContain("Covers the core wire protocol.");
  });

  it("reads a bug/house-keeping artifact's own `## Description` section, distinct from a requirement's `## Summary`", () => {
    root = createFixtureCorpus({
      bugs: [
        {
          id: "BUG-000001",
          title: "Broken login",
          description: "Login silently fails on an expired token.",
        },
      ],
      houseKeeping: [
        {
          id: "HK-000001",
          title: "Upgrade CI runner",
          description: "Move CI to the newer runner image.",
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const bug = allNodes.find((n) => n.id === "BUG-000001") as DevArtifactNode;
    expect(bug.description).toBe("Login silently fails on an expired token.");

    const hk = allNodes.find((n) => n.id === "HK-000001") as DevArtifactNode;
    expect(hk.description).toBe("Move CI to the newer runner image.");
  });

  it("leaves description empty for an index-only artifact/feature with no backing file", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Ghost", createFile: false }],
      features: [{ id: "FEAT-000001", title: "Ghost", createFile: false }],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const req = allNodes.find((n) => n.id === "REQ-000001") as DevArtifactNode;
    expect(req.description).toBe("");
    expect(req.content).toBe("");
    const feature = allNodes.find((n) => n.id === "FEAT-000001") as FeatureNode;
    expect(feature.description).toBe("");
    expect(feature.content).toBe("");
  });

  it("leaves a domain's description and content empty when it has no doc file", () => {
    root = createFixtureCorpus({
      domains: [{ code: "ORPHAN", skipDoc: true }],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const domain = allNodes.find((n) => n.id === "ORPHAN") as DomainNode;
    expect(domain.hasDoc).toBe(false);
    expect(domain.description).toBe("");
    expect(domain.content).toBe("");
  });

  it("captures a dev-artifact's complete raw file content, beyond just its Description section", () => {
    root = createFixtureCorpus({
      bugs: [
        {
          id: "BUG-000001",
          title: "Broken login",
          description: "Login silently fails on an expired token.",
          extraBody: "Traced to auth.ts:42.",
          targets: ["env-RUNTIME-001"],
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const bug = allNodes.find((n) => n.id === "BUG-000001") as DevArtifactNode;
    expect(bug.content).toContain("Login silently fails on an expired token.");
    expect(bug.content).toContain("Traced to auth.ts:42.");
    expect(bug.content).toContain("**Targets**");
    expect(bug.content).toContain("## Notes");
  });

  it("resolves a userid-suffixed id (Rules-of-Rules.md §20) as one coherent entry, not truncated", () => {
    root = createFixtureCorpus({
      requirements: [
        {
          id: "REQ-000001-Ab3xR9pQ",
          title: "Implement core",
          description: "Ship the typed chain model end to end.",
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    // Exactly one entry for the full suffixed id — not a separate
    // truncated "REQ-000001" entry from a filename/index key mismatch.
    expect(allNodes.filter((n) => n.id.startsWith("REQ-000001")).length).toBe(
      1,
    );
    const req = allNodes.find(
      (n) => n.id === "REQ-000001-Ab3xR9pQ",
    ) as DevArtifactNode;
    expect(req).toBeDefined();
    expect(req.registered).toBe(true);
    expect(req.fileExists).toBe(true);
    expect(req.description).toBe("Ship the typed chain model end to end.");
  });

  it("does not truncate an old-style bare id whose filename summary starts with a lowercase 8-letter word", () => {
    root = createFixtureCorpus({
      requirements: [
        {
          id: "REQ-000002",
          title: "Database migration plan",
          createFile: false,
        },
      ],
    });
    // The generic fixture helper always names files "<id>-file.md" — this
    // regression needs the exact shape a real deployment would produce
    // (id + a descriptive slug that happens to start with an 8-letter,
    // all-lowercase word), so it's written directly rather than through
    // createFixtureCorpus's own naming convention.
    writeFileSync(
      join(root, "requirements", "REQ-000002-database-migration-plan.md"),
      "# `REQ-000002` — Database migration plan\n\n" +
        "| Field | Value |\n|---|---|\n| **ID** | `REQ-000002` |\n" +
        "| **Status** | in-progress |\n",
    );

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const req = allNodes.find((n) => n.id === "REQ-000002") as DevArtifactNode;
    expect(req).toBeDefined();
    expect(req.registered).toBe(true);
    expect(req.fileExists).toBe(true);
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

  it("parses a step and links it to its parent requirement", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Core parser" }],
      steps: [
        {
          id: "STEP-000001",
          title: "Wire up the tokenizer",
          parent: "REQ-000001",
          status: "done",
          description: "Implemented the tokenizer for the corpus parser.",
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const step = allNodes.find((n) => n.id === "STEP-000001") as StepNode;
    expect(step).toBeDefined();
    expect(step.kind).toBe("step");
    expect(step.parent).toBe("REQ-000001");
    expect(step.status).toBe("done");
    expect(step.registered).toBe(true);
    expect(step.fileExists).toBe(true);
    expect(step.description).toBe(
      "Implemented the tokenizer for the corpus parser.",
    );
    expect(step.references).toContain("REQ-000001");
  });

  it("parses a step whose parent is a bug (Rules-of-Rules.md §21, widened 0.31.0)", () => {
    root = createFixtureCorpus({
      bugs: [{ id: "BUG-000001", title: "Login form validation" }],
      steps: [
        {
          id: "STEP-000001",
          title: "Add missing null check",
          parent: "BUG-000001",
          status: "done",
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const step = allNodes.find((n) => n.id === "STEP-000001") as StepNode;
    expect(step.parent).toBe("BUG-000001");
  });

  it("falls back to a legacy `Requirement` field for a corpus that hasn't run the 0.31.0 Parent rename", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Core parser" }],
      steps: [
        { id: "STEP-000001", title: "Legacy step", parent: "REQ-000001" },
      ],
    });
    // Overwrite with the pre-0.31.0 field name to simulate an unmigrated file.
    writeFileSync(
      join(root, "steps", "STEP-000001-file.md"),
      "# `STEP-000001` — Legacy step\n\n" +
        "| Field | Value |\n|---|---|\n" +
        "| **ID** | `STEP-000001` |\n" +
        "| **Requirement** | `REQ-000001` |\n" +
        "| **Status** | done |\n",
    );

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const step = allNodes.find((n) => n.id === "STEP-000001") as StepNode;
    expect(step.parent).toBe("REQ-000001");
  });

  it("marks a step registered in the index but missing its file", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Core parser" }],
      steps: [
        {
          id: "STEP-000001",
          title: "Ghost step",
          parent: "REQ-000001",
          createFile: false,
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const step = allNodes.find((n) => n.id === "STEP-000001") as StepNode;
    expect(step.registered).toBe(true);
    expect(step.fileExists).toBe(false);
  });

  it("marks a step file on disk but missing from the index", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Core parser" }],
      steps: [
        {
          id: "STEP-000001",
          title: "Unregistered step",
          parent: "REQ-000001",
          registerInIndex: false,
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const step = allNodes.find((n) => n.id === "STEP-000001") as StepNode;
    expect(step.registered).toBe(false);
    expect(step.fileExists).toBe(true);
  });

  it("parses a test as a fourth dev-artifact type, with its own Requirements/Steps links", () => {
    root = createFixtureCorpus({
      requirements: [{ id: "REQ-000001", title: "Core parser" }],
      steps: [
        {
          id: "STEP-000001",
          title: "Wire up the tokenizer",
          parent: "REQ-000001",
        },
      ],
      tests: [
        {
          id: "TEST-000001",
          title: "Parser round-trip",
          targets: ["env-RUNTIME-001"],
          requirements: ["REQ-000001"],
          steps: ["STEP-000001"],
          status: "passing",
          description: "Round-trips a fixture corpus through the parser.",
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const test = allNodes.find(
      (n) => n.id === "TEST-000001",
    ) as DevArtifactNode;
    expect(test).toBeDefined();
    expect(test.kind).toBe("dev-artifact");
    expect(test.artifactType).toBe("test");
    expect(test.targets).toEqual(["env-RUNTIME-001"]);
    expect(test.requirements).toEqual(["REQ-000001"]);
    expect(test.steps).toEqual(["STEP-000001"]);
    expect(test.status).toBe("passing");
    expect(test.registered).toBe(true);
    expect(test.fileExists).toBe(true);
    expect(test.description).toBe(
      "Round-trips a fixture corpus through the parser.",
    );
  });

  it("leaves a test's Requirements/Steps empty when it names neither (both are optional)", () => {
    root = createFixtureCorpus({
      tests: [
        {
          id: "TEST-000001",
          title: "Standalone smoke test",
          targets: ["env-RUNTIME-001"],
        },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const test = allNodes.find(
      (n) => n.id === "TEST-000001",
    ) as DevArtifactNode;
    expect(test.requirements).toEqual([]);
    expect(test.steps).toEqual([]);
  });

  it("never reads a requirement's own Steps field into `requirements`/`steps` (only a test's do)", () => {
    root = createFixtureCorpus({
      requirements: [
        { id: "REQ-000001", title: "Core parser", steps: ["STEP-000001"] },
      ],
    });

    const allNodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const req = allNodes.find((n) => n.id === "REQ-000001") as DevArtifactNode;
    expect(req.artifactType).toBe("requirement");
    expect(req.requirements).toBeUndefined();
    expect(req.steps).toBeUndefined();
  });
});

describe("extractSlugFromRuleId and cleanRuleTitle", () => {
  it("extracts clean human-readable slug from 6-digit rule id with userid", () => {
    expect(
      extractSlugFromRuleId("env-CI-000001-z6qEx1Kf-github-actions-on-push"),
    ).toBe("github actions on push");
    expect(
      extractSlugFromRuleId(
        "cor-CORE-000001-z6qEx1Kf-telemetry-log-correlation",
      ),
    ).toBe("telemetry log correlation");
    expect(extractSlugFromRuleId("br-REDIS-016")).toBeUndefined();
  });

  it("cleans rule title by removing status words and glyphs", () => {
    expect(cleanRuleTitle("working")).toBe("");
    expect(cleanRuleTitle("not implemented")).toBe("");
    expect(cleanRuleTitle("✅ working")).toBe("");
    expect(cleanRuleTitle("Typed chain model")).toBe("Typed chain model");
  });

  it("detects rule status from text or title", () => {
    expect(detectRuleStatus("", "not implemented")).toBe("❌ not implemented");
    expect(detectRuleStatus("", "working")).toBe("✅ working");
    expect(detectRuleStatus("✅ working.", "working")).toBe("✅ working.");
  });
});

describe("full-ID index rows and short filenames (BUG-000001-UVqkd7cL)", () => {
  it("makes a file and its index row one node, keyed by the full ID", () => {
    root = createFixtureCorpus({});
    writeFileSync(
      join(root, "requirements", "requirements.md"),
      "# Requirements index\n\n| ID | Title | Status |\n|---|---|---|\n" +
        "| [REQ-000014-UVqkd7cL](REQ-000014-entity-links.md) | Entity links | Completed |\n",
    );
    writeFileSync(
      join(root, "requirements", "REQ-000014-entity-links.md"),
      "# `REQ-000014-UVqkd7cL` — Entity links\n\n| Field | Value |\n|---|---|\n" +
        "| **ID** | `REQ-000014-UVqkd7cL` |\n| **Status** | Completed |\n\n## Summary\n\nIDs are links.\n",
    );
    writeFileSync(
      join(root, "steps", "steps.md"),
      "# Steps index\n\n| ID | Title | Parent | Status |\n|---|---|---|---|\n" +
        "| [STEP-000016-UVqkd7cL](STEP-000016-link.md) | Link | REQ-000014-UVqkd7cL | done |\n",
    );
    writeFileSync(
      join(root, "steps", "STEP-000016-link.md"),
      "# `STEP-000016-UVqkd7cL` — Link\n\n| Field | Value |\n|---|---|\n" +
        "| **ID** | `STEP-000016-UVqkd7cL` |\n| **Parent** | `REQ-000014-UVqkd7cL` |\n| **Status** | done |\n",
    );

    const nodes = parseCorpus(root)!.files.flatMap((f) => f.nodes);
    const reqs = nodes.filter((n) => n.id.startsWith("REQ-000014"));
    expect(reqs.map((n) => n.id)).toEqual(["REQ-000014-UVqkd7cL"]);
    const req = reqs[0] as DevArtifactNode;
    expect(req.fileExists).toBe(true);
    expect(req.registered).toBe(true);
    expect(req.description).toBe("IDs are links.");
    const steps = nodes.filter((n) => n.id.startsWith("STEP-000016"));
    expect(steps.map((n) => n.id)).toEqual(["STEP-000016-UVqkd7cL"]);
  });

  it("still keys a file by its filename when it has no ID field and no index row extends it", () => {
    root = createFixtureCorpus({});
    writeFileSync(
      join(root, "requirements", "REQ-000020-plain.md"),
      "# REQ-000020 — Plain\n",
    );
    const ids = parseCorpus(root)!
      .files.flatMap((f) => f.nodes)
      .map((n) => n.id);
    expect(ids).toContain("REQ-000020");
  });
});
