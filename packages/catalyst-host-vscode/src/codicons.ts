/**
 * The chain inspector's icons: VS Code's own Codicons, named here (brand
 * roadmap item 4, RM-000035). They ship with VS Code, so the extension carries
 * no icon files of unknown licence, and they follow the light, dark and
 * high-contrast themes by themselves.
 */

/** A section or a type's name (a basename such as `requirements`) → its Codicon. */
const BY_NAME: Record<string, string> = {
  // the inspector's own sections
  "dev-artifacts": "file-code",
  rule: "law",
  domain: "symbol-namespace",
  users: "person",
  roles: "shield",
  journal: "history",
  backlog: "list-ordered",
  // a module's types, by the names `typeIconCandidates` gives
  requirement: "checklist",
  requirements: "checklist",
  bug: "bug",
  bugs: "bug",
  feature: "lightbulb",
  features: "lightbulb",
  step: "debug-step-over",
  steps: "debug-step-over",
  test: "beaker",
  tests: "beaker",
  house: "tools",
  "house-keeping": "tools",
  roadmap: "milestone",
  decision: "book",
  decisions: "book",
  adr: "book",
  workflow: "type-hierarchy",
  workflows: "type-hierarchy",
  analysis: "search",
  analyses: "search",
  reconciliation: "git-merge",
  reconciliations: "git-merge",
  risk: "warning",
  risks: "warning",
  control: "lock",
  controls: "lock",
  incident: "flame",
  incidents: "flame",
};

/** What a type or section without its own icon shows. */
export const FALLBACK_ICON = "file";

/** The Codicon for the first of `names` that has one, else the fallback. */
export function codiconFor(names: readonly string[]): string {
  for (const name of names) {
    const icon = BY_NAME[name.toLowerCase()];
    if (icon) return icon;
  }
  return FALLBACK_ICON;
}
