# 03 — Visualization Patterns: Making Causality Visible

**Date:** 2026-10-08  
**Source:** Catalyst UI Analysis (05), modern UI products (GitHub, Linear, Figma, Notion)  
**Scope:** Seven core visualization patterns for rendering the Record (entities, relationships, history, drift) in ways that make the system's causality obvious

---

## The Challenge

Catalyst's unique value is _traceability_: every rule, requirement, step, and piece of code is connected by a causal chain (why it exists, what depends on it). But today's UI shows lists. Lists hide the chain.

**This section:** Visual patterns that make causality the primary interface, not something you drill down to find.

---

## Pattern 1: Traceability Tree (Hierarchical, Text-Based)

### Use Case

Understanding "why does this exist?" and "what does it affect?" without overwhelming the user.

### Mockup: Dashboard Showing a Rule's Chain

```
╔══════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Rule: "API rate limiting required"        ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  UPSTREAM (Why does this rule exist?)                        ║
║  ─────────────────────────────────────                       ║
║  ← ADR-005 "API design principles"  (Approved by alice)     ║
║    └─ Requirement: REQ-42  "System resilient to abuse"      ║
║       └─ Feature: FEAT-12 "Public API v2" (In Progress)     ║
║                                                              ║
║  THIS RULE                                                   ║
║  ─────────                                                   ║
║  ✓ API Rate Limiting Required                               ║
║  Domain: API & Performance                                   ║
║  Status: Active  |  Version: 2  |  Modified: 2024-10-08      ║
║                                                              ║
║  DOWNSTREAM (What does this rule affect?)                    ║
║  ──────────────────────────────────────────                  ║
║  → 4 Steps                                                   ║
║    ├─ STEP-89 "Implement rate limiter" (Blocked by STEP-88) ║
║    ├─ STEP-90 "Configure thresholds" (In Progress)          ║
║    ├─ STEP-91 "Document headers" (Done ✓)                   ║
║    └─ STEP-92 "Add to metrics" (Not started)                ║
║                                                              ║
║  → 2 Tests                                                   ║
║    ├─ TEST-156 "Boundaries: 1000/hour" (Passing ✓)          ║
║    └─ TEST-157 "Headers: Retry-After" (Passing ✓)           ║
║                                                              ║
║  → Code References                                           ║
║    └─ src/middleware/ratelimit.ts (5 occurrences)           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### How It Works

```
Rule: "All API endpoints must have rate limiting"
├── Origin (why?)
│   ├── Requirement: REQ-42 "System must be resilient to abuse"
│   │   └── Source: Feature FEAT-12 "Public API v2" (status: In Progress)
│   ├── Decision: ADR-005 "API design principles" (approved by alice, 2024-01-15)
│   └── Rule domain: "API & Performance"
│
└── Dependents (what does this affect?)
    ├── Steps (4 items)
    │   ├── STEP-89 "Implement rate limiter" (Blocked by STEP-88)
    │   ├── STEP-90 "Configure rate limit thresholds" (In Progress)
    │   ├── STEP-91 "Document rate limit headers" (Done)
    │   └── STEP-92 "Add rate limit to metrics" (Not started)
    │
    ├── Tests (2 items)
    │   ├── TEST-156 "Rate limit boundaries: 1000 req/hour" (Passing)
    │   └── TEST-157 "Rate limit headers: Retry-After" (Passing)
    │
    ├── Code (referenced in)
    │   └── src/middleware/ratelimit.ts (5 hits in grep)
    │
    └── Features (constrains)
        ├── FEAT-12 "Public API v2" (blocked by: STEP-89)
        └── FEAT-47 "Pricing tiers" (requires rate limits)
```

### UX Implementation

- Expandable/collapsible tree (click the [+] to show/hide each level)
- Breadcrumb at the top (Rule > domain > origin)
- Click any item to jump to its detail page
- Status badges (colors: passing, in progress, blocked, done, not started)
- Quick actions (hover a row → "Edit," "Archive," "Show chain," "Link to…")

### When to Use

- Detail page of any entity
- Understanding dependencies before making a change
- Onboarding (show the chain for one feature end-to-end)

### Inspiration

- VS Code's file explorer and outline panel
- GitHub's file tree in repos
- Linear's dependency list view

---

## Pattern 2: Dependency Graph (Visual, Interactive)

### Use Case

Seeing the _shape_ of the system: tight clusters, loose coupling, bottlenecks, dependencies at a glance.

### How It Works

```
Visual layout (force-directed or hierarchical):

     Rule
      ↓
   Feature
    ↙  ↘
 Req₁  Req₂
   ↓    ↓
 Step   Step
   ↓    ↓
  Test  Test
