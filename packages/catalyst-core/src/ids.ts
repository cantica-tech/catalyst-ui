import type { DevArtifactType } from "./types.js";

/**
 * ID shapes, per Rules-of-Rules.md §3 (rules: `(DOC_PREFIX)-(DOMAIN)-(NNNNNN)[-parent]-(userid)`)
 * and §6 (dev artifacts: `(BUG|REQ|HK)-(NNNNNN)-(userid)`), plus §9's separate
 * FEAT- scheme and §20's userid-suffix mechanism (framework 0.26.0).
 * Kept as bare pattern source strings so they can be composed into other regexes.
 *
 * `USERID_SUFFIX_PATTERN` requires the 8 characters right after the
 * hyphen to (a) contain at least one uppercase letter — every generated
 * userid does (Rules-of-Rules.md §11) — and (b) not be immediately
 * followed by a 9th alphanumeric character, so it never partially
 * matches into a longer word. Together this means an old-style,
 * unsuffixed filename whose summary happens to start with an 8-letter
 * all-lowercase word (`REQ-000002-database-migration-plan.md`) is never
 * misread as if that word were a userid suffix — "database" has no
 * uppercase letter, so the lookahead simply fails and the whole optional
 * group doesn't engage, leaving the bare id to match on its own.
 * Backward compatible in both directions: the suffix is optional (an
 * un-migrated deployment's bare ids still match), and a rule's sequence
 * number accepts either the old 3-digit or the new 6-digit width.
 */
export const USERID_SUFFIX_PATTERN =
  "(?:-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8}(?![a-zA-Z0-9]))?";
export const RULE_ID_PATTERN = "[a-z]+-[A-Z0-9_]+-\\d{3,6}(?:-[a-zA-Z0-9]+)*";
export const DEV_ARTIFACT_ID_PATTERN = `(?:BUG|REQ|HK)-\\d{6}${USERID_SUFFIX_PATTERN}`;
export const FEATURE_ID_PATTERN = `FEAT-\\d{6}${USERID_SUFFIX_PATTERN}`;
export const ROADMAP_ID_PATTERN = `RM-\\d{6}${USERID_SUFFIX_PATTERN}`;

export const RULE_ID_RE = new RegExp(`^${RULE_ID_PATTERN}$`);
export const DEV_ARTIFACT_ID_RE = new RegExp(`^${DEV_ARTIFACT_ID_PATTERN}$`);
export const FEATURE_ID_RE = new RegExp(`^${FEATURE_ID_PATTERN}$`);
export const ROADMAP_ID_RE = new RegExp(`^${ROADMAP_ID_PATTERN}$`);

export const BACKTICK_RULE_ID_RE = new RegExp(`\`(${RULE_ID_PATTERN})\``, "g");
export const BACKTICK_DEV_ARTIFACT_ID_RE = new RegExp(
  `\`(${DEV_ARTIFACT_ID_PATTERN})\``,
  "g",
);
export const BACKTICK_FEATURE_ID_RE = new RegExp(
  `\`(${FEATURE_ID_PATTERN})\``,
  "g",
);
export const BACKTICK_ROADMAP_ID_RE = new RegExp(
  `\`(${ROADMAP_ID_PATTERN})\``,
  "g",
);

/** Every backtick-quoted rule/dev-artifact/feature/roadmap id token found in `text`, deduped. */
export function collectIdReferences(text: string): string[] {
  const found = new Set<string>();
  for (const re of [
    BACKTICK_RULE_ID_RE,
    BACKTICK_DEV_ARTIFACT_ID_RE,
    BACKTICK_FEATURE_ID_RE,
    BACKTICK_ROADMAP_ID_RE,
  ]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      found.add(match[1]);
    }
  }
  return [...found];
}

/** All matches of a global backtick-id regex in `text`, in order (not deduped). */
export function extractIds(text: string, re: RegExp): string[] {
  re.lastIndex = 0;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    found.push(match[1]);
  }
  return found;
}

export function devArtifactType(id: string): DevArtifactType {
  if (id.startsWith("BUG-")) return "bug";
  if (id.startsWith("HK-")) return "house-keeping";
  return "requirement";
}
