---
description: Share the working copy through a criterion repository — create (make .criterion a submodule), get (join), push (pull request), sync, status
argument-hint: create <url> | get | push <message> | sync | status
---

Share this deployment's working copy through a criterion repository.
Sources: `.criterion/CODE-OF-CONDUCT.md` §4 (`/criterion` and its procedure
paragraphs), mechanism: `.criterion/rules/Rules-of-Rules.md` §13, commands:
`catalyst criterion --help`.
First run `catalyst spec criterion` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Dispatch on the first word — `create <url>`, `get`, `push <message>`,
   `sync`, `status` — and follow that subcommand's procedure in
   `CODE-OF-CONDUCT.md` §4. Each runs the matching `catalyst criterion`
   command (`get` runs `catalyst criterion join`); never re-implement its
   git steps by hand.
2. `push` resolves the signer first (`CODE-OF-CONDUCT.md` §2) and passes
   `--as <signer>`.
3. If `push` stops on a conflict, nothing was pushed. Never apply a
   resolution yourself: report the files, and at most propose one as a
   `RECON-` case for a human to accept with `/reconcile`.
4. Report the result. Do not commit the product repository's staged
   changes or moved gitlink, and do not run `catalyst criterion protect
   --yes`, without the user's assent (INV-4).

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
