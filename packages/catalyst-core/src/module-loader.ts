import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { readCatalystPointer, resolveCorpusRoot } from "./discover.js";

export type GroundingKind = "required" | "inherited" | "none";

export type FieldKind = "text" | "enum" | "ref" | "ref-list" | "date" | "user" | "user-list";

export interface FieldDefinition {
  name: string;
  kind: FieldKind;
  required: boolean;
  allowedValues?: string[];
  targetType?: string;
  backref?: string;
}

export interface WorkflowTransition {
  from: string;
  to: string;
}

export interface WorkflowDefinition {
  initial: string;
  states: string[];
  closedStates: string[];
  transitions?: WorkflowTransition[];
}

export interface EntityTypeDefinition {
  idPrefix: string;
  name: string;
  pluralName: string;
  folder: string;
  grounding: GroundingKind;
  groundingField?: string;
  fields: FieldDefinition[];
  workflow: WorkflowDefinition;
}

export interface CommandRegistration {
  name: string;
  description: string;
  argumentHint?: string;
  specPath?: string;
}

export interface SkillRegistration {
  name: string;
  specPath: string;
}

export interface TemplateRegistration {
  entityType: string;
  templatePath: string;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  groundingType: string;
  entityTypes: Map<string, EntityTypeDefinition>;
  commands: Map<string, CommandRegistration>;
  skills: SkillRegistration[];
  templates: TemplateRegistration[];
}

export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

type YamlMap = Record<string, YamlValue>;

interface YamlLine {
  indent: number;
  content: string;
}

/** Drops a trailing `# comment` that sits outside quotes. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function splitInlineList(body: string): string[] {
  const items: string[] = [];
  let quote: string | null = null;
  let current = "";
  for (const ch of body) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ",") {
      items.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

function parseScalar(raw: string): YamlValue {
  const val = raw.trim();
  if (val === "" || val === "~" || /^(null|Null|NULL)$/.test(val)) {
    return null;
  }
  if (/^(true|True|TRUE)$/.test(val)) return true;
  if (/^(false|False|FALSE)$/.test(val)) return false;
  if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) {
    try {
      return JSON.parse(val) as string;
    } catch {
      return val.slice(1, -1);
    }
  }
  if (val.length >= 2 && val.startsWith("'") && val.endsWith("'")) {
    return val.slice(1, -1).replace(/''/g, "'");
  }
  if (val.startsWith("[") && val.endsWith("]")) {
    return splitInlineList(val.slice(1, -1)).map(parseScalar);
  }
  if (val === "{}") return {};
  if (/^-?\d+$/.test(val)) return Number(val);
  return val;
}

const KEY_LINE = /^([^\s"'[{#-][^:]*?|-[^\s:][^:]*?):(?:\s+(.*))?$/;

function isListItem(content: string): boolean {
  return content === "-" || content.startsWith("- ");
}

/**
 * Parses the small YAML subset a module manifest (`module.yaml`) and its
 * entity type definitions (`schemas/*.yaml`) use — nested maps, block lists
 * (including lists of maps), inline lists (`[a, b]`), quoted and plain
 * scalars, and `#` comments — without a YAML dependency. Mirrors catalyst's
 * `scripts/module_loader.py` `parse_simple_yaml`. Anchors, multi-line
 * scalars and flow maps beyond `{}` are out of scope.
 */
export function parseSimpleYaml(text: string): YamlMap {
  const lines: YamlLine[] = [];
  for (const rawLine of text.replace(/\r\n?/g, "\n").split("\n")) {
    const stripped = stripComment(rawLine).replace(/\s+$/, "");
    if (!stripped.trim() || stripped.trim() === "---") continue;
    const content = stripped.trimStart();
    lines.push({ indent: stripped.length - content.length, content });
  }

  let pos = 0;

  function parseNode(indent: number): YamlValue {
    return isListItem(lines[pos].content) ? parseList(indent) : parseMap(indent);
  }

  /** Value for a `key:` / `-` with nothing after it: a nested block, or null. */
  function parseNested(ownerIndent: number, allowSameIndentList: boolean) {
    const next = lines[pos];
    if (!next) return null;
    if (next.indent > ownerIndent) return parseNode(next.indent);
    if (allowSameIndentList && next.indent === ownerIndent && isListItem(next.content)) {
      return parseList(ownerIndent);
    }
    return null;
  }

  function parseMap(indent: number): YamlMap {
    const map: YamlMap = {};
    while (pos < lines.length) {
      const line = lines[pos];
      if (line.indent !== indent || isListItem(line.content)) break;
      const match = KEY_LINE.exec(line.content);
      pos++;
      if (!match) continue;
      const key = match[1].trim();
      const rest = match[2] ?? "";
      map[key] = rest.trim() ? parseScalar(rest) : parseNested(indent, true);
    }
    return map;
  }

  function parseList(indent: number): YamlValue[] {
    const list: YamlValue[] = [];
    while (pos < lines.length) {
      const line = lines[pos];
      if (line.indent !== indent || !isListItem(line.content)) break;
      const rest = line.content === "-" ? "" : line.content.slice(2);
      const body = rest.trimStart();
      if (!body) {
        pos++;
        list.push(parseNested(indent, false));
      } else if (KEY_LINE.test(body)) {
        // `- key: value` opens a map whose keys align with `key`.
        const itemIndent = indent + (line.content.length - body.length);
        lines[pos] = { indent: itemIndent, content: body };
        list.push(parseMap(itemIndent));
      } else {
        pos++;
        list.push(parseScalar(body));
      }
    }
    return list;
  }

  if (lines.length === 0) return {};
  const root = parseNode(lines[0].indent);
  return Array.isArray(root) ? {} : (root as YamlMap);
}

