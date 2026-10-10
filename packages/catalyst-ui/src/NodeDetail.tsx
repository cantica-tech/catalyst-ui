import type { ChainNode, Proposal, ReferenceInfo } from "catalyst-core";

import { renderMarkdown } from "./markdown.js";
import { REFERENCE_CLASS, hoverText, linkifyReferences } from "./references.js";

export interface NodeDetailProps {
  node: ChainNode;
  upstream: ChainNode[];
  downstream: ChainNode[];
  openProposals: Proposal[];
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
 * own (a rule's body *is* its full text; a roadmap row has no backing
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
  if (node.kind === "roadmap") return null;
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

function RoadmapDetails({ node }: { node: ChainNode }) {
  if (node.kind !== "roadmap") return null;
  const clean = node.signedOffBy ? node.signedOffBy.replace(/^_+|_+$/g, "") : "";
  return (
    <section>
      <h2>Roadmap</h2>
      <p>
        {node.roadmapName}
        {node.roadmapRetired ? " (retired)" : ""}
      </p>
      {clean ? (
        <p>
          Signed off by: <em>{clean}</em>
        </p>
      ) : null}
      {node.notes ? <p>{node.notes}</p> : null}
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

function ProposalList({ proposals }: { proposals: Proposal[] }) {
  if (proposals.length === 0) return null;
  return (
    <section>
      <h2>Open proposals</h2>
      <ul>
        {proposals.map((p) => (
          <li key={p.id}>
            <code>{p.id}</code> ({p.status}) — {p.intent}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The chain inspector's node-detail view — presentational only, no
 * VS Code or Electron API awareness, so it mounts unchanged inside
 * either host's webview (the roadmap's "one protocol, three packages"
 * decision).
 */
export function NodeDetail({ node, upstream, downstream, openProposals, references }: NodeDetailProps) {
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
      <RoadmapDetails node={node} />
      <DetailsSection node={node} references={references} />
      <ProposalList proposals={openProposals} />
      <NodeList title="Justified by (upstream)" nodes={upstream} references={references} />
      <NodeList title="Produces (downstream)" nodes={downstream} references={references} />
    </div>
  );
}
