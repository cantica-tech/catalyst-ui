import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Builds small, real-shaped `.criterion` corpora on disk for tests — never used by product code. */

export interface FixtureRule {
  id: string;
  title: string;
  domain: string;
  status?: string;
  extraBody?: string;
}

export interface FixtureRuleDoc {
  prefix: string;
  filename: string;
  rules: FixtureRule[];
}

export interface FixtureDomain {
  code: string;
  filename?: string;
  skipDoc?: boolean;
}

export interface FixtureArtifact {
  id: string;
  title: string;
  status?: string;
  targets?: string[];
  feature?: string;
  registerInIndex?: boolean;
  createFile?: boolean;
  extraBody?: string;
}

export interface FixtureFeature {
  id: string;
  title: string;
  status?: string;
  registerInIndex?: boolean;
  createFile?: boolean;
}

export interface FixtureProposal {
  id: string;
  status?: string;
  intent?: string;
  targets?: string[];
  expectations?: string[];
  constraints?: string[];
}

export interface FixtureRun {
  id: string;
  status?: string;
  command?: string;
  started?: string;
  /** Raw checklist lines, glyph prefix included (e.g. `"✅ Ran tests"`). */
  checklist?: string[];
  ledger?: string[];
}

export interface FixtureSpec {
  ruleDocs?: FixtureRuleDoc[];
  domains?: FixtureDomain[];
  requirements?: FixtureArtifact[];
  bugs?: FixtureArtifact[];
  houseKeeping?: FixtureArtifact[];
  features?: FixtureFeature[];
  proposals?: FixtureProposal[];
  runs?: FixtureRun[];
  /** Extra rule ids to also list in rules.md's "Rule IDs" section (e.g. to simulate an orphan-registration mismatch). */
  extraRegisteredRuleIds?: string[];
}

function renderRuleDoc(doc: FixtureRuleDoc): string {
  const domainGroups = new Map<string, FixtureRule[]>();
  for (const rule of doc.rules) {
    const group = domainGroups.get(rule.domain) ?? [];
    group.push(rule);
    domainGroups.set(rule.domain, group);
  }

  let text = `# ${doc.filename}\n\n`;
  for (const [domain, rules] of domainGroups) {
    text += `## \`${domain}\`\n\n> **Domain:** \`${domain}\` — see [domains/${domain}.md](domains/${domain}.md).\n\n`;
    for (const rule of rules) {
      text += `### \`${rule.id}\` ${rule.title}\n\n${rule.status ?? "✅"} working.${rule.extraBody ? ` ${rule.extraBody}` : ""}\n\n`;
    }
  }
  text += "## Known Bugs — Quick Index\n\n*(none)*\n";
  return text;
}

function renderRulesOfRules(rules: FixtureRule[]): string {
  let text = "# Rules of Rules — template\n\n";
  rules.forEach((rule, i) => {
    text += `## ${i + 1}. \`${rule.id}\` ${rule.title}\n\n${rule.status ?? "✅"} ${rule.extraBody ?? ""}\n\n`;
  });
  return text;
}

function renderRulesIndex(
  ruleDocs: FixtureRuleDoc[],
  extraRegisteredRuleIds: string[],
): string {
  let text =
    "# Rules index\n\n## Rule documents\n\n| Prefix | Document | Domains |\n|---|---|---|\n";
  for (const doc of ruleDocs) {
    const domains = [...new Set(doc.rules.map((r) => r.domain))]
      .map((d) => `\`${d}\``)
      .join(", ");
    text += `| \`${doc.prefix}\` | [\`${doc.filename}\`](${doc.filename}) | ${domains} |\n`;
  }
  text += "\n## Rule IDs\n\n";
  const allIds = [
    ...ruleDocs.flatMap((d) => d.rules.map((r) => r.id)),
    ...extraRegisteredRuleIds,
  ];
  for (const id of allIds) {
    text += `- \`${id}\` — placeholder\n`;
  }
  return text;
}

function renderDomainsIndex(domains: FixtureDomain[]): string {
  let text =
    "# Domains index\n\n| Code | Document | Defined |\n|---|---|---|\n";
  for (const domain of domains) {
    text += `| [\`${domain.code}\`](${domain.filename ?? `${domain.code}.md`}) | rules/some-doc.md | 2026-01-01 |\n`;
  }
  return text;
}

function renderFieldTable(fields: Record<string, string>): string {
  let text = "| Field | Value |\n|---|---|\n";
  for (const [key, value] of Object.entries(fields)) {
    text += `| **${key}** | ${value} |\n`;
  }
  return text;
}

