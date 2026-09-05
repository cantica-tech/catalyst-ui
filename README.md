# catalyst-ui

A UI for [catalyst](https://github.com/oliben67/catalyst) that makes its
four-layer traceability chain (work items → dev artifacts → rules →
rules of rules) navigable in both directions, surfaces drift as it
happens, and lets a human author governed changes without ever
bypassing the agent. Ships as a VS Code extension and an Electron
desktop app, sharing one core and one UI package.

## Status

Pre-alpha. No product code yet — this repository currently holds only
its dev-environment scaffold (tooling, lint, test, CI), established via
catalyst's own greenfield instantiation path before any application
code was written. See the roadmap for what's planned and in what order.

## Packages

- `packages/catalyst-core` — TypeScript, no DOM. Parses the corpus,
  builds the typed chain model, runs global validation, watches files.
- `packages/catalyst-ui` — React. All four surfaces (chain inspector,
  health board, proposal queue, run monitor), mounted unchanged by both
  hosts.
- `packages/catalyst-host-vscode` / `packages/catalyst-host-electron` —
  thin adapters implementing the core↔UI protocol over postMessage and
  IPC respectively.

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

This project is itself governed by catalyst — see
`.criterion`-equivalent state (agent-owned, not in this repo) for the
current dev-environment rules and, once real application work starts,
the product rule documents and requirements each change traces to.
