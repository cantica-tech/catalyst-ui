# How Modules Work in Catalyst UI

_As of 2026-09-26: catalyst 0.36.0, software-engineering module 2.0.0, catalyst UI 0.32.0._

A module is a versioned zip bundle for one process domain, built from its own
`catalyst-<module-id>` repository. The catalyst UI VS Code extension finds it
on cantica-tech, checks it against the **kernel** version, activates it, and
keeps a local copy. Only one UI module is active at a time.

## Terms

| Term           | Meaning                                                                                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework      | The whole of catalyst: the kernel plus its process modules.                                                                                                                                                                                           |
| Kernel         | The part of the framework independent of modules, in `framework/kernel/` in the catalyst repo. Versioned by catalyst's root `version.txt`. Released as `kernel-v<version>.zip`.                                                                       |
| Process module | Entity types (ETDs), templates, slash commands and a grounding type, defined by `module.yaml` (`framework/kernel/MODULE-SPECIFICATION.md`). Used by agents and the kernel loaders (`scripts/module_loader.py`, `catalyst-core/src/module-loader.ts`). |
| UI module      | The same bundle zipped with a `manifest.json` plus React components under `ui/`. Used by the extension (`catalyst-core/src/ui-module-manager.ts`, `remote-module-store.ts`).                                                                          |

## Where modules live

Each module is a full repository of its own, checked out **next to** catalyst.
It is no longer a catalyst submodule: `framework/modules/software-engineering`
was removed in 0.35.0.

```
sources/
├── catalyst/                          # framework/kernel/ + framework/modules/sample-process only
├── catalyst-software-engineering/     # the module repo (origin: catalyst-software-engineering.git)
├── catalyst-ui/                       # the extension; the module's ui/ builds against it
└── cantica-tech/                      # published releases
```

The sibling layout is load-bearing. Three things look for a module there:

| Consumer                                      | Where it looks                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `task release` (`scripts/package_release.py`) | `../catalyst-<id>/` for each module in `framework/modules/catalog.md`; skips any that is not checked out                                 |
| `scripts/module_loader.py`                    | `.criterion/modules/<id>`, then `framework/modules/<id>`, then `../catalyst-<id>/`; no built-in module, returns nothing if none is found |
| Module `ui/tsconfig.json`                     | `../../catalyst-ui/` for `catalyst-core` types (built `dist/index.d.ts`), `react` and `marked`                                           |

`.vscode/catalyst.code-workspace` opens all four folders together.

## Anatomy of a module repo

```
catalyst-software-engineering/
├── module.yaml                 # manifest: entity_types, commands, templates, definitions, required_paths, contributions
├── version.txt                 # module version (2.0.0), read by the release task
├── schemas/                    # one ETD per entity type: BUG, REQ, HK, TEST, STEP, FEAT, RM
├── templates/                  # <entity>.template.md, index and backlog templates
├── definitions/                # DEFINITION-<PREFIX>-vN.md per entity type
├── commands/                   # slash-command specs: create-req, create-bug, roadmap-add, ...
├── rules-of-rules.module.md    # module meta-rules, appended to the deployed Rules-of-Rules
├── code-of-conduct.module.md   # module document types and commands (CODE-OF-CONDUCT §3/§4)
├── INVARIANTS.module.md        # module invariants
├── Taskfile.module.yml         # one dispatch task per module command
├── migrations/                 # module migrations + migrations.md
├── ui/                # npm package @catalyst-modules/software-engineering-ui
│   ├── index.ts       # exports Backlog, RoadmapDetails
│   ├── Backlog.tsx
│   ├── RoadmapDetails.tsx
│   └── tsconfig.json  # outDir dist/
└── catalyst/modules/software-engineering/v<version>/   # release output, committed
    ├── manifest.json
    └── software-engineering-v<version>.zip
```

### The UI manifest (`manifest.json`)

The extension reads only this file. `parseUiModuleFromZip` checks the required
fields.

