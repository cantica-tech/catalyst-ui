---
description: Create a new test artifact and register it in tests/tests.md
argument-hint: <description> [--targets <rule-id>...] [--domain <CODE>] [--requirements <REQ-id>...] [--steps <STEP-id>...]
---

Create a new test artifact. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §3/§4, `Rules-of-Rules.md` §22, template:
`.criterion/tests/templates/TEMPLATE-TEST-v1.md`.
Input: $ARGUMENTS

1. Resolve the next `TEST-NNNNNN` ID from `tests/tests.md` + a directory
   listing of `tests/` — never guess or reuse a number.
2. Must be vetted against every rule document (`Rules-of-Rules.md` §1) and
   always carries a `Domain` and `Targets`/proposed rule(s) — a test is
   not exempt, same as a bug or requirement. Ask for domain/target rule
   if not inferable.
3. If the user names one or more `REQ-NNNNNN`/`STEP-NNNNNN` this test
   verifies, resolve each against an existing file under `requirements/`/
   `steps/` and populate the `Requirements`/`Steps` fields accordingly.
   Refuse with a clear message rather than citing a dangling id. Both
   fields are optional — a test naming neither is still valid as long as
   `Targets`/`Domain` are set.
4. Resolve who is signing this per §2 and fill `Signed-off-by`.
5. Copy the current `TEMPLATE-TEST-vN.md`, fill every field, save as
   `tests/TEST-NNNNNN-<short-summary>.md`.
6. Register it in `tests/tests.md`.
7. Append this test's own `TEST-NNNNNN` ID to the `Tests` field of every
   requirement/step named in step 3 (creating that field if this is its
   first test) — never leave the back-reference for a later pass.
8. Report the result. Do not commit or push — leave changes unstaged
   unless the user asks otherwise.
