---
description: Synchronize this deployment with the latest (or a specific) catalyst framework version
argument-hint: "[latest|<version>] [--force <scope>]"
---

Synchronize the deployed framework. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4, this framework's own
`framework/kernel/SYNCHRONIZE.md` (not part of the deployed
project — fetch if not already available this session, referring to it
only by repository name, never a local path).
First run `catalyst spec sync-framework` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Resolve the target version: `latest` from the `release` branch, a
   specific version if named, otherwise the currently installed local
   version.
2. Diff the deployed tree against the target version.
3. Respect the root `.frozen` file unless `--force <type>`/`--force
   <item-id>`/`--force all` is given; unfreeze any item actually
   refreshed.
4. Never deactivate an already-active plugin unless its catalog
   `Compatibility` field explicitly excludes the target version.
5. Merge into `plugins/<type>/catalog.md` only — never delete an existing
   row or wipe an installed plugin's directory.
6. Replace `.criterion/bin/catalyst.pyz` with the target release's
   `bin/catalyst.pyz` (from catalyst's own checkout: `task build:cli`),
   and apply every pending migration in `SYNCHRONIZE.md`'s order.
7. Journal the sync: `catalyst journal append --command /sync-framework
   --action sync --artifact "kernel <version>" --intent "<why>" --file <each touched file>`.
8. Run `catalyst check` and resolve every error.
9. Run a four-eyes verification pass (two independent sub-agents) before
   declaring the sync complete; any disagreement blocks completion.

`catalyst <args>` is `python3 .criterion/bin/catalyst.pyz <args>`
(`CODE-OF-CONDUCT.md` §4).
