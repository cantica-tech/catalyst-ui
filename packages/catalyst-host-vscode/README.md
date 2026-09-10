# catalyst

**catalyst is a portable, model-agnostic development framework that a coding
agent installs into a project and then works within.** It gives any codebase a
single, traceable structure for its rules, its development work, its agile
process, its roadmap, who's accountable for what, and a real history of why
every change happened — so every change traces down to a documented rule, and
every rule back up to the work that exercises it.

## The core chain

At its center is a four-layer chain, each layer subordinate to the one below it:

```
Work items    EPIC ─▶ STORY ─▶ TASK / SPIKE / SPRINT   (agile process layer)
                        ▼
Dev artifacts        REQ- / BUG- / HK- / TAG-          (rule-linked work)
                        ▼
Rules            (prefix)-(DOMAIN)-(NNN)                (documented behavior)
                        ▼
Rules of rules   the meta-rules governing all of the above
```

The work-items layer is optional, plugin-provided content, not core — see
"Extensible via plugins" below. Without one active, the chain starts one
layer down: dev artifacts trace straight to a rule.

The chain's one invariant: **no work happens without a traceable link down to a
documented rule**, and every document, domain, and rule carries a stable,
permanent, never-reused ID. That is what makes both "why does this code do X"
and "what rule does this ticket satisfy" answerable by following IDs in either
direction, indefinitely. Rules are never deleted, only retired in place — a
retired rule keeps its ID, gets marked 🗑 with a reason and date, and stays a
valid target for the dev-artifact that explains why — so any reference to it,
in code, tests, or tickets, stays resolvable forever.

## Above the chain: roadmap and ideas

`FEAT-` entries are non-rule-linked roadmap ideas — a place to write down
future product direction before it's ready to be measured against anything.
They can themselves be bulk-ingested: `/roadmap-add`/`-update`/`-merge` pull
an external roadmap (one or many, tracked independently) into `RM-` items
with their own status, triaged into `FEAT-` entries and, once work actually
starts, promoted to a `REQ-` — never a `BUG-` — the same way any other new
work enters the chain.

## Accountability: users, roles, signing

Every artifact carries a `Signed-off-by` field, resolved against a
registered-user list (`/user-add`/`-remove`/`-modify`/`-assign-role`) and a
role → typical-action mapping (`/role-add`/`-modify`, seeded with a default
agile-role set). A project must always have at least one active user — the
one hard requirement — but role checks themselves are advisory, not access
control: catalyst has no way to verify who's actually typing, so a mismatch
prompts for confirmation rather than blocking.

## History: the journal

`development/journal.jsonl` is an append-only, transaction-log-grade record
of every rule-linked change — not a changelog. Each entry carries the exact
git content hash before and after, per touched file, plus the rule(s) it
served and the actual intent behind it (the goal, not a label). Because the
pointers are exact, `/journal-restore <timestamp>` can materialize the tree
as it stood at any point into a side directory for inspection — a real
point-in-time reconstruction, never a guess, and never applied to the live
tree automatically. `/journal` is the read-only query side.

## Multi-user sync: criterion

A deployment stays local by default, but can opt into being **repoed**:
`.criterion/` mirrored through a dedicated repository so multiple
people working on the same project converge instead of silently diverging.
`/criterion create`/`get` bootstrap or join it, and run an **identity
migration** on first contact: once a contributor's real git identity is
resolved, every existing `Signed-off-by` that named their old, unresolved
identity gets rewritten to match it going forward. The journal itself is
never rewritten — immutability is the harder invariant, so the migration
is recorded as a new journal entry instead, not a silent edit to old ones.
Every contributor pushes to their own branch via `/criterion push`,
which vets the incoming change against the framework's own rules and
merges it — using AI-assisted resolution only where a plain merge can't —
into the shared canonical branch, then syncs the result back down locally.

## Dogfooding

The same vetting procedure — `/check-rules` plus an independent four-eyes
sub-agent pass checking whether the actual state still matches what the
rules claim — backs both `/criterion push`'s incoming-change check and a
standalone command, `/dogfood`, that runs it on demand against catalyst's
own repository. `/dogfood` is deliberately **not** part of what gets
deployed into other projects: it only ever exists in catalyst's own repo,
for verifying catalyst's own rules against catalyst's own actual state,
never as something an ordinary deployment carries around.

## Extensible via plugins

Plugins add ongoing capability without touching the framework core — each
lives in its own repository (never this one, with one exception: schemas
and plugins still maturing live under `plugins/_prototyping/` until they
graduate out), is gated behind explicit activation (`/catalyzer`), and
operates on the _deployed_ project, never on catalyst itself. Two shapes
exist: **background** plugins that continuously watch a deployed
project — `catalyst-git`, the first one, surfacing rule breaks as they
happen — and **content-contributing** plugins that add whole artifact
types to a deployment on activation. Work-item tracking (`EPIC`/`STORY`/
`TASK`/`SPIKE`/`SPRINT`) is the first of the latter kind: currently
schema-only, in `plugins/_prototyping/project-management/agile/`, with
no concrete, activatable plugin yet.

## Getting started

Deployment follows one of two paths, chosen at install time:

- **Greenfield** — no code yet: the stack, tooling, and dev-environment
  decisions get written and implemented as the project's first rules,
  before any application code exists.
- **Retrofit** — existing code, no rules yet: rules get gathered
  incrementally from what's already there, optionally bootstrapped with a
  four-eyes analysis pass (`/run-analysis`) rather than written up front.

Either way, `development/BACKLOG.md` is the always-current, never-hand-edited
day-to-day view — `/show-backlog` regenerates it from the real indexes, every
time.

## Portable by design

catalyst is built to run under **any** capable coding agent — Claude Code, a
generic tool-using agent, or a system-prompted model — by detecting what the
running agent can do and falling back when a capability is absent. It installs
itself into a fixed deploy target (`.criterion/`) on first load, and stays
grounded across long runs through explicit anti-drift mechanisms (an invariants
file, deployment ledgers, and a re-ground cadence) rather than trusting the
agent to simply remember.

`.criterion/` itself is the agent's own governance context for the
project — not part of the developed code structure, so it doesn't build
inside the project's own tree at all. It builds in **agent-owned space**
instead, and the target project tracks exactly one small, committed file
for it, `<app-name>.catalyst`, whose `agent-source` field points at where
the real working copy lives; `/project create`/`remove`/`export`/`import`
manage that lifecycle. An agent with no owned-space concept falls back to
building `.criterion/` directly in the project, gitignored there
instead. Either way, `/criterion` is the opt-in mechanism for a team
that wants the working copy to persist and sync across contributors,
through a dedicated repository rather than a commit into the product's
own history.

`BOOTSTRAP.md` is the single source of truth. Everything else here either points
at it or extends it.

## Which prompt to load

Choose the prompt file that matches the agent you are running, and load only
that file.

- `CLAUDE.md` — running Claude Code.
- `AGENT.md` — running a generic agent workflow.
- `SYSTEM.md` — running the system-level prompt.

All three load `BOOTSTRAP.md`, the single portable install core. Open the
selected file and follow its instructions from top to bottom.
