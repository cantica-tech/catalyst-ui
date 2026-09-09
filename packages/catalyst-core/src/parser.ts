import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

import {
  BACKTICK_FEATURE_ID_RE,
  BACKTICK_RULE_ID_RE,
  DEV_ARTIFACT_ID_PATTERN,
  FEATURE_ID_PATTERN,
  ROADMAP_ID_PATTERN,
  collectIdReferences,
  devArtifactType,
  extractIds,
} from "./ids.js";
import type {
  ChainNode,
  DevArtifactNode,
  DomainNode,
  FeatureNode,
  ParseOptions,
  ParseResult,
  ParsedFile,
  RoadmapNode,
  RoadmapStatus,
  RuleNode,
} from "./types.js";

const DOMAIN_LINE_RE = /^>\s*\*\*Domain:\*\*\s*`([A-Z0-9_]+)`/;
const RULE_HEADING_RE =
  /^(#{2,3})\s+(?:\d+\.\s+)?`([a-z]+-[A-Z]+-\d{3}(?:-[a-zA-Z0-9]+)*)`\s+(.*)$/;
const ANY_HEADING_RE = /^#{1,6}\s+/;
const STATUS_GLYPH_RE = /(✅|❌|🗑|⚠️)/;
const ROADMAP_ROW_RE = new RegExp(
  `^\\|\\s*\`(${ROADMAP_ID_PATTERN})\`\\s*\\|(.+)\\|\\s*$`,
);
const RETIRED_HEADER_RE = /^\*\*Retired:\*\*/m;

/** Rule bullets in one rule document (`### id Title` or `## N. id Title`). */
export function parseRuleDocument(
  filePath: string,
  docPrefix: string,
  registeredRuleIds: Set<string>,
): RuleNode[] {
  const lines = readFileSync(filePath, "utf8").split("\n");
  const nodes: RuleNode[] = [];

  let currentDomain = docPrefix === "rr" ? "META" : "";
  let current: {
    id: string;
    title: string;
    startLine: number;
    domain: string;
  } | null = null;
  let body: string[] = [];

  const flush = () => {
    if (!current) return;
    const text = body.join("\n");
    const statusMatch = text.match(STATUS_GLYPH_RE);
    nodes.push({
      id: current.id,
      kind: "rule",
      title: current.title,
      location: { file: filePath, line: current.startLine },
      docPrefix,
      domain: current.domain,
      status: statusMatch ? statusMatch[1] : "",
      registeredInRulesIndex:
        docPrefix === "rr" || registeredRuleIds.has(current.id),
      // `rr` (Rules-of-Rules.md) documents the id scheme itself and cites
      // illustrative example ids (e.g. `br-AUTH-003-login-flow`) that were
      // never meant to resolve — same self-governing exemption as the
      // unbacked-rule check above, applied here to avoid false dangling refs.
      references: docPrefix === "rr" ? [] : collectIdReferences(text),
    });
  };

  lines.forEach((line, i) => {
    const domainMatch = line.match(DOMAIN_LINE_RE);
    if (domainMatch) currentDomain = domainMatch[1];

    const headingMatch = line.match(RULE_HEADING_RE);
    if (headingMatch) {
      flush();
      current = {
        id: headingMatch[2],
        title: headingMatch[3].trim(),
        startLine: i + 1,
        domain: currentDomain,
      };
      body = [];
      return;
    }
    if (current && ANY_HEADING_RE.test(line)) {
      flush();
      current = null;
      body = [];
      return;
    }
    if (current) body.push(line);
  });
  flush();

  return nodes;
}

/** The `rules/domains/domains.md` global index, plus each domain's own doc file presence. */
export function parseDomainsIndex(
  indexPath: string,
  domainsDir: string,
): DomainNode[] {
  const lines = readFileSync(indexPath, "utf8").split("\n");
  const nodes: DomainNode[] = [];
  const rowRe = /^\|\s*\[`([A-Z0-9_]+)`\]\(([^)]+)\)\s*\|/;

  lines.forEach((line, i) => {
    const match = line.match(rowRe);
    if (!match) return;
    const docPath = join(domainsDir, match[2]);
    nodes.push({
      id: match[1],
      kind: "domain",
      title: match[1],
      location: { file: indexPath, line: i + 1 },
      code: match[1],
      hasDoc: existsSync(docPath),
      references: [],
    });
  });

  return nodes;
}

