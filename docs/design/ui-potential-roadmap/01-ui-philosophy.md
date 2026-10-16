# 01 — UI Philosophy & Guiding Principles

**Date:** 2026-10-08  
**Source:** Catalyst UI Analysis (05), Brand & Portability (09), Ideal Architecture (07)  
**Scope:** Core design principles for Catalyst Studio beyond simple entity display

---

## The Problem We're Solving

**Today:** Catalyst users see:

- 5 React views (Node, IAM user, IAM role, Journal, Backlog) as raw lists
- A VS Code tree inspector showing entities without context
- No visual connection between rules, work, steps, tests, and decisions
- Token cost: 72–81k tokens per session start + operation

**Users ask:** "Where am I in this system? How do all these pieces relate? Why does this rule exist?"

**Result:** The product's unique value — *verifiable project memory* — is invisible.

---

## Core Insight: Context is King

Catalyst isn't a task tracker, document manager, or even a governance tool. It's a **memory system** that answers:

- *Why* does this rule exist?
- *What* depends on this decision?
- *Who* approved this change and when?
- *How* is the system drifting from its declared state?

**The UI should make this obvious in every interaction.** The traceability chain (rule → feature → requirement → step → test → code → journal) is the UI, not something you drill down to find.

### Visual: Memory System Revealed

```
WHAT USERS NEED TO UNDERSTAND:

  Decision (ADR-005: "API design principles")
       ↓
  Rule ("Rate limit required on all endpoints")
       ↓
  Feature ("Public API v2")
       ↓
  Requirement ("System must handle 10k RPS")
       ↓
  Steps (4: implement, config, document, metrics)
       ↓
  Tests (2: boundaries, headers)
       ↓
  Code (middleware/ratelimit.ts)
       ↓
  Journal ("alice approved on 2024-10-08")

TODAY'S UI: You see "Rate limit" in a list. Good luck finding the chain.

CATALYST STUDIO: Click "Rate limit" → see the full chain visually:
  - Up: Why does this rule exist? (the decision)
  - Down: What work/tests depend on it? (the implementation)
  - Side: What else in the API domain? (related rules)
  - Across: Who approved this? (decision thread)
```

---

## Five Laws for Catalyst Studio UI

### Law 1: Traceability is the Default View

Every entity should show its chain immediately:

- **Up:** Which rules, features, and decisions led here?
- **Down:** What work, tests, and code depend on this?
- **Sideways:** What else is at this level?

**Example:** Click a rule, see it highlighted in:

- Which features it constrains
- Which steps it blocks or enables
- Which tests validate it
- Which decisions cite it
- Which journal entries modified it

**Not:** Click a rule, see its properties, then manually navigate to related things.

### Law 2: Causality is Visual, Not Textual

Dependencies, imports, and causality should be **graphical first**:

- Nodes (entities) and edges (relationships) form the visual language
- Graph layouts reveal system shape: tight clusters, loose coupling, bottlenecks
- Color, size, and position communicate state (passing/failing, blocked, orphaned)
- Animation shows what changed between versions

**Not:** "See RELATED section with a list of 12 IDs that mean nothing"

**Inspiration:**

- Figma's "select all nearby" highlighting
- GitHub's dependency graph and network visualization
- Linear's custom views and filters
- VS Code's outline and breadcrumb navigation

### Law 3: Context Compounds (Progressive Disclosure)

Start with the high-level story, reveal details on demand:

1. **Dashboard:** "Here's the system's health and open work at a glance"
2. **Traceability explorer:** "Here's how these pieces connect"
3. **Entity detail:** "Here are the specifics of this one thing"
4. **Timeline/history:** "Here's what changed and why"

Each layer answers a different question without overwhelming the user.

**Not:** Show all 30 fields and 50 related items on every view.

### Law 4: Drift is Always Visible

Health status, violations, and inconsistencies shouldn't be hidden in a diagnostics panel. They should be:

- Woven into every view (red highlights, warning icons, status badges)
- Flowing in like notifications (Inbox pattern from Linear/GitHub)
- Actionable with one click (propose fix, acknowledge, defer)

**Example:** A rule that no longer constrains any work should appear *faded* across the entire system, not just in a "stale entities" report.

### Law 5: Decisions are First-Class

ADRs, rules, constraints, and owner decisions are not documentation appendices—they're **active players** in the UI:

