---
description: Force the agent-switch procedure to run now, syncing <app-name>.catalyst, .criterion/, and Taskfile.yml to the running (or given) agent
argument-hint: "[agent-id]"
---

Force a resync to the running agent, or to `<agent-id>` if given. Full spec:
`.criterion/CODE-OF-CONDUCT.md` §4.
Input: $ARGUMENTS

1. Resolve the target agent identifier: `$ARGUMENTS` if given, else the
   running agent's own identifier.
2. Resolve that agent's `agent-source` per `BOOTSTRAP.md` §1.
3. Update `<app-name>.catalyst`: set `agent`, `agent-source`, and
   `updated` — unconditionally, even if they already look correct, since
   this command exists precisely for when the automatic per-session
   check missed a mismatch or only partially applied it.
4. If a `.criterion/` working copy exists at a different, prior
   `agent-source`, mirror it into the resolved location: the resolved
   location ends up an exact copy of the old one — overwriting
   conflicts, removing anything extra at the destination — never a
   partial merge.
5. Update `Taskfile.yml` at the project root: set `CRITERION_DIR` to
   match the resolved `agent-source` path.
6. Refresh persistent framework memory with the new agent name, resolved
   `agent-source`, and date.
7. Report what changed (or that everything already matched).
