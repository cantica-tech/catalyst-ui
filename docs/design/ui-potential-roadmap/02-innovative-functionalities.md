# 02 — Innovative Functionalities Beyond Entity Display

**Date:** 2026-10-08  
**Source:** Catalyst UI Analysis (05), Feature Register (doc/feature-register.md), Ideal Architecture (07)  
**Scope:** 15+ capabilities beyond the current 5 React views that transform Catalyst Studio from a browser into a workspace

---

## The Opportunity

**Today:** Catalyst UI renders:

1. Node detail (entity properties)
2. Journal entries (timeline)
3. Backlog (list view)
4. IAM users/roles (list view)
5. Kernel version header (metadata)

**Feature register:** 128 features to keep, 93 to merge, 6 to drop, 11 to park (doc/feature-register.md).  
**Unexplored:** visualization, collaboration, automation, and discovery patterns that make the system alive.

**This section:** 15+ innovations grouped by user need.

---

## Category 1: Understanding the System (Discovery)

### 1. Dashboard — "What's going on right now?"

**Problem:** New users stare at the interface and don't know where to start.

**Solution:** A **one-screen executive summary** showing:

- **Health cards:** Rule coverage % | Test pass rate | Drift alerts | Module versions
- **Open work:** 3 highest-priority items (backlog status, due soon, blocked)
- **Recent changes:** Last 5 journal entries (who, when, what)
- **Quick stats:** Total rules | Total requirements | Team members | Days since last sync
- **Alerts section:** Unjournaled changes | Rule violations | Stale entities | Pending approvals
- **Quick actions:** "Add rule," "Create requirement," "Review findings," "Sync with remote"

**UX Pattern:** Linear's workspace dashboard, GitHub's personal dashboard, Figma's project hub  
**Why:** First view should answer "am I on track?" without opening 5 panels.

### Mockup: Dashboard

