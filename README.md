# catalyst-ui

A UI for [catalyst](https://github.com/cantica-tech/catalyst) that makes its
four-layer traceability chain (work items → dev artifacts → rules →
rules of rules) navigable in both directions, surfaces drift as it
happens, and lets a human author governed changes without ever
bypassing the agent. Ships as a VS Code extension and an Electron
desktop app, sharing one core, one view model and one Studio.

## Status

Shipping. All seven phases of the original roadmap are done — chain
inspector, health board, Electron host — plus multi-root workspace
support, the Studio, and an agent console that runs a deployment's
commands through its agent after you confirm, in either host. The proposal
loop, authoring composer and run monitor were removed in R6.1 (0.40.0):
they wrote `PROP-`/`RUN-` files outside catalyst's journal. The VS Code
extension is published on the
[Marketplace](https://marketplace.visualstudio.com/items?itemName=CanticaTech.catalyst-host-vscode)
as **Catalyst Studio**; the desktop app of the same name is attached to
each [release](https://github.com/cantica-tech/catalyst-ui/releases).

Each release's `.vsix` is also kept on cantica-tech under
`catalyst/vsix/v<version>/`, next to a `manifest.json` whose
`kernelVersion` names the catalyst kernel versions it works with (set in
`packages/catalyst-host-vscode/package.json`, `catalyst.kernelVersion`).
`task publish:vscode-extension:release` (Marketplace) leaves that copy
automatically, in `../cantica-tech` unless `PUBLISH_DIR=...` is given,
with `KERNEL_VERSION=...` overriding the range. On its own, after cutting
a release, from any branch: `task release:vsix:publish
PUBLISH_DIR=<cantica-tech checkout>` builds the `.vsix` from the release
tag in a temporary worktree, then commits and pushes cantica-tech
(`release:vsix` copies the working tree's build without committing). A
release cut before `catalyst.kernelVersion` existed takes it on the
command line: `task release:vsix:publish PUBLISH_DIR=... --
--kernel-version '>=0.36.0'`.

## Packages

Six npm workspaces under `packages/`:

- `packages/catalyst-core` — TypeScript, no DOM. Reads a project through
  catalyst (`catalyst serve --local`, or a served criterion): the typed
  chain model, its validation and the journal come from catalyst's
  `graph`, `check` and `journal`, refreshed on its events; it needs
  catalyst 0.54.0 or later. Also the host port and the hosts' shared
  bridge to the Studio.
- `packages/catalyst-app-model` — what the views show (the tree, roadmap,
  IAM and node-detail selectors), computed from catalyst's model for every
  host to render; no host recomputes it.
- `packages/catalyst-ui` — React. The chain inspector and health board
  surfaces, mounted unchanged by both hosts.
- `packages/catalyst-studio` — the Studio: one accessible bundle
  (dashboard, inbox, board, journal, trace, rules, approvals and the other
  views) read through `catalyst serve`, in the browser, in VS Code and in
  the desktop app. Writes go through the host, after confirmation.
- `packages/catalyst-host-vscode` — the published VS Code extension:
  thin adapter over the core↔UI protocol via `postMessage`, plus
  diagnostics and CodeLens native to VS Code.
- `packages/catalyst-host-electron` — the desktop app, **Catalyst Studio**
  for macOS, Windows and Linux: the same adapter pattern over IPC, plus
  multi-project tracking and a graph view. The `Desktop` workflow builds
  and attaches it to each release (see [docs/desktop.md](docs/desktop.md)
  for building and signing). It opens repositories you choose and can
  start their agent, so run it only on repositories you trust; it has no
  auto-update yet.

## Development

```sh
nvm use          # Node 24, pinned in .nvmrc (CI runs 24)
npm install
npm run lint
npm run typecheck
npm test
```

Or via [Task](https://taskfile.dev): `task --list` shows this project's own
tasks. `task lint` also runs the cantica-tech standards' checks, from a
checkout of [cantica-tech/standards](https://github.com/cantica-tech/standards)
next to this repository (or `STANDARDS_DIR`); without one it stops and says
so. catalyst's commands are not in this Taskfile: `catalyst task` lists
them, from the criterion's own `Taskfile.common.yml` (`catalyst task
check-rules`, `catalyst task show-backlog`, ...).

This project is itself governed by catalyst: `catalyst.toml` at its root
names its criterion, kept outside the repository
(`~/.catalyst/projects/catalyst-ui/criterion`, found with `catalyst where`).
The criterion holds the dev-environment rules, the product rule
documents (core, VS Code host, Electron host, Studio), and every
requirement each change traces to.
