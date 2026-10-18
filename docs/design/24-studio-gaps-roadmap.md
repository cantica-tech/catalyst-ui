# 24 — Closing the Studio's gaps against ui-potential-roadmap (draft for the owner, 2026-10-16)

> **Status: draft.** Written after the gap review of 2026-10-16: of the folder's 16 functionalities, none is complete
> as specified, 4 are close, 9 partial, 3 not started; almost everything built is read-only (Studio decision 3).
> This note proposes how to close the rest, in what order, what the engine must add, and which decisions come first.
> **Decided 2026-10-16: W1** (§2) — the host runs catalyst's verbs, in VS Code and, through the same bridge, in the
> Electron shell (R6.49). The rest is still a proposal.

## 1. Where things stand

| #   | Functionality (folder `02`)  | Today (UI 0.46.0, kernel 0.76.0)                  | Gap                                                            |
| --- | ---------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Dashboard                    | health, what waits, open work, versions, activity | rule coverage %, test pass rate, quick stats, quick actions    |
| 2   | Studio Map                   | types, counts, reference fields as arrows         | colour by status, path highlight, named relations              |
| 3   | Traceability Explorer        | both ways, tree and graph                         | time view, filter by type, code as input                       |
| 4   | Drift Dashboard              | unrecorded changes, missing links, kernel behind  | rule violations %, stale references, trends, fix/defer actions |
| 5   | Judgment Inbox               | items, evidence, settling commands to copy        | settle in ≤ 3 clicks, filters, unread count                    |
| 6   | Palette + Agent Console      | palette, console in VS Code with cost             | run history                                                    |
| 7   | Batch Operations             | —                                                 | all                                                            |
| 8   | Journal Timeline + Diff      | by day, filters, diffs per change                 | causal links, grouping by type or impact, blame                |
| 9   | Impact Analysis & Simulation | the trace                                         | highlight across views, simulation, approve                    |
| 10  | Roadmap Timeline             | tables in order, progress, links                  | time axis, dependency lines, reschedule                        |
| 11  | Approval Workflows           | RECON cases, sign-offs                            | gates, proposals, multi-reviewer sign-off                      |
| 12  | Change History & Rollback    | history with diffs                                | rollback, compare two versions                                 |
| 13  | Rule Browser                 | by document and domain, status, citers, text      | must/should/may, ADR, propose a rule                           |
| 14  | Analysis & Findings          | — (analyses deciding, in the inbox)               | all                                                            |
| 15  | Module Administration        | — (CLI only)                                      | all                                                            |
| 16  | Team Visibility              | users, roles, two weeks of activity               | work in progress per person, live feed, mentions, workload     |

Also open: visualization patterns 3 (Gantt) and 6 (side-by-side diff); design laws 4 (drift in every view) and 5
(decisions as entities); P2's cumulative cost meter, audit pack, embeds and sandbox; the desktop shell; the second
module.

## 2. The one decision that unlocks most of it: how the Studio writes — decided: W1

Studio decision 3 made the first views read-only. Items 1, 4, 5, 7, 9, 10, 11, 12 and 13 all need a write. Every
write already exists as a catalyst verb (`status set`, `journal adopt`, `reconcile`, `analysis decide`, `new`,
`module install`, …), each journaling itself; the question is only who runs it.

| Option                                                | How                                                                                                                                                                                              | For                                                                                                                | Against                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **W1 — the host runs verbs** (**decided** 2026-10-16) | Generalize the console's bridge (C2): the Studio asks for an _action_ (a verb and its arguments), the VS Code host shows it in a modal dialog, runs `catalyst <verb> --json`, returns the result | one path for runs and writes; the person confirms in a trusted dialog; no HTTP write route; already built for runs | a browser page stays read-only; each action is one dialog                          |
| W2 — the local server writes                          | `POST` routes on `serve --local`, opt-in at start                                                                                                                                                | the browser can write too                                                                                          | the page's token becomes a write key; a second write path to keep equal to the CLI |
| W3 — stay read-only                                   | commands copied, as today                                                                                                                                                                        | nothing new                                                                                                        | the folder's ≤ 3-click target is out of reach                                      |

With W1, "≤ 3 clicks" reads: open the item, pick the verb, confirm. Batch operations are one dialog listing every
entity, then one verb per entity, each journaled (law L1).

