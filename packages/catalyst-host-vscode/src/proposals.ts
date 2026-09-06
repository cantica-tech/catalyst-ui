import type { Proposal } from "catalyst-core";

export interface ProposalSection {
  label: string;
  proposals: Proposal[];
}

/** A 6th sidebar section listing every known proposal, alongside the five chain-model sections. */
export function buildProposalSection(proposals: Proposal[]): ProposalSection {
  return { label: `Proposals (${proposals.length})`, proposals };
}

export interface ProposalContentInput {
  id: string;
  title: string;
  intent: string;
  targets: string[];
  expectations: string[];
  constraints: string[];
}

/**
 * Renders a new `proposals/PROP-NNNNNN.md` file's content — the one
 * write this extension ever performs. Shared by "propose fix" (health
 * board) and "compose proposal" (authoring): both just gather different
 * input for the same file shape.
 */
export function renderProposalContent(input: ProposalContentInput): string {
  const targets =
    input.targets.length > 0
      ? input.targets.map((t) => `- \`${t}\``).join("\n")
      : "- (none)";
  const expectations = input.expectations.map((e) => `- ${e}`).join("\n");
  const constraints =
    input.constraints.length > 0
      ? input.constraints.map((c) => `- ${c}`).join("\n")
      : "- (none)";

  return `# \`${input.id}\` — ${input.title}

| Field | Value |
|---|---|
| **ID** | \`${input.id}\` |
| **Status** | proposed |

## Intent

${input.intent}

## Targets

${targets}

## Expectations

${expectations}

## Constraints

${constraints}
`;
}
