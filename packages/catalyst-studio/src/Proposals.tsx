import type { ProposalView } from "./client.js";
import { DiffView } from "./History.js";

/**
 * A proposal's change (studio-SHELL-000019, catalyst >= 0.81.0): the
 * entity's file as it was when proposed beside the proposed content, and
 * who wrote the proposed version. Reading only: the decisions are the
 * inbox item's, through the host.
 */
export function ProposalDiff({ proposal }: { proposal?: ProposalView }) {
  if (!proposal) return null;
  return (
    <section aria-labelledby="proposal-change">
      <h3 id="proposal-change">The proposed change</h3>
      <p className="muted">
        To <code>{proposal.entity}</code>
        {proposal.path && (
          <>
            {" "}
            (<code>{proposal.path}</code>)
          </>
        )}
        {proposal.author && <>, written by {proposal.author}</>}. Its author never accepts it; if the file has changed
        since, catalyst refuses to accept it until it is revised.
      </p>
      {proposal.content_proposed === null ? (
        <p className="muted">catalyst no longer holds the proposed content.</p>
      ) : (
        <DiffView
          before={proposal.content_base}
          after={proposal.content_proposed}
          label="From the text when proposed to the proposal"
        />
      )}
    </section>
  );
}