```
╔════════════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Dashboard                                            ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  👁️  System Health at a Glance                      Last sync: now    ║
║  ─────────────────────────────────────────────────────────────────── ║
║                                                                        ║
║  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ ║
║  │ 📋 Rules     │  │ ✅ Tests Pass │  │ ⚠️  Drift    │  │ 👥 Members │ ║
║  │    127       │  │  96%          │  │  2 Alerts   │  │   8 Active │ ║
║  │ ↑ 3 new      │  │ ↑ +1 passing  │  │ ↓ -1 today  │  │            │ ║
║  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ ║
║                                                                        ║
║  📍 What needs attention?                                              ║
║  ─────────────────────────────────────────────────────────────────── ║
║  🔴 [BLOCKING] STEP-89 "Implement rate limiter" (5 days overdue)      ║
║                ↳ Assigned to: alice | Blocked by: module:deploy      ║
║                                                                        ║
║  🟡 [WARNING]  Rule-042 violating in 3 steps (test coverage <80%)     ║
║                ↳ Quick fix: Run auto-fix | Defer to: friday          ║
║                                                                        ║
║  ⚪ [INFO]     Security module v2.1 available (currently v2.0)        ║
║                ↳ Update now | Release notes | Defer                  ║
║                                                                        ║
║  📊 Recent Journal                                                     ║
║  ─────────────────────────────────────────────────────────────────── ║
║  2024-10-08 10:32  🔐 alice approved ADR-005 "API design"            ║
║  2024-10-08 09:15  ✏️  bob modified STEP-89 status to "in-progress"  ║
║  2024-10-08 08:42  🆕 charlie created FEAT-15 "Notifications"        ║
║  2024-10-08 07:50  🔄 system reconciled 3 unjournaled changes        ║
║  2024-10-07 18:30  ✅ all tests passing (96% coverage)               ║
║                                                                        ║
║  🛠️  Quick Actions                                                    ║
║  ─────────────────────────────────────────────────────────────────── ║
║  [+ Rule] [+ Requirement] [+ Step] [View Drift Dashboard] [Search]   ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

### 2. Studio Map — "How does it all fit together?"

**Problem:** New users don't understand the entity types and how they relate.

**Solution:** An **interactive flowchart** showing:

- **All entity types as boxes:** Rule, Requirement, Bug, Feature, Step, Test, Workflow, User, Role, Decision
- **Relationships as labeled edges:** "constrains," "depends on," "is validated by," "approved by," "changed via"
- **Color coding:** By domain (rule storage) or status (passing, failing, orphaned)
- **Click behavior:** Highlight paths (e.g., click Rule → trace all features it constrains), jump to browser filtered by type

**UX Pattern:** Figma's design system panel, Miro's asset browser, Obsidian's graph view  
**Why:** Users grasp the system's _structure_ before diving into instances.

---

### 3. Traceability Explorer — "Why does this exist and what depends on it?"

**Problem:** Users can't follow the chain rule → work → tests → code without manual navigation.

**Solution:** A **bi-directional, interactive dependency chain**:

- **Input:** Any entity (rule, feature, requirement, step, test, code snippet, decision)
- **Output:** Two panes:
  - **Upstream:** What decisions, rules, and requirements led here? (Why?)
  - **Downstream:** What work, tests, and code does this affect? (Impact?)
- **Visualization:** Tree view (text), graph view (visual), timeline (time-ordered)
- **Interaction:** Expand/collapse to show intermediate steps, highlight cascades, filter by type
- **Example:**

  ```
  Rule: "All API endpoints must have rate limiting"
    ↑ From: Requirement REQ-42 "System resilience"
           From: Feature FEAT-12 "Public API v2"
           From: ADR-005 "API design principles"
    ↓ To: Step STEP-89 "Implement rate limiter"
         Test TEST-156 "Rate limit boundaries"
         Test TEST-157 "Rate limit headers"
         Code: middleware/ratelimit.ts
  ```

**UX Pattern:** GitHub's dependency graph, Linear's dependency view, VS Code's "Go to References"  
**Why:** The product's core value—traceability—becomes the primary navigation model.

### Mockup: Traceability Explorer (Tree & Graph Views)

```
╔════════════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Traceability Explorer: Rule-001                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  [🌳 Tree] [🕸️ Graph] [📅 Timeline]  |  Filter: [All ▼]             ║
║                                                                        ║
║  UPSTREAM (Why this rule exists)            DOWNSTREAM (What it affects)║
║  ─────────────────────────────────         ────────────────────────   ║
║                                                                        ║
║  ↑ Approved by ADR-005                     ↓ Constrains 4 Features    ║
║    "API Design Principles"                   • FEAT-001 ✅             ║
║    Status: ✅ Active                         • FEAT-042 ⏳             ║
║    Reviewed by: alice, bob                   • FEAT-089 ❌             ║
║    Approved: 2024-09-15                      • FEAT-155 ⏸️             ║
║                                                                        ║
║  ↑ Required by REQ-42                      ↓ Blocks 12 Steps           ║
║    "System Resilient to Abuse"              Showing: 3 / 12            ║
║    Status: 🟢 Complete                        • STEP-089 ⏳             ║
║    Owner: security-team                      • STEP-090 🟢             ║
║    Due: 2024-11-01 ✅ on track              • STEP-156 ❌             ║
║                                              [+ 9 more]               ║
║  ↑ From FEAT-12                            ↓ Validated by 2 Tests      ║
║    "Public API v2"                           • TEST-156 ✅             ║
║    Status: 🟡 In Progress                    • TEST-157 ✅             ║
║    ETA: 2024-10-31                                                    ║
║    Progress: 60% (6/10 steps done)         ↓ Referenced in Code (5x)   ║
║                                              • src/middleware/...      ║
║  ↑ Mentioned in 2 Journal Entries            • src/config/...          ║
║    • 2024-10-08: alice modified rule       ↓ Related ADRs (conflicts?) ║
║    • 2024-09-15: charlie approved rule       • ADR-008 🟡 (revise)     ║
║                                                                        ║
║  [ 🔍 Expand All ] [ ⊗ Collapse All ] [ 📋 Copy Chain ]               ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

### 4. Drift Dashboard — "Are we consistent?"

**Problem:** Drift is scattered across `catalyst check` output and easy to miss.

**Solution:** A **centralized health monitor** showing:

- **Unjournaled changes:** Files changed outside the UI/CLI with one-click "adopt or revert"
- **Rule violations:** Rules that no longer match deployed code (e.g., "must have tests" but tests exist for 87% of steps)
- **Stale references:** Entities referencing deleted targets, orphaned entities, broken links
- **Migration blockers:** Incomplete migrations, pending reconciliation (RECON) items
- **Version mismatches:** Module versions, kernel versions, dependency drift
- **Status:** Icons + percentages + trend (↑ improving, → stable, ↓ degrading)
- **Quick actions:** Each alert has an "auto-fix," "mark approved," or "defer" button

**UX Pattern:** GitHub's security alerts, Linear's workspace settings, Datadog's dashboard  
**Why:** Drift is the reason for record-keeping; make it visible by default.

### Mockup: Drift Dashboard

