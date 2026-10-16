# UI Mockups Guide — Catalyst Studio Roadmap

This document maps every mockup to the document and concept it illustrates.

---

## Visual Mockups by Category

### 1. System Architecture

**Location:** `00-EXECUTIVE-SUMMARY.md`  
**Mockup:** "Catalyst Studio in Action"

Shows:

- Multiple shells (VS Code, Browser, Desktop) connecting to a single Python engine
- JSON-RPC 2.0 protocol layer
- The Record (.catalyst/ directory) as the source of truth
- Core navigation model (Dashboard → Explorer → Detail → History)

**Why:** Helps stakeholders understand the architecture: one engine, many shells, module-driven rendering.

---

### 2. Dashboard

**Location:** `02-innovative-functionalities.md` → Feature 1  
**Mockup:** Full dashboard layout

Shows:

- Health cards (rules, tests, drift, members)
- What needs attention (3-5 priority items with quick actions)
- Recent journal activity
- Quick action buttons

**Context:** This is the user's first screen; answers "where am I?" in 3 seconds.

---

### 3. Traceability Explorer (Tree View)

**Location:** `03-visualization-patterns.md` → Pattern 1  
**Mockup:** Hierarchy showing upstream and downstream

Shows:

- Upstream: decisions → requirements → features → rules
- This entity (centered)
- Downstream: steps → tests → code references
- Status indicators (✅ ⏳ ❌)
- Expand/collapse, filter, copy options

**Context:** The core value prop—answer "why?" and "what depends on it?"

---

### 4. Dependency Graph

**Location:** `03-visualization-patterns.md` → Pattern 2  
**Mockup:** Visual network with nodes and edges

Shows:

- Nodes of different shapes (octagon=rule, rectangle=req, diamond=step, circle=test)
- Node size = impact
- Node color = status (🟢 passing, 🟡 in-progress, 🔴 blocked)
- Edge labels showing relationships
- Legend and interaction hints

**Context:** Visual causality—see the system's structure at a glance.

---

### 5. Judgment Inbox

**Location:** `02-innovative-functionalities.md` → Feature 5  
**Mockup:** Activity feed with decision requests

Shows:

- Multiple proposal types (reconciliation, archiving, rewrites, questions)
- Evidence pre-assembled (diffs, metrics, links)
- Quick action buttons (✅ Approve, ⚠️ Changes, ⏸️ Defer, ❌ Reject)
- Comment threads for async collaboration
- Filter/sort options

**Context:** Transform CLI judgment requests into human workflows.

---

### 6. Command Palette + Agent Console

**Location:** `02-innovative-functionalities.md` → Feature 6  
**Mockup:** Two screens

**Screen 1:** Command palette

- Fuzzy search with preview
- Form to fill parameters
- Dispatch to agent selector

**Screen 2:** Agent console

- Real-time streamed output
- Cost report (input/output tokens)
- Run history with links
- Actions: Copy, Export, Rerun, Clear

**Context:** Make CLI commands discoverable; show token cost and history.

---

### 7. Drift Dashboard

**Location:** `02-innovative-functionalities.md` → Feature 4  
**Mockup:** Alert list with auto-fixes

Shows:

- Critical alerts (unjournaled changes) with quick adopt/revert
- Warnings (rule violations) with severity and auto-fix suggestions
- Info alerts (stale refs, version mismatches) with actions
- Trend analysis (↑ ↓ →) showing direction
- Bulk actions (fix all, email report)

**Context:** Drift is why record-keeping matters; make it visible by default.

---

### 8. Journal Timeline + Diff

**Location:** `02-innovative-functionalities.md` → Feature 8  
**Mockup:** Vertical timeline with expandable entries

Shows:

- Time axis (left side)
- Entry cards showing entity type, author, timestamp
- For each entry:
  - Brief description
  - Related entities
  - Side-by-side diff (before/after)
  - Links to related entries
- Filter options (date, author, type, severity)

**Context:** Understand what changed and why, with full audit trail.

---

### 9. Impact Analysis

**Location:** `02-innovative-functionalities.md` → Feature 9  
**Mockup:** Simulation preview with red cascades

Shows:

- The proposed change (from/to)
- Impact breakdown:
  - Directly affected (features, steps, tests)
  - Cascading risks (what breaks downstream)
  - Conflicts (ADRs, decisions that disagree)
- Risk level (high/medium/low with confidence)
- Suggested approaches (A/B/C alternatives)
- Buttons to approve, adjust, or cancel

**Context:** Users gain confidence when they can see impact before committing.

---

### 10. Roadmap Timeline (Gantt)

**Location:** `02-innovative-functionalities.md` → Feature 10  
**Mockup:** Gantt chart with bars and dependencies

Shows:

- Time axis (weeks, quarters)
- Rows: roadmap items grouped by milestone/domain
- Bars: duration, color = status (████ complete, ░░░░ not started, ⚠️ at risk, 🔴 blocked)
- Dependency lines (blocking relationships)
- Legend and controls (add, export, filter, zoom)

**Context:** Visual planning is faster than text; see milestones and dependencies.

---

### 11. Five Laws Diagram

