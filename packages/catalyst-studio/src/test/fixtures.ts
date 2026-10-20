/**
 * Fixtures as catalyst prints them (`spec/`, R6.50), from only the fields a test cares about: whatever
 * catalyst always prints and the test does not name is filled in here, so a fixture never drifts from
 * the real output unnoticed.
 */
import type { GraphArtifact, Graph, EntityType } from "../client.js";

/**
 * An artifact as `graph` gives it. With `row: true` it is a table row: its title and other fields
 * become its columns, under `fields`; an entity's `fields`, if given, are spread flat, as catalyst prints them.
 */
export function art(a: {
  id: string;
  type: string;
  file?: string;
  title?: string;
  links?: Record<string, string[]>;
  row?: boolean;
  line?: number;
  fields?: Record<string, string>;
  [field: string]: unknown;
}): GraphArtifact {
  const { id, type, file = `${id}.md`, links = {}, row, line = 0, fields, ...rest } = a;
  if (row) {
    const columns =
      fields ?? Object.fromEntries(Object.entries(rest).map(([k, v]) => [k === "title" ? "Title" : k, String(v)]));
    return { id, type, file, line, row: true, fields: columns, links, mentions: [] };
  }
  return { title: "", ...rest, ...fields, id, type, file, links, mentions: [] }; // an entity's fields are flat
}

/** An entity type as `graph.types` gives it. */
export function entityType(t: Partial<EntityType> & { name: string }): EntityType {
  return {
    plural_name: `${t.name}s`,
    folder: t.name.toLowerCase(),
    location: null,
    grounding: null,
    grounding_field: null,
    fields: [],
    states: [],
    initial: null,
    closed_states: [],
    ...t,
  };
}

/** A `graph` with nothing but what the test names. */
export function makeGraph(g: Partial<Graph> = {}): Graph {
  return { types: {}, artifacts: [], rules: [], domains: [], ...g };
}
