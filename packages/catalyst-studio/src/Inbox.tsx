import { useEffect, useState } from "react";

import type { ChangedFile, EntityView, InboxItem, InboxReport, StudioClient } from "./client.js";
import { clipboardCopy, CopyButton } from "./Copy.js";
import { ActionForm } from "./ActionForm.js";
import { describeEvidence } from "./evidence.js";
import { gateCount } from "./Gates.js";
import { ProposalDiff } from "./Proposals.js";
import { useHost } from "./host.js";
import { Status } from "./Status.js";

/** The kinds catalyst reports, in its order, each with the heading the inbox gives it. */
const KINDS: { kind: string; heading: string }[] = [
  { kind: "unrecorded-commit", heading: "Commits the journal does not record" },
  { kind: "unrecorded-change", heading: "Changes the journal does not record" },
  { kind: "reconciliation", heading: "Reconciliation cases" },
  { kind: "analysis", heading: "Analyses being decided" },
  { kind: "approval", heading: "Approvals waiting" },
  { kind: "proposal", heading: "Proposals to decide" },
];

function plural(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? "" : "s"}`;
}

/** The inbox's groups: catalyst's kinds in its order, then any kind this Studio does not know. */
export function inboxGroups(report: InboxReport): { kind: string; heading: string; items: InboxItem[] }[] {
  const known = new Set(KINDS.map((k) => k.kind));
  const others = [...new Set(report.items.map((i) => i.kind))].filter((k) => !known.has(k));
  return [...KINDS, ...others.map((kind) => ({ kind, heading: kind }))]
    .map((k) => ({ ...k, items: report.items.filter((i) => i.kind === k.kind) }))
    .filter((g) => g.items.length > 0);
}

/** How a file changed, from its content before and after. */
export function fileChange(file: ChangedFile): string {
  if (file.before === null) return "added";
  if (file.after === null) return "deleted";
  return "changed";
}

/** Everything waiting, by kind; each item opens its page. */
export function InboxList({ report, onOpen }: { report: InboxReport; onOpen: (item: InboxItem) => void }) {
  const groups = inboxGroups(report);
  return (
    <>
      <h2>Inbox</h2>
      {groups.length === 0 ? (
        <p>
          <Status tone="ok" label="Nothing waits" />{" "}
          <span className="muted">Every change is journaled and no decision is open.</span>
        </p>
      ) : (
        <p>
          <Status tone="warn" label={`${plural(report.items.length, "decision")} to take`} />
        </p>
      )}
      {groups.map((g) => (
        <section key={g.kind} aria-labelledby={`inbox-${g.kind}`}>
          <h3 id={`inbox-${g.kind}`}>
            {g.heading} ({g.items.length})
          </h3>
          <ul className="artifact-list">
            {g.items.map((item) => (
              <li key={`${item.kind}:${item.id}`}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    onOpen(item);
                  }}
                >
                  <code>{item.id}</code> {item.title}
                </button>{" "}
                {describeEvidence(item) !== item.id && <span className="muted">{describeEvidence(item)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Whether a way to settle is a command to run, rather than words such as "discard the change". */
export function isCommand(settle: string): boolean {
  return /^(catalyst|git) /.test(settle);
}

/** One command that settles an item, copyable; words such as "discard the change" are just said. */
function SettleCommand({ command, copy }: { command: string; copy: (text: string) => Promise<void> }) {
  if (!isCommand(command)) return <li>{command}</li>;
  return (
    <li>
      <code>{command}</code> <CopyButton text={command} copy={copy} />
    </li>
  );
}

function Evidence({ item, artifact }: { item: InboxItem; artifact?: EntityView }) {
  const e = item.evidence;
  return (
    <section aria-labelledby="item-evidence">
      <h3 id="item-evidence">Evidence</h3>
      <dl className="fields">
        {e.author && (
          <div>
            <dt>Author</dt>
            <dd>{e.author}</dd>
          </div>
        )}
        {e.commit && (
          <div>
            <dt>Commit</dt>
            <dd>
              <code>{e.commit}</code>
            </dd>
          </div>
        )}
        {e.path && (
          <div>
            <dt>Path</dt>
            <dd>
              <code>{e.path}</code>
            </dd>
          </div>
        )}
        {e.status && (
          <div>
            <dt>Status</dt>
            <dd>{e.status}</dd>
          </div>
        )}
        {e.entity && (
          <div>
            <dt>About</dt>
            <dd>
              <code>{e.entity}</code>
            </dd>
          </div>
        )}
        {e.gate && (
          <div>
            <dt>Gate</dt>
            <dd>
              <code>{e.gate}</code>
            </dd>
          </div>
        )}
        {e.role && typeof e.approvals === "number" && (
          <div>
            <dt>Approvals</dt>
            <dd>
              {gateCount({
                approvals: e.approvals,
                role: e.role,
                counted: Array.isArray(e.counted) ? e.counted : [],
                missing: typeof e.missing === "number" ? e.missing : 0,
              })}
            </dd>
          </div>
        )}
        {e.version && (
          <div>
            <dt>Version</dt>
            <dd>
              <code>{e.version.slice(0, 12)}</code> <span className="muted">(approvals are of this version)</span>
            </dd>
          </div>
        )}
        {e.scope && (
          <div>
            <dt>Scope</dt>
            <dd>{e.scope}</dd>
          </div>
        )}
      </dl>
      {Array.isArray(e.files) && e.files.length > 0 && (
        <table>
          <caption className="muted">The files the commit touched</caption>
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {e.files.map((f) => (
              <tr key={f.path}>
                <td>
                  <code>{f.path}</code>
                </td>
                <td>{fileChange(f)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(artifact?.sections ?? []).map((s, i) => (
        <section key={`${s.heading}-${String(i)}`} aria-labelledby={`item-section-${String(i)}`}>
          <h4 id={`item-section-${String(i)}`}>{s.heading}</h4>
          <div className="section-text">{s.text || <span className="muted">Not written.</span>}</div>
        </section>
      ))}
    </section>
  );
}

/** One item waiting: its evidence in full and the commands that settle it; the Studio runs none. */
export function InboxItemPage({
  item,
  artifact,
  onBack,
  copy,
}: {
  item: InboxItem;
  /** The case or analysis itself, when the item is an artifact catalyst can `view`. */
  artifact?: EntityView;
  onBack: () => void;
  copy: (text: string) => Promise<void>;
}) {
  const heading = KINDS.find((k) => k.kind === item.kind)?.heading ?? item.kind;
  const host = useHost();
  return (
    <article aria-labelledby="item-title">
      <p>
        <button type="button" className="link-button" onClick={onBack}>
          ← The inbox
        </button>
      </p>
      <h2 id="item-title">
        <code>{item.id}</code> {item.title}
      </h2>
      <p className="muted">{heading}</p>
      {item.kind === "proposal" && <ProposalDiff proposal={artifact?.proposal} />}
      <Evidence item={item} artifact={artifact} />
      {host?.act && <SettleHere item={item} />}
      <section aria-labelledby="item-settle">
        <h3 id="item-settle">{host?.act ? "Or settle it with" : "Settle it with"}</h3>
        {item.settle.length === 0 ? (
          <p className="muted">catalyst names no command for it.</p>
        ) : (
          <>
            <p className="muted">
              One of these, run by you or your agent; replace what is in angle brackets. The Studio decides nothing.
            </p>
            <ul className="settle">
              {item.settle.map((cmd) => (
                <SettleCommand key={cmd} command={cmd} copy={copy} />
              ))}
            </ul>
          </>
        )}
      </section>
    </article>
  );
}

/** The decisions a reconciliation case takes (`catalyst reconcile`). */
const DECISIONS = ["accept", "accept-with-edits", "reject", "propose", "close"];

/**
 * A proposal's decisions here (studio-SHELL-000019): accepting with edits
 * needs the edited content, so it stays a command to copy.
 */
const PROPOSAL_DECISIONS: [string, string][] = [
  ["accept", "Accept: write it to the entity"],
  ["reject", "Reject"],
  ["propose", "Propose a revision"],
  ["close", "Withdraw (its author)"],
];

/**
 * Settling here, through the host (studio-SHELL-000016): an unrecorded
 * commit adopted, a changed file journaled, a case decided, a gated
 * version approved (studio-SHELL-000018). Reverting and an analysis's
 * decision stay commands to copy.
 */
function SettleHere({ item }: { item: InboxItem }) {
  const host = useHost();
  if (!host?.act) return null;
  const forms =
    item.kind === "unrecorded-commit" ? (
      <ActionForm
        host={host}
        label="Adopt into the journal"
        action={{ verb: "journal-adopt", commit: item.evidence.commit ?? item.id }}
        journals
      />
    ) : item.kind === "unrecorded-change" ? (
      <ActionForm
        host={host}
        label="Record in the journal"
        action={{ verb: "journal-append", path: item.evidence.path ?? item.id }}
        journals
      />
    ) : item.kind === "reconciliation" ? (
      <ul className="settle">
        {DECISIONS.map((d) => (
          <li key={d}>
            <ActionForm
              host={host}
              label={d}
              action={{ verb: "reconcile", case: item.id, decision: d }}
              textLabel={d === "propose" ? "The proposal" : undefined}
            />
          </li>
        ))}
      </ul>
    ) : item.kind === "proposal" ? (
      <ul className="settle">
        {PROPOSAL_DECISIONS.map(([d, label]) => (
          <li key={d}>
            <ActionForm
              host={host}
              label={label}
              action={{ verb: "reconcile", case: item.id, decision: d }}
              textLabel={d === "propose" ? "The revision, in words" : undefined}
            />
          </li>
        ))}
      </ul>
    ) : item.kind === "approval" && item.evidence.gate ? (
      <ActionForm
        host={host}
        label="Approve this version"
        action={{ verb: "approve", id: item.id, gate: item.evidence.gate }}
      />
    ) : null;
  if (!forms) return null;
  return (
    <section aria-labelledby="item-settle-here">
      <h3 id="item-settle-here">Settle it here</h3>
      <p className="muted">Your editor shows the exact command and asks you before catalyst runs it.</p>
      {forms}
    </section>
  );
}

type Load = { state: "loading" } | { state: "ready"; report: InboxReport } | { state: "failed"; message: string };

/** The Inbox view: the list, or one item's page; reloaded after each change catalyst announces. */
export function Inbox({
  client,
  copy = clipboardCopy,
  target,
}: {
  client: StudioClient;
  copy?: (text: string) => Promise<void>;
  /** An item to open (`<kind>:<id>`), from the dashboard's Settle… */
  target?: string;
}) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [open, setOpen] = useState<string | null>(target ?? null);
  const [artifact, setArtifact] = useState<EntityView | undefined>(undefined);
  const [batch, setBatch] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    client
      .events(() => {
        setBatch((b) => b + 1);
      }, abort.signal)
      .catch(() => undefined);
    return () => {
      abort.abort();
    };
  }, [client]);

  useEffect(() => {
    let live = true;
    client.inbox().then(
      (report) => {
        if (live) setLoad({ state: "ready", report });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, batch]);

  const item = load.state === "ready" && open ? load.report.items.find((i) => `${i.kind}:${i.id}` === open) : undefined;
  const viewable = item && ["reconciliation", "analysis", "approval", "proposal"].includes(item.kind) ? item.id : null;

  useEffect(() => {
    setArtifact(undefined);
    if (!viewable) return;
    let live = true;
    client.view(viewable).then(
      (value) => {
        if (live) setArtifact(value);
      },
      () => undefined, // the page keeps the evidence catalyst gave with the item
    );
    return () => {
      live = false;
    };
  }, [client, viewable, batch]);

  if (load.state !== "ready") {
    return (
      <>
        <h2>Inbox</h2>
        {load.state === "loading" ? (
          <Status tone="info" label="Loading" />
        ) : (
          <p>
            <Status tone="error" label="catalyst did not answer" /> <span className="muted">{load.message}</span>
          </p>
        )}
      </>
    );
  }
  if (item) {
    return (
      <InboxItemPage
        item={item}
        artifact={artifact}
        copy={copy}
        onBack={() => {
          setOpen(null);
        }}
      />
    );
  }
  // an item settled while its page was open is gone from the report: the list shows again
  return (
    <InboxList
      report={load.report}
      onOpen={(i) => {
        setOpen(`${i.kind}:${i.id}`);
      }}
    />
  );
}