```
╔════════════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Drift Dashboard (Health Check)                       ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  Overall Health: 🟡 DEGRADING  [Last check: 5 min ago]  [Recheck now] ║
║                                                                        ║
║  ┌────────────────────────────────────────────────────────────────────┐ ║
║  │ Alerts (7)                             Trend      Auto-Fix         │ ║
║  ├────────────────────────────────────────────────────────────────────┤ ║
║  │                                                                    │ ║
║  │ 🔴 CRITICAL: Unjournaled Changes  (3 files)        ↑ increasing   │ ║
║  │                                                                    │ ║
║  │   src/api/auth.ts  [modified 2024-10-08 14:32]  [View] [Adopt] ║ ║
║  │   src/api/users.ts [modified 2024-10-07 09:15]  [View] [Adopt] ║ ║
║  │   requirements/REQ-100.md [modified 2024-10-06]  [View] [Adopt] ║ ║
║  │                                                                    │ ║
║  │   ⚡ Quick action: [ ✅ Adopt All ] [ 🔄 Revert All ]             │ ║
║  │                                                                    │ ║
║  ├────────────────────────────────────────────────────────────────────┤ ║
║  │ 🟡 WARNING: Rule Violations  (5 rules)            → stable        │ ║
║  │                                                                    │ ║
║  │   RULE-001 "All endpoints need rate limits"                       │ ║
║  │     ✗ 12% of endpoints missing rate limiter                       │ ║
║  │     Affected: FEAT-001, FEAT-042, FEAT-089                        │ ║
║  │     Auto-fix: [ 🔧 Add missing limits ] [ Later ] [ Archive rule ]║ ║
║  │                                                                    │ ║
║  │   RULE-015 "All code must have tests"  (87% compliant)           │ ║
║  │     ✗ 13 files have zero tests                                    │ ║
║  │     Auto-fix: [ 🧪 Generate tests ] [ Review ] [ Exempt files ]  ║ ║
║  │                                                                    │ ║
║  ├────────────────────────────────────────────────────────────────────┤ ║
║  │ ⚪ INFO: Stale References  (2 issues)              → stable        │ ║
║  │                                                                    │ ║
║  │   STEP-042 references deleted STEP-041                           │ ║
║  │     Auto-fix: [ 🔗 Relink ] [ Orphan ] [ Manual ]                │ ║
║  │                                                                    │ ║
║  │   FEAT-089 "Legacy API" orphaned (no requirements)                │ ║
║  │     Action: [ 📋 Create requirement ] [ Archive ] [ Review ]    │ ║
║  │                                                                    │ ║
║  ├────────────────────────────────────────────────────────────────────┤ ║
║  │ ⚪ INFO: Version Mismatches                        ↑ 1 new        │ ║
║  │                                                                    │ ║
║  │   Module: dev-module v2.0 → v2.1 available                        │ ║
║  │     Auto-fix: [ 🆙 Upgrade ] [ Release notes ] [ Later ]         │ ║
║  │                                                                    │ ║
║  │   Kernel: v0.31.1 (current) vs v0.32.0 (available)               │ ║
║  │     Note: Breaking changes. Review before upgrade.                │ ║
║  │                                                                    │ ║
║  └────────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║  📈 Trend Analysis:                                                     ║
║    • Unjournaled changes: 1 → 2 → 3 (↑ growing, last 7 days)         ║
║    • Rule violations: 5 → 4 → 5 (→ stable)                            ║
║    • Stale references: 3 → 2 → 2 (↓ improving)                        ║
║                                                                        ║
║  [ 🚨 Fix Critical Only ] [ 🔧 Fix All ] [ 📧 Email Report ] [ Cancel]║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

## Category 2: Taking Action (Command Execution)

### 5. Judgment Inbox — "What decisions need me right now?"

**Problem:** Agents propose changes (/adopt command, AI findings, auto-fixes), but users don't know about them.

**Solution:** An **activity-feed-style inbox** with decision requests:

- **Types of proposals:**
  - "Should I adopt this unjournaled change?" (with a diff)
  - "I found 3 rules that aren't constraining any work—should we archive them?" (with links)
  - "This test is slow; should we split it?" (with metrics)
  - "Deploy to production?" (reconciliation of remotes)
  - "Module v2.4.0 is available. Upgrade?" (with changelog)
- **UI per proposal:**
  - Brief description (≤150 chars)
  - Pre-assembled evidence (diff, metrics, links)
  - Button grid: "Approve," "Request Changes," "Defer," "Reject"
  - One-click journal entry with full details
  - Comment thread (async collaboration)
- **Filtering/sorting:** By type, urgency, age, assignee
- **Notifications:** Unread count in activity bar, optional email digest

**UX Pattern:** GitHub's PR review inbox, Linear's inbox, Slack's notification center  
**Why:** Transforms CLI judgment requests into human workflows without CLI friction.

### Mockup: Judgment Inbox

```
╔════════════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Judgment Inbox (5 unreviewed)                       ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  Filter: [All ▼] [⏰ Age ▼] [👤 Assignee ▼] [Status: Pending ▼]      ║
║                                                                        ║
║  ─────────────────────────────────────────────────────────────────── ║
║  🔴 URGENT: Module Reconciliation  [just now]  by: alice             ║
║  ─────────────────────────────────────────────────────────────────── ║
║  "Deploy to production? (staging → main branch)"                      ║
║                                                                        ║
║  📊 EVIDENCE:                                                          ║
║    • 5 new commits since last sync                                    ║
║    • All tests passing (96% coverage)                                 ║
║    • Staging is 3 days behind main                                    ║
║    • Zero conflicts detected                                          ║
║                                                                        ║
║  [ ✅ Approve ]  [ ⚠️  Changes ]  [ ⏸️  Defer ]  [ ❌ Reject ]         ║
║                                                                        ║
║  ─────────────────────────────────────────────────────────────────── ║
║  🟡 PROPOSED: Archive 3 Orphaned Rules  [2 hrs ago]  by: agent(claude)║
║  ─────────────────────────────────────────────────────────────────── ║
║  "Rules RULE-003, RULE-015, RULE-089 have zero dependents."           ║
║                                                                        ║
║  📊 EVIDENCE (click to expand):                                        ║
║    • RULE-003: Created 18mo ago, last modified 12mo ago               ║
║    • RULE-015: 0 features, 0 steps, 0 tests referencing              ║
║    • RULE-089: Superceded by RULE-042 (per ADR-005)                  ║
║    • Cost: Archiving saves 120 tokens in init cost                   ║
║                                                                        ║
║  [ ✅ Approve ]  [ ⚠️  Changes ]  [ ⏸️  Defer to friday ]  [ ❌ Reject] ║
║  📝 Add comment... (alice, bob can reply)                              ║
║                                                                        ║
║  ─────────────────────────────────────────────────────────────────── ║
║  ⚪ SUGGESTED: Rewrite REQ-42 (technical debt)  [6 hrs ago] by: agent ║
║  ─────────────────────────────────────────────────────────────────── ║
║  "Requirement is ambiguous; AI can clarify for approval."             ║
║                                                                        ║
║  BEFORE:                                  AFTER (AI-proposed):       ║
║  "System must be resilient"             "System must handle 10k      ║
║                                         RPS and 99.9% uptime"        ║
║                                                                        ║
║  [ ✅ Use AI version ]  [ ✏️  Edit first ]  [ 🔍 Review ]  [ ❌ Keep ]║
║                                                                        ║
║  ─────────────────────────────────────────────────────────────────── ║
║  ⚪ QUESTION: Should we add API rate limiting?  [1 day ago] by: bob   ║
║  ─────────────────────────────────────────────────────────────────── ║
║  (with comment thread)                                               ║
║  📝 Add comment... (4 replies below)                                   ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

