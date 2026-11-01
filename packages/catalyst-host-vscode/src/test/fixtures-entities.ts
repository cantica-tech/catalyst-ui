import type { ArtifactNode, DomainNode, ModuleType, RuleNode } from "catalyst-core";

/** A bug type as catalyst serves the software-engineering module's definition. */
export const BUG: ModuleType = {
  prefix: "BUG",
  name: "Bug",
  plural_name: "Bugs",
  states: ["Open", "Under Review", "Fixed", "Closed", "WontFix"],
  initial: "Open",
  closed_states: ["Closed", "WontFix"],
  fields: [],
};

export const REQ: ModuleType = {
  prefix: "REQ",
  name: "Requirement",
  plural_name: "Requirements",
  states: ["Draft", "Active", "Completed", "Abandoned"],
  initial: "Draft",
  closed_states: ["Completed", "Abandoned"],
  fields: [],
};

/** An artifact of `type` with `status`, closed as the type's closed states say. */
export function artifact(id: string, type: ModuleType, status: string, title = "A title"): ArtifactNode {
  return {
    id,
    kind: "artifact",
    title,
    location: { file: `${id}.md`, line: 1 },
    references: [],
    typePrefix: type.prefix,
    status,
    closed: type.closed_states.includes(status),
    links: {},
    registered: true,
    fileExists: true,
    description: "",
    content: "",
  };
}

export function rule(id: string, title: string, status: string): RuleNode {
  return {
    id,
    kind: "rule",
    title,
    location: { file: "rules.md", line: 1 },
    references: [],
    docPrefix: id.split("-")[0],
    domain: id.split("-")[1],
    status,
    registeredInRulesIndex: true,
    description: "",
  };
}

export function domain(code: string, title: string): DomainNode {
  return {
    id: code,
    kind: "domain",
    title,
    location: { file: "domains.md", line: 1 },
    references: [],
    code,
    hasDoc: true,
    description: "",
    content: "",
  };
}
