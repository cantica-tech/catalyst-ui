/**
 * Stable identities for the chain inspector's tree items, and finding a
 * node in it (`REQ-000017-UVqkd7cL`): what `TreeView.reveal` needs to select
 * the entity a detail panel shows. Pure, so it is unit-tested without
 * VS Code.
 */

/**
 * A tree item's key among its siblings: a node by its ID, a deployment by
 * its corpus root, anything else by its type and the kind/id/name of what
 * it shows — structural, so it survives a refresh that changes a label's
 * count. `label` is the fallback.
 */
export function itemKey(item: { type: string } & Record<string, unknown>, label: string): string {
  if (item.type === "node") {
    const node = item.node as { id?: unknown } | undefined;
    if (typeof node?.id === "string") return `node:${node.id}`;
  }
  if (item.type === "deployment" && typeof item.corpusRoot === "string") {
    return `deployment:${item.corpusRoot}`;
  }
  for (const field of ["section", "group", "proposal", "run", "user", "role", "step"]) {
    const inner = item[field] as Record<string, unknown> | undefined;
    if (inner && typeof inner === "object") {
      for (const prop of ["kind", "id", "name", "key"]) {
        const value = inner[prop];
        if (typeof value === "string" && value) return `${item.type}:${value}`;
      }
    }
  }
  return `${item.type}:${label}`;
}

/** A child's id: its parent's id, then its key — `#n` for a repeat among siblings. */
export function childId(parentId: string, key: string, taken: Map<string, number>): string {
  const seen = taken.get(key) ?? 0;
  taken.set(key, seen + 1);
  return `${parentId}/${key}${seen ? `#${seen}` : ""}`;
}

/**
 * The first item, breadth-first from `roots`, that `match` accepts —
 * the shallowest occurrence, so a node listed in its own section wins over
 * the same node nested under another. Stops after `limit` items.
 */
export function breadthFirst<T>(
  roots: readonly T[],
  children: (item: T) => readonly T[],
  match: (item: T) => boolean,
  limit = 10000,
): T | undefined {
  const queue = [...roots];
  for (let seen = 0; queue.length > 0 && seen < limit; seen++) {
    const item = queue.shift()!;
    if (match(item)) return item;
    queue.push(...children(item));
  }
  return undefined;
}
