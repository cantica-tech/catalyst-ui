import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type GroundingKind = "required" | "inherited" | "none";

export type FieldKind =
  "text" | "enum" | "ref" | "ref-list" | "date" | "user" | "user-list";

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

export function getDefaultSoftwareEngineeringManifest(): ModuleManifest {
  const entityTypes = new Map<string, EntityTypeDefinition>();

  entityTypes.set("BUG", {
    idPrefix: "BUG",
    name: "Bug",
    pluralName: "Bugs",
    folder: "bugs",
    grounding: "required",
    groundingField: "Targets",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: ["Open", "Under Review", "Fixed", "Closed", "WontFix"],
      },
      { name: "Targets", kind: "ref-list", required: true, targetType: "rule" },
      { name: "Domain", kind: "ref", required: true, targetType: "domain" },
      { name: "Steps", kind: "ref-list", required: false, targetType: "STEP" },
    ],
    workflow: {
      initial: "Open",
      states: ["Open", "Under Review", "Fixed", "Closed", "WontFix"],
      closedStates: ["Closed", "WontFix"],
    },
  });

  entityTypes.set("REQ", {
    idPrefix: "REQ",
    name: "Requirement",
    pluralName: "Requirements",
    folder: "requirements",
    grounding: "required",
    groundingField: "Targets",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: [
          "Draft",
          "Proposed",
          "Vetted",
          "Active",
          "Completed",
          "Abandoned",
        ],
      },
      { name: "Targets", kind: "ref-list", required: true, targetType: "rule" },
      { name: "Domain", kind: "ref", required: true, targetType: "domain" },
      {
        name: "Feature",
        kind: "ref",
        required: false,
        targetType: "FEAT",
        backref: "Requirements",
      },
      {
        name: "Tests",
        kind: "ref-list",
        required: false,
        targetType: "TEST",
        backref: "Requirements",
      },
      { name: "Steps", kind: "ref-list", required: false, targetType: "STEP" },
    ],
    workflow: {
      initial: "Draft",
      states: [
        "Draft",
        "Proposed",
        "Vetted",
        "Active",
        "Completed",
        "Abandoned",
      ],
      closedStates: ["Completed", "Abandoned"],
    },
  });

  entityTypes.set("HK", {
    idPrefix: "HK",
    name: "House-keeping",
    pluralName: "House-keeping Items",
    folder: "house-keeping",
    grounding: "required",
    groundingField: "Targets",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: ["Open", "Completed"],
      },
      { name: "Targets", kind: "ref-list", required: true, targetType: "rule" },
      { name: "Domain", kind: "ref", required: true, targetType: "domain" },
    ],
    workflow: {
      initial: "Open",
      states: ["Open", "Completed"],
      closedStates: ["Completed"],
    },
  });

  entityTypes.set("TEST", {
    idPrefix: "TEST",
    name: "Test",
    pluralName: "Tests",
    folder: "tests",
    grounding: "required",
    groundingField: "Targets",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: ["Draft", "Active", "Passing", "Failing", "Disabled"],
      },
      { name: "Targets", kind: "ref-list", required: true, targetType: "rule" },
      { name: "Domain", kind: "ref", required: true, targetType: "domain" },
      {
        name: "Requirements",
        kind: "ref-list",
        required: false,
        targetType: "REQ",
        backref: "Tests",
      },
      { name: "Steps", kind: "ref-list", required: false, targetType: "STEP" },
    ],
    workflow: {
      initial: "Draft",
      states: ["Draft", "Active", "Passing", "Failing", "Disabled"],
      closedStates: ["Passing"],
    },
  });

  entityTypes.set("STEP", {
    idPrefix: "STEP",
    name: "Step",
    pluralName: "Steps",
    folder: "steps",
    grounding: "inherited",
    groundingField: "Parent",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: ["planned", "in-progress", "done", "abandoned"],
      },
      { name: "Parent", kind: "ref", required: true, targetType: "REQ" },
    ],
    workflow: {
      initial: "planned",
      states: ["planned", "in-progress", "done", "abandoned"],
      closedStates: ["done", "abandoned"],
    },
  });

  entityTypes.set("FEAT", {
    idPrefix: "FEAT",
    name: "Feature",
    pluralName: "Features",
    folder: "features",
    grounding: "none",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: ["Draft", "Triaged", "Active", "Completed", "Abandoned"],
      },
    ],
    workflow: {
      initial: "Draft",
      states: ["Draft", "Triaged", "Active", "Completed", "Abandoned"],
      closedStates: ["Completed", "Abandoned"],
    },
  });

  entityTypes.set("RM", {
    idPrefix: "RM",
    name: "Roadmap",
    pluralName: "Roadmaps",
    folder: "roadmaps",
    grounding: "none",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: ["Not triaged", "Triaged", "In progress", "Done"],
      },
      { name: "Linked", kind: "ref", required: false, targetType: "FEAT" },
    ],
    workflow: {
      initial: "Not triaged",
      states: ["Not triaged", "Triaged", "In progress", "Done"],
      closedStates: ["Done"],
    },
  });

  entityTypes.set("WORKFLOW", {
    idPrefix: "WORKFLOW",
    name: "Workflow",
    pluralName: "Workflows",
    folder: "workflows",
    grounding: "none",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: ["Draft", "Active", "Deprecated"],
      },
    ],
    workflow: {
      initial: "Draft",
      states: ["Draft", "Active", "Deprecated"],
      closedStates: ["Deprecated"],
    },
  });

  entityTypes.set("RECON", {
    idPrefix: "RECON",
    name: "Reconciliation",
    pluralName: "Reconciliations",
    folder: "reconciliations",
    grounding: "none",
    fields: [
      { name: "ID", kind: "text", required: true },
      {
        name: "Status",
        kind: "enum",
        required: true,
        allowedValues: [
          "Open",
          "Under Review",
          "Resolved-Accepted",
          "Resolved-Rejected",
          "Closed",
        ],
      },
      { name: "Entity", kind: "ref", required: true },
      {
        name: "Workflow",
        kind: "ref",
        required: false,
        targetType: "WORKFLOW",
      },
    ],
    workflow: {
      initial: "Open",
      states: [
        "Open",
        "Under Review",
        "Resolved-Accepted",
        "Resolved-Rejected",
        "Closed",
      ],
      closedStates: ["Resolved-Accepted", "Resolved-Rejected", "Closed"],
    },
  });

  const commands = new Map<string, CommandRegistration>();
  commands.set("create-req", {
    name: "create-req",
    description: "Create a new requirement artifact",
    argumentHint: "[<rule-id>]",
  });
  commands.set("create-bug", {
    name: "create-bug",
    description: "Create a new bug artifact",
    argumentHint: "[<rule-id>]",
  });
  commands.set("create-test", {
    name: "create-test",
    description: "Create a new test artifact",
    argumentHint: "[<rule-id>]",
  });
  commands.set("create-feature", {
    name: "create-feature",
    description: "Create a new feature artifact",
  });
  commands.set("create-step", {
    name: "create-step",
    description: "Create a new step artifact",
    argumentHint: "<parent-id>",
  });
  commands.set("check-rules", {
    name: "check-rules",
    description: "Validate rule link coverage across dev artifacts",
  });
  commands.set("show-backlog", {
    name: "show-backlog",
    description: "Display work item and artifact backlog",
  });
  commands.set("cut-release", {
    name: "cut-release",
    description: "Cut a release for catalyst or a submodule",
  });

  return {
    id: "software-engineering",
    name: "Software Engineering Process Module",
    version: "1.0.0",
    description:
      "Standard software engineering process module governing rules, requirements, bugs, tests, steps, features, and reconciliations.",
    groundingType: "rule",
    entityTypes,
    commands,
    skills: [],
    templates: [],
  };
}

