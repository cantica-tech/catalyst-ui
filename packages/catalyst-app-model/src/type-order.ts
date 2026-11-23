/**
 * The order the views list a module's types in (`REQ-000122-UVqkd7cL`): a type
 * follows the types it rests on, so the chain reads from what a type cites down
 * to what cites it (a roadmap's features, then their requirements, then their
 * steps), and nothing here names a type. Pure, so every host shares it.
 */

/** What ordering needs of a type: its plural name and its fields' kinds and targets, as catalyst declares them. */
export interface OrderableType {
  plural_name: string;
  fields: readonly { kind: string; target_type: string | null }[];
}

/**
 * The types `prefix` rests on: the targets of its single-reference (`ref`)
 * fields, such as a step's `Parent` or a requirement's `Feature`, among
 * `present`. A `ref-list` field lists what rests on the type instead (a
 * requirement's `Steps`), so it orders nothing; `rule` and `domain` targets
 * and the type itself are not types listed beside it.
 */
export function restsOn(prefix: string, type: OrderableType | undefined, present: ReadonlySet<string>): string[] {
  const targets = new Set<string>();
  for (const field of type?.fields ?? []) {
    if (field.kind !== "ref" || !field.target_type) continue;
    for (const target of field.target_type.split("|")) {
      const t = target.trim();
      if (t && t !== prefix && present.has(t)) targets.add(t);
    }
  }
  return [...targets];
}

/**
 * `prefixes` in reading order: each type right after the last of the types it
 * rests on (`restsOn`), as soon as all of them are listed; a type that rests
 * on none, and the ties, in the order of their plural names (the prefix for a
 * type the module does not declare). Once only a cycle of references is left,
 * it is broken at its first type by name, so every prefix is listed exactly once.
 */
export function orderTypes(
  prefixes: Iterable<string>,
  typeOf: (prefix: string) => OrderableType | undefined,
): string[] {
  const label = (p: string) => typeOf(p)?.plural_name ?? p;
  const byName = [...new Set(prefixes)].sort((a, b) => label(a).localeCompare(label(b)));
  const present = new Set(byName);
  const parents = new Map(byName.map((p) => [p, restsOn(p, typeOf(p), present)]));
  const placed = new Set<string>();
  const order: string[] = [];
  const ready = (p: string) => !placed.has(p) && (parents.get(p) ?? []).every((q) => placed.has(q));

  const place = (p: string): void => {
    placed.add(p);
    order.push(p);
    for (const child of byName) {
      if ((parents.get(child) ?? []).includes(p) && ready(child)) place(child);
    }
  };

  while (order.length < byName.length) {
    const next = byName.find(ready) ?? byName.find((p) => !placed.has(p));
    if (next === undefined) break;
    place(next);
  }
  return order;
}