```

### Mockup: Graph View of a Feature with Dependencies

```
╔═════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Graph: API Rate Limiting Feature              ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                 ║
║  ┌─────────────┐                                                ║
║  │ ADR-005 🎯  │  (Octagon: Decision, size = impact, 🟢 active)║
║  │ "API Design"│                                                ║
║  └──────┬──────┘                                                ║
║         │                                                       ║
║    ┌────┴─────┐                                                 ║
║    ↓          ↓                                                 ║
║  ┌──────┐  ┌─────────┐                                          ║
║  │REQ-42│  │ REQ-89  │  (Rectangles: Requirements, 🟢 active)  ║
║  │ Large│  │ Small   │                                          ║
║  └──┬───┘  └────┬────┘                                          ║
║     │           │                                               ║
║  ┌──┴──┐   ┌────┴───┐                                           ║
║  ↓     ↓   ↓        ↓                                           ║
║ ◇ S89 ◇S90 ◇ S91  ◇ S92  (Diamonds: Steps, 🟢🟡🟢🔴)           ║
║ "impl" "cfg" "doc" "metr"  (One blocked: red edge to S88)      ║
║  │     │    │      │                                           ║
║  └──┬──┴────┴──┬───┘                                           ║
║     ↓          ↓                                               ║
║   ● T156     ● T157  (Circles: Tests, all 🟢 passing)          ║
║   "bound"    "hdr"                                             ║
║                                                                 ║
║  Legend:                                                        ║
║  🟢 Passing/Active   🟡 In Progress   🔴 Blocked   🟠 Warning  ║
║  Size → impact, darker = older, brighter = recent              ║
║  Hover node → highlight all connected (up & down)              ║
║  Hover edge → show constraint "S89 blocks S90"                 ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝
```

### UX Implementation

- **Node styling:**
  - Size = how much depends on it (bigger = more impact)
  - Color = status (green passing, red failing, yellow in progress, gray orphaned)
  - Shape = entity type (octagon for rules, rectangle for requirements, diamond for steps, circle for tests)
  - Icon = domain (API, security, testing, etc.)

- **Edge styling:**
  - Solid line = "constrains" / "depends on"
  - Dashed line = "suggested" / "optional"
  - Color = relationship type (blue for "requires," red for "conflicts with," green for "validates")

- **Interaction:**
  - Hover node → highlights all incoming/outgoing edges (cascade)
  - Click node → open detail panel (doesn't leave the graph)
  - Click edge → show the relationship details
  - Drag to pan, scroll to zoom
  - Click "expand all" or collapse to fold large subgraphs
  - Filter nodes by type, domain, status (checkbox panel on the left)

- **Layout modes:**
  - Hierarchical (left-to-right by layer: decisions → rules → requirements → steps → tests → code)
  - Force-directed (organic, shows clusters and tight coupling)
  - Time-based (horizontal axis = creation date)
  - Radial (selected node in center, radiating out)

### When to Use

- "Studio map" view (show all entity types and their relationships)
- Impact analysis (change a rule → red highlights all affected items)
- Onboarding (show the architecture of the project)
- Drift detection (orphaned nodes appear faded)

### Inspiration

- Figma's component dependencies + design tokens graph
- GitHub's dependency graph and network visualization
- Linear's "view" with graph layout option
- Obsidian's graph view
- Miro's infinite canvas with auto-layout

---

## Pattern 3: Timeline / Gantt View (Temporal)

### Use Case

Seeing progress over time: which work is on track, what's blocked, dependencies between milestones.

### How It Works

```
Quarter Q1 2025         Q2 2025         Q3 2025
        |----------|----------|----------|
