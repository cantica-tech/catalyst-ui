import { useEffect, useId, useState } from "react";

import type { AuditPack, StudioClient } from "./client.js";
import { useNavigate } from "./Shell.js";
import { Status } from "./Status.js";

/** Whether the record holds: the journal verifies, `check` has no error, every gated rule is approved. */
export function holds(pack: AuditPack): boolean {
  const i = pack.integrity;
  return i.journal.errors === 0 && i.check.errors === 0 && i.unapproved_rules.length === 0;
}

/** The rules shown: every one, or only those nothing rests on (retired ones left out of that). */
export function rulesShown(pack: AuditPack, onlyAlone: boolean): AuditPack["rules"] {
  return onlyAlone ? pack.rules.filter((r) => r.chain.length === 0 && !r.retired) : pack.rules;
}

/** The audit pack (R6.27): the record's integrity, then each rule and what rests on it; printable to a PDF. */
export function AuditView({
  pack,
  print = () => {
    window.print();
  },
}: {
  pack: AuditPack;
  print?: () => void;
}) {
  const navigate = useNavigate();
  const aloneId = useId();
  const [onlyAlone, setOnlyAlone] = useState(false);
  const i = pack.integrity;
  const alone = pack.rules.filter((r) => r.chain.length === 0 && !r.retired).length;
  const shown = rulesShown(pack, onlyAlone);
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
    <article aria-labelledby="audit-title" className="audit">
      <h2 id="audit-title">Audit pack{pack.project ? ` — ${pack.project}` : ""}</h2>
      <p className="muted">
        Made {pack.generated} by catalyst {pack.catalyst}; kernel {pack.kernel ?? "?"}
        {pack.modules.map((m) => `, ${m.id} ${m.version ?? "?"}`).join("")}
        {pack.criterion_commit && (
          <>
            ; the criterion at <code>{pack.criterion_commit.slice(0, 12)}</code>
          </>
        )}
        .{" "}
        <button type="button" className="no-print" onClick={print}>
          Print or save as PDF
        </button>
      </p>
      <section aria-labelledby="audit-integrity">
        <h3 id="audit-integrity">Integrity</h3>
        <p>
          {holds(pack) ? (
            <Status tone="ok" label="The record holds" />
          ) : (
            <Status tone="error" label="The record has problems" />
          )}
        </p>
        <ul>
          <li>
            Journal: {i.journal.entries} entries; {i.journal.errors} error(s), {i.journal.warnings} warning(s).
          </li>
          <li>
            Check: {i.check.errors} error(s), {i.check.warnings} warning(s).
          </li>
          <li>
            Approvals:{" "}
            {i.unapproved_rules.length === 0 ? (
              "every gated rule's text is approved."
            ) : (
              <>
                lacking for{" "}
                {i.unapproved_rules.map((r) => (
                  <span key={r}>{link(r)} </span>
                ))}
              </>
            )}
          </li>
        </ul>
        {i.check.first.length > 0 && (
          <ul className="muted">
            {i.check.first.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="audit-signers">
        <h3 id="audit-signers">Signers</h3>
        <ul>
          {pack.signers.map((s) => (
            <li key={s.name}>
              {s.name}: {s.signed}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="audit-rules">
        <h3 id="audit-rules">Rules and what rests on them</h3>
        <p>
          {pack.rules.length} rules; {alone} with nothing resting on them.{" "}
          <input
            id={aloneId}
            type="checkbox"
            className="no-print"
            checked={onlyAlone}
            onChange={(event) => {
              setOnlyAlone(event.target.checked);
            }}
          />{" "}
          <label htmlFor={aloneId} className="no-print">
            Only those
          </label>
        </p>
        {shown.map((r) => (
          <section key={r.id} className="audit-rule" aria-label={r.id}>
            <h4>
              {link(r.id)} {r.title} {r.retired && <Status tone="info" label="Retired" />}
            </h4>
            <p className="muted">
              {r.status ?? "no status"} · strength {r.strength}
              {r.domain ? ` · domain ${r.domain}` : ""}
            </p>
            {r.chain.length === 0 ? (
              <p>
                <Status tone="warn" label="Nothing rests on it" />
              </p>
            ) : (
              <table>
                <caption className="muted">What rests on {r.id}, nearest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Entity</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Through</th>
                  </tr>
                </thead>
                <tbody>
                  {r.chain.map((c) => (
                    <tr key={c.id}>
                      <td style={{ paddingLeft: `${String(c.depth - 1)}em` }}>
                        {link(c.id)} {c.title}
                      </td>
                      <td>{c.type}</td>
                      <td>{c.status ?? ""}</td>
                      <td className="muted">
                        {c.via.field} of <code>{c.via.on}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </section>
    </article>
  );
}

type Load = { state: "loading" } | { state: "ready"; pack: AuditPack } | { state: "failed"; message: string };

/** The Audit view (local mode). */
export function Audit({ client }: { client: StudioClient }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    let live = true;
    client.audit().then(
      (pack) => {
        if (live) setLoad({ state: "ready", pack });
      },
      (err: unknown) => {
        if (live) setLoad({ state: "failed", message: String(err) });
      },
    );
    return () => {
      live = false;
    };
  }, [client]);
  if (load.state === "ready") return <AuditView pack={load.pack} />;
  return (
    <>
      <h2>Audit pack</h2>
      {load.state === "loading" ? (
        <Status tone="info" label="Loading" />
      ) : (
        <p>
          <Status tone="error" label="catalyst did not answer" />{" "}
          <span className="muted">
            {load.message} (the audit pack needs <code>catalyst serve --local</code>, catalyst 0.87.0 or later)
          </span>
        </p>
      )}
    </>
  );
}