function asMap(value: YamlValue | undefined): YamlMap | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function asList(value: YamlValue | undefined): YamlValue[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: YamlValue | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function asStringList(value: YamlValue | undefined): string[] {
  return asList(value)
    .map(asString)
    .filter((v): v is string => v !== undefined);
}

function readYamlFile(path: string): YamlMap | undefined {
  try {
    return parseSimpleYaml(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

const GROUNDING_KINDS: GroundingKind[] = ["required", "inherited", "none"];
const FIELD_KINDS: FieldKind[] = ["text", "enum", "ref", "ref-list", "date", "user", "user-list"];

/** Maps one parsed `schemas/<entity>.yaml` (snake_case keys) onto an ETD. */
export function parseEntityTypeDefinition(data: YamlMap): EntityTypeDefinition {
  const idPrefix = asString(data.id_prefix) ?? "";
  const name = asString(data.name) ?? idPrefix;
  const groundingRaw = asString(data.grounding) as GroundingKind | undefined;

  const fields: FieldDefinition[] = [];
  for (const entry of asList(data.fields)) {
    const f = asMap(entry);
    if (!f) continue;
    const kindRaw = asString(f.kind) as FieldKind | undefined;
    const field: FieldDefinition = {
      name: asString(f.name) ?? "",
      kind: kindRaw && FIELD_KINDS.includes(kindRaw) ? kindRaw : "text",
      required: f.required === true,
    };
    const allowed = asStringList(f.allowed_values);
    if (allowed.length) field.allowedValues = allowed;
    const targetType = asString(f.target_type);
    if (targetType) field.targetType = targetType;
    const backref = asString(f.backref);
    if (backref) field.backref = backref;
    fields.push(field);
  }

  const wf = asMap(data.workflow) ?? {};
  const states = asStringList(wf.states);
  const workflow: WorkflowDefinition = {
    initial: asString(wf.initial) ?? states[0] ?? "",
    states,
    closedStates: asStringList(wf.closed_states),
  };
  const transitions = asList(wf.transitions)
    .map(asMap)
    .filter((t): t is YamlMap => t !== undefined)
    .map((t) => ({ from: asString(t.from) ?? "", to: asString(t.to) ?? "" }));
  if (transitions.length) workflow.transitions = transitions;

  const etd: EntityTypeDefinition = {
    idPrefix,
    name,
    pluralName: asString(data.plural_name) ?? `${name}s`,
    folder: asString(data.folder) ?? idPrefix.toLowerCase(),
    grounding: groundingRaw && GROUNDING_KINDS.includes(groundingRaw) ? groundingRaw : "none",
    fields,
    workflow,
  };
  const groundingField = asString(data.grounding_field);
  if (groundingField) etd.groundingField = groundingField;
  return etd;
}

const MODULE_ID = /^[a-z0-9_-]+$/;

/**
 * Resolves the project's active module id, in order: the `module` field of
 * the `*.catalyst` pointer at the project root, then `.criterion/config.yaml`
 * `module:`, then `.criterion/module.yaml` `id:` — each `.criterion` looked
 * up in the project and in the deployment's working copy. `undefined` when
 * no module is declared: there is no built-in default module.
 */
export function resolveModuleId(projectRoot?: string): string | undefined {
  if (!projectRoot || !existsSync(projectRoot)) return undefined;

  const fromPointer = readCatalystPointer(projectRoot)?.module;
  if (typeof fromPointer === "string" && MODULE_ID.test(fromPointer)) {
    return fromPointer;
  }

  const criterionDirs = [join(projectRoot, ".criterion")];
  const corpusRoot = resolveCorpusRoot(projectRoot);
  if (corpusRoot && resolve(corpusRoot) !== resolve(criterionDirs[0])) {
    criterionDirs.push(corpusRoot);
  }

  for (const [file, key] of [
    ["config.yaml", "module"],
    ["module.yaml", "id"],
  ] as const) {
    for (const dir of criterionDirs) {
      const path = join(dir, file);
      if (!existsSync(path)) continue;
      const id = asString(readYamlFile(path)?.[key]);
      if (id && MODULE_ID.test(id)) return id;
    }
  }

  return undefined;
}

/**
 * Candidate directories holding module `<id>`'s `module.yaml`, most
 * authoritative first: the deployment's own `modules/<id>/` (working copy
 * resolved by `resolveCorpusRoot` — the project's `.criterion`, else the
 * legacy pointer `agent-source` and further fallbacks — then the
 * in-project `.criterion/`), then a sibling `catalyst-<id>/` checkout of the module's
 * own repository.
 */
function moduleSearchDirs(projectRoot: string, moduleId: string): string[] {
  const dirs: string[] = [];
  const corpusRoot = resolveCorpusRoot(projectRoot);
  if (corpusRoot) dirs.push(join(corpusRoot, "modules", moduleId));
  dirs.push(join(projectRoot, ".criterion", "modules", moduleId));
  dirs.push(join(dirname(resolve(projectRoot)), `catalyst-${moduleId}`));
  return [...new Set(dirs.map((d) => resolve(d)))];
}

function buildManifest(moduleDir: string, data: YamlMap, fallbackId: string): ModuleManifest {
  const id = asString(data.id) ?? fallbackId;

  const entityTypes = new Map<string, EntityTypeDefinition>();
  for (const entry of asList(data.entity_types)) {
    const item = asMap(entry);
    const entityId = asString(item?.id);
    const schema = asString(item?.schema);
    if (!entityId || !schema) continue;
    const etdData = readYamlFile(join(moduleDir, schema));
    if (etdData) entityTypes.set(entityId, parseEntityTypeDefinition(etdData));
  }

  const commands = new Map<string, CommandRegistration>();
  for (const entry of asList(data.commands)) {
    const c = asMap(entry);
    const name = asString(c?.name);
    if (!c || !name) continue;
    const command: CommandRegistration = {
      name,
      description: asString(c.description) ?? "",
    };
    const argumentHint = asString(c.argument_hint);
    if (argumentHint) command.argumentHint = argumentHint;
    const specPath = asString(c.spec_path);
    if (specPath) command.specPath = specPath;
    commands.set(name, command);
  }

  const skills: SkillRegistration[] = [];
  for (const entry of asList(data.skills)) {
    const s = asMap(entry);
    const name = asString(s?.name);
    const specPath = asString(s?.spec_path);
    if (name && specPath) skills.push({ name, specPath });
  }

  const templates: TemplateRegistration[] = [];
  for (const entry of asList(data.templates)) {
    const t = asMap(entry);
    const entityType = asString(t?.entity_type);
    const templatePath = asString(t?.template_path);
    if (entityType && templatePath) {
      templates.push({ entityType, templatePath });
    }
  }

  return {
    id,
    name: asString(data.name) ?? id,
    version: asString(data.version) ?? "",
    description: asString(data.description) ?? "",
    groundingType: asString(data.grounding_type) ?? "rule",
    entityTypes,
    commands,
    skills,
    templates,
  };
}

/**
 * Loads the active (or the given) module's manifest and entity type
 * definitions from disk: `module.yaml` plus the `schemas/*.yaml` it lists,
 * searched in the deployment's `modules/<id>/` and then a sibling
 * `catalyst-<id>/` checkout. `undefined` when no module is declared or its
 * `module.yaml` can't be found — callers must handle a module-less project.
 */
export function loadModule(projectRoot?: string, moduleId?: string): ModuleManifest | undefined {
  if (!projectRoot) return undefined;
  const targetId = moduleId ?? resolveModuleId(projectRoot);
  if (!targetId || !MODULE_ID.test(targetId)) return undefined;

  for (const dir of moduleSearchDirs(projectRoot, targetId)) {
    const manifestPath = join(dir, "module.yaml");
    if (!existsSync(manifestPath)) continue;
    const data = readYamlFile(manifestPath);
    if (data) return buildManifest(dir, data, targetId);
  }
  return undefined;
}

export function getActiveETDs(manifest: ModuleManifest): Map<string, EntityTypeDefinition> {
  return manifest.entityTypes;
}

export function getGroundingType(manifest: ModuleManifest): string {
  return manifest.groundingType;
}

export function resolveCommand(manifest: ModuleManifest, commandName: string): CommandRegistration | undefined {
  const cleanName = commandName.startsWith("/") ? commandName.slice(1) : commandName;
  return manifest.commands.get(cleanName);
}