interface IndexRow {
  title: string;
  status: string;
  line: number;
}

/** `| [ID](file) | Title | ... | Status |` rows keyed by id — the shape shared by every artifact-type index. */
function parseIndexTable(
  indexPath: string,
  idPattern: string,
): Map<string, IndexRow> {
  const rows = new Map<string, IndexRow>();
  const rowRe = new RegExp(
    `^\\|\\s*\\[(${idPattern})\\]\\([^)]+\\)\\s*\\|(.+)\\|\\s*$`,
  );

  readFileSync(indexPath, "utf8")
    .split("\n")
    .forEach((line, i) => {
      const match = line.match(rowRe);
      if (!match) return;
      const cells = match[2]
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      rows.set(match[1], {
        title: cells[0] ?? "",
        status: cells[cells.length - 1] ?? "",
        line: i + 1,
      });
    });

  return rows;
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
    const match = line.match(rowRe);
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

function filesById(
  dirPath: string,
  indexPath: string,
  idFromFilenameRe: RegExp,
): Map<string, string> {
  const found = new Map<string, string>();
  if (!existsSync(dirPath)) return found;

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === basename(indexPath) || entry.name === "README.md")
      continue;
    const match = entry.name.match(idFromFilenameRe);
    if (match) found.set(match[1], join(dirPath, entry.name));
  }

  return found;
}

function buildDevArtifactNode(
  id: string,
  filePath: string,
  registered: IndexRow | undefined,
): DevArtifactNode {
  const { fields, text } = parseFieldTable(filePath);
  const targets = extractIds(fields.get("Targets") ?? "", BACKTICK_RULE_ID_RE);
  const featureIds = extractIds(
    fields.get("Feature") ?? "",
    BACKTICK_FEATURE_ID_RE,
  );

  return {
    id,
    kind: "dev-artifact",
    title: registered?.title ?? fields.get("ID") ?? id,
    location: { file: filePath, line: 1 },
    artifactType: devArtifactType(id),
    status: fields.get("Status") ?? registered?.status ?? "",
    targets,
    feature: featureIds[0],
    registered: registered !== undefined,
    fileExists: true,
    references: collectIdReferences(text),
  };
}

/** One dev-artifact type's index + directory (requirements/, development/bugs/, development/house-keeping/). */
function parseDevArtifactCollection(
  indexPath: string,
  dirPath: string,
): ParsedFile[] {
  const index = parseIndexTable(indexPath, DEV_ARTIFACT_ID_PATTERN);
  const idFromFilenameRe = new RegExp(`^(${DEV_ARTIFACT_ID_PATTERN})-`);
  const onDisk = filesById(dirPath, indexPath, idFromFilenameRe);

  const files: ParsedFile[] = [];
  const indexOnlyNodes: ChainNode[] = [];

  for (const id of new Set([...index.keys(), ...onDisk.keys()])) {
    const registeredRow = index.get(id);
    const filePath = onDisk.get(id);
    if (filePath) {
      files.push({
        file: filePath,
        mtimeMs: statSync(filePath).mtimeMs,
        nodes: [buildDevArtifactNode(id, filePath, registeredRow)],
      });
    } else if (registeredRow) {
      indexOnlyNodes.push({
        id,
        kind: "dev-artifact",
        title: registeredRow.title,
        location: { file: indexPath, line: registeredRow.line },
        artifactType: devArtifactType(id),
        status: registeredRow.status,
        targets: [],
        feature: undefined,
        registered: true,
        fileExists: false,
        references: [],
      });
    }
  }

  files.push({
    file: indexPath,
    mtimeMs: statSync(indexPath).mtimeMs,
    nodes: indexOnlyNodes,
  });
  return files;
}

