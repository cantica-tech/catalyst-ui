---
description: Create a new test artifact and register it in tests/tests.md
argument-hint: <description> [--targets <rule-id>...] [--domain <CODE>] [--requirements <REQ-id>...] [--steps <STEP-id>...]
---

Create a new test artifact. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3/§4, `Rules-of-Rules.md` §22,
template: the highest-versioned `.criterion/tests/templates/TEMPLATE-TEST-vN.md`.
Input: $ARGUMENTS

1. Must be vetted against every rule document (`Rules-of-Rules.md` §1) and
   always carries a `Domain` and `Targets`/proposed rule(s) — a test is
   not exempt, same as a bug or requirement. Ask for domain/target rule
   if not inferable.
2. If the user names one or more `REQ-NNNNNN`/`STEP-NNNNNN` this test
   verifies, resolve each against an existing file under `requirements/`/
   `steps/` and populate the `Requirements`/`Steps` fields accordingly.
   Refuse with a clear message rather than citing a dangling id. Both
   fields are optional — a test naming neither is still valid as long as
   `Targets`/`Domain` are set.
3. Resolve who is signing this per §2 and fill `Signed-off-by`, then
   allocate the ID with `catalyst id next TEST --as <signer>` — never
   guess, compute by hand, or reuse a number.
4. Copy the current `TEMPLATE-TEST-vN.md`, fill every field, save as
   `tests/<ID>-<short-summary>.md`.
5. Append this test's ID to the `Tests` field of every requirement/step
   named in step 2 (creating that field if this is its first test) —
   never leave the back-reference for a later pass.
6. Register it: `catalyst index regen` rebuilds `tests/tests.md` (and any
   index showing the touched requirements/steps).
7. Journal it: `catalyst journal append --command /create-test --action create
   --artifact <ID> --target <rule-id> ... --intent "<goal>" --file <each touched file>`.
8. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
