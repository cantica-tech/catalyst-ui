---
description: Resolve a RECON- reconciliation case by accepting, accepting with edits, or rejecting the proposed version, or propose a resolution
argument-hint: <RECON-id> accept | accept-with-edits | reject | propose <text>
---

Resolve, or move toward resolving, an open reconciliation case. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4, template:
`.criterion/reconciliations/templates/TEMPLATE-RECONCILIATION-v1.md`,
mechanism: `.criterion/rules/Rules-of-Rules.md` §16.
Input: $ARGUMENTS

1. Load the named `RECON-NNNNNN`; refuse if its `Status` is already
   `Closed` (point to `/status` for reopening if genuinely needed, same
   as any other artifact). If it names a `Workflow`, read that
   `WORKFLOW-NNNNNN`'s `## Steps`/`## Gates / exit criteria` first — it
   guides which verb is appropriate here.
2. Resolve the current actor's role(s) against `IAM/roles/roles.json`'s
   `reconciliation` field. This is genuinely enforced, not advisory
   (`Rules-of-Rules.md` §11's one exception):
   - `none` — refuse immediately, regardless of verb, and name a `full`
     or `propose` actor to ask instead.
   - `propose` — only the `propose <text>` verb is allowed; refuse
     `accept`/`accept-with-edits`/`reject` and name that a `full`-level
     actor must finish it.
   - `full` — every verb below is allowed.
3. `accept`: merge `Proposed` into the `Entity` it names, unchanged.
   `accept-with-edits`: ask for (or use already-supplied) revised
   content, append it as a new row in `## Revisions`, then merge that
   instead. `reject`: leave the `Entity` unchanged on `criterion`, and
   flag the proposer's local divergence for reverting. `propose <text>`:
   append `<text>` as a new row in `## Revisions` and move `Status` to
   `Under Review` — do not touch `Resolved`/`Resolver`.
4. For the three resolving verbs, set `Status` to `Resolved-Accepted` /
   `Resolved-Accepted-with-Edits` / `Resolved-Rejected`, fill `Resolved`
   and `Resolver`, and fill in `## Resolution` with the rationale.
5. Register the outcome in `reconciliations.md` and append one journal
   entry covering both the `RECON-` file and the `Entity` file if it was
   merged (INV-17) — never rewrite an earlier `## Revisions` row.
6. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise (INV-4).