- Quote decisions in entity details (why this field is immutable, why this state transition exists)
- Link every constraint to the rule or decision that created it
- Show decision history (this rule had 3 versions; here's why)
- Make approvals and gates visible as part of the normal flow

**Not:** "See the related ADR" at the bottom of a page.

---

## The "Aha!" Moment (Onboarding Goal)

When a new user opens Catalyst Studio for the first time, they should instantly understand what makes it different:

```
1. They see a DASHBOARD
   → Shows project health, open work, rules, recent changes
   → One screen, no scrolling needed for the "executive summary"

2. They click a RULE
   → Red highlight cascades through the system (what depends on this?)
   → They see a GRAPH showing: feature → requirement → step → test → code
   → Blue arrows show the chain upward: decision → ADR → owner
   → They understand: "This isn't arbitrary; it's traced and justified"

3. They click an UNRECORDED CHANGE (drift alert)
   → INBOX shows two options: "Adopt this change" or "Revert"
   → Behind the scenes: agent has prepared a proposal with a diff
   → They approve with one click; the system journals it
   → No manual editing governed files, no "what do I write here?"

4. They ask: "How does this all fit together?"
   → STUDIO MAP shows a flowchart of all entity types and relationships
   → Not an org chart or swimlanes—a traceability map
   → Click any box, see the entity browser filtered to that type
   → They get it: "This is the schema of our project memory"
```

Result: **"Oh, I can trust this because everything is traced and journaled. I can change things knowing the why stays recorded."**

---

## Design Principles (Derived from Laws)

### Principle 1: Show, Don't Tell

- Use visual indicators (color, position, size, animation) before text labels
- Let users *see* the shape of the system, not read a description

### Principle 2: Reduce Cognitive Load

- One question per screen (dashboard: what's the status? explorer: how's it connected? detail: what are the specifics?)
- Don't show all options everywhere
- Hide complexity until the user asks for it

### Principle 3: Make Judgment Decisions Obvious

- When the CLI would ask an agent a judgment question, the UI pre-assembles a brief and makes it a human choice
- "Approve," "Reject," "Request Changes"—not free-form text
- Result is journaled immediately

### Principle 4: Respect the Traceability Chain

- Every edit, creation, or state change is recorded with *why*
- Never let an entity exist without knowing its origin
- "Unjournaled changes" are a first-class alert, not an afterthought

### Principle 5: Make Drift Visible by Default

- Rule violations and inconsistencies should appear *in the views users care about*, not hidden in a separate panel
- Use color, badges, and highlights; never bury warnings
- "Orphaned" entities (nothing depends on them) should fade visually

### Principle 6: One Source of Truth

- The Python CLI/engine is the single source of truth (Law 1 from ideal-architecture)
- The UI reads the engine's JSON-RPC output; never duplicates parsing
- Module schemas drive UI rendering (no hard-coded field lists)

---

## Design Goals (Measurable)

| Goal | Target | How to measure |
|---|---|---|
| **Time to understanding** | <1 min for new users | Onboarding flow + user testing |
| **Clicks to take action** | ≤3 clicks for 90% of workflows | Telemetry + usability testing |
| **Token cost reduction** | CLI ≤ 3k tokens vs. 72k today | Token meter in UI + measurements |
| **Drift visibility** | 100% of violations visible in main views | Coverage audit (every view includes drift) |
| **Traceability completeness** | Every entity shows its chain on first load | Data completeness audit |
| **Module portability** | Second module works with zero UI changes | Implement a test module (e.g., legal-review) |

---

## What Changes from Today

| Aspect | Today | After These Laws |
|---|---|---|
| **Entity view** | Text list of properties | Visual graph with context chain |
| **Navigation** | "See related items" list | Highlighted cascade of dependencies |
| **Error handling** | Problems panel with ID codes | Drift alerts in-context with one-click fixes |
| **Judgment requests** | Agent prompt ("approve this?") | UI pre-assembles brief + human clicks button |
| **Module data** | Hard-coded fields (SE module only) | Schema-driven (works for any module) |
| **Agent integration** | Fire-and-forget chat injection | Structured dispatch with run history + cost meter |
| **Onboarding** | 30-minute read of BOOTSTRAP | 3-minute dashboard + interactive walkthrough |

---

## Summary

**Catalyst Studio is not another task tracker or document manager.**  
It's the visual interface to *verifiable project memory.*

Every decision, constraint, and rule is visible, traced, and justified.  
Users don't ask "what do I do?"—the UI makes it obvious.  
They don't ask "why does this exist?"—the chain is there.  
They don't ask "is the system consistent?"—drift is highlighted everywhere.

The UI should make it instantly clear: **This is what happens when you give a project a memory.**