### 6. Command Palette + Agent Console

**Problem:** Users must know the CLI or open documentation to figure out what's possible.

**Solution:** A **fuzzy-searchable command palette** integrated with an **agent result viewer**:

- **Palette features:**
  - Type to search ~16 slash commands (from `catalyst spec <cmd>`)
  - Quick help pops up (1.5k tokens from spec, not full docs)
  - Select → preview the command's intent and output schema
  - Run with arguments or run interactively
  - Dispatch to any agent (Claude Code, Cursor, local, etc.)
- **Agent console** (side panel):
  - Streamed output as it arrives (if agent supports `--output-format stream-json`)
  - Token counter (input, output, total cost)
  - Run history (past 20 commands with results, timings, cost)
  - Ability to copy, export, or re-run a past command
  - Agent selection (which model to use for the next command)
- **Example workflow:**
  1. User presses Cmd+K (or clicks palette icon)
  2. Types "create req"
  3. Sees "create-requirement" command with preview: "Define a new work item… args: [name, description, affected-rules]"
  4. Fills in fields in a form (generated from command spec)
  5. Chooses which agent to dispatch to
  6. Console shows real-time output: "Creating REQ-342 in development/ requirements/ ... done in 2.3s (1.2k tokens)"

**UX Pattern:** VS Code's command palette, Cursor's command mode, Linear's AI command center  
**Why:** Lowers friction for non-CLI-fluent users and makes agent costs visible.

### Mockup: Command Palette + Agent Console