function buildFeatureNode(
  id: string,
  filePath: string,
  registered: IndexRow | undefined,
): FeatureNode {
  const { fields, text } = parseFieldTable(filePath);
  return {
    id,
    kind: "feature",
    title: registered?.title ?? fields.get("ID") ?? id,
    location: { file: filePath, line: 1 },
    status: fields.get("Status") ?? registered?.status ?? "",
    registered: registered !== undefined,
    fileExists: true,
    references: collectIdReferences(text),
  };
}

/** features/ — same registered/on-disk cross-check as dev-artifacts, but never rule-linked (Rules-of-Rules.md §9). */
function parseFeatureCollection(
  indexPath: string,
  dirPath: string,
): ParsedFile[] {
  const index = parseIndexTable(indexPath, FEATURE_ID_PATTERN);
  const idFromFilenameRe = new RegExp(`^(${FEATURE_ID_PATTERN})-`);
  const onDisk = filesById(dirPath, indexPath, idFromFilenameRe);

  const files: ParsedFile[] = [];
  const indexOnlyNodes: ChainNode[] = [];

  for (const id of new Set([...index.keys(), ...onDisk.keys()])) {
    const registeredRow = index.get(id);
    const filePath = onDisk.get(id);
    if (filePath) {
      files.push({
        file: filePath,
        mtimeMs: statSync(filePath).mtimeMs,
        nodes: [buildFeatureNode(id, filePath, registeredRow)],
      });
    } else if (registeredRow) {
      indexOnlyNodes.push({
        id,
        kind: "feature",
        title: registeredRow.title,
        location: { file: indexPath, line: registeredRow.line },
        status: registeredRow.status,
        registered: true,
        fileExists: false,
        references: [],
      });
    }
  }

  files.push({
    file: indexPath,
    mtimeMs: statSync(indexPath).mtimeMs,
    nodes: indexOnlyNodes,
  });
  return files;
}

function isRoadmapStatus(value: string | undefined): value is RoadmapStatus {
  return (
    value === "Not triaged" ||
    value === "Triaged" ||
    value === "In progress" ||
    value === "Done"
  );
}

/**
 * One named roadmap's `RM-NNNNNN` table rows (`rr-META-010`). A row is
 * exempt from `Targets`/`Domain` (roadmap items aren't rule-linked), so
 * unlike a rule or dev-artifact its `references` come from scanning the
 * whole row rather than a dedicated field — same "cite it in backticks
 * and it resolves" convention as everywhere else, which is what lets a
 * `Linked` `FEAT-`/`REQ-` id (and a feature's own back-citation of this
 * row's id) auto-resolve into real graph edges.
 */
function parseRoadmapFile(
  filePath: string,
  roadmapName: string,
): RoadmapNode[] {
  const text = readFileSync(filePath, "utf8");
  const roadmapRetired = RETIRED_HEADER_RE.test(text);
  const nodes: RoadmapNode[] = [];

  text.split("\n").forEach((line, i) => {
    const match = line.match(ROADMAP_ROW_RE);
    if (!match) return;
    const cells = match[2].split("|").map((c) => c.trim());
    const [title, status, linkedCell, signedOffBy, ...rest] = cells;
    const linked = collectIdReferences(linkedCell ?? "")[0];

    nodes.push({
      id: match[1],
      kind: "roadmap",
      title: title || match[1],
      location: { file: filePath, line: i + 1 },
      roadmapName,
      roadmapRetired,
      status: isRoadmapStatus(status) ? status : "Not triaged",
      linked,
      signedOffBy: signedOffBy ?? "",
      notes: rest.join("|").trim(),
      references: collectIdReferences(line),
    });
  });

  return nodes;
}

/**
 * `development/roadmaps/*.md` — one file per named roadmap, plus the
 * `roadmaps.md` registry (skipped — it names roadmaps, it doesn't carry
 * rows itself) and any `templates/` subdirectory (excluded by `isFile()`,
 * same as every other collection scan in this file).
 */
