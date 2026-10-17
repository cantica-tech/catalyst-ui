# Executive Summary: Catalyst Studio Vision

**Date:** 2026-10-08  
**Audience:** Product leadership, engineering, design  
**Scope:** Complete UI/UX roadmap for Catalyst Studio (R5–R7)

---

## The Opportunity

Catalyst is unique: it's the only tool that gives projects _verifiable memory_ — a complete, traced, journaled record of why the system is the way it is. But today's UI doesn't make this obvious.

**Current catalyst-ui:** A VS Code extension (2,567-line file) + 5 basic React views. Users see lists and properties, not traceability.

**Result:** New users don't understand what makes Catalyst different. Experienced users struggle to navigate causality. The product's core value is invisible.

**Opportunity:** Redesign the UI to make **traceability the default interface**. Make it obvious that everything is traced, justified, and verifiable.

---

## The Vision (One Paragraph)

**Catalyst Studio is a governance workspace that answers four questions instantly:**

1. "Where am I?" → Dashboard shows health, open work, drift, recent changes
2. "Why does this exist?" → Traceability chain shows rule → feature → requirement → step → test → code
3. "What if I change this?" → Impact analysis shows red cascades of affected items
4. "Is the system consistent?" → Drift dashboard highlights violations, unjournaled changes, stale references

Every view is grounded in one core principle: **causality is visible, decisions are traceable, and nothing changes without leaving a record.**

---

## Visual Overview: Catalyst Studio in Action

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  CATALYST STUDIO — Multiple Shells, One Engine                            │
│                                                                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐       │
│  │   VS Code        │  │   Browser        │  │    Desktop       │       │
│  │   Extension      │  │   (localhost)    │  │  (Electron)      │       │
│  │                  │  │                  │  │                  │       │
│  │ [Tree Explorer]  │  │ [Dashboard] ────→│  │ [Command Palette]      │
│  │ [Detail Pane]    │  │ [Traceability  ] │  │ [Workspace View]       │
│  │ [Inline Blame]   │  │ [Impact         ]│  │ [Settings]             │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬──────────┘      │
│           │                     │                     │                  │
│           └─────────────────────┼─────────────────────┘                  │
│                                 │                                        │
│                        JSON-RPC 2.0 Protocol                             │
│                        (Python Engine)                                   │
│                                 │                                        │
│                    ┌────────────┴────────────┐                           │
│                    │  catalyst serve         │                           │
│                    │  (localhost:9999)       │                           │
│                    │                         │                           │
│                    │  ├─ Parse module.yaml   │                           │
│                    │  ├─ Render entity types │                           │
│                    │  ├─ Check drift         │                           │
│                    │  ├─ Compute impact      │                           │
│                    │  └─ Journal all changes │                           │
│                    │                         │                           │
│                    └────────┬────────────────┘                           │
│                             │                                           │
│                    ┌────────┴────────┐                                   │
│                    │   The Record    │                                   │
│                    │  (.catalyst/)   │                                   │
│                    │                 │                                   │
│                    │ ├─ Rules        │                                   │
│                    │ ├─ Requirements │                                   │
│                    │ ├─ Steps        │                                   │
│                    │ ├─ Tests        │                                   │
│                    │ ├─ Journal      │                                   │
│                    │ └─ ADRs (meta)  │                                   │
│                    │                 │                                   │
│                    └─────────────────┘                                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

Each shell renders the same data (module.yaml + Record) through three core views:

┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  THE CORE NAVIGATION MODEL (All Shells)                                 │
│                                                                          │
│  ┌─ DASHBOARD ───────────────────┐                                      │
│  │ "Where am I?"                 │                                      │
│  │ • Health cards (rules, tests) │                                      │
│  │ • Open work (next 3 items)    │                                      │
│  │ • Drift alerts (2 warnings)   │                                      │
│  │ • Team activity               │                                      │
│  └─────────────┬─────────────────┘                                      │
│                ↓                                                        │
│  ┌─ TRACEABILITY EXPLORER ───────┐                                      │
│  │ "Why? What? How?"             │                                      │
│  │ • Upstream: rule → why         │                                      │
│  │ • Downstream: impact           │                                      │
│  │ • Tree/Graph/Timeline views    │                                      │
│  │ • Full causality chain         │                                      │
│  └─────────────┬─────────────────┘                                      │
│                ↓                                                        │
│  ┌─ ENTITY DETAIL ───────────────┐                                      │
│  │ "All metadata about this"      │                                      │
│  │ • Properties (all fields)      │                                      │
│  │ • Relationships (links)        │                                      │
│  │ • Journal history (changes)    │                                      │
│  │ • Approval threads (decisions) │                                      │
│  └───────────────────────────────┘                                      │
│                                                                          │
│  ALSO AVAILABLE:                                                        │
│  ├─ Drift Dashboard (consistent?)                                       │
│  ├─ Judgment Inbox (decisions)                                          │
│  ├─ Command Palette (do stuff)                                          │
│  ├─ Impact Preview (what breaks?)                                       │
│  ├─ Journal Timeline (what changed?)                                    │
│  ├─ Roadmap Timeline (when?)                                            │
│  └─ Rule Browser (what rules exist?)                                    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

