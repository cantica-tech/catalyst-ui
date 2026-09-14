import type { ChainNode, Proposal } from "catalyst-core";
import { marked } from "marked";

export interface NodeDetailProps {
  node: ChainNode;
  upstream: ChainNode[];
  downstream: ChainNode[];
  openProposals: Proposal[];
}

function statusOf(node: ChainNode): string | undefined {
  return "status" in node ? node.status : undefined;
}

function descriptionOf(node: ChainNode): string | undefined {
  return "description" in node && node.description
    ? node.description
    : undefined;
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

function NodeList({ title, nodes }: { title: string; nodes: ChainNode[] }) {
  return (
    <section>
      <h2>{title}</h2>
      {nodes.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul>
          {nodes.map((n) => (
            <li key={n.id}>
              <code>{n.id}</code> — {n.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoadmapDetails({ node }: { node: ChainNode }) {
  if (node.kind !== "roadmap") return null;
  return (
    <section>
      <h2>Roadmap</h2>
      <p>
        {node.roadmapName}
        {node.roadmapRetired ? " (retired)" : ""}
      </p>
      <p>Signed off by: {node.signedOffBy}</p>
      {node.notes ? <p>{node.notes}</p> : null}
    </section>
  );
}

/**
 * Renders the node's full backing document as actual formatted HTML
 * (headings, lists, tables, bold/italic, code blocks) rather than raw
 * markdown syntax or a single flattened line — the whole point of
 * surfacing the file's complete content instead of a hand-picked field
 * is that it has to read as a normal document, not markup soup. The
 * host's webview CSP (`default-src 'none'; script-src 'nonce-...'`)
 * blocks any injected `<script>` from executing even though this is raw
 * HTML, but content always originates from local, trusted files (never
 * a remote or multi-tenant source), matching this codebase's existing
 * trust boundary.
 */
function DetailsSection({ node }: { node: ChainNode }) {
  const content = fullContentOf(node);
  if (!content) return null;
  const html = marked.parse(content, { async: false }) as string;
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
export function NodeDetail({
  node,
  upstream,
  downstream,
  openProposals,
}: NodeDetailProps) {
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
      <RoadmapDetails node={node} />
      <DetailsSection node={node} />
      <ProposalList proposals={openProposals} />
      <NodeList title="Justified by (upstream)" nodes={upstream} />
      <NodeList title="Produces (downstream)" nodes={downstream} />
    </div>
  );
}
