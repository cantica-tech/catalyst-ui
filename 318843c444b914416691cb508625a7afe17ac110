---
description: Create a new step against an existing requirement or bug, recording one concrete unit of implementation work
argument-hint: <REQ-id|BUG-id> <short description>
---

Create a new step. Sources: `.criterion/CODE-OF-CONDUCT.md` §4,
template: the highest-versioned `.criterion/steps/templates/TEMPLATE-STEP-vN.md`.
First run `catalyst spec create-step` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Refuse with a clear message if `<REQ-id|BUG-id>` doesn't resolve to an
   existing file under `requirements/` or `development/bugs/`.
2. Resolve who is signing this per §2, then allocate the ID with
   `catalyst id next STEP --as <signer>` — never guess, compute by hand,
   or reuse a number.
3. Create the step file from the template, `Parent` set to
   `<REQ-id|BUG-id>`, `Status: planned` (or `in-progress` if the user
   says work is already underway). Do not prompt for a domain or rule
   target — neither field exists on this artifact type; it inherits
   `<REQ-id|BUG-id>`'s.
4. Append its ID to `<REQ-id|BUG-id>`'s own `Steps` field (creating the
   field if this is its first step), then `catalyst index regen` to
   rebuild `steps/steps.md`.
5. Journal it: `catalyst journal append --command /create-step --action create
   --tier feature --artifact <ID> --intent "<goal>" --file <step file> --file <parent file>
   --file <each regenerated index>` (`--tier fix` instead when the parent
   is a `BUG-`: a bug is fix-tier work, `CODE-OF-CONDUCT.md` §3).
6. Report the new step's ID and filename. Do not commit or push on your
   own: the working copy (`.criterion/`) and the product
   repository are committed only with the user's assent.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
