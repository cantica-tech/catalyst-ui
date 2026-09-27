---
description: Create a new feature entry and register it in features/features.md (non-rule-linked)
argument-hint: <description> [--roadmap <RM-NNNNNN>]
---

Create a new feature entry. Full spec: `.criterion/CODE-OF-CONDUCT.md`
§3/§4, template: `.criterion/features/templates/TEMPLATE-FEATURE-v1.md`.
Input: $ARGUMENTS

1. Resolve the next `FEAT-NNNNNN` ID from `features/features.md` + a
   directory listing of `features/` — never guess or reuse a number.
2. Do not prompt for a domain or rule target — neither field exists on
   this artifact type (`Rules-of-Rules.md` §9).
3. If this formalizes an existing roadmap row (any
   `development/roadmaps/<name>.md`), cite that row's `RM-NNNNNN` ID in the
   `Roadmap` field and set the row's `Status` to `Triaged`, `Linked` to
   this new `FEAT-NNNNNN`.
4. Resolve who is signing this per §2 and fill `Signed-off-by`.
5. Copy the current `TEMPLATE-FEATURE-vN.md`, fill every field, save as
   `features/FEAT-NNNNNN-<short-summary>.md`.
6. Register it in `features/features.md`.
7. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
