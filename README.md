# catalyst-ui

A UI for [catalyst](https://github.com/oliben67/catalyst) that makes its
four-layer traceability chain (work items → dev artifacts → rules →
rules of rules) navigable in both directions, surfaces drift as it
happens, and lets a human author governed changes without ever
bypassing the agent. Ships as a VS Code extension and an Electron
desktop app, sharing one core and one UI package.

## Status

Shipping. All seven phases of the original roadmap are done — chain
inspector, health board, proposal loop, authoring composer, Electron
host, and run monitor — plus multi-root workspace support and an agent
window for running catalyst slash commands from either host. The VS
Code extension is published on the
[Marketplace](https://marketplace.visualstudio.com/items?itemName=CanticaTech.catalyst-host-vscode)
as **Catalyst framework**.

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

- `packages/catalyst-core` — TypeScript, no DOM. Parses the corpus,
  builds the typed chain model, runs global validation, watches files,
  and parses proposals and live agent runs.
- `packages/catalyst-ui` — React. All UI surfaces (chain inspector,
  health board, proposal/authoring composer, run monitor), mounted
  unchanged by both hosts.
- `packages/catalyst-host-vscode` — the published VS Code extension:
  thin adapter over the core↔UI protocol via `postMessage`, plus
  diagnostics, CodeLens, and code actions native to VS Code.
- `packages/catalyst-host-electron` — **experimental**, not released or
  packaged: a development prototype of a standalone desktop app (the
  same adapter pattern over IPC, plus multi-project tracking and a graph
  view). It opens repositories you choose and can start their agent, so
  run it only on repositories you trust; it has no packaging, signing or
  auto-update.

## Development

```sh
nvm use          # Node 20, pinned in .nvmrc
npm install
npm run lint
npm run typecheck
npm test
```

Or via [Task](https://taskfile.dev): `task --list` shows every available
task, including one per catalyst slash command (`task check-rules`,
`task show-backlog`, ...) from the deployed `Taskfile.common.yml`.

This project is itself governed by catalyst — see its `.criterion`
working copy (agent-owned, not in this repo) for the dev-environment
rules, the four product rule documents (`core`/`vscode`/`electron`/
`env`), and every requirement each change traces to.