**Location:** `01-ui-philosophy.md`  
**Mockup:** ASCII diagram showing all five laws in one screen

Shows:

- Law 1: Traceability (text-based, rule → dependents)
- Law 2: Causality (graph-based, visual shapes)
- Law 3: Progressive disclosure (dashboard → explorer → detail)
- Law 4: Drift (alerts and warnings woven in)
- Law 5: Decisions (approval gates, threads, audit trail)
- Each law illustrated with a small UI snippet

**Context:** Design philosophy—the invariants that guide all decisions.

---

### 12. Phase Comparison

**Location:** `05-implementation-roadmap.md` → Overview  
**Mockup:** Side-by-side comparison of P0, P1, P2

Shows:

- P0: MVP features (Dashboard, Explorer, Inbox, Drift)
- P1: Polish features (all 16, rich visualizations)
- P2: Advanced features (cost meter, sandbox, audit)
- For each phase:
  - Goal question ("Can we understand it?" → "Can we see it?" → "Can we operate at scale?")
  - Features list
  - Success criteria
  - Timeline

**Context:** Help teams understand the roadmap and coordinate on phases.

---

## How to Read the Mockups

Each mockup uses one or more of these styles:

### ASCII Art

```
┌─────────────┐
│ Box Layout  │
└─────────────┘
```

- Used for UI layouts, data tables, screenshots
- Fast to scan, works in text, easy to compare versions

### Unicode Symbols

```
🟢 passing   🟡 in-progress   🔴 blocked   ⚠️ warning
████ complete   ░░░░ not started
```

- Visual at-a-glance indicators
- Status, severity, progress
- Tree/graph structure

### Pseudo-Forms

```
Name:  _______________ [required]
Email: _______________ [optional]
```

- Shows form fields and validation
- User input flows
- Parameters

### Tree Structures

```
Rule
 ├─ Feature 1
 │  ├─ Step 1
 │  └─ Step 2
 └─ Feature 2
```

- Hierarchical relationships
- Traceability chains
- Navigation trees

### Graphs (ASCII)

```
  ◇ Node 1
  /     \
◇ Node 2 ◇ Node 3
```

- Dependency visualization
- Impact cascades
- Relationships

---

## Integration Points

### From Mockups to Specification

Each mockup should drive the creation of:

1. **Interaction spec** — How does the user navigate this view?
   - Example: Dashboard → click "STEP-89" → Explorer shows chain

2. **API contract** — What JSON does the engine return?
   - Example: Dashboard needs `{health: {rules: 127, tests: 96%, drift: 2}}`

3. **Component library** — Which reusable components do we need?
   - Example: Alert card, approval button, diff viewer, tree node

4. **Accessibility spec** — How does this work with screen readers?
   - Example: Tree announces expanded/collapsed state

5. **Mobile/responsive** — Does this mockup adapt to narrow screens?
   - Example: Graph view → smaller font, horizontal scroll

---

## Next Steps

1. **Validate with users:** Show mockups 1, 3, 5, 9, 10 to 3–5 target users. Do they make sense?
2. **Prototype:** Build 2–3 interactive prototypes (Dashboard, Traceability Explorer) with real data.
3. **Design system:** Define tokens (colors, spacing, typography) for all mockups.
4. **Spec from mockups:** For each view, write detailed interaction spec + API contract.
5. **Implement:** Use mockups as acceptance criteria; UI is done when it matches the mockup.

---

## Mockups Gallery (Visual Index)

**Total mockups in this roadmap: 12**

| # | Name | Document | Lines | Visual Type |
|---|------|----------|-------|------------|
| 1 | System Architecture | 00-EXEC | 30 | ASCII diagram |
| 2 | Dashboard | 02-FUNC | 35 | ASCII layout |
| 3 | Traceability Tree | 03-PATTERNS | 40 | ASCII tree |
| 4 | Dependency Graph | 03-PATTERNS | 35 | ASCII graph |
| 5 | Judgment Inbox | 02-FUNC | 50 | ASCII feed |
| 6 | Command Palette + Console | 02-FUNC | 60 | ASCII forms + output |
| 7 | Drift Dashboard | 02-FUNC | 70 | ASCII alerts |
| 8 | Journal Timeline | 02-FUNC | 55 | ASCII timeline |
| 9 | Impact Analysis | 02-FUNC | 60 | ASCII preview |
| 10 | Roadmap Gantt | 02-FUNC | 50 | ASCII chart |
| 11 | Five Laws | 01-PHIL | 25 | ASCII grid |
| 12 | Phase Comparison | 05-IMPL | 60 | ASCII table |

**Total lines of mockups: ~575**

---

## Mockup Evolution Path

As the project progresses:

1. **R5 Week 1-2:** All mockups reviewed with team → sign-off on design direction
2. **R5 Week 3-4:** Create interactive Figma prototypes from mockups
3. **R5 Week 5-6:** User testing with prototypes
4. **R5 Week 7-16:** Implement, iterating as needed (mockups stay current)
5. **R6:** Polish mockups based on user feedback, add P1 features
6. **R7:** Add P2 features, document final designs

---

**Every mockup answers a question the user needs to answer.**  
**If a mockup doesn't answer a question, it shouldn't be in the product.**
