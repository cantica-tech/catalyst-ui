---
description: Force the agent-switch procedure to run now, syncing <app-name>.catalyst, .criterion/, and the .criterion symlink to the running (or given) agent
argument-hint: "[agent-id]"
---

Force a resync to the running agent, or to `<agent-id>` if given. Sources:
`.criterion/CODE-OF-CONDUCT.md` §4.
First run `catalyst spec switch-agent` and follow it: it prints this command's
part of `CODE-OF-CONDUCT.md` §4, the canonical text. Open the sources
above in full only when the spec points elsewhere or a judgment needs
the Rules-of-Rules sections they cite.
Input: $ARGUMENTS

1. Resolve the target agent identifier: `$ARGUMENTS` if given, else the
   running agent's own identifier.
2. Resolve that agent's owned location per `BOOTSTRAP.md` §1.
3. If a `.criterion/` working copy exists at a different, prior location
   (the current `.criterion` symlink's target, or a legacy pointer's
   `agent-source`), mirror it into the resolved location: the resolved
   location ends up an exact copy of the old one — overwriting
   conflicts, removing anything extra at the destination — never a
   partial merge.
4. Repoint the `.criterion` symlink at the project root to the resolved
   location (skip on the in-project fallback), keeping `/.criterion`
   gitignored.
5. Update `<app-name>.catalyst`: set `agent` and `updated` —
   unconditionally, even if they already look correct, since this
   command exists precisely for when the automatic per-session check
   missed a mismatch or only partially applied it. The pointer holds no
   path, and `Taskfile.yml` needs no edit.
6. Refresh persistent framework memory with the new agent name, resolved
   working-copy location, and date.
7. Report what changed (or that everything already matched).
