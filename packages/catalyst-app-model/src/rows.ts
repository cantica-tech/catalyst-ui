import type { ModuleType, RowNode } from "catalyst-core";

export interface RowGroup {
  /** The table file's basename. */
  name: string;
  retired: boolean;
  items: RowNode[];
}

/** One module type kept as rows (a roadmap's items, say): its table files, each with its rows. */
export interface RowSection {
  typePrefix: string;
  label: string;
  groups: RowGroup[];
}

/**
 * The tree's sections for row types: per type, its tables by file name, each
 * with its rows sorted by id. The label is the type's plural name.
 */
export function buildRowSections(nodes: RowNode[], types?: Map<string, ModuleType>): RowSection[] {
  const byType = new Map<string, Map<string, RowGroup>>();
  for (const node of nodes) {
    const tables = byType.get(node.typePrefix) ?? new Map<string, RowGroup>();
    byType.set(node.typePrefix, tables);
    const group = tables.get(node.table) ?? { name: node.table, retired: node.tableRetired, items: [] };
    tables.set(node.table, group);
    group.items.push(node);
  }
  return [...byType.entries()]
    .map(([typePrefix, tables]) => {
      const groups = [...tables.values()].sort((a, b) => a.name.localeCompare(b.name));
      for (const g of groups) g.items.sort((a, b) => a.id.localeCompare(b.id));
      return { typePrefix, label: `${types?.get(typePrefix)?.plural_name ?? typePrefix} (${groups.length})`, groups };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
