import type { ChainNode, ModuleType } from "catalyst-core";

/** A type's slug, as its definition file and an icon may be named: `House-keeping` → `house-keeping`. */
export function typeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The prefix every entity node's context value starts with. */
export const ENTITY_CONTEXT = "catalystEntity";

/**
 * An entity node's context value in the Instances tree (REQ-000077-UVqkd7cL): its type and, for an artifact
 * of a module type, whether its status is one of the type's closed states, as catalyst serves the definition,
 * and whether the signer may change its status (`/status`) — `catalystEntity.bug.open.allowed`,
 * `catalystEntity.bug.closed.denied`, `catalystEntity.rule`, `catalystEntity.domain`. A context menu's
 * `viewItem` when-clause reads it.
 */
export function entityContextValue(
  node: ChainNode,
  type: ModuleType | undefined,
  status: "allowed" | "denied" = "allowed",
): string {
  if (node.kind === "artifact" || node.kind === "row") {
    const slug = typeSlug(type?.name ?? node.typePrefix) || node.typePrefix.toLowerCase();
    return `${ENTITY_CONTEXT}.${slug}.${node.closed ? "closed" : "open"}.${status}`;
  }
  return `${ENTITY_CONTEXT}.${node.kind}`;
}
