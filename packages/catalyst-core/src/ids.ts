import type { DevArtifactType } from "./types.js";

/**
 * ID shapes, per Rules-of-Rules.md §3 (rules: `(DOC_PREFIX)-(DOMAIN)-(NNN)[-parent]`)
 * and §6 (dev artifacts: `(BUG|REQ|HK)-(NNNNNN)`), plus §9's separate FEAT- scheme.
 * Kept as bare pattern source strings so they can be composed into other regexes.
 */
export const RULE_ID_PATTERN = "[a-z]+-[A-Z]+-\\d{3}(?:-[a-zA-Z0-9]+)*";
export const DEV_ARTIFACT_ID_PATTERN = "(?:BUG|REQ|HK)-\\d{6}";
export const FEATURE_ID_PATTERN = "FEAT-\\d{6}";

export const RULE_ID_RE = new RegExp(`^${RULE_ID_PATTERN}$`);
export const DEV_ARTIFACT_ID_RE = new RegExp(`^${DEV_ARTIFACT_ID_PATTERN}$`);
export const FEATURE_ID_RE = new RegExp(`^${FEATURE_ID_PATTERN}$`);

export const BACKTICK_RULE_ID_RE = new RegExp(`\`(${RULE_ID_PATTERN})\``, "g");
export const BACKTICK_DEV_ARTIFACT_ID_RE = new RegExp(
  `\`(${DEV_ARTIFACT_ID_PATTERN})\``,
  "g",
);
export const BACKTICK_FEATURE_ID_RE = new RegExp(
  `\`(${FEATURE_ID_PATTERN})\``,
  "g",
);

/** Every backtick-quoted rule/dev-artifact/feature id token found in `text`, deduped. */
export function collectIdReferences(text: string): string[] {
  const found = new Set<string>();
  for (const re of [
    BACKTICK_RULE_ID_RE,
    BACKTICK_DEV_ARTIFACT_ID_RE,
    BACKTICK_FEATURE_ID_RE,
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