export function resolveModuleId(projectRoot?: string): string {
  if (!projectRoot || !existsSync(projectRoot)) {
    return "software-engineering";
  }

  // Check config.yaml or module.yaml under .criterion
  const cfgYaml = join(projectRoot, ".criterion", "config.yaml");
  if (existsSync(cfgYaml)) {
    try {
      const content = readFileSync(cfgYaml, "utf8");
      const match = content.match(/^module:\s*([a-z0-9_-]+)/m);
      if (match) return match[1];
    } catch {
      // fallback
    }
  }

  const modYaml = join(projectRoot, ".criterion", "module.yaml");
  if (existsSync(modYaml)) {
    try {
      const content = readFileSync(modYaml, "utf8");
      const match = content.match(/^id:\s*([a-z0-9_-]+)/m);
      if (match) return match[1];
    } catch {
      // fallback
    }
  }

  return "software-engineering";
}

export function loadModule(
  projectRoot?: string,
  moduleId?: string,
): ModuleManifest {
  const targetId = moduleId || resolveModuleId(projectRoot);

  // Default fallback if not customized
  if (targetId === "software-engineering") {
    return getDefaultSoftwareEngineeringManifest();
  }

  return getDefaultSoftwareEngineeringManifest();
}

export function getActiveETDs(
  manifest: ModuleManifest,
): Map<string, EntityTypeDefinition> {
  return manifest.entityTypes;
}

export function getGroundingType(manifest: ModuleManifest): string {
  return manifest.groundingType;
}

export function resolveCommand(
  manifest: ModuleManifest,
  commandName: string,
): CommandRegistration | undefined {
  const cleanName = commandName.startsWith("/")
    ? commandName.slice(1)
    : commandName;
  return manifest.commands.get(cleanName);
}
