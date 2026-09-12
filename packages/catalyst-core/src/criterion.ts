/**
 * Pure helpers for the repoed-criterion mechanism (`Rules-of-Rules.md`
 * §13) — no `vscode` import, shared by every host. The canonical branch
 * is always literally `criterion`; every other contributor pushes to
 * their own `<branch-safe-name>.criterion`.
 */

/**
 * A person's identity, reduced to a valid git ref component: lowercase,
 * every run of characters that isn't `[a-z0-9]` collapsed to a single
 * `-`, leading/trailing `-` trimmed. Deterministic and applied uniformly
 * — never skipped because a name already looks git-safe.
 */
export function branchSafeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The suggested default push branch for a contributor's display name — `<branch-safe-name>.criterion`. `criterion` itself is the other valid choice (single-maintainer mode), not derived here. */
export function suggestCriterionBranch(displayName: string): string {
  return `${branchSafeName(displayName)}.criterion`;
}