| Field              | Required | Example                               | Meaning                                                                                                                                                                                                        |
| ------------------ | -------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | Yes      | `software-engineering`                | Unique id; also the folder name on cantica-tech                                                                                                                                                                |
| `name`             | Yes      | `Software Engineering Process Module` | Label in the module picker                                                                                                                                                                                     |
| `version`          | Yes      | `2.0.0`                               | Module version; release folder is `v<version>`                                                                                                                                                                 |
| `kernelVersion`    | Yes      | `>=0.36.0`                            | UV-style specifier the active kernel must satisfy.                                                                                                                                                             |
| `frameworkVersion` | Legacy   | `>=0.36.0`                            | Old name of `kernelVersion`, written with the same value. Extension builds before 0.31.0 read only this field. catalyst UI 0.31.0+ prefers `kernelVersion` and falls back to it (`readManifestKernelVersion`). |
| `description`      | No       |                                       | Picker detail line                                                                                                                                                                                             |
| `entry`            | No       | `ui/index.js`                         | Entry script for the UI code (declared, not executed yet)                                                                                                                                                      |
| `components`       | No       |                                       | Reserved                                                                                                                                                                                                       |

The loader looks for `manifest.json`, then `ui-module.json`, then `module.json`,
first at the zip root and then in any subfolder.

## Lifecycle in the extension

```mermaid
flowchart LR
  A[Discover<br/>fetchRemoteUiModules] --> B[Pick<br/>QuickPick]
  B --> C[Download<br/>downloadModuleZip]
  C --> D{Validate<br/>kernelVersion}
  D -- ok --> E[Activate<br/>UiModuleManager]
  D -- fails --> X[Error message]
  E --> F[Persist<br/>active-module.zip]
  F -. next start .-> G[Restore<br/>loadLocalSavedModule]
```

This is the "Catalyst: Switch Process UI Module…" path. "Load Zipped UI
Module…" skips discovery and download.

1. **Discover.** `fetchRemoteUiModules(catalyst.moduleSourceUrl)` defaults to
   `git@github.com:cantica-tech/cantica-tech.git/catalyst/`.
   `parseArtifactSourceLocation` accepts a Git SSH URL with a path, a GitHub
   tree URL, a `git+https://…#branch:path` URI, a raw.githubusercontent URL, or
   a local path. It derives `moduleSubpath` (`catalyst/modules`) and
   `kernelSubpath` (`catalyst/kernel`; a legacy `…/framework` path maps to
   `…/kernel`). It tries three strategies and stops at the first that finds
   modules:
   1. Local folder scan, for `/path` or `file://` sources.
   2. Git CLI: a shallow clone cached in `<os tmp>/catalyst-git-remotes/<sha256(url)[:12]>`, then a scan. Works for private repos over SSH.
   3. GitHub REST API: the recursive tree plus raw manifest fetches. For public repos when `git` is missing.

   A scan expects `<modules>/<id>/v<version>/manifest.json` next to a zip,
   preferring `<id>-v<version>.zip`. Manifests without `id`, `version` and a
   kernel specifier are ignored; duplicate `id@version` pairs are dropped.

2. **Pick and download.** One QuickPick row per module; `downloadModuleZip`
   reads local paths and fetches `http` URLs.
3. **Validate and activate.** `UiModuleManager.loadAndActivateZipModule(zip,
kernelVersion)` unzips in memory, checks the manifest, and tests the
   specifier with `satisfiesUvVersionSpecifier` (`>=`, `<=`, `>`, `<`, `==`,
   `!=`, `~=`, `*`, comma-separated clauses combined with AND). On success it
   deactivates the current module and stores the new one, all files included.
   The kernel version checked is, in order: the one set with "Load Specific
   Kernel Version in Memory…", else the first deployment's
   `.criterion/version.txt`, else `REQUIRED_KERNEL_VERSION`.
4. **Persist and restore.** The zip is saved as
   `<globalStorageUri>/active-module.zip` (one slot) and restored at startup.
   If a workspace folder has no catalyst pointer and no module is active, the
   picker opens automatically.

## Integration contract with catalyst UI

A module plugs in through its manifest, the kernel-version check, and the
host's commands and settings. Its UI code is shipped and held in memory, but
catalyst UI does not run it yet.

