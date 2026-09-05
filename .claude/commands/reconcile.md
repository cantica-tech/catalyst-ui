---
description: Resolve a RECON- reconciliation case by accepting, accepting with edits, or rejecting the proposed version
argument-hint: <RECON-id> accept | accept-with-edits | reject
---

Resolve an open reconciliation case. Full spec: `.criterion/CODE-OF-CONDUCT.md`
§4, template: `.criterion/reconciliations/templates/TEMPLATE-RECONCILIATION-v1.md`,
mechanism: `.criterion/rules/Rules-of-Rules.md` §16.
Input: $ARGUMENTS

1. Load the named `RECON-NNNNNN`; refuse if its `Status` is already
   `Closed` (point to `/status` for reopening if genuinely needed, same
   as any other artifact).
2. `accept`: merge `Proposed` into the `Entity` it names, unchanged.
   `accept-with-edits`: ask for (or use already-supplied) revised
   content, append it as a new row in `## Revisions`, then merge that
   instead. `reject`: leave the `Entity` unchanged on `criterion`, and
   flag the proposer's local divergence for reverting.
3. Set `Status` to `Resolved-Accepted` / `Resolved-Accepted-with-Edits` /
   `Resolved-Rejected`, fill `Resolved` and `Resolver`, and fill in
   `## Resolution` with the rationale.
4. Register the outcome in `reconciliations.md` and append one journal
   entry covering both the `RECON-` file and the `Entity` file if it was
   merged (INV-17) — never rewrite an earlier `## Revisions` row.
5. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise (INV-4).
