---
description: Manage plugin installation and activation (list, activate, download, deactivate, upgrade, downgrade)
argument-hint: list | activate <name> <version|latest> | download <name> <version|latest> | deactivate <name> | upgrade <name|latest> | downgrade <name> <version>
---

Manage plugin installation and activation. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

**Unlike every other command here, this one resolves plugins against
`plugins/<type>/catalog.md` in the catalyst framework's own repository
(currently `plugins/repository/catalog.md`), not against anything under
`.criterion/`.** A plugin name with no matching catalog entry is
unregistered — refuse the subcommand and say so.

1. `list` — read every plugin type's `catalog.md`; report each plugin's
   repository URL, pinned release/tag, and compatibility.
2. `activate <name> <version|latest>` — resolve `<name>`'s repository URL
   from the catalog, download/update into `plugins/<type>/` if not
   already present, then load it: read its `working-contract.md` and
   fulfill its Operational-loop section, targeting the *deployed
   project's* own repository root — never catalyst's own repo or the
   plugin's install directory. Requires a version argument.
3. `download <name> <version|latest>` — same resolution, but install
   without activating.
4. `deactivate <name>` — mark inactive and flush from memory; stays
   installed.
5. `upgrade <name|latest>` / `downgrade <name> <version>` — resolve from
   the catalog and update the installed version accordingly.
6. Refuse activation if the plugin's root is missing `README.md` or
   `working-contract.md`.
