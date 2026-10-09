import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  getActiveETDs,
  getGroundingType,
  loadModule,
  parseSimpleYaml,
  resolveCommand,
  resolveModuleId,
} from "../module-loader.js";

const MODULE_YAML = `# A fictional process module used only by tests.
id: example-process
name: Example Process Module
version: 1.2.0
description: "A generic module: one entity type"
grounding_type: rule

entity_types:
  - id: ITEM
    schema: schemas/item.yaml

commands:
  - name: create-item
    description: Create a new item
    argument_hint: "[<rule-id>]"
    spec_path: commands/create-item.md

templates:
  - entity_type: ITEM
    template_path: templates/item.template.md
`;

const ITEM_YAML = `id_prefix: ITEM
name: Item
plural_name: Items
folder: items
grounding: required
grounding_field: Targets

fields:
  - name: ID
    kind: text
    required: true
  - name: Status
    kind: enum
    required: true
    allowed_values:
      - Open
      - Done
  - name: Targets
    kind: ref-list
    required: true
    target_type: rule
  - name: Labels
    kind: enum
    required: false
    allowed_values: [red, "green", 'blue']

workflow:
  initial: Open
  states: [Open, Done]
  closed_states:
    - Done
`;

const dirs: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "module-loader-"));
  dirs.push(dir);
  return dir;
}

function writeModule(moduleDir: string): void {
  mkdirSync(join(moduleDir, "schemas"), { recursive: true });
  writeFileSync(join(moduleDir, "module.yaml"), MODULE_YAML);
  writeFileSync(join(moduleDir, "schemas", "item.yaml"), ITEM_YAML);
}

/**
 * A project whose working copy lives out of tree, reached through a
 * `.criterion` symlink (kernel 0.37.0) — or, with `legacy`, through a
 * pre-0.37.0 pointer's `agent-source` field instead.
 */
function projectWithDeployment(
  pointerExtra: Record<string, unknown> = {},
  { legacy = false }: { legacy?: boolean } = {},
) {
  const base = tempDir();
  const projectRoot = join(base, "app");
  const corpusRoot = join(base, "storage", ".criterion");
  mkdirSync(projectRoot, { recursive: true });
  mkdirSync(corpusRoot, { recursive: true });
  if (!legacy) symlinkSync(corpusRoot, join(projectRoot, ".criterion"), "dir");
  writeFileSync(
    join(projectRoot, "app.catalyst"),
    JSON.stringify({
      project_name: "app",
      ...(legacy ? { "agent-source": corpusRoot } : {}),
      ...pointerExtra,
    }),
  );
  return { base, projectRoot, corpusRoot };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseSimpleYaml", () => {
  it("parses maps, lists of maps, inline lists and scalars", () => {
    const parsed = parseSimpleYaml(ITEM_YAML);
    expect(parsed.id_prefix).toBe("ITEM");
    const fields = parsed.fields as Record<string, unknown>[];
    expect(fields).toHaveLength(4);
    expect(fields[0]).toEqual({ name: "ID", kind: "text", required: true });
    expect(fields[1].allowed_values).toEqual(["Open", "Done"]);
    expect(fields[3].allowed_values).toEqual(["red", "green", "blue"]);
    expect(parsed.workflow).toEqual({
      initial: "Open",
      states: ["Open", "Done"],
      closed_states: ["Done"],
    });
  });

  it("keeps quoted values and strips comments", () => {
    const parsed = parseSimpleYaml(MODULE_YAML);
    expect(parsed.description).toBe("A generic module: one entity type");
    expect(parsed.version).toBe("1.2.0");
    expect(parseSimpleYaml("")).toEqual({});
  });
});

