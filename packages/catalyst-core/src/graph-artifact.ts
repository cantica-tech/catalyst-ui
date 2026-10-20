/**
 * An artifact as `graph` gives it is either an entity with a file and a page of its own, or a row of a
 * type kept as a table (a roadmap item), its columns under `fields` (`spec/graph.schema.json`). Browser-safe: the
 * Studio imports it as `catalyst-core/graph-artifact`, never the package root, which reaches node modules.
 */
import type { GraphArtifactJson, GraphJson, GraphTableRowJson } from "./spec.js";

/** One artifact or row of `graph`. */
type GraphArtifact = GraphJson["artifacts"][number];

/** A table row: no page of its own, its columns under `fields`. */
export const isRow = (a: GraphArtifact): a is GraphTableRowJson => a.row === true;

/** An entity with a file and a page of its own. */
export const isEntity = (a: GraphArtifact): a is GraphArtifactJson => a.row !== true;

/** Its fields by name: a row's columns, an entity's fields (an older catalyst gave a row's flat too). */
export function fieldsOf(a: GraphArtifact): Record<string, unknown> {
  const nested: unknown = isRow(a) ? a.fields : undefined;
  return nested && typeof nested === "object"
    ? (nested as Record<string, unknown>)
    : (a as unknown as Record<string, unknown>);
}

/** Its title: an entity's own, a row's `Title` column; "" when it has none. */
export function titleOf(a: GraphArtifact): string {
  const title = isRow(a) ? fieldsOf(a).Title : a.title;
  return typeof title === "string" ? title : "";
}
