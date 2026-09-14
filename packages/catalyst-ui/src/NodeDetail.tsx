import type { ChainNode, Proposal } from "catalyst-core";

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
  const description = descriptionOf(node);
  return (
    <div>
      <h1>
        <code>{node.id}</code>
      </h1>
      <p>
        {node.kind} — {node.title}
      </p>
      {status ? <p>Status: {status}</p> : null}
      {description ? <p>{description}</p> : null}
      <RoadmapDetails node={node} />
      <ProposalList proposals={openProposals} />
      <NodeList title="Justified by (upstream)" nodes={upstream} />
      <NodeList title="Produces (downstream)" nodes={downstream} />
    </div>
  );
}
