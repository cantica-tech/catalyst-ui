---
description: Create, remove, export, or import a catalyst deployment (agent-owned working copy + <app-name>.catalyst pointer)
argument-hint: create <project name> | remove <project name> [force] | export <project name> [export filename] | import <export filename> [force]
---

Manage this project's catalyst deployment lifecycle. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4, mechanism:
`.criterion/rules/Rules-of-Rules.md` §14.
Input: $ARGUMENTS

**`remove ... force` and `import ... force` are destructive and
hard-to-reverse — confirm with the user explicitly before either, even
though invoking this command already implies intent.**

## `create <project name>`

Refuses if a `<app-name>.catalyst` pointer or an in-project
`.criterion/` already exists at this project's root — that's
`import ... force`'s job, not this one's.
1. Resolve `agent-source` (`BOOTSTRAP.md` §1): agent-owned per-project
   storage if this agent has one, else the in-project fallback.
2. Run the instantiation procedure (`INSTANTIATION-GUIDE.md`), building
   the working copy at `agent-source`.
3. Write `<app-name>.catalyst` at this project's root, from
   `templates/catalyst-pointer.template.json`, with `<project name>`
   and the resolved `agent-source`.
4. Report the result. Nothing is committed automatically (hard rule 4).

## `remove <project name> [force]`

Without `force`: delete this project's `<app-name>.catalyst` only (and,
on the in-project fallback, stop treating that `.criterion/` as
active). The working copy, this agent's memory note, and any
`criterion` repo are left untouched — never delete, retire in place.

With `force`: confirm explicitly first, then additionally delete the
working copy at `agent-source` and this agent's memory note for the
project. Never deletes a `criterion` repo regardless — that's a
separate, possibly multi-contributor, externally-hosted artifact outside
a local removal's scope.

## `export <project name> [export filename]`

1. Resolve `agent-source` for `<project name>`.
2. Read every file under its working copy into one JSON bundle, keyed by
   path relative to `.criterion/`, plus the pointer fields from
   `<app-name>.catalyst` (all but `agent-source` — meaningless outside
   this machine).
3. Write it to `<export filename>` if given, else
   `<project name>-catalyst-export-<UTC timestamp>.json` in the current
   directory.
4. Report the result.

## `import <export filename> [force]`

Without `force`: refuses if a `<app-name>.catalyst` pointer or an
in-project `.criterion/` already exists at the current project's
root.

With `force` (or when nothing exists yet): confirm explicitly what will
be overwritten if this replaces an existing deployment, then:
1. Parse the bundle.
2. Resolve a **fresh** `agent-source` — never the exporting machine's
   original.
3. Materialize every bundled file there.
4. Write `<app-name>.catalyst`, carrying the bundle's pointer fields
   over as-is (`repoed`, `catalyst_repo`, `catalyst_repo_url`,
   `created_by`), `agent-source` set to the new location.
5. Append one journal entry (`action: "import"`).
6. Report the result.

Not a replacement for `/criterion get` (that joins an already-repoed
deployment's shared history via its dedicated repo; this installs from a
standalone export file with no repo involved).