Feature 1: [=====>   ]  (In Progress)
  ├─ Req A: [===>    ]  (In Progress)
  │   ├─ Step 1: [=>]  (Blocked by Step 2)
  │   └─ Step 2: [  ====>    ]  (In Progress)
  └─ Req B: [     =====>    ]  (Planned)

Feature 2: [            =====>    ]  (Planned, depends on Feature 1)
  └─ Req C: [            =====>    ]

Feature 3: [ =======> ]  (Done, delivered in Q1)
```

**With milestones and gates:**

```
Milestone: "Public API v2"  ──→ [Gate: 2 approvals needed]
  │
  Feature FEAT-12 ───→ [========>  ]
  Feature FEAT-13 ───→ [   ======> ]  (blocked by FEAT-12)
  Feature FEAT-14 ───→ [         =====>]
```

### UX Implementation

- **Rows:** Entities (features, requirements, milestones) grouped by parent
- **Columns:** Time axis (weeks, months, quarters, years)
- **Bars:** Duration (from creation/start date to target/done date)
- **Status color:** Green (done), blue (in progress), yellow (planned), red (blocked)
- **Dependencies:** Lines showing "blocks" relationships (from end of one bar to start of another, with a small red X if blocking)
- **Milestones:** Vertical gates across all rows
- **Drag to reschedule:** Hover a bar → grab handle → drag right/left to change date
- **Click bar:** Open detail panel
- **Scrollable:** Horizontal (time) and vertical (entities)

### When to Use

- Roadmap view (long-term planning, Q-by-Q view)
- Release planning (sprint-by-sprint, with dependencies)
- Backlog prioritization (WIP limits, due dates)

### Inspiration

- Jira's roadmap view
- Linear's timeline and cycle planning
- Asana's timeline view
- GitHub's milestones and project timeline
- Notion's timeline database

---

## Pattern 4: Board / Kanban (State-Based)

### Use Case

Seeing what's in each state at a glance, moving items through workflows.

### How It Works

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Proposed │ │ In Prog. │ │In Review │ │  Done    │
├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│ STEP-89  │ │ STEP-91  │ │ STEP-92  │ │ STEP-87  │
│ "Impl..." │ │ "Config" │ │ "Docs"   │ │ "Tests"  │
│ Est: 3d  │ │ Est: 2d  │ │ Est: 1d  │ │ Done!    │
│ Blocked  │ │ Assigned │ │ 1 review │ │Delivered │
│          │ │ to alice │ │ from bob │ │2024-10-8 │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
   ↓            ↓            ↓            ↓
 (1 item)    (2 items)    (1 item)    (5 items)
```

**With swimlanes (by assignee or domain):**

```
alice         │ STEP-91 │ STEP-93 │        │ STEP-85 (Done 2024-10-8)
bob           │         │         │ TEST-92│
automation    │         │ STEP-88 │        │
```

### UX Implementation

- **Columns:** Workflow states (Proposed, In Progress, In Review, Blocked, Done)
- **Rows (optional):** Swimlanes by assignee, domain, or priority
- **Cards:** Entity summary (title, ID, estimate, assignee, status badge, due date, blockers)
- **Drag-drop:** Move card to new column (triggers state transition + validation + journal entry)
- **Color coding:** By status, domain, or priority
- **Hover card:** Show full description and related items (rules it satisfies, tests, blocking issues)
- **Filter sidebar:** Show only items assigned to me, in my domain, due this week, etc.
- **WIP limits:** Column header shows "3/5" (3 items in column, limit is 5) with warning if exceeded
- **Cycle/sprint selector:** Radio buttons to switch between backlog, current sprint, next sprint

### When to Use

- Backlog prioritization
- Sprint planning and tracking
- Work-in-progress monitoring (WIP limits, throughput)
- Team communication (who's doing what, what's blocked)

### Inspiration

- Jira's board view
- Linear's board and filter views
- GitHub's project board
- Trello's cards and swimlanes
- Notion's kanban database

---

## Pattern 5: Inbox / Activity Feed (Narrative)

### Use Case

Sequential updates and decisions: "what needs my attention?" without having to open multiple views.

### How It Works

