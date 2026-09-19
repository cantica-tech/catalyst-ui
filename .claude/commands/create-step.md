---
description: Create a new step against an existing requirement, recording one concrete unit of implementation work
argument-hint: <REQ-id> <short description>
---

Create a new step. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4, template: `.criterion/steps/templates/TEMPLATE-STEP-v1.md`.
Input: $ARGUMENTS

1. Refuse with a clear message if `<REQ-id>` doesn't resolve to an
   existing file under `requirements/`.
2. Resolve the next sequential `STEP-NNNNNN` ID from `steps/steps.md` plus
   a directory listing of `steps/` — never guess or reuse a number.
3. Create the step file from the template, `Requirement` set to
   `<REQ-id>`, `Status: planned` (or `in-progress` if the user says work
   is already underway). Do not prompt for a domain or rule target —
   neither field exists on this artifact type; it inherits `<REQ-id>`'s.
4. Register it in `steps/steps.md`, and append its ID to `<REQ-id>`'s own
   `Steps` field (creating the field if this is its first step).
5. Report the new step's ID and filename.
