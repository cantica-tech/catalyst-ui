import type { ReferenceInfo } from "catalyst-core";

import { renderMarkdown } from "./markdown.js";
import { linkifyReferences } from "./references.js";

export interface BacklogProps {
  markdown: string;
  /** The entities the backlog cites: linked, with a hover (REQ-000014-UVqkd7cL). */
  references?: Record<string, ReferenceInfo>;
}

/**
 * Renders `development/BACKLOG.md`'s full generated content as actual
 * formatted HTML, the same way `NodeDetail`'s `DetailsSection` renders a
 * node's own backing document — `BACKLOG.md` is machine-regenerated
 * prose (`INVARIANTS.md` INV-14), never hand-edited, so there's no
 * "hand-picked field" to show instead of the whole thing. Same posture as
 * `NodeDetail`: sanitised by `renderMarkdown`, CSP as a second layer.
 */
export function Backlog({ markdown, references }: BacklogProps) {
  const html = linkifyReferences(renderMarkdown(markdown), references);
  return (
    <div>
      <h1>Backlog</h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