describe("resolveModuleId", () => {
  it("reads the pointer's module field", () => {
    const { projectRoot } = projectWithDeployment({
      module: "example-process",
    });
    expect(resolveModuleId(projectRoot)).toBe("example-process");
  });

  it("falls back to .criterion/config.yaml, then .criterion/module.yaml", () => {
    const projectRoot = tempDir();
    mkdirSync(join(projectRoot, ".criterion"));
    writeFileSync(join(projectRoot, ".criterion", "module.yaml"), "id: other-process\n");
    expect(resolveModuleId(projectRoot)).toBe("other-process");

    writeFileSync(join(projectRoot, ".criterion", "config.yaml"), "module: example-process\n");
    expect(resolveModuleId(projectRoot)).toBe("example-process");
  });

  it("returns undefined when no module is declared", () => {
    expect(resolveModuleId()).toBeUndefined();
    const { projectRoot } = projectWithDeployment();
    expect(resolveModuleId(projectRoot)).toBeUndefined();
  });
});

describe("loadModule", () => {
  it("loads the manifest and ETDs from the deployment's modules/<id>/", () => {
    const { projectRoot, corpusRoot } = projectWithDeployment({
      module: "example-process",
    });
    writeModule(join(corpusRoot, "modules", "example-process"));

    const manifest = loadModule(projectRoot);
    expect(manifest?.id).toBe("example-process");
    expect(manifest?.name).toBe("Example Process Module");
    expect(manifest?.version).toBe("1.2.0");
    expect(getGroundingType(manifest!)).toBe("rule");

    const etds = getActiveETDs(manifest!);
    expect([...etds.keys()]).toEqual(["ITEM"]);
    const item = etds.get("ITEM");
    expect(item?.name).toBe("Item");
    expect(item?.pluralName).toBe("Items");
    expect(item?.folder).toBe("items");
    expect(item?.grounding).toBe("required");
    expect(item?.groundingField).toBe("Targets");
    expect(item?.fields.map((f) => f.name)).toEqual(["ID", "Status", "Targets", "Labels"]);
    expect(item?.fields[1].allowedValues).toEqual(["Open", "Done"]);
    expect(item?.fields[2]).toEqual({
      name: "Targets",
      kind: "ref-list",
      required: true,
      targetType: "rule",
    });
    expect(item?.workflow).toEqual({
      initial: "Open",
      states: ["Open", "Done"],
      closedStates: ["Done"],
    });

    expect(manifest?.templates).toEqual([{ entityType: "ITEM", templatePath: "templates/item.template.md" }]);
  });

  it("loads from a legacy (pre-0.37.0) pointer agent-source working copy", () => {
    const { projectRoot, corpusRoot } = projectWithDeployment({ module: "example-process" }, { legacy: true });
    writeModule(join(corpusRoot, "modules", "example-process"));
    expect(loadModule(projectRoot)?.id).toBe("example-process");
  });

  it("resolves registered commands", () => {
    const { projectRoot, corpusRoot } = projectWithDeployment();
    writeModule(join(corpusRoot, "modules", "example-process"));
    const manifest = loadModule(projectRoot, "example-process")!;

    expect(resolveCommand(manifest, "/create-item")).toEqual({
      name: "create-item",
      description: "Create a new item",
      argumentHint: "[<rule-id>]",
      specPath: "commands/create-item.md",
    });
    expect(resolveCommand(manifest, "create-item")?.name).toBe("create-item");
    expect(resolveCommand(manifest, "unknown")).toBeUndefined();
  });

  it("falls back to a sibling catalyst-<id>/ checkout", () => {
    const { base, projectRoot } = projectWithDeployment({
      module: "example-process",
    });
    writeModule(join(base, "catalyst-example-process"));
    expect(loadModule(projectRoot)?.entityTypes.has("ITEM")).toBe(true);
  });

  it("returns undefined when no module is declared or found", () => {
    expect(loadModule()).toBeUndefined();
    const { projectRoot } = projectWithDeployment();
    expect(loadModule(projectRoot)).toBeUndefined();
    expect(loadModule(projectRoot, "missing-process")).toBeUndefined();
  });
});