| Kind    | Id                             | What it does                                                                                   |
| ------- | ------------------------------ | ---------------------------------------------------------------------------------------------- |
| Command | `catalyst.switchUiModule`      | Discover, pick, download, activate, persist                                                    |
| Command | `catalyst.loadUiModule`        | Activate a local `.zip`, persist it, refresh the tree and panels                               |
| Command | `catalyst.selectKernelVersion` | Set the in-memory kernel version and activate a placeholder `software-engineering-ui` manifest |
| Setting | `catalyst.moduleSourceUrl`     | Where modules are listed (default `cantica-tech.git/catalyst/`)                                |
| Setting | `catalyst.kernelSourceUrl`     | Where kernel releases are listed (default `cantica-tech.git/catalyst/kernel/`)                 |

On the kernel side, catalyst-core's `resolveModuleId` reads the `*.catalyst`
pointer's `module` field, then `.criterion/config.yaml` `module:` or
`.criterion/module.yaml` `id:`, and returns `undefined` when none is declared;
there is no default module. `loadModule` reads the module's own `module.yaml`
and ETD schemas from the deployment's `modules/<id>/` (or a sibling
`catalyst-<id>/` checkout). Since catalyst 0.36.0 the kernel itself names no
module: reconciliation (`RECON-`) and workflows (`WORKFLOW-`) are kernel
entities, and everything else comes from the module (MODULE-SPECIFICATION §6).

**Rendering.** A compile-time link (the module's `ui/` as an npm workspace of
catalyst UI, `eff7eb8`) was tried and reverted in `0616dbc`. It tied catalyst
UI's build to one module and ruled out switching at runtime. `Backlog` and
`RoadmapDetails` therefore exist twice: live in `catalyst-ui/src`, and shipped
but not rendered in the module's `ui/`. The missing piece is a runtime hook in
the webview that loads `manifest.entry` from `ActiveUiModule.files`.

## Build, packaging and release

`task release` in catalyst runs `scripts/package_release.py`:

1. **Modules.** For each module in catalyst's `framework/modules/catalog.md`
   checked out as `../catalyst-<id>/`, it writes
   `manifest.json` (`kernelVersion` and legacy `frameworkVersion`, both
   `">=<kernel version>"`, and `entry: "ui/index.js"`) and zips the repo into
   `catalyst/modules/<id>/v<version>/`. It skips dotfiles,
   `node_modules`, `dist` and `catalyst/`, then commits and pushes to the
   module repo's `main`.
2. **Kernel.** Zips `framework/kernel/` into
   `catalyst/kernel/v<version>/kernel-v<version>.zip` (manifest id
   `catalyst-kernel`).
3. **Deploy.** Copies both release folders into `../cantica-tech/`, regenerates
   its READMEs from the manifests, then commits and pushes to `main`.

```
cantica-tech/catalyst/
├── kernel/v0.34.0 … v0.45.0/{manifest.json, kernel-v<version>.zip}
└── modules/software-engineering/v1.0.0, v2.0.0, v2.3.0, v2.3.1/{manifest.json, software-engineering-v<version>.zip}
```

