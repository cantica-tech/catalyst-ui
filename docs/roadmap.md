# Catalyst Studio roadmap

The plan for Catalyst Studio, the UI of this repository. It is phase R6 of catalyst's roadmap, which keeps the
engine's side (what catalyst serves and runs for a UI): `docs/roadmap.md` in the catalyst repository. Decisions:
[decisions.md](decisions.md). `09`, `23`, `24` and the `ui-potential-roadmap/` folder are in [`design/`](design/);
`05` is still in the owner's working notes.

## R6 — Catalyst Studio (catalyst's roadmap phase R6)

Sources: [`09`](design/09-ui-brand-portability.md) (decisions D1–D8, portability stages, brand) and the [`ui-potential-roadmap/`](design/ui-potential-roadmap/INDEX.md)
folder (2026-10-08: five design laws, 16 functionalities with mockups, seven visualisation patterns, reference
products, a three-phase plan). That folder is integrated here; where it disagrees with `09` or with what was built
since, this section wins, and the differences are listed under the tables.

**Design laws for every view** (`ui-potential-roadmap` 01): traceability is the default view; causality is drawn, not
listed; context is disclosed step by step; drift is visible in every view; decisions are entities, not documentation.
One token rule from `09` §3: whatever the UI can do deterministically costs no agent tokens.

