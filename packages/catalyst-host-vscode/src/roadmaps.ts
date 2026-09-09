import type { RoadmapNode } from "catalyst-core";

export interface RoadmapGroup {
  name: string;
  retired: boolean;
  items: RoadmapNode[];
}

export interface RoadmapSection {
  label: string;
  groups: RoadmapGroup[];
}

/**
 * Roadmaps need a two-level (roadmap name -> rows) shape that doesn't fit
 * `TreeSection`'s flat `nodes: ChainNode[]` contract, so unlike the five
 * uniform sections in `tree.ts` this gets its own builder, the same way
 * `proposals.ts`/`runmonitor.ts` do for their own section shapes.
 */
export function buildRoadmapSection(nodes: RoadmapNode[]): RoadmapSection {
  const byName = new Map<string, RoadmapGroup>();

  for (const node of nodes) {
    let group = byName.get(node.roadmapName);
    if (!group) {
      group = {
        name: node.roadmapName,
        retired: node.roadmapRetired,
        items: [],
      };
      byName.set(node.roadmapName, group);
    }
    group.items.push(node);
  }

  const groups = [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  for (const group of groups) {
    group.items.sort((a, b) => a.id.localeCompare(b.id));
  }

  return { label: `Roadmaps (${nodes.length})`, groups };
}
