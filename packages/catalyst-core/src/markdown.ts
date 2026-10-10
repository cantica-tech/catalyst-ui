import { readFileSync } from "node:fs";

/**
 * Small Markdown helpers for the files this package still reads itself
 * (proposals, runs, a deployment's discovery) and for display (a rule's
 * title). The chain model comes from catalyst (`catalyst-source.ts`); these
 * never parse a criterion's chain.
 */

export function extractSlugFromRuleId(ruleId: string): string | undefined {
  const re = /^([a-z]+-[A-Z0-9_]+-\d{3,6}(?:-\d+)?)(?:-(?=[a-zA-Z0-9]{0,7}[A-Z])[a-zA-Z0-9]{8})?(?:-(.*))?$/;
  const match = re.exec(ruleId);
  if (match?.[2]) {
    const slug = match[2].replace(/-/g, " ").replace(/\s+/g, " ").trim();
    if (slug) return slug;
  }
  return undefined;
}

export function cleanRuleTitle(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/(?:✅|❌|🗑|⚠️|🐛)/g, "");
  s = s
    .replace(
      /\b(?:partially fixed|fixed|working|not implemented|not-implemented|unimplemented|implemented|untested|buggy|incomplete|behavioural|non-working)\b/gi,
      "",
    )
    .replace(/^\d{4}-\d{2}-\d{2}/, "")
    .replace(/^[\u2014\u2013/.:,\s-]+|[\u2014\u2013/.:,\s-]+$/g, "")
    .trim();
  return s;
}

export function detectRuleStatus(text: string, rawTitle: string, fileFieldStatus?: string): string {
  const statusLineMatch = /(✅|❌|🗑|⚠️)[^\n]*/.exec(text);
  if (statusLineMatch) return statusLineMatch[0].trim();
  if (fileFieldStatus) return fileFieldStatus.trim();

  const combined = (rawTitle + " " + text.slice(0, 200)).toLowerCase();
  if (
    combined.includes("❌") ||
    combined.includes("not implemented") ||
    combined.includes("unimplemented") ||
    combined.includes("not-implemented") ||
    combined.includes("incomplete") ||
    combined.includes("buggy") ||
    combined.includes("partially fixed") ||
    combined.includes("untested") ||
    combined.includes("broken") ||
    combined.includes("failed")
  ) {
    return "❌ not implemented";
  }
  if (
    combined.includes("✅") ||
    combined.includes("working") ||
    combined.includes("implemented") ||
    combined.includes("fixed")
  ) {
    return "✅ working";
  }
  return "✅ working";
}

/** `| **Field** | Value |` rows in one artifact file, plus its raw text for reference scanning. */
export function parseFieldTable(filePath: string): {
  fields: Map<string, string>;
  text: string;
} {
  const text = readFileSync(filePath, "utf8");
  const fields = new Map<string, string>();
  const rowRe = /^\|\s*\*\*([A-Za-z-]+)\*\*\s*\|\s*(.*?)\s*\|\s*$/;

  for (const line of text.split("\n")) {
    const match = rowRe.exec(line);
    if (match) fields.set(match[1], match[2]);
  }

  return { fields, text };
}

/** Trimmed, non-empty lines under one `## Heading` section, up to the next `##`. */
export function sectionLines(text: string, heading: string): string[] {
  const lines = text.split("\n");
  const collected: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (inSection) break;
      inSection = line.trim() === `## ${heading}`;
      continue;
    }
    if (inSection && line.trim().length > 0) collected.push(line.trim());
  }

  return collected;
}

/** `sectionLines`, stripped of each line's leading `- ` bullet marker. */
export function bulletItems(text: string, heading: string): string[] {
  return sectionLines(text, heading)
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter((line) => line.length > 0);
}
