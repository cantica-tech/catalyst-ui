import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { collectIdReferences } from "./ids.js";
import { bulletItems, parseFieldTable, sectionLines } from "./parser.js";
import type { Proposal, ProposalStatus } from "./types.js";

const PROPOSAL_ID_RE = /^(PROP-\d{6})-/;
const INDEX_FILENAME = "proposals.md";

function isProposalStatus(value: string | undefined): value is ProposalStatus {
  return (
    value === "proposed" || value === "applying" || value === "applied" || value === "partial" || value === "stale"
  );
}

/**
 * Parses `<corpusRoot>/proposals/*.md` into a typed list — this
 * deployment's own uniform-layout artifact type (not a catalyst
 * framework-wide concept), the same field-table + prose-section shape
 * every other artifact type uses. Skips the index and any `templates/`
 * content, same convention as every other collection.
 */
export function parseProposals(corpusRoot: string): Proposal[] {
  const dir = join(corpusRoot, "proposals");
  if (!existsSync(dir)) return [];

  const proposals: Proposal[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === INDEX_FILENAME || entry.name === "README.md") continue;

    const match = PROPOSAL_ID_RE.exec(entry.name);
    if (!match) continue;

    const filePath = join(dir, entry.name);
    const { fields, text } = parseFieldTable(filePath);
    const status = fields.get("Status");

    proposals.push({
      id: match[1],
      status: isProposalStatus(status) ? status : "proposed",
      intent: sectionLines(text, "Intent").join(" "),
      targets: collectIdReferences(sectionLines(text, "Targets").join("\n")),
      expectations: bulletItems(text, "Expectations"),
      constraints: bulletItems(text, "Constraints"),
      location: { file: filePath, line: 1 },
    });
  }

  return proposals.sort((a, b) => a.id.localeCompare(b.id));
}

/** Next unused PROP-NNNNNN id — never reused, same 6-digit scheme as every other artifact type. */
export function nextProposalId(existing: Proposal[]): string {
  const max = existing.reduce((highest, p) => {
    const n = Number.parseInt(p.id.slice("PROP-".length), 10);
    return Number.isFinite(n) && n > highest ? n : highest;
  }, 0);
  return `PROP-${String(max + 1).padStart(6, "0")}`;
}

/** Every non-`applied` proposal, grouped by each id it targets — for pending-state lookups. */
export function openProposalsByTarget(existing: Proposal[]): Map<string, Proposal[]> {
  const byTarget = new Map<string, Proposal[]>();

  for (const proposal of existing) {
    if (proposal.status === "applied") continue;
    for (const targetId of proposal.targets) {
      const list = byTarget.get(targetId) ?? [];
      list.push(proposal);
      byTarget.set(targetId, list);
    }
  }

  return byTarget;
}
