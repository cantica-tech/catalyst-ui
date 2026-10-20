import { fieldsOf, titleOf } from "catalyst-core/graph-artifact";
import { useEffect, useState } from "react";

import type { Graph, GraphArtifact, InboxItem, StudioClient, User } from "./client.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

/** The kernel's reconciliation type and signer field (`Rules-of-Rules.md` §16, INV-16). */
const RECONCILIATION = "RECON";
const SIGNER = "Signed-off-by";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^`|`$/g, "") : "";
}

function fieldOf(a: GraphArtifact, name: string): string {
  return clean(fieldsOf(a)[name]);
}

export interface Case {
  id: string;
  title: string;
  status: string;
  closed: boolean;
  entity: string;
}

/** The reconciliation cases, open first, each in ID order. */
export function reconciliationCases(graph: Graph): Case[] {
  const closedStates = RECONCILIATION in graph.types ? graph.types[RECONCILIATION].closed_states : [];
  return graph.artifacts
    .filter((a) => a.type === RECONCILIATION)
    .map((a) => {
      const status = fieldOf(a, "Status");
      return {
        id: a.id,
        title: clean(titleOf(a)) || a.id,
        status,
        closed: closedStates.includes(status) || status === "Closed",
        entity: fieldOf(a, "Entity"),
      };
    })
    .sort((x, y) => Number(x.closed) - Number(y.closed) || x.id.localeCompare(y.id));
}

export interface Signer {
  name: string;
  signed: number;
  closed: number;
  registered: boolean;
}

/** Each name in `Signed-off-by`, with how many entities it signed and how many of those are closed. */
export function signers(graph: Graph, users: User[]): Signer[] {
  const known = new Set(users.map((u) => u.name));
  const out = new Map<string, Signer>();
  for (const a of graph.artifacts) {
    const name = fieldOf(a, SIGNER);
    if (!name) continue;
    const type = a.type in graph.types ? graph.types[a.type] : undefined;
    const s = out.get(name) ?? { name, signed: 0, closed: 0, registered: known.has(name) };
    s.signed++;
    if (type?.closed_states.includes(fieldOf(a, "Status"))) s.closed++;
    out.set(name, s);
  }
  return [...out.values()].sort((a, b) => b.signed - a.signed || a.name.localeCompare(b.name));
}

/**
 * The approvals (studio-SHELL-000014): reconciliation cases and sign-offs,
 * read-only, and what waits for an approval under a gate (studio-SHELL-000018,
 * catalyst >= 0.80.0), each opening the entity, whose page approves it.
 */
export function ApprovalsView({ graph, users, waiting = [] }: { graph: Graph; users: User[]; waiting?: InboxItem[] }) {
  const navigate = useNavigate();
  const cases = reconciliationCases(graph);
  const open = cases.filter((c) => !c.closed);
  const who = signers(graph, users);
  const link = (id: string) => (
    <button
      type="button"
      className="link-button"
      onClick={() => {
        navigate("artifacts", id);
      }}
    >
      <code>{id}</code>
    </button>
  );
  return (
    <>
      <h2>Approvals</h2>
      {waiting.length > 0 && (
        <section aria-labelledby="gates-waiting">
          <h3 id="gates-waiting">Waiting for an approval</h3>
          <p>
            <Status tone="warn" label={`${String(waiting.length)} waiting`} />{" "}
            <span className="muted">
              Approved by a person holding the gate&apos;s role, never the version&apos;s author.
            </span>
          </p>
          <table>
            <caption className="muted">Each gated change, with what its current version lacks</caption>
            <thead>
              <tr>
                <th scope="col">Entity</th>
                <th scope="col">Gate</th>
                <th scope="col">Approvals</th>
              </tr>
            </thead>
            <tbody>
              {waiting.map((w) => (
                <tr key={`${w.id}:${w.evidence.gate ?? ""}`}>
                  <td>{link(w.id)}</td>
                  <td>
                    <code>{w.evidence.gate}</code>
                  </td>
                  <td>{w.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section aria-labelledby="cases">
        <h3 id="cases">Reconciliation cases</h3>
        {cases.length === 0 ? (
          <p className="muted">No reconciliation case.</p>
        ) : (
          <>
            <p>
              {open.length === 0 ? (
                <Status tone="ok" label="None open" />
              ) : (
                <Status tone="warn" label={`${String(open.length)} open`} />
              )}{" "}
              <span className="muted">
                A person decides each with <code>/reconcile</code>; a case&apos;s page shows its trail.
              </span>
            </p>
            <table>
              <caption className="muted">Every case, open first</caption>
              <thead>
                <tr>
                  <th scope="col">Case</th>
                  <th scope="col">About</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {link(c.id)} {c.title}
                    </td>
                    <td>{c.entity ? link(c.entity) : <span className="muted">—</span>}</td>
                    <td>
                      <Status tone={c.closed ? "ok" : "warn"} label={c.status || "No status"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>
      <section aria-labelledby="signoffs">
        <h3 id="signoffs">Sign-offs</h3>
        {who.length === 0 ? (
          <p className="muted">No entity names a signer.</p>
        ) : (
          <table>
            <caption className="muted">Who signed off how much ({SIGNER})</caption>
            <thead>
              <tr>
                <th scope="col">Signer</th>
                <th scope="col">Signed</th>
                <th scope="col">Of them closed</th>
              </tr>
            </thead>
            <tbody>
              {who.map((s) => (
                <tr key={s.name}>
                  <th scope="row">
                    {s.name} {!s.registered && <Status tone="error" label="Not a registered user" />}
                  </th>
                  <td>{s.signed}</td>
                  <td>{s.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

type Load =
  | { state: "loading" }
  | { state: "ready"; graph: Graph; users: User[]; waiting: InboxItem[] }
  | { state: "failed"; message: string };

/** The Approvals view, reloaded after each change catalyst announces. */
export function Approvals({ client }: { client: StudioClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
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
    const inbox = client.inbox().then(
      (r) => r.items.filter((i) => i.kind === "approval"),
      () => [] as InboxItem[], // without the inbox, the cases and sign-offs still show
    );
    Promise.all([client.graph(), client.users(), inbox]).then(
      ([graph, users, waiting]) => {
        if (live) setLoad({ state: "ready", graph, users, waiting });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client, batch]);

  if (load.state === "ready") return <ApprovalsView graph={load.graph} users={load.users} waiting={load.waiting} />;
  return (
    <>
      <h2>Approvals</h2>
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