```
┌────────────────────────────────────────────────────────────────────────┐
│ > create-requirement                              [Cmd+K to search]    │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│ 📋 create-requirement — Define a new work item                       │
│ From: catalyst spec create-requirement                               │
│                                                                        │
│ Name:           ________________  [required]                         │
│ Description:    ________________  [1000 chars]                       │
│ Affected Rules: [RULE-001 ✓]     [Add more]                         │
│ Priority:       [High ▼]                                             │
│ Assign to:      [alice ▼]                                            │
│ Module:         [development ▼]                                      │
│                                                                        │
│ Dispatch to:    [Claude Code ▼]   (Model: claude-opus)              │
│                                                                        │
│ [ RUN ]  [ PREVIEW ]  [ CANCEL ]                                     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

After clicking RUN:

╔════════════════════════════════════════════════════════════════════════╗
║ 📊 Agent Console — Command: create-requirement                         ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║ Dispatched to: Claude Code (claude-opus)  🟢 Running                  ║
║ Started: 2024-10-08 10:32:15                                          ║
║                                                                        ║
║ ┌────────────────────────────────────────────────────────────────────┐ ║
║ │ ✅ Validating inputs...                                           │ ║
║ │ ✅ Checking for name conflicts...                                 │ ║
║ │ ⏳ Creating REQ-354 in development/requirements/...               │ ║
║ │ ⏳ Linking to RULE-001, RULE-042...                               │ ║
║ │ ⏳ Journaling...                                                  │ ║
║ │ ...                                                              │ ║
║ │ ✅ Done!                                                         │ ║
║ │                                                                  │ ║
║ │ Created: development/requirements/REQ-354-example.md            │ ║
║ │ Links: [View] [Navigate to new requirement]                     │ ║
║ │                                                                  │ ║
║ └────────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║ 📈 Cost Report:                                                        ║
║  Input tokens:   1,240                                                ║
║  Output tokens:  340                                                  ║
║  Total:          1,580 tokens  ($0.02)                                ║
║                                                                        ║
║ ⏱️  Duration: 3.2 seconds                                              ║
║                                                                        ║
║ Recent history:                                                        ║
║  [ 10:32 create-requirement    ] 1.58k tokens ✅                       ║
║  [ 10:15 list-rules filter:API ] 0.34k tokens ✅                       ║
║  [ 09:50 create-step           ] 1.20k tokens ✅                       ║
║  [ 09:22 audit-module          ] 5.10k tokens ✅                       ║
║                                                                        ║
║ [ Copy ] [ Export ] [ Rerun ] [ Clear history ]                        ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

### 7. Batch Operations

**Problem:** Changing 10 rules requires 10 manual edits.

**Solution:** A **multi-select workflow** for bulk actions:

- **Selection:** Click checkboxes on any list view (backlog, rules, requirements)
- **Bulk actions:**
  - Change status (multiple items to "In Progress")
  - Add labels/tags
  - Link to a new rule
  - Assign to team members
  - Export as CSV or JSON
  - Propose to agent (e.g., "Rewrite these 3 requirements for clarity")
- **Undo:** All changes journaled; rollback is a single command

**UX Pattern:** Gmail's select + archive, Linear's board bulk edit, Figma's multi-select  
**Why:** Power users do bulk work; the UI should support it.

---

## Category 3: Seeing Change (Visualization & History)

### 8. Journal Timeline + Diff

**Problem:** Journal is a flat list of entries; understanding what changed requires reading each one.

**Solution:** A **rich timeline view** with:

- **Visual timeline:** Vertical or horizontal axis of time, entries as cards or bubbles
- **Grouping:** By date, author, entity type, or impact (rule changes, work completed, approvals)
- **Diff view:** Click any entry → side-by-side diff of what changed (before/after)
- **Causality chains:** Entries that reference each other are visually linked (e.g., entry 42 was triggered by entry 41)
- **Filter:** By author, entity type, date range, impact severity
- **Annotations:** Hover to see full reason, click to jump to related entity
- **Blame integration:** For code files, show which journal entry caused this line to exist (via Git integration)

**UX Pattern:** GitHub's insights timeline, Git lens blame, Notion's version history, Loom's timeline with annotations  
**Why:** Auditing and understanding causality should be visual and fast.

### Mockup: Journal Timeline + Diff View

```
╔════════════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Journal Timeline (Last 30 days)                      ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  Filter: [All ▼] [By: Date ▼] [Author: alice ▼] [Type: Rules ▼]     ║
║                                                                        ║
║  2024-10-08  10:32  🔐 alice approved ADR-005                          ║
║  ─────────────────────────────────────────────────────────────────── ║
║  │                                                                   │ ║
║  │ Decision: "API Design Principles"                                │ ║
║  │ Status: ✅ Approved (2 reviewers, 0 objections)                   │ ║
║  │ References: ADR-005, RULE-001, RULE-002, REQ-42                 │ ║
║  │                                                                   │ ║
║  │ 💬 Comment: "Aligns with security audit findings"                │ ║
║  │ [ 📄 View full ] [ 🔗 View related ] [ 📋 Copy ]                │ ║
║  │                                                                   │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║  2024-10-08  09:15  ✏️  bob modified STEP-89 status                    ║
║  ─────────────────────────────────────────────────────────────────── ║
║  │                                                                   │ ║
║  │ Modified: STEP-89 "Implement rate limiter"                       │ ║
║  │ Status: pending → in-progress                                    │ ║
║  │                                                                   │ ║
║  │ BEFORE:                          AFTER:                          │ ║
║  │ ┌─────────────────────────────┐  ┌─────────────────────────────┐ ║
║  │ │ Status: pending             │  │ Status: in-progress         │ ║
║  │ │ Assignee: unassigned        │→ │ Assignee: bob (alice)       │ ║
║  │ │ DueDate: 2024-10-20         │  │ DueDate: 2024-10-15         │ ║
║  │ │                             │  │ BlockedBy: none → DEP-42    │ ║
║  │ └─────────────────────────────┘  └─────────────────────────────┘ ║
║  │                                                                   │ ║
║  │ Triggered by: REQ-42 "System resilience"                         │ ║
║  │ Affects: 2 tests, 3 downstream steps                             │ ║
║  │                                                                   │ ║
║  │ [ 📄 Full diff ] [ 🔙 Undo ] [ 🔗 View STEP-89 ]                 │ ║
║  │                                                                   │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║  2024-10-08  08:42  🆕 charlie created FEAT-15                         ║
║  ─────────────────────────────────────────────────────────────────── ║
║  │                                                                   │ ║
║  │ New Feature: "Notification Center"                               │ ║
║  │ Linked to: REQ-100, REQ-101, RULE-025                            │ ║
║  │ Triggered by: ADR-010 "User engagement strategy"                 │ ║
║  │                                                                   │ ║
║  │ [ 📄 View ] [ 📋 Copy ]                                          │ ║
║  │                                                                   │ ║
║  └─────────────────────────────────────────────────────────────────┘ ║
║                                                                        ║
║  [← Older entries]                                  [Newer entries →] ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