```
┌─ ⚠️  Unjournaled changes detected (2 files)
│  ├─ STEP-89: src/middleware/ratelimit.ts (138 lines modified)
│  ├─ STEP-88: tests/rate_limit.test.ts (45 lines added)
│  └─ Actions: [View Diff] [Adopt] [Revert] [Defer]
│
├─ 🤖 Alice (via Claude Code) proposes: "Archive 3 stale rules"
│  ├─ REQ-142 (no dependents, last used 6 months ago)
│  ├─ REQ-143 (superseded by REQ-200)
│  ├─ REQ-144 (conflicts with new ADR-015)
│  └─ Actions: [Approve] [Request Changes] [Defer]
│
├─ 👤 Bob requested your review on REQ-89 "Add caching"
│  └─ Actions: [Approve] [Request Changes] [Comment]
│
├─ ✅ Alice moved STEP-91 to Done (2024-10-08 14:32)
│  └─ Journal: "Finished documentation for rate limit headers"
│
├─ 📋 Module update available: catalyst-software-engineering v2.4.0
│  ├─ Changelog: "Added new entity type: Decision"
│  └─ Actions: [View Changelog] [Upgrade] [Dismiss]
│
└─ 🚨 Rule violation: "Rate limit must be tested" but TEST-159 is Failing
   └─ Actions: [Fix] [Acknowledge] [Escalate]
```

### UX Implementation

- **Timeline:** Vertical list of events, newest first
- **Event types:** Proposal (with diff), approval needed, change made, status update, alert, notification
- **Grouping:** By type or date, with counters (e.g., "3 unread," "5 awaiting approval")
- **Filtering:** Show all, or filter by type (proposals, approvals, changes, alerts)
- **Action buttons:** Always visible, context-sensitive (Approve/Reject for proposals, Fix/Acknowledge for alerts)
- **Comments:** Each event can have a thread (async collaboration)
- **Mark read:** Swipe left to mark as read, or "Mark all as read"
- **Unread badge:** On the activity bar icon

### When to Use

- Notification/activity center (first thing users see when opening the UI)
- Decision inbox (what needs my approval?)
- Change log (what happened since I was last here?)

### Inspiration

- Linear's inbox view
- GitHub's notification inbox
- Slack's notification center
- Gmail's inbox and thread view
- Twitter's home feed

---

## Pattern 6: Diff / Comparison (Change-Based)

### Use Case

Understanding what changed and why (in journal entries, entity history, or before approving a proposal).

### How It Works

**Side-by-side diff of an entity:**

```
BEFORE (REQ-42 v1)          │  AFTER (REQ-42 v2)
┌─────────────────────────┐ │ ┌─────────────────────────────┐
│ Title: "API resilience" │ │ │ Title: "API must handle 10k  │
│ Status: Proposed        │ │ │ Severity: Critical" → High   │
│ Severity: Medium  ━━━━━━━┼━━┫ Status: Proposed            │
│ Rules: [REQ-89]         │ │ │ Rules: [REQ-89, ADR-005]   ←  (added)
│ Assigned: None    ━━━━━━━┼━━┫ Assigned: alice              │
│ Due: (none)       ━━━━━━━┼━━┫ Due: 2024-11-01              │
│ Approved by: None       │ │ │ Approved by: bob (2024-10-08)│
└─────────────────────────┘ │ └─────────────────────────────┘
```

**Unified diff of a journal entry (file changes):**

```
src/middleware/ratelimit.ts
2024-10-08 by alice

  export function RateLimiter(options) {
    return (req, res, next) => {
      const limit = options.limit || 1000;
- const window = options.window || 60000;
+ const window = options.window || 3600000;  // Changed: 1min → 1hr
      const key = `${req.ip}-${options.id}`;
      if (!store[key]) store[key] = 0;
      store[key]++;
      if (store[key] > limit) {
+       res.set('Retry-After', Math.ceil(window / 1000));  // New: Added header
        return res.status(429).json({ error: 'Too many requests' });
      }
      next();
    };
  }

Journal reason: "ADR-005: API design principles – added Retry-After header per spec"
```

### UX Implementation

