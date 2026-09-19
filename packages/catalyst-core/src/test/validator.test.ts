import { describe, expect, it } from "vitest";

import { buildChainModel } from "../graph.js";
import { validate } from "../validator.js";
import type { ChainNode, ParseResult } from "../types.js";

function devArtifact(
  overrides: Partial<ChainNode> & { id: string },
): ChainNode {
  return {
    kind: "dev-artifact",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    artifactType: "requirement",
    status: "in-progress",
    targets: [],
    registered: true,
    fileExists: true,
    references: [],
    ...overrides,
  } as ChainNode;
}

function rule(overrides: Partial<ChainNode> & { id: string }): ChainNode {
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

function domain(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "domain",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    code: overrides.id,
    hasDoc: true,
    references: [],
    ...overrides,
  } as ChainNode;
}

function step(overrides: Partial<ChainNode> & { id: string }): ChainNode {
  return {
    kind: "step",
    title: overrides.id,
    location: { file: "f.md", line: 1 },
    requirement: "REQ-000001",
    status: "in-progress",
    registered: true,
    fileExists: true,
    references: [],
    ...overrides,
  } as ChainNode;
}

function modelOf(nodes: ChainNode[]): ReturnType<typeof buildChainModel> {
  const result: ParseResult = {
    root: "/fixture",
    files: [{ file: "f.md", mtimeMs: 0, nodes }],
    durationMs: 0,
  };
  return buildChainModel(result);
}

describe("validate — orphaned artifacts", () => {
  it("flags an artifact with no Targets rule", () => {
    const report = validate(
      modelOf([devArtifact({ id: "REQ-000001", targets: [] })]),
    );
    expect(
      report.issues.some(
        (i) =>
          i.kind === "orphaned-artifact" &&
          i.message.includes("no Targets rule"),
      ),
    ).toBe(true);
  });

  it("flags an artifact registered in the index but missing its file", () => {
    const report = validate(
      modelOf([
        devArtifact({
          id: "REQ-000001",
          fileExists: false,
          targets: ["env-RUNTIME-001"],
        }),
      ]),
    );
    expect(
      report.issues.some(
        (i) =>
          i.kind === "orphaned-artifact" &&
          i.message.includes("file is missing"),
      ),
    ).toBe(true);
  });

  it("flags an artifact file on disk but not registered in the index", () => {
    const report = validate(
      modelOf([
        devArtifact({
          id: "REQ-000001",
          registered: false,
          targets: ["env-RUNTIME-001"],
        }),
      ]),
    );
    expect(
      report.issues.some(
        (i) =>
          i.kind === "orphaned-artifact" &&
          i.message.includes("not registered"),
      ),
    ).toBe(true);
  });

  it("passes a well-formed, targeted, registered artifact clean", () => {
    const report = validate(
      modelOf([
        devArtifact({ id: "REQ-000001", targets: ["env-RUNTIME-001"] }),
        rule({ id: "env-RUNTIME-001" }),
        domain({ id: "RUNTIME" }),
      ]),
    );
    expect(report.issues.filter((i) => i.kind === "orphaned-artifact")).toEqual(
      [],
    );
  });
});

describe("validate — steps", () => {
  it("flags a step with no Requirement field", () => {
    const report = validate(modelOf([step({ id: "STEP-000001", requirement: "" })]));
    expect(
      report.issues.some(
        (i) =>
          i.kind === "orphaned-artifact" &&
          i.message.includes("no Requirement field"),
      ),
    ).toBe(true);
  });

  it("flags a step registered in the index but missing its file", () => {
    const report = validate(
      modelOf([step({ id: "STEP-000001", fileExists: false })]),
    );
    expect(
      report.issues.some(
        (i) => i.kind === "orphaned-artifact" && i.message.includes("file is missing"),
      ),
    ).toBe(true);
  });

  it("flags a step file on disk but not registered in the index", () => {
    const report = validate(
      modelOf([step({ id: "STEP-000001", registered: false })]),
    );
    expect(
      report.issues.some(
        (i) => i.kind === "orphaned-artifact" && i.message.includes("not registered"),
      ),
    ).toBe(true);
  });

  it("flags a dangling reference when a step's Requirement doesn't resolve to a real node", () => {
    const report = validate(
      modelOf([
        {
          ...step({ id: "STEP-000001", requirement: "REQ-000099" }),
          references: ["REQ-000099"],
        } as ChainNode,
      ]),
    );
    expect(
      report.issues.some(
        (i) => i.kind === "dangling-reference" && i.nodeId === "STEP-000001",
      ),
    ).toBe(true);
  });

  it("passes a well-formed step targeting a real requirement clean", () => {
    const report = validate(
      modelOf([
        devArtifact({ id: "REQ-000001", targets: ["env-RUNTIME-001"] }),
        rule({ id: "env-RUNTIME-001" }),
        domain({ id: "RUNTIME" }),
        { ...step({ id: "STEP-000001" }), references: ["REQ-000001"] } as ChainNode,
      ]),
    );
    expect(report.issues.filter((i) => i.nodeId === "STEP-000001")).toEqual([]);
  });
});

