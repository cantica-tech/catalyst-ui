import type { ChainNode, ReferenceInfo } from "catalyst-core";

import { renderMarkdown } from "./markdown.js";
import { REFERENCE_CLASS, hoverText, linkifyReferences } from "./references.js";

export interface NodeDetailProps {
  node: ChainNode;
  upstream: ChainNode[];
  downstream: ChainNode[];
  /** The entities the content cites: linked, with a hover (REQ-000014-UVqkd7cL). */
  references?: Record<string, ReferenceInfo>;
}

function statusOf(node: ChainNode): string | undefined {
  return "status" in node ? node.status : undefined;
}

function descriptionOf(node: ChainNode): string | undefined {
  return "description" in node && node.description ? node.description : undefined;
}

/**
 * The fullest text available for this node: the backing .md file's
 * complete raw content (every field and section, not just the one
 * heading `description` extracts) for a kind with a file on disk;
 * falls back to `description` for a kind with no separate file of its
 * own (a rule's body *is* its full text; a table row has no backing
 * file at all) or an index-only artifact with nothing to read.
 */
function fullContentOf(node: ChainNode): string | undefined {
  if ("content" in node && node.content) return node.content;
  return descriptionOf(node);
}

function NodeList({
  title,
  nodes,
  references,
}: {
  title: string;
  nodes: ChainNode[];
  references?: Record<string, ReferenceInfo>;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {nodes.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {nodes.map((n) => (
            <li key={n.id}>
              <code>
                <a
                  href="#"
                  className={REFERENCE_CLASS}
                  data-ref={n.id}
                  title={references?.[n.id] ? hoverText(references[n.id]) : n.title}
                >
                  {n.id}
                </a>
              </code>{" "}
              — {n.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SignedOffByDetails({ node }: { node: ChainNode }) {
  if (node.kind === "row") return null;
  if ("signedOffBy" in node && node.signedOffBy) {
    const clean = node.signedOffBy.replace(/^_+|_+$/g, "");
    if (!clean) return null;
    return (
      <p>
        Signed off by: <em>{clean}</em>
      </p>
    );
  }
  return null;
}

/** A row of a table file (a roadmap's item, say): its table and its cells, as written. */
function RowDetails({ node }: { node: ChainNode }) {
  if (node.kind !== "row") return null;
  const clean = node.signedOffBy ? node.signedOffBy.replace(/^_+|_+$/g, "") : "";
  const cells = Object.entries(node.fields).filter(([name, value]) => value && name !== "Signed-off-by");
  return (
    <section>
      <h2>{node.table}</h2>
      {node.tableRetired ? <p>(retired)</p> : null}
      {cells.length > 0 ? (
        <dl>
          {cells.map(([name, value]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {clean ? (
        <p>
          Signed off by: <em>{clean}</em>
        </p>
      ) : null}
    </section>
  );
}

/**
 * Renders the node's full backing document as actual formatted HTML
 * (headings, lists, tables, bold/italic, code blocks) rather than raw
 * markdown syntax or a single flattened line — the whole point of
 * surfacing the file's complete content instead of a hand-picked field
 * is that it has to read as a normal document, not markup soup. Corpus
 * text comes from whatever repository was cloned, so it is rendered
 * through `renderMarkdown` (raw HTML escaped, unsafe URLs dropped), with
 * the host's CSP as a second layer.
 */
function DetailsSection({ node, references }: { node: ChainNode; references?: Record<string, ReferenceInfo> }) {
  const content = fullContentOf(node);
  if (!content) return null;
  const html = linkifyReferences(renderMarkdown(content), references);
  return (
    <section>
      <h2>Details</h2>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}

/**
 * The chain inspector's node-detail view — presentational only, no
 * VS Code or Electron API awareness, so it mounts unchanged inside
 * either host's webview (the roadmap's "one protocol, three packages"
 * decision).
 */
export function NodeDetail({ node, upstream, downstream, references }: NodeDetailProps) {
  const status = statusOf(node);
  return (
    <div>
      <h1>
        <code>{node.id}</code>
      </h1>
      <p>
        {node.kind} — {node.title}
      </p>
      {status ? <p>Status: {status}</p> : null}
      <SignedOffByDetails node={node} />
      <RowDetails node={node} />
      <DetailsSection node={node} references={references} />
      <NodeList title="Justified by (upstream)" nodes={upstream} references={references} />
      <NodeList title="Produces (downstream)" nodes={downstream} references={references} />
    </div>
  );
}