**W1 across shells.** A host is whatever frames the Studio and confirms on the person's behalf; the Studio does not
change between them, only the transport does:

| Host                       | Serves the Studio                                      | Studio → host                                                                   | Confirms                              | Runs                                                                      |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| VS Code (built, UI 0.46.0) | the extension starts `catalyst serve --local --static` | `postMessage` through the panel's relay script                                  | VS Code's modal dialog                | `catalyst agent run` / `catalyst <verb> --json`, spawned by the extension |
| Electron (R6.49)           | the main process starts the same server as a sidecar   | a preload script exposes a minimal API (`contextBridge`); the page gets no Node | a native dialog from the main process | the same commands, spawned by the main process                            |
| Browser                    | `catalyst serve --local --static`                      | none                                                                            | —                                     | nothing: read-only                                                        |

`connectHost` (catalyst-studio `host.ts`) looks for the preload's API first, then for a framing parent; the action
allow-list, the dialogs' wording and the event stream are shared, so a host is a transport and a dialog.

## 3. Phases

### G1 — Writes through the host (W1)

| Item  | Work                                                                                                                                                                                                                                                                                                      | Engine needs                                                                                                              |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| R6.30 | Action bridge: `StudioMessage` gains `action` (allow-listed verbs only), the host confirms and runs it, returns stdout or `--json`                                                                                                                                                                        | every allow-listed verb has `--json` output (most do)                                                                     |
| R6.31 | Inbox settling (#5): each settle command becomes a button, its arguments asked in place                                                                                                                                                                                                                   | `journal adopt`, `reconcile`, `analysis decide` with `--json`                                                             |
| R6.32 | Board moves (#4 board): drag or "Move to…" runs `status set`; a guard's refusal is shown as catalyst says it                                                                                                                                                                                              | none                                                                                                                      |
| R6.33 | Rollback (#12): "Restore this version"                                                                                                                                                                                                                                                                    | **new verb** `catalyst restore <id> --to <timestamp>`: writes the old content as a new journaled change (never a rewrite) |
| R6.34 | Dashboard and drift quick actions (#1, #4): adopt, sync plan, open the inbox                                                                                                                                                                                                                              | none                                                                                                                      |
| R6.17 | Batch operations (#7): select in any list, one dialog, one journaled change per entity                                                                                                                                                                                                                    | none                                                                                                                      |
| R6.49 | Electron transport (W1 on the desktop): a preload exposing `run`, `action`, `cancel` and their events over IPC; the main process confirms with a native dialog and spawns catalyst; `connectHost` tries it before the parent frame; the frozen `catalyst-host-electron`'s own agent window retired for it | none (R6.20 builds the shell around it)                                                                                   |

Estimate: 5–7 sessions, the restore verb included; R6.49 adds 1–2, done with R6.20 or before it.

### G2 — Read side finished (no decision needed)

| Item  | Work                                                                                                    | Engine needs                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| R6.35 | Map (#2): colour by open share, click a type to highlight what it references and what references it     | none                                                                                                        |
| R6.36 | Trace (#3): filter by type, a time-ordered view from history                                            | none                                                                                                        |
| R6.37 | Diff (#8, #12, pattern 6): side by side; compare any two versions of an entity                          | none (`history` holds every version)                                                                        |
| R6.38 | Journal (#8): group by entity type or tier; link entries that touch the same file within one session    | none at first; a `follows` field later if the heuristic is not enough                                       |
| R6.39 | Drift everywhere (law 4): a badge on every entity, list row and card with an open problem, from `check` | **`check --json` gives each finding its entity ID** (today: text)                                           |
| R6.40 | Dashboard metrics (#1): rule coverage (rules with targeting work), linked tests, quick stats            | **`backlog`/`graph` give coverage counts**; test results stay outside catalyst unless a module records them |
| R6.41 | Impact highlight (#9): from an entity, mark what it reaches in the board, map and lists                 | none                                                                                                        |
| R6.42 | Run history (#6): the console's past runs, their cost                                                   | **`agent run` keeps a run log** in the criterion (who, command, ok, usage, cost)                            |
| R6.22 | Cost meter: runs summed per command, per day, per person                                                | the run log of R6.42                                                                                        |

Estimate: 8–11 sessions.

### G3 — Decisions as first-class (decision G taken: opt-in gates for 1.0; ADRs and rule typing decided 2026-10-18)

| Item  | Work                                                                                                   | Needs                                                                                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R6.43 | Approval gates (#11): a rule such as "two approvals from the Tech Lead role to change a security rule" | **decision G: opt-in for 1.0** (2026-10-16); a kernel gate model declared in IAM (what it covers, how many approvals, from which role), approvals journaled, enforced by `status set`, rule edits and `check`; nothing for a deployment that declares none |
| R6.44 | Proposals (#11, #13): propose a rule or a change; reviewers see it in the inbox with its diff          | a kernel proposal path; RECON's `propose` covers disputes only, and `PROP-` was dropped (decision 5)                                                                                                                                                       |
| R6.45 | Decisions as entities (law 5): ADRs in the record, cited by rules                                      | a module type (`ADR-`) — the module's call, not the kernel's                                                                                                                                                                                               |
| R6.46 | Rule typing (#13): must / should / may                                                                 | a rule-format field (Rules-of-Rules §6), with a migration                                                                                                                                                                                                  |
| R6.47 | Impact simulation (#9): try a change on a scratch copy, see what breaks, then apply                    | a scratch criterion (a `git worktree` of the criterion) and `check` on it                                                                                                                                                                                  |

Estimate: 8–12 sessions after the decisions.

### G4 — Analysis and modules (R6.E items, pulled forward if a pilot needs them)

| Item  | Work                                                                                                  | Engine needs                                                             |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R6.23 | Analysis workspace (#14): runs, findings triage, trend, "propose fix" through the console             | `analysis` verbs with `--json` and a findings route on `serve`           |
| R6.24 | Module administration (#15): installed, available, install/upgrade/remove with what each would change | `module list/verify/upgrade --json`; a dry-run of `upgrade`              |
| R6.48 | Team work in progress (#16): open items per person                                                    | **an assignee** on work types — a module field, or the signer as a proxy |

Estimate: 6–8 sessions.

### G5 — Scale, shells and the rest

R6.20 desktop (C3 decided: Catalyst Studio; C4: Apache-2.0), R6.26 notifications (the inbox's unread count first),
R6.27 audit pack, R6.28 embeds, the Gantt view (#10) once a module's roadmap rows carry dates, and R7's second module
as the proof that nothing in the Studio names a module type.

## 4. Proposed out of scope

| From the folder                             | Why                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mentions and @ replies, email digests (#16) | catalyst has no messaging; the inbox and the journal are its conversation                                                   |
| Real-time multi-user activity feed (#16)    | `serve` events already refresh every view; "real time" beyond that needs the shared server's events in the UI, a later item |
| Drag to reschedule (#10)                    | needs dates the record does not hold                                                                                        |
| Blame on code lines (#8)                    | the journal records criterion files; product code is git's, and `git blame` already answers                                 |

## 5. Decisions for the owner

1. ~~**W — how the Studio writes**~~ — **decided 2026-10-16: W1**, in VS Code and Electron alike (R6.49).
2. ~~**G — approval gates**~~ — **decided 2026-10-16: opt-in for 1.0** (option 2): no gate unless a deployment declares one. (Not B5, which keeps four-eyes _analysis_.)
3. **Module choices:** ~~an `ADR-` type~~ — **decided 2026-10-18: yes**, decisions are recorded, so they are entities: an `ADR-` type of the process module naming the rules it shapes, catalyst's own ADRs moved into its record (R6.45); an assignee field and dates on roadmap rows — **decided 2026-10-18: yes** (module 3.4.0, B9); embeds from other sites — **decided 2026-10-18: yes**, from origins a deployment allows (B8).
   **Rule typing** — **decided 2026-10-18:** a rule states `must`, `should` or `may`, `must` when it states none; a `should` breach is reported as a warning, a `may` one as a note (R6.46, kernel).
4. **Scope cuts** of §4.

## 6. Order

G1 now that W1 is decided (it is what users will notice first), G2 in parallel where it needs no engine work, G3 now that G is decided (the gates first; ADRs and rule typing wait on the module),
G4 when a pilot asks, G5 with R6.D and R7. About 27–38 sessions for G1–G4, one developer with an agent.
