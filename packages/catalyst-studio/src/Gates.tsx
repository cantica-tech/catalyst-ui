import type { ApprovalGate, ApprovalsReport } from "./client.js";
import { ActionForm } from "./ActionForm.js";
import { useHost } from "./host.js";
import { Status } from "./Status.js";

/** What a gate covers, in words: the rules of a domain, or a type entering a state. */
export function gateCovers(gate: Pick<ApprovalGate, "covers">): string {
  const c = gate.covers;
  if ("rules" in c) return `the rules of ${c.rules.domain}`;
  return `${c.type} entering ${c.to}`;
}

/** One gate's count for the current version: "1 of 2 from Reviewer (bob); 1 missing", or "passed". */
export function gateCount(gate: Pick<ApprovalGate, "approvals" | "role" | "counted" | "missing">): string {
  const who = gate.counted.length > 0 ? ` (${gate.counted.join(", ")})` : "";
  const have = `${String(gate.counted.length)} of ${String(gate.approvals)} from ${gate.role}${who}`;
  return gate.missing > 0 ? `${have}; ${String(gate.missing)} missing` : `${have}; passed`;
}

/**
 * The approval gates covering an entity (studio-SHELL-000018, catalyst >=
 * 0.80.0): what each has and lacks for its current version, and, inside a
 * host that acts, the approval asked for here. None when no gate covers it.
 */
export function GatesSection({ report }: { report?: ApprovalsReport }) {
  const host = useHost();
  if (!report || report.gates.length === 0) return null;
  return (
    <section aria-labelledby="entity-gates">
      <h3 id="entity-gates">Approval gates</h3>
      <p className="muted">
        An approval is of this version: once its text changes, earlier approvals no longer count, and its author never
        approves it.
      </p>
      <ul>
        {report.gates.map((g) => (
          <li key={g.gate}>
            <Status tone={g.missing > 0 ? "warn" : "ok"} label={g.missing > 0 ? "Waiting" : "Passed"} />{" "}
            <code>{g.gate}</code> <span className="muted">({gateCovers(g)})</span>: {gateCount(g)}
            {g.missing > 0 &&
              (host?.act ? (
                <ActionForm
                  host={host}
                  label="Approve this version"
                  action={{ verb: "approve", id: report.id, gate: g.gate }}
                />
              ) : (
                <>
                  {" "}
                  <code>
                    catalyst approve {report.id} --gate {g.gate}
                  </code>
                </>
              ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