| Date       | Release            | What it published                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-08 | catalyst UI 0.38.0 | Hardened Electron host, sanitised Markdown, validator aligned with the kernel; works with kernel >=0.46.0                                                                                                                                                                                                                                                                                          |
| 2026-10-17 | catalyst UI 0.47.0 | The Studio acts through its host (decision W1): inbox settling, board moves and batch moves, rollback from the history, the dashboard's Settle…; Apache-2.0; listed as Catalyst Studio; works with kernel >=0.54.0 (actions need 0.76.0, rollback 0.77.0)                                                                                                                                          |
| 2026-10-17 | catalyst UI 0.48.0 | The Studio's read side finished: drift marked wherever an entity is shown, rule coverage on the dashboard, the run history with its cost, side-by-side and two-version diffs, journal grouping, a tinted map, a trace filter and impact marks; works with kernel >=0.54.0 (findings, coverage and runs need 0.78.0)                                                                                |
| 2026-10-17 | catalyst UI 0.48.1 | Each chain inspector panel is titled with its project first, "<name> (chain inspector)"; works with kernel >=0.54.0                                                                                                                                                                                                                                                                                |
| 2026-10-17 | catalyst UI 0.49.0 | Approval gates in the Studio: what waits for an approval in the inbox and the Approvals view, an entity's gates on its page, approved through the host; works with kernel >=0.54.0 (gates need 0.80.0)                                                                                                                                                                                             |
| 2026-10-18 | catalyst UI 0.50.0 | Proposals in the Studio (the proposed change beside the current text, decided through the host) and Try it (an action's effect from `catalyst try`, shown before it is made); works with kernel >=0.54.0 (proposals need 0.81.0, Try it 0.82.0)                                                                                                                                                    |
| 2026-10-18 | catalyst UI 0.51.0 | Rule strength in the Studio (a rule's page says its strength and what a breach is reported as; the rule browser marks and filters by it) and entity labels that repeat nothing in brackets they already start with; works with kernel >=0.54.0 (strength needs 0.83.0)                                                                                                                             |
| 2026-10-18 | catalyst UI 0.52.0 | The analysis workspace, module administration, the Inbox's unread count, the audit pack, and the Studio on the desktop (a served window, the preload bridge, native confirmations); works with kernel >=0.54.0 (analyses need 0.85.0, modules 0.86.0, the audit pack 0.87.0); each person's open work and a roadmap's Gantt chart (B9); `embed.js`, an entity embedded in another site's page (B8) |
| 2026-10-18 | catalyst UI 0.53.0 | The desktop app shipped for macOS, Windows and Linux (packaged, built on each release, signed once its keys exist), and the UI reads commands, users, roles and definitions through catalyst (R5.3); works with kernel >=0.54.0 (the served definitions need 0.88.0)                                                                                                                               |
| 2026-10-18 | catalyst UI 0.54.0 | IAM administration (register, add a role, deactivate) and a share panel (what is not published, pull, publish) in the Studio, through the host (R6.25); works with kernel >=0.54.0 (the share panel needs 0.90.0)                                                                                                                                                                                  |
| 2026-10-19 | catalyst UI 0.54.1 | The default module and kernel sources name the organisation's public distribution repository (BUG-000003); the maker is CanticaTech; works with kernel >=0.54.0                                                                                                                                                                                                                                    |
| 2026-10-19 | catalyst UI 0.55.0 | The desktop app carries its own catalyst (kernel 0.90.0's `catalyst.pyz`), run by Python 3.11 or later when no catalyst is installed (R6.20); works with kernel >=0.54.0                                                                                                                                                                                                                           |
| 2026-10-19 | catalyst UI 0.55.1 | The desktop app ships kernel 0.92.0's `catalyst.pyz`, now published; works with kernel >=0.54.0                                                                                                                                                                                                                                                                                                    |
| 2026-10-19 | catalyst UI 0.56.0 | The chain inspector's icons are VS Code's own, and the extension's and desktop app's icons a placeholder mark of our own: no image of unknown licence (brand item 4); works with kernel >=0.54.0                                                                                                                                                                                                   |
| 2026-10-19 | catalyst UI 0.56.1 | The desktop app ships kernel 0.96.0's `catalyst.pyz`, now published; works with kernel >=0.54.0                                                                                                                                                                                                                                                                                                    |
| 2026-10-20 | catalyst UI 0.56.2 | The desktop app ships kernel 0.100.1's `catalyst.pyz`; works with kernel >=0.54.0                                                                                                                                                                                                                                                                                                                  |
| 2026-10-20 | catalyst UI 0.56.3 | The desktop app ships kernel 0.101.0's `catalyst.pyz`; works with kernel >=0.54.0                                                                                                                                                                                                                                                                                                                  |
| 2026-10-20 | catalyst UI 0.57.0 | The Studio's types for what catalyst prints are generated from catalyst's `spec/` (kernel 0.101.2), which fixed a rule with no status line and a closed table row on the map; the desktop app ships kernel 0.101.2; works with kernel >=0.54.0                                                                                                                                                     |
| 2026-10-21 | catalyst UI 0.58.0 | The audit pack marks a meta-rule and never counts it as a rule nothing rests on; `try`'s impact typed; `spec/` and the desktop app's kernel held equal by a test; the desktop app ships kernel 0.102.1; works with kernel >=0.54.0                                                                                                                                                                 |
| 2026-10-22 | catalyst UI 0.59.0 | The inbox shows overdue entities (catalyst's workflow governance); an entity's page lists a governing workflow's moves; the desktop app ships kernel 0.104.1; works with kernel >=0.54.0                                                                                                                                                                                                           |
| 2026-10-23 | catalyst UI 0.60.0 | In VS Code, the IAM settings name the account catalyst uses locally: keycloak, its URL, a user name, and a password entered masked into secret storage or printed by a command; works with kernel >=0.54.0                                                                                                                                                                                         |
| 2026-10-23 | catalyst UI 0.61.0 | In VS Code, the IAM settings point to catalyst-users: a provider pointer (provider, issuer, client) replaces Keycloak's URL; works with kernel >=0.54.0                                                                                                                                                                                                                                            |
| 2026-10-23 | catalyst UI 0.62.0 | In VS Code, the IAM settings name the catalyst-users command (catalyst-users 0.3.0, a facade to any identity provider); the system account is whoever it signs in, and the extension holds no credential; works with kernel >=0.54.0                                                                                                                                                               |
| 2026-10-24 | catalyst UI 0.63.0 | The Studio follows catalyst 0.106.0: from that kernel the Team view offers no user or role form and says people are catalyst-users'; spec/ and the desktop app at 0.106.0; works with kernel >=0.54.0                                                                                                                                                                                              |
| 2026-10-24 | catalyst UI 0.64.0 | The app icons are the owner's flask again (the extension, its activity bar and the desktop app), its licence recorded in brand/README.md; works with kernel >=0.54.0                                                                                                                                                                                                                               |
| 2026-10-24 | catalyst UI 0.64.1 | The desktop app ships kernel 0.109.0 (a criterion's admins, `catalyst serve --criterion`, the Criterion Admin role) and `spec/` follows it (`identity whoami` reports `administers`); works with kernel >=0.54.0                                                                                                                                                                                   |
| 2026-10-25 | catalyst UI 0.64.2 | The desktop app ships kernel 0.111.0 (catalyst-users 0.6.0: its home is `~/.catalyst/users`), and the IAM command setting names that home; works with kernel >=0.54.0                                                                                                                                                                                                                              |
| 2026-10-16 | catalyst UI 0.46.0 | The Studio's richer views (journal timeline and entity history with diffs, board, type map, roadmap, rule browser, approvals, team, search) and, in VS Code, the agent console (a confirmed run streamed with its cost); works with kernel >=0.54.0 (a rule's text and the console need 0.76.0)                                                                                                    |
| 2026-10-16 | catalyst UI 0.45.0 | The Studio's inbox (each item waiting, a page with its evidence and copyable settling commands) and command palette (the deployment's commands, Ctrl/⌘+K, each with its procedure and a composed slash command); the dashboard no longer fails when anything waits; works with kernel >=0.54.0 (the palette needs 0.75.0)                                                                          |
| 2026-10-16 | catalyst UI 0.44.0 | The Studio's dashboard (health, what waits with the commands that settle it, open work, versions, activity) and traceability explorer (trees and an elkjs graph on each entity page); works with kernel >=0.54.0 (versions need 0.74.0)                                                                                                                                                            |
| 2026-10-16 | catalyst UI 0.43.0 | The chain tree follows the module's declared types: one section per type under its plural name, marks from each type's states, artifacts nested under what they cite; no UI package names a module type; works with kernel >=0.54.0 (types from catalyst graph)                                                                                                                                    |
| 2026-10-16 | catalyst UI 0.42.0 | The Studio's Artifacts view and entity page: fields, sections, the moves an artifact may make and what blocks them, citers and journal, from the module's types (kernel >=0.73.0); works with kernel >=0.54.0                                                                                                                                                                                      |
| 2026-10-16 | catalyst UI 0.41.0 | The Studio: one accessible bundle (design tokens, light and dark, keyboard and screen reader) read through catalyst serve, in the browser and in VS Code (Open Studio, kernel >=0.64.0); works with kernel >=0.54.0                                                                                                                                                                                |
| 2026-10-16 | catalyst UI 0.40.0 | The VS Code extension split behind a host port; `catalyst-app-model` holds what the views show; the proposal loop, composer and run monitor removed; works with kernel >=0.54.0                                                                                                                                                                                                                    |
| 2026-10-11 | catalyst UI 0.39.0 | Reads every project through catalyst serve (graph, check, journal, events); the old parser removed; starts in a catalyst project; works with kernel >=0.54.0                                                                                                                                                                                                                                       |
| 2026-10-02 | catalyst UI 0.37.2 | One "not yet" marker in the chain tree: … for requirements, features, steps, tests and roadmap items                                                                                                                                                                                                                                                                                               |
| 2026-10-02 | catalyst UI 0.37.1 | Requirement and feature status markers: ✅ implemented, ⏳ in progress, ⃠ not implemented yet, 🗑 abandoned                                                                                                                                                                                                                                                                                         |
| 2026-10-02 | catalyst UI 0.37.0 | One chain inspector panel per deployment; the entity a panel shows is tracked in the tree; Journal/Backlog entries; no duplicate artifacts                                                                                                                                                                                                                                                         |
| 2026-10-01 | catalyst UI 0.36.0 | Remote, WSL, dev containers: runs where the files are; unreachable working copies reported with a fix; virtual workspaces unsupported                                                                                                                                                                                                                                                              |
| 2026-10-01 | catalyst UI 0.35.0 | Workspace-aware: nested deployments, `.catalystignore` and `catalyst.ignoredFolders`, install-offer opt-outs, Workspace Trust, status bar; kernel `>=0.45.0`                                                                                                                                                                                                                                       |
| 2026-10-01 | catalyst 0.45.0    | `kernel-v0.45.0.zip`; what a deployment governs (nested deployments, `.catalystignore`), routing commit-msg hook                                                                                                                                                                                                                                                                                   |
| 2026-09-30 | catalyst 0.44.1    | `kernel-v0.44.1.zip`; module releases state their kernel; software-engineering module 2.3.1                                                                                                                                                                                                                                                                                                        |
| 2026-10-01 | catalyst UI 0.34.0 | Detail panels: one editor group per project (`catalyst.detailPanelGroups`); entity references are links with a hover                                                                                                                                                                                                                                                                               |
| 2026-09-30 | catalyst UI 0.33.2 | Extension paired with kernel `>=0.44.0`; deployment synced to kernel 0.44.0                                                                                                                                                                                                                                                                                                                        |
| 2026-09-30 | catalyst 0.44.0    | `kernel-v0.44.0.zip`; four-eyes analysis of existing code (`ANALYSIS-`, `/run-analysis`), playbook deployed                                                                                                                                                                                                                                                                                        |
| 2026-09-30 | catalyst 0.43.0    | `kernel-v0.43.0.zip`; `criterion create` without a URL                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-30 | catalyst 0.42.2    | `kernel-v0.42.2.zip`; reproducible release archives                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-29 | catalyst UI 0.33.1 | Extension paired with kernel `>=0.42.1`; deployment synced to kernel 0.42.1                                                                                                                                                                                                                                                                                                                        |
| 2026-09-29 | catalyst 0.42.1    | `kernel-v0.42.1.zip`; module release archives always land on the module repo's `main`                                                                                                                                                                                                                                                                                                              |
| 2026-09-29 | catalyst 0.42.0    | `kernel-v0.42.0.zip` (0.37.0–0.42.0: `.criterion`, the catalyst CLI, criterion on git, tiers, traced commits, changes made outside catalyst); software-engineering module 2.3.0                                                                                                                                                                                                                    |
| 2026-09-28 | catalyst UI 0.33.0 | Extension resolving the working copy through `.criterion` (catalyst 0.37.0+); `.vsix` also kept in cantica-tech `catalyst/vsix/`                                                                                                                                                                                                                                                                   |
| 2026-09-26 | catalyst UI 0.32.0 | Extension with catalyst-core's module loader reading module.yaml (no built-in module)                                                                                                                                                                                                                                                                                                              |
| 2026-09-26 | catalyst 0.36.0    | `kernel-v0.36.0.zip`; module-agnostic kernel; software-engineering module 2.0.0, requiring `>=0.36.0`                                                                                                                                                                                                                                                                                              |
| 2026-09-25 | catalyst 0.35.2    | `kernel-v0.35.2.zip`; module 1.0.0 manifest with both fields, requiring `>=0.36.0`                                                                                                                                                                                                                                                                                                                 |
| 2026-09-25 | catalyst 0.35.1    | `kernel-v0.35.1.zip`; `/sync-kernel` withdrawn, `/sync-framework` kept                                                                                                                                                                                                                                                                                                                             |
| 2026-09-25 | catalyst 0.35.0    | First kernel release; `catalyst/framework/` renamed `catalyst/kernel/` on cantica-tech                                                                                                                                                                                                                                                                                                             |
| 2026-09-25 | catalyst UI 0.31.0 | Extension on the Marketplace with the kernel settings and commands                                                                                                                                                                                                                                                                                                                                 |

## Authoring a new module

- [ ] Create a `catalyst-<id>` repository and clone it next to catalyst. Don't add it as a submodule.
- [ ] Write `module.yaml` per `framework/kernel/MODULE-SPECIFICATION.md`, with ETDs, templates and command specs.
- [ ] Add `version.txt` and bump it on every release, or the new zip overwrites the old version folder.
- [ ] Put UI components in `ui/`, exported from `index.ts`, and build them before releasing.
- [ ] Generalize `scripts/package_release.py`: the module id, name and repo folder are hard-coded for software-engineering.
- [ ] Release, then check that "Switch Process UI Module…" lists the module and activates it on the target kernel version.

## Known pitfalls

| Pitfall                                         | Where                                                                                          | Effect                                                                                                                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No compiled UI in the next release              | Module `ui/` builds to `dist/`, which the zip skips; `ui/*.js` is gitignored                   | `entry: ui/index.js` points at a file the zip won't contain. The old submodule checkout only shipped JS by accident, via stale local build files.                                        |
| Saved module restored against the wrong version | `activate()` passes `REQUIRED_KERNEL_VERSION` (`">=0.31.0"`, a specifier) as a version         | Read as 0.31.0, so a saved module needing `>=0.34.0` silently fails to restore on every start                                                                                            |
| Same fallback in the load commands              | `loadUiModule`, `switchUiModule`                                                               | A workspace with no deployment is checked as 0.31.0                                                                                                                                      |
| Build depends on sibling checkouts              | Module `ui/tsconfig.json` → `../../catalyst-ui`; types come from catalyst-core's built `dist/` | Build catalyst-ui first; the module won't compile outside the sibling layout                                                                                                             |
| Components duplicated                           | `catalyst-ui/src` vs the module's `ui/`                                                        | Fixes must land twice until runtime rendering exists                                                                                                                                     |
| Legacy release folder                           | Module repo still tracks `catalyst/module/` (singular)                                         | Dead copy of v1.0.0; discovery accepts both spellings                                                                                                                                    |
| Requirement follows the latest kernel           | `package_release.py` writes `>=<current kernel>`                                               | Re-releasing a module without bumping its version raises the requirement in place (v1.0.0 did this until 0.35.2); bump the module version on every release                               |
| Dropping `frameworkVersion` hides the module    | Manifest fields                                                                                | catalyst 0.35.0–0.35.1 published only `kernelVersion`, and extensions before 0.31.0 reported "No process UI modules found". Fixed in 0.35.2; keep writing both until old builds are gone |

## Open questions

- How should the webview load `manifest.entry`: as a bundled IIFE like `dist/webview.js`, or via dynamic `import()` from a webview URI?
- Should `kernelVersion` stay pinned to `>=<kernel version at release>`, or should module authors declare a fixed minimum (for example in `module.yaml`)?
