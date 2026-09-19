# Catalyst framework

A VS Code extension for projects governed by the [catalyst
framework](https://github.com/oliben67/catalyst) — the agent-installed
layer that gives a codebase one traceable structure for its rules, its
development work, and the history of why every change happened. This
extension makes that structure visible and navigable without leaving
the editor, and gives you a safe way to act on it — every write still
goes through the governing agent, never straight from the UI.

## What it does

- **Chain Inspector** — a sidebar tree of the full traceability chain
  (rules → requirements/bugs/house-keeping → features/roadmap →
  proposals and live runs) for every catalyst deployment open in your
  workspace. Multi-root aware: each deployment gets its own section.
  Click any node for full detail in a webview.
- **Health board** — diagnostics, gutter marks, and CodeLens surface
  drift (orphaned artifacts, missing rule targets, dangling references)
  directly in the editor, with click-to-jump from a problem straight to
  the file and line it concerns.
- **Propose a fix, from the editor** — a code action on a flagged
  problem drafts a proposal describing the fix; the agent reviews and
  applies it. Nothing is written directly by the extension.
- **Compose new work** — the authoring composer turns a new rule,
  requirement, feature, or roadmap item you describe into a structured
  proposal with a valid, never-reused ID, ready for the agent to apply.
- **Run monitor** — a live checklist and ledger for work the agent is
  actively doing, so drift is visible while it's happening, not just
  after the fact.
- **Agent window** — run any of the deployment's own slash commands
  (`/check-rules`, `/show-backlog`, ...) through its governing agent
  from a per-project terminal, or send a node straight to an agent chat,
  without a manual copy-paste into an unrelated session.
- **No deployment yet?** Open a workspace folder with no catalyst
  deployment and the extension offers to install one — a ready
  instantiation prompt, one click to copy.

## Requirements

A project governed by catalyst (a `*.catalyst` pointer file at its
root). No pointer yet? Open the folder anyway — the extension offers to
help you install one; see [catalyst's own
repository](https://github.com/oliben67/catalyst) for what that
involves.

## Also available for Electron

The same UI ships as a standalone Electron desktop app for tracking
multiple projects side by side — see the
[catalyst-ui repository](https://github.com/oliben67/catalyst-ui).

## Release notes

See [GitHub Releases](https://github.com/oliben67/catalyst-ui/releases)
for what changed in each version.