**Estimate [`23`](design/23-studio-estimate.md) (2026-10-15; decided 2026-10-16, all as recommended; R6.0 to R6.8 done 2026-10-16, UI 0.40.0 to 0.45.0, kernel 0.73.0 to 0.75.0; the agent console of R6.8 in UI 0.46.0 after R5.5 and decision C2. R6.C done the same day on its read side (UI 0.46.0, kernel 0.76.0 for a rule's text): R6.9 map, R6.10 journal timeline, R6.11 board (moves as commands), R6.13 roadmap, R6.14 rules, R6.15 history with diffs, R6.16 approvals, R6.18 team, R6.19 search (its switcher is the host's); R6.12 is R6.3's trace; R6.17 batch operations wait for writes (decision 3))**: R6.A and R6.B measured against the UI repository's code, 22–31
working sessions (five to seven weeks), a sync to the current kernel first (R6.0), six decisions before starting.

### R6.A — Foundations (`09` §4 stages 1 and 3)

| #     | Deliverable                                                                                                                                                                       | Notes                                                                    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| R6.1  | Split `extension.ts`; `HostPort` abstraction; `@catalyst/app-model` (selectors for tree, board, graph, journal)                                                                   | exit: no `vscode` import outside the adapters                            |
| R6.2  | Studio SPA with a design system: tokens, light and dark, status as icon + word + colour, keyboard and screen-reader support                                                       | same bundle at localhost and in the VS Code webview; axe clean           |
| R6.50 | The client's types for what catalyst prints, generated from catalyst's `spec/` vendored at one kernel release (`npm run spec:sync -w catalyst-core -- <catalyst checkout> <tag>`) | done 2026-10-20 (REQ-000060, decision S7), for 0.57.0, on kernel 0.101.2 |

### R6.B — First views (P0: "can we understand it?")

| #    | View                                                                                                                | Needs from the engine        | Today                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| R6.3 | **Traceability explorer**: upstream (why it exists) and downstream (what depends on it), as a tree and as a graph   | R5.6                         | chain inspector exists                       |
| R6.4 | **Judgment inbox**: decisions waiting for a human, with evidence, settled in at most three clicks                   | R5.7                         | proposal loop exists                         |
| R6.5 | **Dashboard**: check health, open work, drift, versions, recent activity                                            | `check`, `backlog`, `graph`  | health board exists                          |
| R6.6 | **Drift dashboard**: failing checks, unrecorded changes, stale references, with the verb that fixes each            | `check --json`, `unrecorded` | part of the health board                     |
| R6.7 | **Entity page** generated from the module's types: fields, sections, allowed transitions, guards                    | module format 3 (R4.3, done) | hand-mapped kinds (`DEV_ARTIFACT`) to remove |
| R6.8 | **Command palette and agent console**: every command from `catalyst spec`, dispatched to any agent, output streamed | R5.5                         | agent window and run monitor exist           |

### R6.C — Richer views (P1: "can we see it?")

| #     | View                                                                                                | Needs from the engine            |
| ----- | --------------------------------------------------------------------------------------------------- | -------------------------------- |
| R6.9  | **Studio map**: the module's types and their relations as a diagram, coloured by state              | `graph` types                    |
| R6.10 | **Journal timeline and diff**: entries by date, side by side before/after, who and why              | R5.9                             |
| R6.11 | **Board**: columns from a type's states; a move is `status set`, refused by a guard like in the CLI | `status set`                     |
| R6.12 | **Impact analysis**: select an entity, see what a change would reach                                | R5.6                             |
| R6.13 | **Roadmap timeline**: items, milestones, dependencies                                               | roadmap rows in `graph` (0.54.0) |
| R6.14 | **Rule browser**: every rule with its lineage and what cites it                                     | `graph`, `why`                   |
| R6.15 | **Change history** per entity; reverting is a new journaled change, never a rewrite                 | R5.9                             |
| R6.16 | **Approvals**: sign-offs and `RECON-` cases with their audit trail                                  | R5.7, `reconcile`                |
| R6.17 | **Batch operations**: one verb over a selection, one journal entry per entity                       | existing verbs                   |
| R6.18 | **Team visibility**: who changed what, from the journal and the shared copy                         | `journal`, `share status`        |
| R6.19 | Project switcher and global search                                                                  | `workspace`, `list`              |

**Closing the rest of `ui-potential-roadmap`** ([`24`](design/24-studio-gaps-roadmap.md), 2026-10-16): the gaps left after R6.C, in five phases G1–G5 (writes through the host, the read side finished, decisions as entities, analysis and modules, scale and shells), new items R6.30–R6.49; decision W decided 2026-10-16 as **W1** (the host runs catalyst's verbs after the person confirms; the Electron shell gets the same bridge, R6.49); decision G (approval gates) decided the same day: opt-in for 1.0. **G1 under way (2026-10-17, REQ-000037):** R6.30 the action bridge, R6.31 inbox settling (adopt, append, reconcile), R6.32 board moves and R6.33 rollback from the history (REQ-000038, on catalyst 0.77.0's `restore`), R6.34 the dashboard's Settle… and R6.17 batch moves on the board (REQ-000039) done, for 0.47.0; R6.49 the Electron transport to come, with R6.20. **G2 under way:** R6.39 drift marked wherever an entity is shown, R6.40 coverage on the dashboard, R6.42 run history and R6.22 its cost (REQ-000040, on catalyst 0.78.0), then R6.35 the tinted map, R6.36 the trace filter, R6.37 side-by-side and two-version diffs, R6.38 journal grouping and R6.41 impact marks (REQ-000041) done, for 0.48.0: G2 complete (the trace's time view left out, `impact` carries no dates). **G3 under way:** R6.43 approval gates (REQ-000042, on catalyst 0.80.0: the inbox's `approval` kind, an entity's gates, approve through the host) done, for 0.49.0. R6.44 proposals (REQ-000043, on catalyst 0.81.0: the inbox's `proposal` kind, the proposed change beside the current text, decided through the host) and R6.47 Try it (REQ-000044, on catalyst 0.82.0's `catalyst try`: an action's effect shown before it is made) done, for 0.50.0; R6.45 and R6.46 decided 2026-10-18: R6.46 rule strength (REQ-000046, on catalyst 0.83.0: a rule's strength on its page, marked and filtered in the rule browser) done, for 0.51.0; R6.45 decisions as entities needs no Studio code: the process module's `ADR-` type (module 3.3.0) is shown like any type, and a rule's page lists the decisions that name it under Cited by. G3 complete. **G4 and G5 under way (2026-10-18):** R6.23 the analysis workspace (REQ-000047, on catalyst 0.85.0) and R6.24 module administration (REQ-000048, on catalyst 0.86.0) done; R6.48 team work in progress (REQ-000052, on module 3.4.0's assignee, decision B9) done. R6.26 the Inbox's unread count (REQ-000050), R6.27 the audit pack (REQ-000051, on catalyst 0.87.0) and R6.49 the desktop transport with R6.20's Studio window (REQ-000049) done, for 0.52.0; R6.28's web component, `<catalyst-entity>` in `embed.js` (REQ-000053, decision B8; catalyst 0.87.0 has its README badge and the allowed origins), and the Gantt view (REQ-000052, decision B9, module 3.4.0's dates) done, for 0.52.0. R6.20's packaging for macOS, Windows and Linux and the `Desktop` release workflow (REQ-000054) done, for 0.53.0, signing waiting on the owner's keys and auto-update on the feed's choice; the UI reads commands, users, roles and definitions through catalyst (R5.3, REQ-000055, REQ-000056); R6.25 IAM administration and the share panel (REQ-000057, on catalyst 0.90.0's `GET /v1/share`) done, for 0.54.0; R6.20's bundled catalyst (REQ-000058: the pinned kernel's `catalyst.pyz`, run by Python 3.11 or later when no catalyst is installed) done, for 0.55.0; R6.29 disabled (C6, 2026-10-19: D3 holds, revisited if a module needs it); R6.21 rewritten as the `brand` roadmap (C5); brand items 8 (FEAT-000010) and 4 (FEAT-000011, REQ-000059: Codicons in the inspector, a placeholder mark of our own, no image of unknown licence) done, for 0.54.1 and 0.56.0; R7's second module, risk management, is published (`cantica-tech/catalyst-risk-management` 0.1.0).

### R6.D — Desktop and brand

| #     | Deliverable                                                                                                                   | Notes                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| R6.20 | Electron shell with the engine as a sidecar, hardened renderer, signing, auto-update from an org-owned feed                   | `09` D5 decided; the Tauri spike on `explore/tauri-shell` is reviewed here |
| R6.21 | ~~Brand identity and naming~~ **Rewritten as its own roadmap** (2026-10-19, C5): the `brand` roadmap, `RM-000032`…`RM-000043` | spike [`25`](design/25-brand-spike.md); workflow `WORKFLOW-000001`         |

### R6.E — Operating at scale (P2; after 1.0 unless a pilot needs one)

| #     | View                                                                                               | Needs                                                                      |
| ----- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| R6.22 | Token and cost meter per command and per session                                                   | R5.5 token usage                                                           |
| R6.23 | Analysis workspace: findings triaged as real, false or deferred, with a prepared brief for the fix | `analysis`                                                                 |
| R6.24 | Module administration and release centre: install, upgrade, remove, with what each would change    | R4.9                                                                       |
| R6.25 | IAM administration; share panel (push, pull, conflicts)                                            | `user`, `role`, `share`                                                    |
| R6.26 | Notifications                                                                                      | R5.7                                                                       |
| R6.27 | Audit pack: the chain from rule to test as PDF or HTML                                             | `graph`, `journal`                                                         |
| R6.28 | Embeds: a web component and a README badge                                                         | `serve`                                                                    |
| R6.29 | **Disabled** (2026-10-19, C6): Sandboxed module UI (iframe, postMessage, CSP, signature)           | revisit only if a module needs what `module.yaml` cannot express; D3 holds |

**Exit (R6.A–D):** the same bundle runs at localhost, in VS Code and on the desktop; the second module
(`sample-process`) renders with no UI change; a newcomer finds why an artifact exists in under three minutes; the
Problems panel equals `catalyst check`.

**Where the folder was corrected when integrated:**

- **Phases.** It placed P0 in R5, P1 in R6 and P2 in R7. Here R5 stays the engine, the views are R6.B and R6.C, and
  P2 is R6.E after 1.0, so that R7 remains the release. This placement is a proposal for the owner.
- **Effort.** It sums to about 61 weeks of work for 3.5 people over 2027. This roadmap is one developer with an
  agent; R6 was "6+ weeks". Neither figure is a plan yet: R6.A and R6.B are to be estimated against the existing
  views before starting.
- **What exists.** It counts "five basic React views". The UI repository's README lists a chain inspector, a health
  board, a proposal loop, an authoring composer, a run monitor and an agent window, reading through catalyst since
  0.54.0. The "Today" column above comes from that README and was not checked against the code.
- **Budgets.** Its token and performance targets (15k tokens for a first session, 500 graph nodes at 16 ms, P95
  under 200 ms) are kept as targets to measure, not as commitments.
- **Its own index.** Its README names `05-interactive-experiences.md` and `06-implementation-roadmap.md`; the files
  are `05-implementation-roadmap.md` and no interactive-experiences note exists.
- **ADRs in the record.** Its diagrams show ADRs as entities of the record; catalyst has no such type today.
