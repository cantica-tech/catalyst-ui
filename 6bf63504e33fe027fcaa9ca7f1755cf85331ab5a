---
description: Bootstrap/branch (create), join (get), or sync (push) a repoed .criterion/ deployment through a dedicated repository
argument-hint: create <name> <git-info> | get <repo> <username> | push [--force]
---

Manage a repoed deployment. Full spec: `.criterion/CODE-OF-CONDUCT.md`
§4, mechanism: `.criterion/rules/Rules-of-Rules.md` §13.
Input: $ARGUMENTS

**Creating a repo, or force-pushing, is externally-visible and
hard-to-reverse — confirm with the user before doing either, even though
invoking this command already implies intent to push.**

## `create <name> <git-info>`

**First call for this deployment** (`.criterion/DEPLOYMENT.md` doesn't
show `repoed: true` yet):
1. Check whether `<git-info>` already exists.
   - If it doesn't, confirm with the user, then create it there under
     `<name>`.
   - If it does, inspect its content before registering it as-is: if
     it's genuinely this same deployment's own prior state, proceed; if
     it holds *unrelated* content (a different project's own
     `.criterion/` deployment, not a rejoin of this one), stop and
     confirm explicitly with the user before doing anything — same tier
     of confirmation as creating a new repo.
2. Write `repoed: true`, `catalyst_repo: <name>`, `catalyst_repo_url:
   <git-info>`, `created_by: <current Signed-off-by actor>` to
   `.criterion/DEPLOYMENT.md`.
3. **Ask which branch this actor will push to** — the suggested default
   is their own `<branch-safe-name>.criterion`, but `criterion`
   itself is a valid choice (see `push` below for what that changes).
   Write the answer as `criterion_branch` in both
   `.criterion/DEPLOYMENT.md` and `<app-name>.catalyst`.
4. Push the current local `.criterion/` state as the first commit on
   a branch named `criterion` — the canonical, master version. Nothing
   is vetted on this first push.
5. Run the **identity migration** (below) for the current actor.
6. Report the result.

**Called again, already repoed:** don't refuse.
- If `<git-info>` matches the already-registered `catalyst_repo_url`,
  this branches: create a new branch off `criterion`'s current state,
  named `<name>` in its branch-safe form. No `.criterion/DEPLOYMENT.md` change.
- If `<git-info>` names a *different* repo, confirm explicitly with the
  user first — this is an unusual second-repo scenario, not ordinary
  branching.

## `get <repo> <username>`

For a user with no local `.criterion/` copy of an already-repoed
deployment yet — the join path.
1. Validate `<username>` against the branch-safe-name rule (below);
   refuse with a suggested alternative if it doesn't survive
   sanitization uniquely against already-registered users.
2. Download `<repo>`'s `criterion` branch content and check out
   `<username>.criterion` (branch-safe form) from it as this user's
   local `.criterion/`. Create a `IAM/users/users.json` entry for
   them first if one doesn't exist yet.
3. **Ask which branch this actor will push to**, same as `create` above
   — the just-created `<username>.criterion` is the default. Record
   `criterion_branch`.
4. Run the identity migration (below) for this user.
5. Report the result.

## Branch-safe names

Every git ref name derived from a person's identity — `create`'s
branching `<name>`, `get`'s `<username>`, a push branch before a
`git_username` exists — uses that name's branch-safe form: lowercase,
every run of non-`[a-z0-9]` characters collapsed to a single `-`,
leading/trailing `-` trimmed (e.g. "Olivier Steck" → "olivier-steck"). If
two distinct registered names would collapse to the same form, refuse
and ask for a manual override rather than silently colliding branches.

## Identity migration

Part of both `create`'s first call and `get`. Set `git_username` on the
current user's `IAM/users/users.json` entry (`git config user.name`,
branch-safe form, for `create`; the given `<username>` for `get`).
Rewrite every existing artifact's `Signed-off-by` field currently naming
this user's old `name` to their new `git_username` — from here on, every
`Signed-off-by`/journal `actor` written for them uses `git_username`,
never `name`. **Never rewrite the journal itself** — entries are
immutable (INV-17), no exception here either; instead append one new
entry (`action: "update"`, `intent` describing the migration) covering
every artifact file actually rewritten.

## `push [--force]`

1. Refuse if `.criterion/DEPLOYMENT.md` doesn't show `repoed: true` (point to
   `/criterion create`). If no `criterion_branch` is recorded yet (a
   deployment from before this field existed), ask now — same question
   as `create`'s — and record the answer before continuing.
2. **If `criterion_branch` names a real contributor branch**
   (`<git_username>.criterion` if the actor has one, otherwise the
   branch-safe form of `name`):
   a. Push local `.criterion/` there (creating the branch on their
      first push).
   b. If `--force`: refuse unless the current actor matches
      `.criterion/DEPLOYMENT.md`'s `created_by`. Otherwise confirm
      with the user, then overwrite `criterion` directly from local
      state and skip everything below.
   c. Otherwise:
      - **Vet**: run `/check-rules` against the merged-in state, plus an
        independent four-eyes sub-agent pass checking whether it still
        matches what its own rules claim. Disagreement between the two
        sub-agents, or a flagged violation, stops here. (This is the
        exact procedure `/dogfood` runs standalone when developing
        catalyst itself — not available here, so described directly
        instead.)
      - **Merge**: attempt a normal merge first. Only where that leaves
        a conflict — git-level, vetting-flagged, or a rights-mismatch
        (the actor's role doesn't cover this entity per
        `IAM/roles/roles.json`) — have a sub-agent propose a resolution
        guided by `Rules-of-Rules.md` §1's conflict-check principle —
        never silently drop either side's rule-compliant intent. If
        that's itself contested, or genuinely irreconcilable, open a
        `RECON-NNNNNN` instead of guessing which side wins
        (`Rules-of-Rules.md` §16, `/reconcile` to resolve it later) —
        that one entity stays unmerged; everything else proceeds.
      - **Update both branches**: `criterion` gets the merge commit;
        the contributor's own branch is fast-forwarded to match.
      - **Refresh locally**: pull the updated `criterion` and
        overwrite the local `.criterion/` directory and this
        session's in-memory record of it.
3. **If `criterion_branch` *is* `criterion` itself**
   (single-maintainer mode): push local `.criterion/` state directly
   onto `criterion`, overwriting it — every time, no vetting, no
   merge, not gated behind `--force`. Still refuse unless the current
   actor matches `.criterion/DEPLOYMENT.md`'s `created_by`. This is
   catalyst's own repo's expected mode — offered as the natural
   follow-up after `/dogfood` ends clean or ends with fixes applied and
   reverified, since that audit already served as the vetting step.
4. Report the result.

Not a replacement for `/sync-framework` (that syncs the framework
*template* into a deployment; this syncs one deployment's *own state*
across contributors), and not a substitute for the journal — a
`criterion` merge is itself journaled like any other change once it
lands locally.