function parseRoadmapCollection(root: string): ParsedFile[] {
  const roadmapsDir = join(root, "development", "roadmaps");
  if (!existsSync(roadmapsDir)) return [];
  const files: ParsedFile[] = [];

  for (const entry of readdirSync(roadmapsDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === "roadmaps.md" || entry.name === "README.md") continue;
    const filePath = join(roadmapsDir, entry.name);
    files.push({
      file: filePath,
      mtimeMs: statSync(filePath).mtimeMs,
      nodes: parseRoadmapFile(filePath, basename(entry.name, ".md")),
    });
  }
  return files;
}

/**
 * Full reparse of a catalyst deployment corpus (a `.criterion`-shaped tree)
 * into per-file node lists. Never incremental — validation is inherently
 * global, so every pass rebuilds from the complete file set.
 */
export function parseCorpus(
  root: string,
  options: ParseOptions = {},
): ParseResult | null {
  const start = performance.now();
  const shouldContinue = options.shouldContinue ?? (() => true);
  const files: ParsedFile[] = [];

  const rulesDir = join(root, "rules");
  const rulesIndexPath = join(rulesDir, "rules.md");

  const registeredRuleIds = new Set<string>();
  const ruleDocs: { prefix: string; path: string }[] = [];
  if (existsSync(rulesIndexPath)) {
    const text = readFileSync(rulesIndexPath, "utf8");
    for (const match of text.matchAll(
      /^\|\s*`([a-z]+)`\s*\|\s*\[`[^`]+`\]\(([^)]+)\)\s*\|/gm,
    )) {
      ruleDocs.push({ prefix: match[1], path: join(rulesDir, match[2]) });
    }
    for (const match of text.matchAll(/^- `([^`]+)`/gm)) {
      registeredRuleIds.add(match[1]);
    }
  }
  const rulesOfRulesPath = join(rulesDir, "Rules-of-Rules.md");
  if (
    existsSync(rulesOfRulesPath) &&
    !ruleDocs.some((d) => d.path === rulesOfRulesPath)
  ) {
    ruleDocs.push({ prefix: "rr", path: rulesOfRulesPath });
  }

  for (const doc of ruleDocs) {
    if (!shouldContinue()) return null;
    if (!existsSync(doc.path)) continue;
    files.push({
      file: doc.path,
      mtimeMs: statSync(doc.path).mtimeMs,
      nodes: parseRuleDocument(doc.path, doc.prefix, registeredRuleIds),
    });
  }

  if (!shouldContinue()) return null;
  const domainsIndexPath = join(rulesDir, "domains", "domains.md");
  if (existsSync(domainsIndexPath)) {
    files.push({
      file: domainsIndexPath,
      mtimeMs: statSync(domainsIndexPath).mtimeMs,
      nodes: parseDomainsIndex(domainsIndexPath, join(rulesDir, "domains")),
    });
  }

  const devArtifactCollections = [
    {
      index: join(root, "requirements", "requirements.md"),
      dir: join(root, "requirements"),
    },
    {
      index: join(root, "development", "bugs", "bugs.md"),
      dir: join(root, "development", "bugs"),
    },
    {
      index: join(root, "development", "house-keeping", "house-keeping.md"),
      dir: join(root, "development", "house-keeping"),
    },
  ];
  for (const collection of devArtifactCollections) {
    if (!shouldContinue()) return null;
    if (!existsSync(collection.index)) continue;
    files.push(...parseDevArtifactCollection(collection.index, collection.dir));
  }

  if (!shouldContinue()) return null;
  const featuresIndexPath = join(root, "features", "features.md");
  if (existsSync(featuresIndexPath)) {
    files.push(
      ...parseFeatureCollection(featuresIndexPath, join(root, "features")),
    );
  }

  if (!shouldContinue()) return null;
  files.push(...parseRoadmapCollection(root));

  return { root, files, durationMs: performance.now() - start };
}
