# 23 — R6.A and R6.B against the views that exist (estimate for the owner, 2026-10-15)

> **R6.A and R6.B done (2026-10-16), except the agent console (waits for R5.5).** R6.5 and R6.6 (dashboard), R6.3
> (traceability explorer) in UI 0.44.0; R6.4 (inbox: each item waiting a page with its evidence and copyable settling
> commands, UI REQ-000026) and R6.8 (command palette from kernel 0.75.0's `GET /v1/commands` and `GET /v1/spec`, Ctrl/⌘+K,
> kernel REQ-000046, UI REQ-000027) in UI 0.45.0, with BUG-000002 (the 0.44.0 dashboard failed to render as soon as anything
> waited: the inbox's evidence is an object). Settling stays read-only (decision 3). Next: R6.C, or R5.5 for the console.
>
> **R6.7 done (2026-10-16, kernel 0.73.0, UI 0.42.0 and 0.43.0, REQ-000044 and UI REQ-000023):** `view` gives an
> artifact's sections and next states, `graph` each type's transitions, guards and sections; the Studio's Artifacts view
> and entity page; the chain model and the VS Code tree follow the module's declared types, `DevArtifactType` and every
> named module prefix removed from the UI. Next: R6.5 and R6.6 (dashboard and drift), R6.3, R6.4, R6.8.
>
> **R6.2 done (2026-10-16, UI 0.41.0, REQ-000022, rule `studio-SHELL-000001`):** `packages/catalyst-studio`: design
> tokens, light and dark themes, an accessible shell (axe clean, every text colour at 4.5:1), a client that reads catalyst
> only over HTTP (token from the fragment, events through `fetch`) and a live overview; the same bundle under
> `catalyst serve --static` and, in VS Code, _Open Studio_ framing its own server's page. Next: R6.7, the entity page.
>
> **R6.1 done (2026-10-16, UI repository REQ-000021):** `extension.ts` split into modules (2,256 → 931 lines); a
> `HostPort` in `catalyst-core` with its VS Code adapter, every VS Code-bound module under `src/vscode/` (a test keeps
> `vscode` out of the rest); `packages/catalyst-app-model` with the tree, roadmap, IAM and node-detail selectors;
> `PROP-`/`RUN-` dropped, their rules retired. Onboarding stays VS Code code until a second host needs it.
>
> **R6.0 done (2026-10-16):** the UI repository's deployment synced to kernel 0.71.0 and module 3.2.0 in two
> shared steps (criterion PRs 43 and 44), `catalyst check` passes; the UI's client still has to read the new routes.
>
> **Status: decided (owner, 2026-10-16).** All six decisions as recommended: `packages/studio` in the UI repository;
> HTTP to `catalyst serve --local` in every host; read-only first views (settling runs the CLI from VS Code, a
> browser shows the command); `elkjs` for layout; `PROP-` and `RUN-` dropped; axe clean in CI. Order as in §3.
>
> Was: draft for the owner. `06` says R6.A (foundations) and R6.B (first views) must be estimated against the
> existing views before starting. This note does that from the UI repository's code at its `development` head
> (`b3a2a1a`, UI 0.39.0), not from its README. It proposes an order and lists the decisions to take first.

## 1. What exists (measured)

| Area             | Found in the code                                                                                                                                                                                                 | Against R6                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Reading          | `catalyst-core` reads through `catalyst serve --local` (`graph`, `check`, `events`, `journal`); the TS parser is gone (REQ-000020)                                                                                | R6's data path is in place                                             |
| Engine version   | the UI's own deployment is at kernel 0.56.0; `impact`, `history`, `inbox` and `--static` need 0.61.0 to 0.64.0                                                                                                    | a sync to 0.68.0 comes first                                           |
| VS Code host     | `extension.ts`, 2,256 lines, 186 `vscode.` uses; four more files use `vscode`                                                                                                                                     | R6.1 is still the whole split                                          |
| Views, VS Code   | one tree (the chain inspector, five slots, its validation section as the "health board"); webview panels from `catalyst-ui`: node detail, IAM detail, journal, backlog, kernel-version header (React 18, esbuild) | the five panels are reusable; none is a dashboard, an inbox or a graph |
| Views, Electron  | a graph view and an agent window, its own state; argv launch (B-01 fixed)                                                                                                                                         | a prototype; nothing shared with VS Code                               |
| Module knowledge | `DevArtifactType` (bug, requirement, house-keeping, test) hard-coded: 16 uses in 6 files                                                                                                                          | R6.7 has to remove it                                                  |
| UI-only entities | `PROP-` proposals and `RUN-` runs written by the UI, outside the journal                                                                                                                                          | `09` §1's Law-1 gap is still open                                      |
| Tests            | about 460 cases (vitest)                                                                                                                                                                                          | a base to keep green through the split                                 |

The README's "proposal loop", "composer" and "run monitor" are small: 56, 36 and 36 lines over the tree.

## 2. Estimate

In working sessions of one developer with an agent, the unit this project has shipped at: R5.6 to R5.9, four
engine additions with tests and schemas, took about four sessions. UI work costs more per item: visual review,
accessibility, two hosts.

| Item        | Work                                                                                                                                                                                               | Sessions            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| R6.0        | Sync the UI's deployment to kernel 0.68.0; its client reads the 0.61.0 to 0.64.0 routes                                                                                                            | 1                   |
| R6.1        | Split `extension.ts` into adapters; a `HostPort` (notify, pick, input, openExternal, clipboard, trust); `@catalyst/app-model` with the selectors; `PROP-`/`RUN-` through catalyst verbs or dropped | 4–6                 |
| R6.2        | `packages/studio`: tokens, light and dark, status as icon, word and colour, keyboard and screen reader, axe in CI; the same bundle under `serve --static` and in a VS Code webview                 | 5–8                 |
| R6.7        | Entity page from the module's types (fields, sections, transitions, guards); `DevArtifactType` removed                                                                                             | 3–4                 |
| R6.5 + R6.6 | Dashboard and drift, one page: check health, unrecorded changes, open work, versions, each with its fixing verb                                                                                    | 2–3                 |
| R6.3        | Traceability explorer: tree first, then a graph with a layout library                                                                                                                              | 3–4                 |
| R6.4        | Inbox, read side; settling per decision 3                                                                                                                                                          | 2–3                 |
| R6.8        | Command palette from `catalyst spec`; the agent console waits for R5.5                                                                                                                             | 2 (+2–3 after R5.5) |
| **Total**   | R6.A 10–15, R6.B 12–16                                                                                                                                                                             | **22–31**           |

That is five to seven weeks at a steady pace, for R6.A and R6.B only. `06`'s "6+ weeks" for all of R6 is low: R6.C
(eleven views) and R6.D (desktop and brand) come on top. The folder's 61 person-weeks assumed a team and a new
codebase; most of its P0 engine work is now done in the kernel.

## 3. Proposed order

R6.0, R6.1, R6.2, then R6.7 (the page every other view links to), R6.5 and R6.6, R6.3, R6.4, R6.8. One UI release
per item, as for the engine. The Electron host stays frozen until R6.D: it keeps building, it gets no new view.

## 4. Decisions for the owner

1. **Where the Studio lives**: a new `packages/studio` in the UI repository (recommended: the hosts mount it,
   `catalyst-ui`'s panels move into it as they are rebuilt), or the `catalyst-ui` package grown in place.
2. **Transport**: the Studio speaks HTTP to `catalyst serve --local` in every host (recommended: one client; the VS
   Code webview gets the URL and token from the extension, its CSP allows that loopback port), or `postMessage`
   through each host.
3. **Writes in the first views**: read-only Studio; a settling action runs the CLI through the host in VS Code and
   shows the command to copy in a browser (recommended: no new trust question), or writes over local HTTP now (the
   trust decision of `22` §3 first).
4. **Graph layout**: `elkjs`, layout only (recommended: small, renders with the design system's own SVG), or
   Cytoscape, a full graph widget.
5. **`PROP-` and `RUN-`**: dropped (recommended: proposals become a module's artifact or an analysis, runs wait for
   R5.5), or journaled through `catalyst journal append`.
6. **Accessibility gate**: axe clean on every Studio page in CI (recommended, the exit `06` sets), or advisory.