### 9. Impact Analysis & Simulation

**Problem:** Changing a rule might break something, but the UI doesn't warn you.

**Solution:** A **red-highlight cascade** that shows:

- **Input:** Change a rule or requirement
- **Immediate output:** "If you make this change:"
  - [ ] 3 features are affected
  - [ ] 5 steps depend on this
  - [ ] 2 tests will fail
  - [ ] 1 ADR conflicts with this
- **Visual:** Entities affected light up in red across all open views
- **Drill-down:** Click each category to see which specific items break
- **Simulation mode:** Make the change _locally_ and see the impact before committing
- **Approve:** Once verified, click "Approve" and the system journals the change with impact notes

**UX Pattern:** Figma's constraint solver and layout warnings, Excel's formula dependencies, Terraform's plan output  
**Why:** Users gain confidence making changes when they can preview impact first.

### Mockup: Impact Analysis

```
╔════════════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Impact Preview: Changing Rule-001                    ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║ 🔴 SIMULATION: Changing "All API endpoints must have rate limiting"   ║
║    FROM: "required: true"                                              ║
║    TO:   "required: false"                                             ║
║                                                                        ║
║ 📊 IMPACT ANALYSIS                                                     ║
║ ─────────────────────────────────────────────────────────────────────  ║
║                                                                        ║
║  ⚠️  DIRECTLY AFFECTED:                                                 ║
║  ├─ [ 🔴 ] 4 Features will violate this rule                           ║
║  │  └─ FEAT-001 "Public API v2"        (will break constraint)         ║
║  │  └─ FEAT-042 "Analytics API"        (will break constraint)         ║
║  │  └─ FEAT-089 "Admin API"            (will break constraint)         ║
║  │  └─ FEAT-155 "Legacy API compat"    (will break constraint)         ║
║  │                                                                     ║
║  ├─ [ 🟡 ] 12 Steps are now optional (could be skipped)                ║
║  │  └─ STEP-089 "Implement rate limiter"    [will still pass]          ║
║  │  └─ STEP-090 "Configure limits"          [will still pass]          ║
║  │  └─ STEP-156 "Load test at peak"         [⚠️ may fail]               ║
║  │  └─ (+ 9 more steps)                                                ║
║  │                                                                     ║
║  ├─ [ 🟢 ] 3 Tests might now pass (were failing because rule required) ║
║  │  └─ TEST-089 "No rate limit header"      [✅ will pass]             ║
║  │  └─ (+ 2 more)                                                      ║
║  │                                                                     ║
║  └─ [ ⚪ ] 1 ADR references this rule                                    ║
║     └─ ADR-005 "API design principles"      [⚠️ conflict alert]         ║
║                                                                        ║
║ 🚨 CASCADING RISKS:                                                     ║
║  • If FEAT-001 breaks, it affects REQ-42 and REQ-89 (2 requirements)  ║
║  • Those requirements are blocking EPIC-2 (3 months of work)          ║
║  • Estimated impact: HIGH (4/5)                                       ║
║                                                                        ║
║ ✅ CONFIDENCE: This change will break things (high certainty)          ║
║                                                                        ║
║ 📝 SUGGESTED APPROACH:                                                 ║
║  Instead of removing the rule, consider:                              ║
║    A) Mark as "deprecated: true" (grace period)                       ║
║    B) Make it "required: false, but recommended: true"                ║
║    C) Migrate only FEAT-155 first (legacy compat)                     ║
║                                                                        ║
║ [ ✅ Approve Change ] [ ⚠️  Adjust Approach (A/B/C) ] [ ❌ Cancel ]   ║
║                                                                        ║
║ Linked entities will be highlighted red across all open views ↓ ↓ ↓   ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

### 10. Roadmap Timeline & Dependencies

**Problem:** Roadmap items are in a list; it's hard to see milestones and dependencies.

**Solution:** A **Gantt-style timeline** with:

- **Horizontal axis:** Time (weeks, quarters, years)
- **Rows:** Roadmap items, grouped by milestone or domain
- **Visual:** Bars showing duration, colors for status (planned, in progress, completed, blocked)
- **Dependencies:** Lines connecting related items, showing blocking relationships
- **Drag to reschedule:** Adjust timelines (propagates impact analysis)
- **Filter:** By domain, team, milestone, priority
- **Drill-down:** Click an item to see its requirements, active work, and blocking issues

**UX Pattern:** Jira's roadmap, Linear's timeline, Asana's timeline view  
**Why:** Visual planning is faster than text lists.

### Mockup: Roadmap Timeline (Gantt View)

```
╔════════════════════════════════════════════════════════════════════════╗
║ Catalyst Studio — Roadmap Timeline: Q4 2024 Plan                       ║
╠════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  Oct           Nov           Dec                                       ║
║  ├─────────────┼─────────────┼─────────────┤                         ║
║                                                                        ║
║  🎯 MILESTONE: API v2 Launch                                           ║
║  ─────────────────────────────────────────────────────────────────   ║
║                                                                        ║
║  FEAT-001 "Public API v2"         ████████░░░  (60% done, on track)  ║
║  ├─ Req-42 "Resilience"           ████████░░░  (Due: 2024-11-15)    ║
║  ├─ Req-89 "Performance"          ████░░░░░░░  (Blocked by FEAT-007)║
║  └─ Req-155 "Rate Limits"         ░░░░░░░░░░░  (Pending: not started)║
║                                                                        ║
║  FEAT-007 "Auth & Security"       ████████████ (100%, shipped)        ║
║  └─ Req-012 "OAuth 2.0"           ████████████ (Done: 2024-10-05)   ║
║                                                                        ║
║  TEST-Coverage "80%+ Coverage"    ████░░░░░░░  (Blocked by FEAT-001) ║
║  ────────────────────── blocking line ──────→ ────────────────────  ║
║                                                                        ║
║  🎯 MILESTONE: Admin Portal v1                                         ║
║  ─────────────────────────────────────────────────────────────────   ║
║                                                                        ║
║  FEAT-042 "IAM Admin"              ░░░░░░░░░░░  (0% done, at risk)   ║
║  ├─ Req-200 "User Management"     ░░░░░░░░░░░  (Due: 2024-12-01)    ║
║  └─ Req-201 "Role-Based Access"   ░░░░░░░░░░░  (Pending)            ║
║                                                                        ║
║  🎯 MILESTONE: Notifications                                           ║
║  ─────────────────────────────────────────────────────────────────   ║
║                                                                        ║
║  FEAT-015 "Notification Center"   ░░░░░░░░░░░  (0%, Not started yet)║
║  ├─ Req-100 "Email Alerts"        ░░░░░░░░░░░  (Due: 2024-12-15)    ║
║  └─ Req-101 "In-App Feed"         ░░░░░░░░░░░  (Due: 2024-12-15)    ║
║                                                                        ║
║  Legend:  ████ complete   ░░░░ not started   ⚠️ at risk   🔴 blocked  ║
║           ────→ dependency   ◆ milestone      👤 assignee              ║
║                                                                        ║
║  Controls: [ + Milestone ] [ + Feature ] [ 📊 Export ] [Print]        ║
║            [Filter: Team ▼] [Filter: Status ▼] [Zoom: ▼]             ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝
```

---

## Category 4: Collaboration & Decision-Making

### 11. Approval Workflows

**Problem:** Decisions need sign-off, but the system doesn't enforce it.

**Solution:** A **gates and approvals system**:

- **Gate definition:** Rules like "changes to security rules need 2 approvals from security team"
- **Proposal UI:** User wants to change a rule → click "Propose" → creates a proposal card
- **Reviewers notified:** Appear in Inbox with a diff and decision context
- **Approval UI:** One-click approve, or "Request Changes" with comment
- **Journal entry:** Once approved, the change is automatically journaled with approvers listed
- **Audit trail:** Who approved, when, any objections or comments

**UX Pattern:** GitHub's branch protection + code review, Linear's custom workflows  
**Why:** Governance isn't optional; the UI should enforce it.

---

### 12. Entity Change History & Rollback

**Problem:** If a user makes a mistake, they must manually undo it; there's no "undo" button.

**Solution:** A **version history panel** for any entity:

- **List:** All prior versions of this entity (title, description, status, fields) with dates and authors
- **Diff:** Click any version to see changes from the prior one
- **Rollback:** "Revert to this version" creates a new journal entry explaining the reason
- **Compare:** Side-by-side of any two versions
- **Annotations:** See ADRs and decisions that changed fields

**UX Pattern:** Notion's version history, GitHub's commit history, Figma's version history  
**Why:** Mistakes are reversible; users gain confidence making changes.

---

## Category 5: Sense-Making & Learning

### 13. Rule Browser & Constraint Explorer

**Problem:** Rules are scattered in domain docs; users don't know what constraints exist.

**Solution:** A **searchable, filterable rules gallery**:

- **List/grid view:** All rules in the system with summaries
- **Filtering:** By domain, type (must, should, may), status (active, deprecated, proposed)
- **Annotation:** Who created it, which ADR justifies it, which work depends on it
- **Search:** Full-text or regex (e.g., "all rules about testing")
- **Drill-down:** Click a rule to see the traceability chain
- **Proposals:** "Add new rule" creates a proposal that goes to Inbox

**UX Pattern:** GitHub's documentation search, Linear's database filter, Figma's component browser  
**Why:** Rules are the heart of the system; they deserve a first-class browser.

---

### 14. Analysis & Findings Dashboard

**Problem:** Agents run `/analysis` to extract defects from code, but results disappear.

**Solution:** A **findings board** showing:

- **Analysis runs:** When the last analysis was run, by whom, how many findings
- **Findings list:** "Code doesn't match rule REQ-42" → links to the code, the rule, and proposed fix
- **Triage:** Mark as "real defect," "false alarm," "defer," or "propose fix"
- **Metrics:** Defect count over time, trend (↑ getting worse, → stable, ↓ improving)
- **Agent loop:** Click "Propose fix" → prepares a brief for the agent → streams result → user approves → journaled

**UX Pattern:** GitHub's security findings, Linear's analytics dashboard  
**Why:** Finding defects is useless if users don't see them.

---

### 15. Module Administration & Ecosystem

**Problem:** Modules are downloaded but never shown or managed in the UI.

**Solution:** A **module panel** with:

- **Installed modules:** Current version, when it was released, compatibility
- **Module browser:** Search available modules from the release store
- **Module detail:** README, schema, example entities, required kernel version
- **Install/upgrade/remove:** One-click with impact analysis (will this break anything?)
- **Module-specific settings:** If a module has configurable parameters
- **Dependency tree:** Which modules depend on each other

**UX Pattern:** VS Code's extension marketplace, npm's package manager  
**Why:** Modules are composable components; the UI should surface them.

---

### 16. Collaboration & Team Visibility

**Problem:** Who is working on what? What are team members doing?

**Solution:** A **team dashboard** showing:

- **Team members:** List with roles, recent activity, current assignment
- **Work in progress:** Per-person summary (3 items in progress, 1 blocked, 2 pending review)
- **Activity feed:** Real-time updates (Bob moved BUG-42 to Done, Alice proposed a rule change)
- **Mentions & @ replies:** Unread messages or discussions that involve you
- **Workload balance:** Who's overloaded, who has capacity for new work

**UX Pattern:** Linear's team views, GitHub's team activity, Slack's workspace view  
**Why:** Catalyst tracks work; the UI should show who's doing what.

---

## Summary Table

| #   | Feature                   | Category      | Impact   | Effort |
| --- | ------------------------- | ------------- | -------- | ------ |
| 1   | Dashboard                 | Discovery     | High     | Medium |
| 2   | Studio Map                | Discovery     | High     | Medium |
| 3   | Traceability Explorer     | Discovery     | Critical | High   |
| 4   | Drift Dashboard           | Discovery     | Critical | Medium |
| 5   | Judgment Inbox            | Action        | Critical | Medium |
| 6   | Command Palette + Console | Action        | High     | Medium |
| 7   | Batch Operations          | Action        | Medium   | Low    |
| 8   | Journal Timeline + Diff   | Visualization | High     | High   |
| 9   | Impact Analysis           | Visualization | Critical | High   |
| 10  | Roadmap Timeline          | Visualization | Medium   | High   |
| 11  | Approval Workflows        | Collaboration | High     | Medium |
| 12  | Change History & Rollback | Collaboration | Medium   | Low    |
| 13  | Rule Browser              | Learning      | High     | Low    |
| 14  | Analysis & Findings       | Learning      | High     | Medium |
| 15  | Module Administration     | Learning      | Medium   | Low    |
| 16  | Team Visibility           | Collaboration | Medium   | Medium |

---

## Next Steps

**Phase P0 (MVP, R5):** Dashboard, Inbox, Traceability Explorer, Drift Dashboard  
**Phase P1 (Polish, R6):** Journal Timeline, Command Palette, Approval Workflows, Rule Browser  
**Phase P2 (Advanced, R7):** Impact Analysis, Roadmap Timeline, Analysis Findings, Module Admin

Each builds on the philosophy (01) and visualizations (03).
