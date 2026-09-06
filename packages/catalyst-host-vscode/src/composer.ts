import { renderProposalContent } from "./proposals.js";

/**
 * Artifact types this deployment can actually create a proposal for.
 * Work items are deliberately excluded: no project-management plugin is
 * active here, so there is no work-item scheme to target.
 */
export type ComposableArtifactType =
  "rule" | "requirement" | "bug" | "house-keeping";

export interface ComposerInput {
  type: ComposableArtifactType;
  domain: string;
  targets: string[];
  title: string;
  description: string;
}

/**
 * Builds a new artifact's proposal content from structured authoring
 * intent — the same mechanism `codeactions.ts` uses for fixes, just
 * gathering harder, creation-shaped input instead of deriving it from a
 * diagnostic. `Expectations` mirrors the roadmap's own exit-criterion
 * wording, generalized beyond "work item" since none are active here.
 */
export function buildAuthoringProposalContent(
  input: ComposerInput,
  id: string,
): string {
  return renderProposalContent({
    id,
    title: `Compose: ${input.title}`,
    intent: `Create a new ${input.type} artifact: ${input.title}. ${input.description}`,
    targets: input.targets,
    expectations: [
      `A new ${input.type} artifact exists with a valid, never-reused id and resolves all links on first parse.`,
    ],
    constraints: [
      `Domain: \`${input.domain}\``,
      `Follow the ${input.type} template's required fields.`,
    ],
  });
}
