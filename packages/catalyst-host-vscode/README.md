# Catalyst Studio — rules, journal and traceability for AI-assisted development

A VS Code extension for projects governed by the [catalyst
framework](https://github.com/cantica-tech/catalyst) — the agent-installed
layer that gives a codebase one traceable structure for its rules, its
development work, and the history of why every change happened. This
extension makes that structure visible and navigable without leaving
the editor, and gives you a safe way to act on it — every write still
goes through the governing agent, never straight from the UI.

## What it does

- **Instances** — a sidebar tree for every catalyst project open in your
  workspace, multi-root aware: each project is a top-level entry, named as
  it is, with its artifacts grouped by the types its process module
  declares, its rules by document, and its domains. Every entity appears
  once; its parents and children are links in its own document. Click any
  entry for its full detail — fields, links in both directions, journal —
  in a panel; the Journal and the Backlog open from the tree as well.
  catalyst's settings open from the view's title bar.
- **Studio** — _Catalyst: Open Studio_ opens the project's dashboard,
  inbox, board, journal, trace, rules and approvals in an editor tab.
  What waits for a person (an unrecorded change, a reconciliation case,
  a version a declared approval gate still needs approved, a proposed
  change shown beside the current text) is settled
  from there: the editor shows the exact catalyst command and runs it
  only on your yes. Approval gates need catalyst 0.80.0 or later,
  proposals 0.81.0; each action can be tried first, on a scratch copy,
  with catalyst 0.82.0.
- **Health board** — diagnostics, gutter marks, and CodeLens surface
  drift (orphaned artifacts, missing rule targets, dangling references)
  directly in the editor, with click-to-jump from a problem in the
  Problems panel straight to the file and line it concerns.
- **Agent console** — run any of the project's own catalyst commands
  (`/check-rules`, `/show-backlog`, ...) from the Studio's command palette
  through its governing agent, after you confirm, streamed with its cost;
  or send an entity straight to an agent chat (_Send to Agent (Chat)…_),
  without a manual copy-paste into an unrelated session.
- **Users** — a panel of the identity provider's users, roles and groups,
  read through catalyst-users (0.10.0 or later), each with a document
  listing who holds what. Right-click a user to log in to catalyst-users
  with a username and password (catalyst-users 0.9.0 or later).
- **No deployment yet?** Open a workspace folder that catalyst does not
  govern yet and the extension offers to set it up: connect it to an
  existing criterion repository, or start a new deployment with a ready
  instantiation prompt for your agent.

Every write still goes through catalyst, after your confirmation; the
extension never edits a governed file itself.

## Requirements

A project governed by catalyst 0.54.0 or later: a `catalyst.toml` at its
root, naming its criterion (kept outside the project, in
`~/.catalyst/projects/<name>/criterion`), and the `catalyst` command
installed (`CATALYST_BIN`, `~/.catalyst/bin/catalyst`, or `catalyst` on
the `PATH`). No project file yet? Open the folder anyway — the extension
offers to help you set it up; see [catalyst's own
repository](https://github.com/cantica-tech/catalyst) for what that
involves.

## Also available for Electron

The same Studio ships as a desktop app for macOS, Windows and Linux,
tracking several projects side by side; its installers are attached to
each [catalyst-ui release](https://github.com/cantica-tech/catalyst-ui/releases).

## Release notes

See [GitHub Releases](https://github.com/cantica-tech/catalyst-ui/releases)
for what changed in each version.