function renderDevArtifactFile(artifact: FixtureArtifact): string {
  const fields: Record<string, string> = {
    ID: `\`${artifact.id}\``,
    Status: artifact.status ?? "in-progress",
  };
  if (artifact.targets?.length)
    fields.Targets = artifact.targets.map((t) => `\`${t}\``).join(", ");
  if (artifact.feature) fields.Feature = `\`${artifact.feature}\``;
  return `# \`${artifact.id}\` — ${artifact.title}\n\n${renderFieldTable(fields)}\n## Notes\n\n${artifact.extraBody ?? "None."}\n`;
}

function renderFeatureFile(feature: FixtureFeature): string {
  return `# \`${feature.id}\` — ${feature.title}\n\n${renderFieldTable({ ID: `\`${feature.id}\``, Status: feature.status ?? "in-development" })}\n`;
}

function renderProposalFile(proposal: FixtureProposal): string {
  const fields = renderFieldTable({
    ID: `\`${proposal.id}\``,
    Status: proposal.status ?? "proposed",
  });
  const targets = (proposal.targets ?? []).map((t) => `- \`${t}\``).join("\n");
  const expectations = (proposal.expectations ?? ["Placeholder expectation."])
    .map((e) => `- ${e}`)
    .join("\n");
  const constraints = (proposal.constraints ?? [])
    .map((c) => `- ${c}`)
    .join("\n");
  return `# \`${proposal.id}\` — fixture proposal\n\n${fields}\n## Intent\n\n${proposal.intent ?? "Fixture intent."}\n\n## Targets\n\n${targets}\n\n## Expectations\n\n${expectations}\n\n## Constraints\n\n${constraints}\n`;
}

function renderRunFile(run: FixtureRun): string {
  const fields = renderFieldTable({
    ID: `\`${run.id}\``,
    Status: run.status ?? "running",
    Command: run.command ?? "fixture command",
    Started: run.started ?? "2026-01-01T00:00:00Z",
  });
  const checklist = (run.checklist ?? ["✅ Fixture step"])
    .map((c) => `- ${c}`)
    .join("\n");
  const ledger = (run.ledger ?? []).map((l) => `- ${l}`).join("\n");
  return `# \`${run.id}\` — fixture run\n\n${fields}\n## Checklist\n\n${checklist}\n\n## Ledger\n\n${ledger}\n`;
}

function renderArtifactIndex(
  columns: string[],
  rows: Array<{ id: string; filename: string; cells: string[] }>,
): string {
  let text = `# Index\n\n| ${["ID", ...columns].join(" | ")} |\n|${columns
    .map(() => "---")
    .concat("---")
    .join("|")}|\n`;
  for (const row of rows) {
    text += `| [${row.id}](${row.filename}) | ${row.cells.join(" | ")} |\n`;
  }
  if (rows.length === 0) text += "\n*(none yet)*\n";
  return text;
}

function writeArtifactCollection(
  dir: string,
  indexPath: string,
  artifacts: FixtureArtifact[],
): void {
  mkdirSync(dir, { recursive: true });
  const rows = artifacts
    .filter((a) => a.registerInIndex !== false)
    .map((a) => ({
      id: a.id,
      filename: `${a.id}-file.md`,
      cells: [a.title, a.status ?? "in-progress"],
    }));
  writeFileSync(indexPath, renderArtifactIndex(["Title", "Status"], rows));
  for (const artifact of artifacts) {
    if (artifact.createFile === false) continue;
    writeFileSync(
      join(dir, `${artifact.id}-file.md`),
      renderDevArtifactFile(artifact),
    );
  }
}