```

---

## Five Design Laws (Invariants)

These are the rules that guide every UI decision through R5–R7:

1. **Traceability is the default view**
   - Every entity shows its chain immediately (why it exists, what depends on it)
   - No "click for context"; the context is there by default

2. **Causality is visual, not textual**
   - Dependencies shown as graphs, not lists
   - Graph color, size, and layout communicate state at a glance
   - Animation shows change across the system

3. **Context compounds (progressive disclosure)**
   - Start simple (dashboard), reveal complexity on demand (explorer, detail, history)
   - Never overwhelm the user with all 30 fields on the first view

4. **Drift is always visible**
   - Health status, violations, stale references woven into every view
   - Never hidden in a separate panel; always front and center

5. **Decisions are first-class**
   - Rules, ADRs, and constraints are not documentation—they're active entities in the UI
   - Approval gates, decision threads, and audit trails are the normal workflow

---

## The Product in Three Phases

### Phase 1: MVP (P0, R5, Q1–Q2 2027)

**Deliverable:** One engine, three shells (browser, VS Code, desktop), four core features.

| Feature                   | Solves                                                    |
| ------------------------- | --------------------------------------------------------- |
| **Dashboard**             | "Where am I?" — health, open work, alerts at a glance     |
| **Traceability Explorer** | "Why does this exist?" — show the causal chain            |
| **Judgment Inbox**        | "What needs me?" — proposals, approvals, drift alerts     |
| **Drift Dashboard**       | "Are we consistent?" — violations and unjournaled changes |

**Success:** Portability proven (same bundle in 3 shells), module-agnostic rendering, 50% token reduction.

### Phase 2: Polish (P1, R6, Q2–Q3 2027)

**Deliverable:** All 16 innovative functionalities with rich visualizations.

**Add:** Graph views, timeline, board, approval workflows, command palette, rule browser, impact analysis, change history.

**Success:** Module portability proven (second module works with zero code changes), all P0+P1 features in 3 shells, advanced visualization performance benchmarked.

### Phase 3: Advanced (P2, R7, Q3–Q4 2027)

**Deliverable:** Cost transparency, analysis workspace, module sandbox, embeds, compliance audit pack.

**Add:** Token meter, findings triage, sandboxed module UI, global search, PDF export, IAM admin.

**Success:** Cost telemetry visible to users, module sandbox security audit passed, audit compliance pack exports.

---

## 16 Innovative Functionalities

Beyond the current 5 React views, Catalyst Studio adds 16 capabilities:

**Discovery (4):**

1. Dashboard — system health snapshot
2. Studio Map — interactive flowchart of entity types and relationships
3. Traceability Explorer — bi-directional dependency chain
4. Drift Dashboard — centralized health monitor

**Action (3):** 5. Judgment Inbox — decision requests with previewed evidence 6. Command Palette + Agent Console — search + dispatch + run history + token meter 7. Batch Operations — multi-select for bulk work

**Visualization (3):** 8. Journal Timeline + Diff — rich change history with side-by-side comparisons 9. Impact Analysis — change a field, see red cascade of affected items 10. Roadmap Timeline — Gantt view with milestones and dependencies

**Collaboration (3):** 11. Approval Workflows — gate definition + multi-reviewer sign-off 12. Entity Change History & Rollback — time-travel for any entity 13. (Team Visibility — activity feed showing who's doing what)

**Learning (3):** 14. Rule Browser — searchable gallery of all rules with lineage 15. Analysis & Findings Dashboard — triage and propose fixes for defects 16. Module Administration — install, upgrade, remove modules with impact analysis

---

## Seven Visualization Patterns

The UI uses proven patterns from modern tools (GitHub, Linear, Figma, Notion):

1. **Traceability Tree** — Hierarchical, text-based causality (VS Code outline style)
2. **Dependency Graph** — Visual network of rules, requirements, steps, tests (Obsidian graph style)
3. **Timeline/Gantt** — Temporal view of work with milestones and dependencies (Jira/Asana style)
4. **Board/Kanban** — State-based columns with drag-drop transitions (Linear/Trello style)
5. **Inbox/Activity Feed** — Narrative stream of decisions and alerts (Linear/GitHub PR review style)
6. **Diff/Comparison** — Side-by-side change visualization (GitHub diff style)
7. **Audit Trail** — Forensic timeline of who changed what and why (Git blame style)

Each pattern is chosen because it makes a specific dimension of the system obvious (structure, state, time, change, decision).

---

## Modern Reference Learnings

**From GitHub:** Blame/lineage views (show who changed it and why), dependency graphs, approval gates.

**From Linear:** Workspace dashboard (health at a glance), nested hierarchies, custom fields + filters, cycle planning, AI command palette, inbox pattern.

**From Figma:** Selection info panel (organized by category), design tokens as rules (change cascades), multiplayer presence, version history with branching, decision-focused handoff views.

**From Notion:** Multiple views of the same data (table, board, timeline, graph), bidirectional relationships, automatic rollups, guided creation templates.

**From Loom:** Timeline with chapters/markers, searchable transcript.

**From VS Code:** Breadcrumb navigation, explorer sidebar, go to definition + find references, minimap, inline blame.

**From Obsidian:** Graph view as primary interface, automatic backlinks (computed, not manual).

---

## Technical Architecture

### One Engine, Many Shells

```
Python Engine (catalyst serve)
    ↓ JSON-RPC 2.0
