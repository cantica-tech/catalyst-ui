import type { ChainNode } from "catalyst-core";

export interface NodeDetailProps {
  node: ChainNode;
  upstream: ChainNode[];
  downstream: ChainNode[];
}

function statusOf(node: ChainNode): string | undefined {
  return "status" in node ? node.status : undefined;
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

/**
 * The chain inspector's node-detail view — presentational only, no
 * VS Code or Electron API awareness, so it mounts unchanged inside
 * either host's webview (the roadmap's "one protocol, three packages"
 * decision).
 */
export function NodeDetail({ node, upstream, downstream }: NodeDetailProps) {
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
      <NodeList title="Justified by (upstream)" nodes={upstream} />
      <NodeList title="Produces (downstream)" nodes={downstream} />
    </div>
  );
}