describe("validate — unbacked rules", () => {
  it("flags a rule not listed in rules/rules.md", () => {
    const report = validate(
      modelOf([
        rule({ id: "env-RUNTIME-001", registeredInRulesIndex: false }),
        domain({ id: "RUNTIME" }),
      ]),
    );
    expect(
      report.issues.some(
        (i) =>
          i.kind === "unbacked-rule" &&
          i.message.includes("not listed in rules/rules.md"),
      ),
    ).toBe(true);
  });

  it("flags a rule whose domain is not registered in domains.md", () => {
    const report = validate(
      modelOf([rule({ id: "env-RUNTIME-001", domain: "NOWHERE" })]),
    );
    expect(
      report.issues.some(
        (i) =>
          i.kind === "unbacked-rule" &&
          i.message.includes("not registered in rules/domains/domains.md"),
      ),
    ).toBe(true);
  });

  it("flags a rule whose domain is registered but has no doc file", () => {
    const report = validate(
      modelOf([
        rule({ id: "env-RUNTIME-001" }),
        domain({ id: "RUNTIME", hasDoc: false }),
      ]),
    );
    expect(
      report.issues.some(
        (i) =>
          i.kind === "unbacked-rule" &&
          i.message.includes("no domain doc file"),
      ),
    ).toBe(true);
  });

  it("exempts rr-META rules from the rules.md index requirement", () => {
    const report = validate(
      modelOf([
        rule({
          id: "rr-META-003",
          docPrefix: "rr",
          domain: "META",
          registeredInRulesIndex: false,
        }),
      ]),
    );
    expect(report.issues.filter((i) => i.kind === "unbacked-rule")).toEqual([]);
  });
});

describe("validate — id reuse", () => {
  it("flags the same id defined at more than one location", () => {
    const result: ParseResult = {
      root: "/fixture",
      files: [
        {
          file: "a.md",
          mtimeMs: 0,
          nodes: [
            rule({
              id: "env-RUNTIME-001",
              location: { file: "a.md", line: 1 },
            }),
          ],
        },
        {
          file: "b.md",
          mtimeMs: 0,
          nodes: [
            rule({
              id: "env-RUNTIME-001",
              location: { file: "b.md", line: 9 },
            }),
          ],
        },
      ],
      durationMs: 0,
    };
    const report = validate(buildChainModel(result));
    expect(
      report.issues.some(
        (i) =>
          i.kind === "id-reuse" &&
          i.message.includes("a.md:1") &&
          i.message.includes("b.md:9"),
      ),
    ).toBe(true);
  });
});

describe("validate — dangling references", () => {
  it("flags a reference that does not resolve to any known node", () => {
    const report = validate(
      modelOf([
        devArtifact({
          id: "REQ-000001",
          targets: ["env-RUNTIME-001"],
          references: ["env-RUNTIME-001", "nowhere-999"],
        }),
      ]),
    );
    expect(
      report.issues.some(
        (i) =>
          i.kind === "dangling-reference" && i.message.includes("nowhere-999"),
      ),
    ).toBe(true);
  });

  it("does not flag a reference that resolves", () => {
    const report = validate(
      modelOf([
        devArtifact({
          id: "REQ-000001",
          targets: ["env-RUNTIME-001"],
          references: ["env-RUNTIME-001"],
        }),
        rule({ id: "env-RUNTIME-001" }),
        domain({ id: "RUNTIME" }),
      ]),
    );
    expect(
      report.issues.filter((i) => i.kind === "dangling-reference"),
    ).toEqual([]);
  });

  it("resolves a reference to a userid-suffixed id just as well as a bare one (Rules-of-Rules.md §20)", () => {
    const report = validate(
      modelOf([
        devArtifact({
          id: "REQ-000001-Ab3xR9pQ",
          targets: ["env-RUNTIME-000001-Zz9kM2wT"],
          references: ["env-RUNTIME-000001-Zz9kM2wT"],
        }),
        rule({ id: "env-RUNTIME-000001-Zz9kM2wT" }),
        domain({ id: "RUNTIME" }),
      ]),
    );
    expect(
      report.issues.filter((i) => i.kind === "dangling-reference"),
    ).toEqual([]);
  });
});

describe("validate — report shape", () => {
  it("counts nodes and splits errors/warnings", () => {
    const report = validate(
      modelOf([devArtifact({ id: "REQ-000001", targets: [] })]),
    );
    expect(report.nodeCount).toBe(1);
    expect(report.errorCount).toBe(report.issues.length);
    expect(report.warningCount).toBe(0);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });
});
