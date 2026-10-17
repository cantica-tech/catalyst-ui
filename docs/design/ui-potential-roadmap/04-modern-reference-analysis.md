# 04 — Modern UI Reference Analysis: Lessons from Online Products

**Date:** 2026-10-08  
**Source:** Analysis of GitHub, Linear, Figma, Notion, Loom, VS Code, Miro, Obsidian  
**Scope:** Patterns, design decisions, and UX principles from best-in-class products that apply to Catalyst Studio

---

## The Research Method

For each product below, I examined:

1. **Core value proposition** — what problem does it solve?
2. **Primary navigation** — how do users find what they need?
3. **Entity visualization** — how does it show relationships?
4. **Collaboration patterns** — how do teams work together?
5. **Change management** — how does it track and review changes?
6. **Onboarding** — how does a new user understand the system?
7. **Applicable lessons** — which ideas fit Catalyst's unique needs?

---

## 1. GitHub — Trust & Traceability in Code

### Core Value

Distributed version control with a trace of _who changed what and why_ (commits, code review, blame).

### Key Patterns We Can Steal

**1.1 Branch Protection + Approval Gates**

- A rule (e.g., "main requires 2 approvals before merge") is _enforceable_ and visible
- Users see the gate upfront; proposals are rejected at the gate, not silently
- Lesson: **Catalyst should enforce approval gates visibly.** If a rule change needs 2 approvals, the UI should show the gate and require approvers. (See 02-functionalities, feature #11.)

**1.2 Dependency Graph**

- A commit in one repo might be required by 50 other repos (the network is visible)
- Users see the shape of their dependencies without drilling into each one
- Lesson: **Show Catalyst's dependency graph by default.** Rules → requirements → steps → tests. Make the shape obvious, not hidden.

**1.3 Blame View**

- Hover any line → see who wrote it, when, and the commit message (why)
- The _reason_ is always one click away
- Lesson: **Catalyst should support "blame" or "lineage" on any field.** Click a rule's status → see who changed it, when, why (from the journal entry reason).

**1.4 PR Review Flow**

- Propose a change → reviewers see a diff → they comment on specific lines → conversation lives in one place → approval gates the merge
- The _decision process_ is captured, not just the final decision
- Lesson: **Catalyst's approval workflows should capture the full decision thread.** Comments, approvals, requests for changes—all journaled together.

**1.5 Notifications & Inbox**

- GitHub sends notifications for "review requested," "changes requested," "approved," "merged"
- Users can focus on their role (reviewer, author, stakeholder) without seeing everything
- Lesson: **Catalyst should send smart notifications.** "You're assigned," "Your approval is needed," "Someone blocked your work." Not "entity X was created" (noise).

### Lessons Summary

✅ Enforce gates visibly  
✅ Show dependency graphs  
✅ Blame/lineage for every field  
✅ Capture decision threads  
✅ Smart, role-based notifications

---

## 2. Linear — Workflow, Hierarchies & Speed

### Core Value

Fast, opinionated issue tracking with deep integrations and team workflows.

### Key Patterns We Can Steal

**2.1 Workspace Overview (Dashboard)**

- One screen shows: WIP limits per team, due soon, backlog summary, recent updates, team activity
- New users instantly see "here's the health of the system"
- Lesson: **Catalyst's dashboard should be the first screen.** One look should answer: "Are we on track?" (See 02-functionalities, feature #1.)

**2.2 Nested Hierarchies**

- Projects → cycles → issues → subtasks (up to 4 levels deep)
- At each level, filter, search, and drill into the next
- Lesson: **Catalyst's entity browser should support nesting.** Feature → Requirement → Step → Test. Make hierarchy the navigation model.

**2.3 Custom Fields + Filters**

- Issues have fields: assignee, priority, estimate, labels, deadline
- Filters chain: show me "in:backlog priority:urgent not:blocked"
- Lesson: **Catalyst should expose module fields as filterable columns.** Module.yaml declares fields; UI auto-generates filters and views.

**2.4 Cycle (Sprint) Planning**

- "Set a cycle" for an issue (e.g., "Q1 2025" or "Sprint 3")
- UI shows cycle progress (X/Y complete), burndown, and blockers for the cycle
- Lesson: **Catalyst should support roadmap cycles.** Link features to quarters or milestones; show progress and drift per cycle.

**2.5 AI Command Palette**

- Press Cmd+K → search issues, create issues, run commands, all via natural language
- The interface accepts prose, not just structured input
- Lesson: **Catalyst should have a command palette that understands natural language.** "Create a requirement for rate limiting" → prefilled form. (See 02-functionalities, feature #6.)

**2.6 Inbox (Like Gmail)**

- Central place for all decisions, mentions, approvals, blocked work
- Swipe to mark read, snooze, or move to a folder
- Lesson: **Catalyst's inbox pattern (drift alerts, approvals, findings) is borrowed from Linear.** (See 02-functionalities, feature #5.)

### Lessons Summary

✅ Dashboard as the default view  
✅ Nested hierarchies for navigation  
✅ Filterable custom fields  
✅ Cycle/sprint planning with progress  
✅ AI command palette (prose input)  
✅ Inbox for all decisions

---

## 3. Figma — Collaborative Design with Multiplayer

### Core Value

Real-time collaborative design where multiple people edit simultaneously, with a complete history and comment thread on every decision.

### Key Patterns We Can Steal

**3.1 Selection Info Panel**

- Click an object → right panel shows all its properties (dimensions, colors, constraints, data bindings)
- Properties are organized by category (position, size, fill, stroke, effects)
- Lesson: **Catalyst's entity detail should be organized by category too.** Not all 30 fields on one page; group by "Identity," "Status," "Links," "Constraints." (See 01-philosophy, Law 3: progressive disclosure.)

**3.2 Design Tokens & Variant System**

- Create a token once ("primary color = #0066cc") → use it everywhere
- Change the token → all usages update automatically
- Lesson: **Catalyst rules are like design tokens.** Change a rule → cascade highlights all dependents automatically. (See 02-functionalities, feature #9: impact analysis.)

**3.3 Component Variants**

- One component with multiple versions (button: primary, secondary, disabled, loading)
- Variants are mutually exclusive states (you can't be both "disabled" and "loading")
- Lesson: **Catalyst's workflow states are like variants.** A requirement can be "Proposed," "In Progress," "Blocked," "Done" — but not two at once. Show allowed transitions in the UI.

**3.4 Multiplayer Cursors & Presence**

- See where other team members are editing in real-time
- Each user has a color and their cursor is visible
- Lesson: **Catalyst should show team presence.** If alice is editing REQ-42, show her cursor there. When she approves, you see it happen.

**3.5 Version History with Branching**

- Every version is saved (you can time-travel to any point)
- You can create a branch to experiment, then merge back
- Lesson: **Catalyst's journaling is the version history.** But add a "propose changes" mode (like branching) where you make edits locally, see impact, then propose.

**3.6 Comments at Precise Locations**

- Click a design element → leave a comment thread that pins to that element
- Future viewers see the comment thread in the same place
- Lesson: **Catalyst should support comments on entity fields.** Click a rule's text → comment thread about that specific constraint.

**3.7 Handoff View**

- Handoff shows developers "here's what the designer specified" with measurements, copy, and assets
- It's read-only, curated, and **decision-focused** (not all of Figma's complexity)
- Lesson: **Catalyst's "brief" generation (for agents and humans) is the handoff view.** Pre-assemble decision context; hide unnecessary complexity.

### Lessons Summary

✅ Entity detail organized by category  
✅ Rules as design tokens (change cascades)  
✅ Workflow states as mutually exclusive  
✅ Real-time team presence  
✅ Full version history with branching  
✅ Comments pinned to precise locations  
✅ Decision-focused "handoff" views

---

## 4. Notion — Databases, Relations & Flexibility

### Core Value

Organize anything as databases that relate to each other, with multiple views (table, board, timeline, gallery) on the same data.

### Key Patterns We Can Steal

**4.1 Multiple Views of the Same Data**

- Database table, Kanban board, Timeline, Gallery, Calendar — all showing the same entities, just differently
- Switch between views with buttons or sidebar
- Lesson: **Catalyst's entity browser should support multiple views.** Show requirements as table (list), board (by status), or timeline (by due date). (See 03-visualization-patterns, patterns 1–6.)

**4.2 Relation Fields**

- Entity A can link to Entity B (and vice versa automatically)
- A requirement can link to multiple steps; each step shows the requirement that governs it
- Lesson: **Catalyst's relationships should be bidirectional.** Change a backref on one side; it updates everywhere.

**4.3 Rollups & Computations**

- Sum the estimates of all steps in a requirement → show in the requirement row
- Count how many tests depend on a rule → badge appears automatically
- Lesson: **Catalyst should compute summary metrics.** "5 steps, 3 done" appears on every requirement without manual updates. (Derived status in ideal-architecture.md.)

**4.4 Database Templates**

- Create a template for new issues (type, assign to, set status, link to a parent)
- Filling in a template auto-creates the entity with relationships
- Lesson: **Catalyst should have guided creation flows.** "New requirement" → form pre-fills based on module.yaml, auto-links to parent.

**4.5 Graph View**

- Show all entities and their relationships as an interactive graph
- Zoom, filter, click to jump
- Lesson: **Catalyst should have a graph view of the entire Record.** (See 03-visualization-patterns, pattern 2: dependency graph.)

### Lessons Summary

✅ Multiple views of the same data (table, board, timeline, graph)  
✅ Bidirectional relationships  
✅ Automatic rollups and derived fields  
✅ Guided creation templates  
✅ Graph view of all entities

---

## 5. Loom — Video Recording with Annotation

### Core Value

Capture complex workflows in video, then add annotations and navigate by timestamp.

### Key Patterns We Can Steal

**5.1 Timeline with Annotations**

- Video plays over time; click the timeline to jump to a specific moment
- Add markers/chapters: "0:32 – Rate limiting logic," "1:15 – Error handling"
- Lesson: **Catalyst's journal timeline should have markers.** Milestone dates, status transitions, approvals appear as checkpoints. Click to jump.

**5.2 Transcript Search**

- Loom auto-generates a transcript; users search for keywords
- Results show the timestamp where that word appears
- Lesson: **Catalyst's journal should be searchable by content.** Search "rate limiting" → results show journal entries mentioning it.

### Lessons Summary

✅ Timeline with chapters/markers  
✅ Searchable transcript/content

---

## 6. VS Code — Discovery Through Context

### Core Value

Show just enough information to orient yourself, but make it easy to drill into complexity.

### Key Patterns We Can Steal

**6.1 Breadcrumb Navigation**

- At the top: File > Class > Method (each clickable)
- Shows where you are in the hierarchy without leaving the current view
- Lesson: **Catalyst should show breadcrumbs.** Requirement > Step > Test (each clickable to jump).

**6.2 Outline & Explorer**

- Left sidebar shows the file structure (quick navigation)
- Drag to open multiple files in tabs
- Lesson: **Catalyst should have a left sidebar with entity browser.** Expand domains to see rules, drag to open detail panels.

**6.3 Go to Definition & References**

- Click a symbol → jump to where it's defined
- "Find all references" shows everywhere it's used
- Lesson: **Catalyst should support "Go to definition."** Click a rule ID → jump to the rule. Click "Show references" → see all work depending on it.

**6.4 Minimap**

- Right side shows a tiny preview of the entire file
- Click the minimap to jump to any section
- Lesson: **Catalyst's timeline or graph could have a minimap.** See the entire roadmap/system at once, click to jump.

**6.5 Git Lens Blame**

- Hover a line → see who wrote it, when, and the commit message
- Inline, always available
- Lesson: **Catalyst should show inline blame.** Click any field → see who last changed it and why (from journal).

### Lessons Summary

✅ Breadcrumb navigation  
✅ Explorer sidebar for quick navigation  
✅ Go to definition & find references  
✅ Minimap for overview  
✅ Inline blame (lineage)

---

## 7. Miro — Infinite Canvas & Collaboration

### Core Value

Infinite canvas lets teams ideate, organize, and collaborate in one space without structure constraints.

### Key Patterns We Can Steal

**7.1 Frames & Grouping**

- Organize sticky notes into frames (named sections)
- Zoom into a frame or zoom out to see all frames
- Lesson: **Catalyst's graph view could use frames.** Show clusters of related items, drill into clusters, zoom out to see the system.

**7.2 Async Collaboration**

- Leave comments on sticky notes (async discussion, not real-time chat)
- Reactions (👍 ❤️ 🎉) show agreement/sentiment
- Lesson: **Catalyst's decision inbox supports async collaboration.** Comment threads, reactions, and "mark resolved" without needing real-time presence.

### Lessons Summary

✅ Frames for grouping related items  
✅ Async collaboration (comments, reactions)

---

## 8. Obsidian — Knowledge Graph & Wikilinks

### Core Value

Notes are connected through links and backlinks; the graph is the primary interface.

### Key Patterns We Can Steal

**8.1 Graph View**

- Every note is a node; links are edges
- Clicking a node highlights its neighbors (what it links to, what links to it)
- Filter by type, search for specific paths
- Lesson: **Catalyst's traceability chain is like a graph view.** Rules, requirements, steps, tests form nodes. Click a node to highlight its graph neighborhood.

**8.2 Backlinks**

- Every note automatically shows "things that link to me" (backlinks)
- You don't manually maintain a "related items" list; it's computed
- Lesson: **Catalyst should show backlinks automatically.** Click a requirement → see all features that require it, all steps that satisfy it.

**8.3 Unlinked Mentions**

- Obsidian finds mentions of related topics that aren't formally linked
- "Hey, you mentioned 'rate limiting' in this note; want to link it?"
- Lesson: **Catalyst could suggest links.** Detect when a rule's text appears in a requirement's reason; suggest linking them.

### Lessons Summary

✅ Graph view as primary interface  
✅ Automatic backlinks (computed, not manual)  
✅ Unlinked mention suggestions

---

## Synthesized Principles

Across all these products, a few themes emerge:

| Principle                      | Products                                                                               | Application to Catalyst                                               |
| ------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Show, don't tell**           | GitHub (blame), Figma (properties), VS Code (outline)                                  | Display inline lineage, impact cascades, related entities             |
| **Progressive disclosure**     | VS Code (breadcrumb → outline → file → line), Figma (select → info panel → properties) | Start with dashboard; drill to detail; show complexity on demand      |
| **Multiple views**             | Notion (table/board/timeline/graph), Figma (layers/inspect), GitHub (PR/commit/blame)  | Same data: traceability tree view, graph view, timeline, diff view    |
| **Relationships are explicit** | Notion (relation fields), Obsidian (backlinks), Figma (component variants)             | Rules and work are linked; make links bidirectional and visible       |
| **Decision threads**           | GitHub (PR review), Linear (comments), Figma (comment pins)                            | Every decision lives in one thread with full context                  |
| **Real-time presence**         | Figma (multiplayer cursors), Linear (comments)                                         | Show who's editing what, stream approvals and changes                 |
| **Async collaboration**        | Miro (comments/reactions), Linear (inbox), GitHub (PR discussions)                     | Don't require real-time; support comment threads, reactions, "snooze" |
| **Search & discovery**         | VS Code (command palette), Linear (filters), Obsidian (graph search)                   | Command palette + fuzzy search + graph navigation                     |
| **Undo/history**               | Figma (version history), Notion (version history), GitHub (commits)                    | Full journaling with revert; time-travel is always available          |

---

## The Catalyst Studio Synthesis

Taking the best from these 8 products and grounding it in Catalyst's unique value (traceability + verification + versioning):

1. **Dashboard** (Linear's workspace overview + GitHub's notifications)
2. **Traceability explorer** (Obsidian's graph + VS Code's outline + GitHub's blame)
3. **Judgment inbox** (Linear's inbox + GitHub's PR review)
4. **Multiple views** (Notion's table/board/timeline/graph on the same data)
5. **Impact analysis** (Figma's constraint solver + GitHub's dependency graph)
6. **Async collaboration** (GitHub's PR threads + Miro's comments + Linear's decisions)
7. **Full version history** (GitHub's blame + Figma's version history + Obsidian's backlinks)
8. **Command palette** (VS Code's command palette + Linear's AI mode + Figma's quick actions)

Each of these is described in detail in [02-innovative-functionalities.md](02-innovative-functionalities.md).

---

## Next Steps

These patterns are the _reference_. The next document (05-interactive-experiences.md) shows _how_ to make them delightful and memorable for Catalyst-specific workflows.