- **Layout:** Side-by-side (columns) or unified (single stream)
- **Highlighting:** Removed lines in red with strikethrough, added lines in green with highlight
- **Context lines:** Show surrounding unchanged lines for context (configurable: 3, 5, or 10 lines)
- **Line-by-line:** Click a diff line to see its journal reason or linked entities
- **Toggle whitespace:** Show/hide whitespace-only changes
- **Statistics:** "X lines added, Y lines removed, Z files changed"
- **Blame:** Hover a line → show author and date (optional, requires Git integration)

### When to Use

- Comparing two versions of an entity (current vs. previous)
- Reviewing a proposal before approving it
- Understanding a journal entry (what changed and why)
- Auditing changes by author or date range

### Inspiration

- GitHub's commit diff and PR review view
- GitLab's merge request diff
- Git lens blame view
- VS Code's diff editor
- Notion's version history

---

## Pattern 7: Audit Trail / Timeline (Forensic)

### Use Case

Full traceability: "who changed this, when, why, and what was the impact?"

### How It Works

```
Entity: REQ-42 "API must handle 10k RPS"

┌─────────────────────────────────────────────────────────────┐
│ 2024-10-08 14:32 by alice                        [↻ Revert] │
│ → Status changed: Proposed → In Review                      │
│ → Assigned to: alice                                        │
│ Reason: "Starting implementation of rate limiter"           │
│ Journal entry: JNL-8493                                     │
│ Related changes:                                            │
│   - STEP-89 created (implementation task)                   │
│   - TEST-156 created (test task)                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2024-10-05 09:15 by bob                                     │
│ → Severity changed: Medium → High                           │
│ Reason: "Customer escalation; needs urgent resolution"      │
│ Approval: alice (approved 2024-10-05 10:22)                 │
│ Journal entry: JNL-8487                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2024-10-01 16:45 by alice                                   │
│ → Created from REQ-89 "API resilience"                      │
│ Rules linked: [ADR-005, REQ-89]                             │
│ Journal entry: JNL-8421                                     │
└─────────────────────────────────────────────────────────────┘
```

**With impact annotations:**

```
2024-10-08 14:32: Status → In Review
  Impact: 2 dependents notified
  - FEAT-12 "Public API v2" (was Blocked, now In Progress)
  - STEP-91 "Documentation" (was Deferred, now Ready to Start)
```

### UX Implementation

- **Reverse chronological timeline:** Most recent at top
- **Event cards:** Each change shown as a card with:
  - Timestamp and author
  - What changed (field name, old value → new value)
  - Why (reason from journal entry)
  - Approval chain (who approved, when)
  - Impact (what changed as a result)
- **Drill-down:** Click a change to see the full journal entry, related entities, and code diff
- **Revert button:** Any past state can be reverted with a new journal entry
- **Filter:** By author, date range, change type (status, assignment, linking, etc.)
- **Search:** Full-text search on reasons

### When to Use

- Forensic auditing ("who changed this and why?")
- Compliance review ("show me all changes by bob in Q3")
- Understanding entity history (how did this requirement evolve?)
- Debugging ("when did this test start failing?")

### Inspiration

- GitHub's commit history and blame view
- Git log and git blame
- Notion's version history with user comments
- Linear's activity log
- Figma's design history timeline

---

## Summary: Which Pattern to Use When

| Situation                       | Pattern           | Why                                      |
| ------------------------------- | ----------------- | ---------------------------------------- |
| "Why does this exist?"          | Traceability Tree | Shows the causal chain directly          |
| "What's the system structure?"  | Dependency Graph  | Reveals clusters, coupling, bottlenecks  |
| "Are we on track?"              | Timeline/Gantt    | Shows progress and blocking dependencies |
| "What's in progress right now?" | Board/Kanban      | Shows state transitions and WIP          |
| "What needs my attention?"      | Inbox/Feed        | Highlights decisions and alerts          |
| "What exactly changed?"         | Diff/Comparison   | Side-by-side before/after                |
| "Who did what and when?"        | Audit Trail       | Full forensic record                     |

## Next Steps

These patterns form the foundation for the 16 innovative functionalities (02-innovative-functionalities.md). Each functionality composes one or more patterns to answer a user need.

Examples:

- **Dashboard** = summary cards + mini-graph
- **Impact analysis** = graph with red cascade + diff preview
- **Journal timeline** = audit trail + diff view
- **Traceability explorer** = tree view + graph view + optional timeline
