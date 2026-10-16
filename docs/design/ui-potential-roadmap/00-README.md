# Catalyst Studio: UI Potential Roadmap

**Date:** 2026-10-08  
**Scope:** Innovative UI design beyond entity display  
**Philosophy:** Make "persistent, verifiable project memory" *visible* and *delightful*

---

## What This Roadmap Covers

This exploration reimagines **Catalyst Studio** (the UI) as a **source of truth for project memory**, where users can:

- **See the full traceability chain** in multiple dimensions (not just lists)
- **Navigate causality** — why this rule exists, what it constrains, which decisions depend on it
- **Discover drift** in real-time with visual feedback (not just CLI errors)
- **Collaborate** with agents and humans in the same interface (blurred lines)
- **Measure impact** of decisions and changes across the entire system
- **Understand *why* catalyst matters** without reading 30 pages of documentation

---

## Core Insight: Catalyst is About **Context**

Unlike GitHub (repositories), Linear (tasks), or Notion (documents), **catalyst** is fundamentally about *preserving the reasoning* behind decisions. The UI should make this obvious in every interaction.

**Today:** Users see lists of entities and must mentally construct the chain.  
**Goal:** The chain is the UI, and entities are explored *through* it.

---

## The Roadmap Structure

| File | Scope | Highlights |
|---|---|---|
| **01-ui-philosophy.md** | Core design principles | 5 laws for catalyst UI; why "context is king" |
| **02-innovative-functionalities.md** | Beyond entity display | 15+ features: dependency graphs, impact analysis, time travel, drift detection, collaboration blurs |
| **03-visualization-patterns.md** | How to render the Record | Tree, graph, timeline, board, inbox, diff, audit trail — each revealing a different dimension |
| **04-modern-reference-analysis.md** | What others are doing | Studying GitHub, Linear, Figma, Notion, Loom, VS Code, Miro — what works and why |
| **05-interactive-experiences.md** | Delight and discovery | Animations, gestures, shortcuts, easter eggs that make catalyst *fun* |
| **06-implementation-roadmap.md** | How to build it | Phased plan: MVP (P0), richer (P1), advanced (P2) over R5–R7 |

---

## Five Laws for Catalyst UI

1. **Law 1: Traceability is the default view**  
   Every entity entry point should ask "why?" — show the chain up and down the tree before showing properties.

2. **Law 2: Causality is visual**  
   Dependencies, imports, and causality should be graphical (not text lists). Make the *shape* of the system obvious.

3. **Law 3: Context compounds**  
   Layers of detail reveal progressively (zoom in, expand, drill down). Start with the high-level story.

4. **Law 4: Drift is always visible**  
   Health status, rule violations, stale references, unjournaled changes — not hidden in a panel, but woven into every view.

5. **Law 5: Decisions are first-class**  
   ADRs, owner decisions, rules, and constraints are *not* documentation — they're active players in the UI, not footnotes.

---

## Key Questions Answered

### "Where am I?"

**Dashboard** — a visual summary of deployment health, open work, drift, team, rules at a glance. Not a spreadsheet.

### "What depends on this?"

**Impact explorer** — change a rule, see red highlights cascade through affected tests, steps, features, roadmap items. (Like Figma's selection analysis.)

### "Why does this exist?"

**Lineage view** — requirement → feature → steps → tests → rules → code. Click any point, see how it got there. (Like git blame + Figma's design system.)

### "Did we drift?"

**Drift dashboard** — unrecorded changes, rule violations, stale migrations, unrun CI, all flowing in like GitHub's PR notifications. (Like Linear's inbox or GitKraken's launchpad.)

### "Can the team collaborate here?"

**Decision inbox** — agent findings, approvals needed, proposals from /adopt command — reviewable, approvable, commentable, all journaled. (Like GitHub's PR review flow but for governance.)

### "How does the whole system fit together?"

**Studio map** — interactive flowchart of all entity types, their relationships, their states. Click to jump to type detail or filter. (Like Figma's assets panel or Notion's graph view.)

---

## The "Aha!" Moment

The UI should make it instantly clear: **"This isn't a task tracker or document manager. This is the living, attributed memory of how and why our project works."**

When a user opens Catalyst Studio for the first time:

1. They see a visual *map* of the project (not a spreadsheet)
2. They pick a rule or requirement and follow the chain in any direction
3. They see a real-time *impact* visualization if they changed something
4. They understand: "Oh, I can trust this because everything is traced and journaled."

---

## Inspiration Sources

- **GitHub:** PR review, branch protection, action workflows, dependency graphs, security alerts
- **Linear:** inbox, project views, custom fields, cycle/iteration management, AI suggestions
- **Figma:** selection info panel, design tokens, component variants, prototyping, version history
- **Notion:** databases with relations, timeline views, kanban boards, inline editing, comments
- **Loom:** video recording + transcript, timeline annotations, sharing with comments at specific timestamps
- **VS Code:** explorer sidebar, breadcrumb navigation, minimap, outline, git lens blame annotations
- **Miro:** infinite canvas, collaborative real-time editing, sticky notes, drawing, breakout boards
- **Obsidian:** graph view, backlinks, transclusion, wikilinks, quick switcher

---

## Next Steps

1. **Read the philosophy** (01-ui-philosophy.md) — understand the "why"
2. **Explore innovations** (02-innovative-functionalities.md) — specific features
3. **Study visualizations** (03-visualization-patterns.md) — how to render the Record
4. **Reference modern UIs** (04-modern-reference-analysis.md) — patterns that work
5. **Imagine interactions** (05-interactive-experiences.md) — delight and usability
6. **Plan the build** (06-implementation-roadmap.md) — phases, priorities, effort

---

## Quick Stats

- **15+ innovative functionalities** proposed (beyond today's 5 React views)
- **7 core visualization patterns** (tree, graph, timeline, board, inbox, diff, audit)
- **5 UI laws** guiding every decision
- **10+ reference tools** analyzed for patterns
- **3 implementation phases:** MVP (P0), richer (P1), advanced (P2)
- **Effort estimate:** P0 = R5 (Q1–Q2 2027), P1 = R6 (Q2–Q3 2027), P2 = beyond

---

## Philosophy Summary

**Catalyst Studio is not another task tracker. It's the visual interface to *verifiable project memory.*  Every decision, every constraint, every rule is visible, traced, and *justified* — not just stored.**

The UI should make this so clear that new users say: *"I didn't know projects could have memory like this."*
