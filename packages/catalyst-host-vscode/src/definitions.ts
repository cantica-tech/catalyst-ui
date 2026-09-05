import {
  BACKTICK_DEV_ARTIFACT_ID_RE,
  BACKTICK_FEATURE_ID_RE,
  BACKTICK_RULE_ID_RE,
} from "catalyst-core";
import type { ChainModel, SourceLocation } from "catalyst-core";

const ID_PATTERNS = [
  BACKTICK_RULE_ID_RE,
  BACKTICK_DEV_ARTIFACT_ID_RE,
  BACKTICK_FEATURE_ID_RE,
];

/**
 * Finds the backtick-quoted id token (if any) spanning `character` in
 * `lineText` and resolves it to its defining location via the chain
 * model — the logic behind "click any id to jump to its node." Reuses
 * catalyst-core's own id regexes rather than re-deriving what counts as
 * an id.
 */
export function resolveDefinitionAt(
  model: ChainModel,
  lineText: string,
  character: number,
): SourceLocation | null {
  for (const pattern of ID_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(lineText))) {
      const start = match.index;
      const end = start + match[0].length;
      if (character >= start && character < end) {
        return model.nodes.get(match[1])?.location ?? null;
      }
    }
  }
  return null;
}