export function createFixtureCorpus(spec: FixtureSpec): string {
  const root = mkdtempSync(join(tmpdir(), "catalyst-core-fixture-"));
  const rulesDir = join(root, "rules");
  const domainsDir = join(rulesDir, "domains");
  mkdirSync(domainsDir, { recursive: true });

  const ruleDocs = spec.ruleDocs ?? [];
  writeFileSync(
    join(rulesDir, "rules.md"),
    renderRulesIndex(ruleDocs, spec.extraRegisteredRuleIds ?? []),
  );
  for (const doc of ruleDocs) {
    writeFileSync(join(rulesDir, doc.filename), renderRuleDoc(doc));
  }

  const domains = spec.domains ?? [];
  writeFileSync(join(domainsDir, "domains.md"), renderDomainsIndex(domains));
  for (const domain of domains) {
    if (domain.skipDoc) continue;
    writeFileSync(
      join(domainsDir, domain.filename ?? `${domain.code}.md`),
      `# ${domain.code}\n`,
    );
  }

  writeArtifactCollection(
    join(root, "requirements"),
    join(root, "requirements", "requirements.md"),
    spec.requirements ?? [],
  );
  writeArtifactCollection(
    join(root, "development", "bugs"),
    join(root, "development", "bugs", "bugs.md"),
    spec.bugs ?? [],
  );
  writeArtifactCollection(
    join(root, "development", "house-keeping"),
    join(root, "development", "house-keeping", "house-keeping.md"),
    spec.houseKeeping ?? [],
  );

  const featuresDir = join(root, "features");
  mkdirSync(featuresDir, { recursive: true });
  const features = spec.features ?? [];
  const featureRows = features
    .filter((f) => f.registerInIndex !== false)
    .map((f) => ({
      id: f.id,
      filename: `${f.id}-file.md`,
      cells: [f.title, f.status ?? "in-development"],
    }));
  writeFileSync(
    join(featuresDir, "features.md"),
    renderArtifactIndex(["Title", "Status"], featureRows),
  );
  for (const feature of features) {
    if (feature.createFile === false) continue;
    writeFileSync(
      join(featuresDir, `${feature.id}-file.md`),
      renderFeatureFile(feature),
    );
  }

  const proposals = spec.proposals ?? [];
  if (proposals.length > 0) {
    const proposalsDir = join(root, "proposals");
    mkdirSync(proposalsDir, { recursive: true });
    for (const proposal of proposals) {
      writeFileSync(
        join(proposalsDir, `${proposal.id}-fixture.md`),
        renderProposalFile(proposal),
      );
    }
  }

  const runs = spec.runs ?? [];
  if (runs.length > 0) {
    const runsDir = join(root, "runs");
    mkdirSync(runsDir, { recursive: true });
    for (const run of runs) {
      writeFileSync(join(runsDir, `${run.id}-fixture.md`), renderRunFile(run));
    }
  }

  return root;
}

export function removeFixtureCorpus(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

/** Renders `renderRulesOfRules` reachable for a from-scratch Rules-of-Rules.md when a test needs `rr` rules specifically. */
export function writeRulesOfRules(root: string, rules: FixtureRule[]): void {
  writeFileSync(
    join(root, "rules", "Rules-of-Rules.md"),
    renderRulesOfRules(rules),
  );
}

/** Base-26 letter encoding (A, B, ..., Z, AA, AB, ...) — rule ids and domain
 * codes must be pure letters (`[A-Z]+`/`[a-z]+`), so a numeric index can't be
 * embedded directly. */
function toAlpha(n: number, upper: boolean): string {
  let value = n;
  let result = "";
  do {
    result = String.fromCharCode((upper ? 65 : 97) + (value % 26)) + result;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return result;
}

/**
 * A synthetic, fully-linked corpus sized as a multiple of a rough "one real
 * deployment" baseline (~50 rules across 5 docs, ~50 domains, ~50
 * requirements, each targeting a real rule) — there's no real corpus big
 * enough yet to size the CI perf assertion from, so this stands in for it.
 */
export function createSyntheticCorpus(multiplier: number): string {
  const rulesPerDoc = 10;
  const docCount = 5;
  const totalRequirements = 50 * multiplier;

  const ruleDocs: FixtureRuleDoc[] = [];
  const domains: FixtureDomain[] = [];
  const ruleIds: string[] = [];

  for (let d = 0; d < docCount * multiplier; d++) {
    const domainCode = `DOM${toAlpha(d, true)}`;
    domains.push({ code: domainCode });
    const rules: FixtureRule[] = [];
    for (let r = 0; r < rulesPerDoc; r++) {
      const id = `syn${toAlpha(d, false)}-${domainCode}-${String(r + 1).padStart(3, "0")}`;
      rules.push({ id, title: `Synthetic rule ${id}`, domain: domainCode });
      ruleIds.push(id);
    }
    ruleDocs.push({
      prefix: `syn${toAlpha(d, false)}`,
      filename: `synthetic-rules-${d}.md`,
      rules,
    });
  }

  const requirements: FixtureArtifact[] = [];
  for (let i = 0; i < totalRequirements; i++) {
    const id = `REQ-${String(i + 1).padStart(6, "0")}`;
    requirements.push({
      id,
      title: `Synthetic requirement ${id}`,
      targets: [ruleIds[i % ruleIds.length]],
    });
  }

  return createFixtureCorpus({ ruleDocs, domains, requirements });
}