@catalyst/client + @catalyst/app-model (TypeScript)
    ↓ (same bundle in all shells)
Catalyst Studio SPA (React + design system)
    ↓
┌─────────────────────────────────────┐
│ Browser at localhost:7070           │
│ VS Code webview + native tree        │
│ Electron + bundled Python runtime    │
│ (Tauri spike on a branch)            │
└─────────────────────────────────────┘
```

### Design Principles

- **Single source of truth:** Python engine parses, validates, computes
- **Protocol first:** JSON Schema generates types in Python and TypeScript
- **Module-driven rendering:** `module.yaml` declares entity types, fields, states; no module-specific code in UI
- **Read anywhere, write through the engine:** Every mutation is journaled
- **Progressive disclosure:** Show complexity on demand, never overwhelm

---

## Success Metrics

### User Experience

- ✅ Time to understand Catalyst's value: **<3 minutes** (vs. 30 min docs read today)
- ✅ Time to take an action (approve a proposal): **≤3 clicks**
- ✅ Confidence in consistency: Users say **"I trust this; everything's traced"**

### Technical

- ✅ Portability: **Same bundle in 3+ shells** (browser, VS Code, desktop)
- ✅ Module-agnostic: **Second module works with zero code changes**
- ✅ Token efficiency: **≥50% reduction** (from 72k to ≤35k tokens per session)
- ✅ Performance: **P95 response time <200ms** for any navigation

### Adoption

- ✅ Shipped to VS Code Marketplace
- ✅ Browser version used by ≥3 external teams
- ✅ Desktop version (Electron) tested and delivered
- ✅ Feature parity with CLI (everything `catalyst` can do, Studio can do)

---

## Resource Plan

### Team (3.5 FTE)

- **2 FTE Frontend/UX** (design, React, all shells)
- **1 FTE Backend/Engine** (Python, JSON-RPC, module loading)
- **0.5 FTE QA/DevOps** (tests, CI, golden corpus, profiling)

### Timeline

- **P0 (16 weeks, R5):** MVP with core features in 3 shells
- **P1 (12 weeks, R6):** All 16 functionalities, module portability proven
- **P2 (12 weeks, R7):** Advanced features, compliance audit pack, cost telemetry
- **Total:** 40 weeks spread across R5–R7

### Dependencies

- Engine must be ready (R4 work or brought forward)
- Module schema (`module.yaml`) must fully describe entity types (R4 work)
- JSON Schema contract tests between Python and TypeScript (R4 work)

---

## The Competitive Advantage

After R7, Catalyst Studio will be:

| Aspect                 | Today                     | After R7                                   |
| ---------------------- | ------------------------- | ------------------------------------------ |
| **Value proposition**  | Hidden (users see lists)  | Obvious (traceability is visible)          |
| **Time to competence** | 30+ min (docs)            | <3 min (dashboard)                         |
| **Platform**           | VS Code only              | Browser + VS Code + desktop                |
| **Module flexibility** | Hard-coded SE module only | Any module, zero code changes              |
| **Token cost**         | 72k per session           | ≤25k (50% reduction)                       |
| **Collaboration**      | Async threads             | Inbox + approval gates + audit trail       |
| **Visibility**         | List views                | 7 visualization patterns + impact analysis |

---

## Next Steps

1. **Approve this vision** — Do the Five Laws, 16 features, and 7 patterns align with your goals?
2. **Refine scope** — Which P1 features matter most? Prioritize within R6.
3. **Resource alignment** — Can we staff the 3.5 FTE team for R5–R7?
4. **Engine readiness** — What engine work must happen before P0 kickoff?
5. **Design system** — Kick off tokens, light/dark modes, a11y baseline
6. **Prototypes** — Build 1–2 prototype views (dashboard, traceability explorer) to validate patterns

---

## Supporting Documents

- [01-ui-philosophy.md](01-ui-philosophy.md) — Five laws and design principles
- [02-innovative-functionalities.md](02-innovative-functionalities.md) — 16 features with detailed specs
- [03-visualization-patterns.md](03-visualization-patterns.md) — 7 patterns and when to use each
- [04-modern-reference-analysis.md](04-modern-reference-analysis.md) — Lessons from GitHub, Linear, Figma, etc.
- [05-implementation-roadmap.md](05-implementation-roadmap.md) — Phase-by-phase plan with effort estimates, risks, success criteria

---

## One Final Thought

**Catalyst's tagline is "persistent, verifiable project memory."**

After R7, that tagline should be _visible_ in every screen, every interaction, and every decision.

Users shouldn't need to read it; they should _see_ it:

- The chain shows persistence (nothing is forgotten)
- The journal shows verification (every change is recorded and attributed)
- The traceability shows memory (how did we get here?)

That's Catalyst Studio.
