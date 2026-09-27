---
description: Create a new feature entry and register it in features/features.md (non-rule-linked)
argument-hint: <description> [--roadmap <RM-NNNNNN>]
---

Create a new feature entry. Sources: `.criterion/CODE-OF-CONDUCT.md`
§3/§4, template: the highest-versioned
`.criterion/features/templates/TEMPLATE-FEATURE-vN.md`.
First run `catalyst spec create-feature` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Do not prompt for a domain or rule target — neither field exists on
   this artifact type (`Rules-of-Rules.md` §9).
2. Resolve who is signing this per §2 and fill `Signed-off-by`.
3. Allocate the ID with `catalyst id next FEAT --as <signer>` — never
   guess, compute by hand, or reuse a number.
4. If this formalizes an existing roadmap row (any
   `development/roadmaps/<name>.md`), cite that row's `RM-NNNNNN` ID in the
   `Roadmap` field and set the row's `Status` to `Triaged`, `Linked` to
   this new ID (a roadmap row is edited in place, by hand).
5. Copy the current `TEMPLATE-FEATURE-vN.md`, fill every field, save as
   `features/<ID>-<short-summary>.md`.
6. Register it: `catalyst index regen` rebuilds `features/features.md`.
7. Journal it: `catalyst journal append --command /create-feature --action create
   --artifact <ID> --intent "<goal>" --file <each touched file>` (no
   `--target`: features are not rule-linked).
8. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
