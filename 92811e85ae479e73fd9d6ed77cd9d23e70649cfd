import { marked } from "marked";

export interface BacklogProps {
  markdown: string;
}

/**
 * Renders `development/BACKLOG.md`'s full generated content as actual
 * formatted HTML, the same way `NodeDetail`'s `DetailsSection` renders a
 * node's own backing document — `BACKLOG.md` is machine-regenerated
 * prose (`INVARIANTS.md` INV-14), never hand-edited, so there's no
 * "hand-picked field" to show instead of the whole thing. Same CSP/trust
 * posture as `NodeDetail`: content always originates from a local,
 * trusted file.
 */
export function Backlog({ markdown }: BacklogProps) {
  const html = marked.parse(markdown, { async: false }) as string;
  return (
    <div>
      <h1>Backlog</h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
