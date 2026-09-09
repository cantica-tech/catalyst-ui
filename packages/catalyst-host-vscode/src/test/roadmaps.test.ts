import * as assert from "assert";

import type { RoadmapNode } from "catalyst-core";

import { buildRoadmapSection } from "../roadmaps.js";

function roadmapNode(
  overrides: Partial<RoadmapNode> & { id: string; roadmapName: string },
): RoadmapNode {
  return {
    kind: "roadmap",
    title: overrides.id,
    location: { file: "r.md", line: 1 },
    references: [],
    roadmapRetired: false,
    status: "Not triaged",
    signedOffBy: "fixture-user",
    notes: "",
    ...overrides,
  } as RoadmapNode;
}

describe("buildRoadmapSection", () => {
  it("labels the section with the total row count across every roadmap", () => {
    const nodes = [
      roadmapNode({ id: "RM-000001", roadmapName: "product" }),
      roadmapNode({ id: "RM-000002", roadmapName: "infra" }),
    ];
    assert.strictEqual(buildRoadmapSection(nodes).label, "Roadmaps (2)");
  });

  it("handles an empty list", () => {
    assert.strictEqual(buildRoadmapSection([]).label, "Roadmaps (0)");
    assert.deepStrictEqual(buildRoadmapSection([]).groups, []);
  });

  it("groups rows by roadmapName and sorts groups by name", () => {
    const nodes = [
      roadmapNode({ id: "RM-000001", roadmapName: "product" }),
      roadmapNode({ id: "RM-000002", roadmapName: "infra" }),
      roadmapNode({ id: "RM-000003", roadmapName: "infra" }),
    ];
    const { groups } = buildRoadmapSection(nodes);
    assert.deepStrictEqual(
      groups.map((g) => g.name),
      ["infra", "product"],
    );
    assert.deepStrictEqual(
      groups.find((g) => g.name === "infra")!.items.map((n) => n.id),
      ["RM-000002", "RM-000003"],
    );
  });

  it("sorts items within a group by id", () => {
    const nodes = [
      roadmapNode({ id: "RM-000002", roadmapName: "product" }),
      roadmapNode({ id: "RM-000001", roadmapName: "product" }),
    ];
    const { groups } = buildRoadmapSection(nodes);
    assert.deepStrictEqual(
      groups[0].items.map((n) => n.id),
      ["RM-000001", "RM-000002"],
    );
  });

  it("propagates a group's retired flag from its rows", () => {
    const nodes = [
      roadmapNode({
        id: "RM-000001",
        roadmapName: "infra",
        roadmapRetired: true,
      }),
    ];
    const { groups } = buildRoadmapSection(nodes);
    assert.strictEqual(groups[0].retired, true);
  });
});
