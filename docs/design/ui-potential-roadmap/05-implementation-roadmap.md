# 05 — Implementation Roadmap: From Vision to Reality

**Date:** 2026-10-08  
**Source:** Catalyst framework roadmap (R5–R7), Ideal Architecture (07), UI Brand & Portability (09)  
**Scope:** Phased plan to build Catalyst Studio from MVP to a best-in-class governance UI

---

## Overview

**Today (R1):** Catalyst-ui is a VS Code extension (2,567-line `extension.ts`) + a small React renderer.  
**R5 (2027 Q1–Q2):** Catalyst Studio MVP — one Python engine, one JSON-RPC protocol, multiple shells (browser, VS Code, desktop).  
**R6 (2027 Q2–Q3):** Catalyst Studio polish — all P0 + P1 features, rich visualizations, portability proven.  
**R7 (2027 Q3–Q4):** Catalyst Studio advanced — cost telemetry, analysis workspace, module sandbox.

**Today (R1):** Catalyst-ui is a VS Code extension (2,567-line `extension.ts`) + a small React renderer.  
**R5 (2027 Q1–Q2):** Catalyst Studio MVP — one Python engine, one JSON-RPC protocol, multiple shells (browser, VS Code, desktop).  
**R6 (2027 Q2–Q3):** Catalyst Studio polish — all P0 + P1 features, rich visualizations, portability proven.  
**R7 (2027 Q3–Q4):** Catalyst Studio advanced — cost telemetry, analysis workspace, module sandbox.

---

## Three Phases at a Glance

```
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE COMPARISON                                                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  P0/R5: MVP (16 weeks)                                                  │
│  ┌─────────────────────────────┐                                        │
│  │ 🎯 "Can we understand it?"  │                                        │
│  ├─────────────────────────────┤                                        │
│  │ Views:                      │                                        │
│  │  ✅ Dashboard               │                                        │
│  │  ✅ Traceability explorer   │                                        │
│  │  ✅ Judgment inbox          │                                        │
│  │  ✅ Drift dashboard         │                                        │
│  │  ✅ Entity detail           │                                        │
│  │  ✅ Command palette         │                                        │
│  │                             │                                        │
│  │ Shells:                     │                                        │
│  │  ✅ Browser (localhost)     │                                        │
│  │  ✅ VS Code (webview)       │                                        │
│  │  ✅ Desktop (Electron MVP)  │                                        │
│  │                             │                                        │
│  │ Success: Portability proven │                                        │
│  │ Token budget: 15k (50% cut) │                                        │
│  └─────────────────────────────┘                                        │
│                                                                          │
│  P1/R6: Polish (12 weeks)                                               │
│  ┌─────────────────────────────┐                                        │
│  │ 🎨 "Can we see it visually?"│                                        │
│  ├─────────────────────────────┤                                        │
│  │ P0 Views +                  │                                        │
│  │  ✅ Studio Map (flowchart)  │                                        │
│  │  ✅ Timeline + Diff         │                                        │
│  │  ✅ Graph (dependencies)    │                                        │
│  │  ✅ Board (kanban)          │                                        │
│  │  ✅ Roadmap (Gantt)         │                                        │
│  │  ✅ Approval workflows      │                                        │
│  │  ✅ Impact analysis         │                                        │
│  │  ✅ Rule browser            │                                        │
│  │  ✅ Change history          │                                        │
│  │  ✅ Team visibility         │                                        │
│  │                             │                                        │
│  │ Success: Second module      │                                        │
│  │ renders with zero changes   │                                        │
│  │ All visualization patterns  │                                        │
│  │ live and performant         │                                        │
│  └─────────────────────────────┘                                        │
│                                                                          │
│  P2/R7: Advanced (12 weeks)                                             │
│  ┌─────────────────────────────┐                                        │
│  │ 🔧 "Can we operate at scale?"│                                       │
│  ├─────────────────────────────┤                                        │
│  │ P1 Views +                  │                                        │
│  │  ✅ Cost meter              │                                        │
│  │  ✅ Analysis workspace      │                                        │
│  │  ✅ Module sandbox          │                                        │
│  │  ✅ Global search           │                                        │
│  │  ✅ Compliance audit pack   │                                        │
│  │  ✅ IAM admin               │                                        │
│  │  ✅ Release center          │                                        │
│  │  ✅ Notifications (email)   │                                        │
│  │  ✅ Sync (real-time)        │                                        │
│  │  ✅ Embeds                  │                                        │
│  │                             │                                        │
│  │ Success: Cost telemetry     │                                        │
│  │ visible; sandbox security   │                                        │
│  │ audit passed; external      │                                        │
│  │ teams self-served           │                                        │
│  └─────────────────────────────┘                                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

Timeline:
Q1 2027 ├─ R5 Start ─┤ (16 weeks)  ├─ R6 Start ─┤ (12 weeks)  ├─ R7 Start (12 weeks) ─┤ Q4 2027
        Jan       Apr             Apr         Jul            Jul              Oct
```

---

## Phase P0: MVP (R5, ~16 weeks)

### Goal

Ship Catalyst Studio as a single-engine, multi-shell product where users can:

1. See system health at a glance (Dashboard)
2. Understand causality (Traceability explorer)
3. Review and approve proposals (Judgment inbox)
4. See what's failing (Drift dashboard)

### Technical Prerequisites (Parallel Track)

- ✅ `catalyst serve` CLI (Python JSON-RPC endpoint, stdio + loopback)
- ✅ `@catalyst/client` (TypeScript typed RPC client with reconnect)
- ✅ `@catalyst/app-model` (view-model selectors for tree, board, graph, journal)
- ✅ Module schema validation (ensure module.yaml drives rendering, not hard-coded code)

### P0 Features & Effort

| Feature | Views | Effort | Owner | Notes |
|---------|-------|--------|-------|-------|
| **Dashboard** | Cards (health, open work, alerts) | 2w | Frontend | Signals from engine: rules count, test pass %, drift alerts |
| **Traceability explorer** | Tree + optional graph | 3w | Frontend + Engine | Engine: transitive closure of "depends on" / "constrains" |
| **Judgment inbox** | Activity feed + quick actions | 2w | Frontend + Engine | Engine: generate proposals with diffs; UI: approve/reject/defer |
| **Drift dashboard** | Alert list + quick fixes | 2w | Frontend + Engine | Engine: unjournaled changes, violations, stale refs; UI: one-click adopt |
| **Entity detail** | Schema-driven form | 2w | Frontend | Module.yaml declares fields; UI generates form automatically |
| **Command palette** | Search + dispatch | 2w | Frontend + Engine | VS Code mode: native command list; Web mode: engine catalog |
| **Engine ops** | Record opening, validation, module loading | 3w | Engine | Python: `catalyst serve` with reconnect, project discovery |
| **Browser shell** | SPA at localhost:7070, asset bundling | 2w | Frontend | React + TypeScript, design tokens, dark/light mode |
| **VS Code shell** | Webview integration, native tree, diagnostics | 2w | Frontend + Extension | Embed browser shell in webview; native tree shows top 3 domains |
| **Desktop shell** (minimal) | Electron + engine sidecar | 2w | Frontend | Bundled Python runtime; proof that multiple shells work |
| **Tests & CI** | Contract tests, golden corpus regression | 2w | QA + Engine | Engine spec validated against TS client; UI regression suite |

**Total P0 effort:** ~23 weeks of focused development (R5 = 16 weeks suggests some parallel work or scope reduction).

### P0 Success Criteria

- [ ] `catalyst serve` handles 5+ concurrent sessions (token meter works)
- [ ] Browser shell loads < 2s (cold), renders dashboard in < 500ms
- [ ] VS Code shell is feature-parity with browser for P0 features
- [ ] Drift dashboard finds 100% of unjournaled changes and shows them
- [ ] Judgment inbox accepts proposals from agent; user can approve/reject/defer
- [ ] Zero `vscode.*` imports outside the VS Code shell adapter (portability achieved)
- [ ] Module-agnostic: second module (legal-review or test-module) renders without code changes
- [ ] Token budget: Single session creation + dashboard view ≤ 15k tokens (vs. 72k today)

### P0 Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Engine startup too slow (<2s requirement) | Profile early; use zipapp bundling; optimize parsing |
| TS/Python type mismatch on protocol | Contract tests from day one; JSON Schema + codegen |
| Hard-coded module assumptions in schema-driven UI | Audit every field reference; add module-agnostic tests |
| Drift detection misses categories | Test against golden corpus with all known drift types |

---

## Phase P1: Polish (R6, ~12 weeks)

### Goal

Complete the "richer" UI with all P0 + P1 features, rich visualizations, and proven portability across 3 shells.

### P1 Features & Effort

| Feature | Views | Effort | Notes |
|---------|-------|--------|-------|
| **Studio Map** | Interactive flowchart of entity types + relationships | 2w | Graph layout (force-directed or hierarchical); color by domain/status |
| **Traceability graph** | Graph view of rule→requirement→step→test chain | 2w | Re-use Studio Map layout; highlight selected node's neighborhood |
| **Journal timeline** | Chronological audit trail + diff view | 2w | Entries grouped by date; click → side-by-side diff; blame integration |
| **Impact analysis** | Change a field, see red cascade across system | 2w | Engine computes impact; frontend animates highlights |
| **Roadmap timeline** | Gantt view with milestones + dependencies | 2w | Time-based layout; drag to reschedule; filter by domain |
| **Board/Kanban** | Swimlanes by status, domain, or assignee | 2w | Drag-drop state transitions; WIP limits; cycle selector |
| **Approval workflows** | Gate definition + multi-reviewer sign-off | 2w | Gate creation form; approval UI in inbox; audit trail |
| **Command palette +Agent console** | Fuzzy search + streamed results + run history | 2w | Stream output from agent; token meter; copy/export results |
| **Rule browser** | Searchable gallery of all rules with lineage | 1w | Filter by domain/type/status; click → traceability explorer |
| **Change history & rollback** | Version list + diff + revert button | 1w | UI: timeline of changes per entity; backend: journal entries |
| **Desktop UI improvements** | Column graph, module switcher, settings panel | 2w | Electron-specific polish |
| **Tests & CI** | Regression suite for P1 views, E2E flows, performance | 2w | Visual regression tests; load testing; golden corpus validation |

**Total P1 effort:** ~20 weeks (overlaps with R6).

### P1 Success Criteria

- [ ] All 16 features from [02-innovative-functionalities.md](02-innovative-functionalities.md) are implemented
- [ ] Graph rendering handles 500+ nodes without lag (measured: <16ms render time)
- [ ] Same bundle runs in browser, VS Code webview, and Electron without code changes (portability proven)
- [ ] Second module (legal or research) works with zero hardcoded UI changes
- [ ] Multi-shell sync: changes in browser sync to VS Code in <2s (via engine polling)
- [ ] Approval workflows: gate creation + multi-reviewer + audit = zero token cost (CLI only, no agent)
- [ ] Token budget: Full workflow (view dash + traceability + inbox + approve) ≤ 20k tokens

### P1 Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Graph with 500+ nodes too slow | Implement virtual scrolling / lazy loading; profile early |
| Browser bundle size explodes | Code-split views; lazy load heavy libraries (graph, Gantt) |
| Portability assumptions break under Electron/browser differences | E2E tests on all 3 shells in CI; unified test suite |
| Module schema changes break rendering | Contract tests between module schema and UI renderer |

---

## Phase P2: Advanced (R7, ~12 weeks)

### Goal

Delight users with advanced features: cost telemetry, analysis workspace, module sandboxing, embeds.

### P2 Features & Effort

| Feature | Effort | Notes |
|---------|--------|-------|
| **Token & cost meter** | 2w | Stream `token_usage` from agents; show per-command cost; cumulative budget |
| **Analysis workspace** | 2w | Save `/analysis` findings; triage as real/false/defer; propose fixes |
| **Module sandbox** (iframe + postMessage + CSP) | 2w | Load module UI in sandbox; restrict to module's data; no host access |
| **Notifications panel** | 1w | Desktop notifications for inbox items; snooze, mark read |
| **Criterion/store sync** | 1w | UI panel to push/pull from remote; conflict resolution |
| **IAM admin panel** | 2w | User/role management (create, edit, assign roles, deactivate) |
| **Release center** | 1w | Module browser, install/upgrade/remove, changelog display |
| **Search (global)** | 2w | Full-text index of all entities; quick search with preview |
| **Embeds & web components** | 2w | Render Catalyst data in README (badge, mini-board) |
| **PDF/HTML audit pack** | 1w | Export full traceability chain for compliance review |
| **Tests & CI** | 2w | End-to-end tests for all P2 features; performance benchmarks |

**Total P2 effort:** ~18 weeks (overlaps with R7).

### P2 Success Criteria

- [ ] Cost meter shows accurate token usage per agent and cumulative
- [ ] Analysis workspace finds and triages defects; "propose fix" creates agent brief
- [ ] Module sandbox loads untrusted module UI; security audit passes
- [ ] Global search finds any entity in <200ms (indexed)
- [ ] Audit pack PDF/HTML shows full chain: rule → work → tests → code changes
- [ ] Token budget stays < 5k for deterministic operations (list, filter, status change, display)

### P2 Risks

| Risk | Mitigation |
|------|-----------|
| Global search index becomes stale | Index on every journal entry write; validate in CI |
| Module sandbox CSP too restrictive | Whitelist safe operations; test with real modules |
| PDF export layout breaks with large datasets | Use HTML→PDF library (e.g., Puppeteer); test with golden corpus |

---

## Cross-Cutting Concerns (Every Phase)

### Design System & Accessibility

- **P0:** Foundational tokens (colors, spacing, typography), light/dark modes
- **P1:** A11y audit (axe pass), keyboard nav, screen reader support
- **P2:** High contrast mode, reduced motion, focus management

### Performance

- **P0:** Dashboard load < 500ms; JS bundle < 500KB (gzipped)
- **P1:** Graph render < 16ms for 500 nodes; navigate any entity in <100ms
- **P2:** Global search < 200ms; PDF export < 2s for 1000-item chain

### Security

- **P0:** Workspace trust gate; read-only first (writes require intent)
- **P1:** Approval gates enforced; audit trail complete
- **P2:** Module sandbox (CSP, iframe isolation); input validation on all forms

### Testing

- **P0:** Unit tests (100+ cases); integration tests for engine/UI handshake; golden corpus regression
- **P1:** Visual regression tests (Percy or similar); E2E tests (all 3 shells); load tests (500+ concurrent)
- **P2:** Security tests (CSP, input validation); compliance audit; user acceptance testing

### Documentation

- **P0:** Setup guide (5 min to "hello dashboard"), concept doc (why Catalyst is different), command palette help
- **P1:** Video tours (dashboard, approval workflow, traceability chain)
- **P2:** Advanced guides (analysis workspace, module development, audit process)

---

## Resource Plan

### Team Composition (Estimates)

- **Frontend/UX:** 2 FTE (design, React, browser shell, desktop shell)
- **Backend/Engine:** 1 FTE (Python engine, JSON-RPC protocol, module loading)
- **QA/DevOps:** 1 FTE (tests, CI/CD, golden corpus maintenance, performance profiling)
- **Product/Design:** 0.5 FTE (roadmap, user research, design system)

### Dependencies

- **Engine ready:** `catalyst serve` must be feature-complete for P0 (R4 work or brought forward)
- **Module schema:** `module.yaml` must fully describe entity types, fields, states (R4 work)
- **Contract tests:** JSON Schema definitions must be agreed and generated into both Python and TypeScript (R4 work)

### Milestones

| Milestone | Target | Deliverable |
|-----------|--------|-------------|
| P0 Kickoff | R5 Week 1 | Design system, API contract, 3 feature teams ready |
| P0 Alpha | R5 Week 8 | Dashboard + Traceability explorer + Inbox working in browser |
| P0 Beta | R5 Week 12 | All P0 features in browser; VS Code shell working |
| P0 Release | R5 Week 16 | Browser + VS Code + Desktop; golden corpus validation; token budget met |
| P1 Alpha | R6 Week 4 | Graph view + timeline working |
| P1 Beta | R6 Week 8 | 12/16 P1 features complete |
| P1 Release | R6 Week 12 | All P1 features in 3 shells; module portability proven |
| P2 Alpha | R7 Week 4 | Cost meter + analysis workspace working |
| P2 Beta | R7 Week 8 | 8/10 P2 features complete |
| P2 Release | R7 Week 12 | All P2 features complete; audit pack export working; security audit passed |

---

## Budget & Token Cost

### Development (Token Budget for Agent Prompts)

- **P0:** ~150k tokens (architecture decisions, component specs, golden corpus queries)
- **P1:** ~100k tokens (feature design, graph algorithms, visual regression rules)
- **P2:** ~80k tokens (sandbox design, PDF export, compliance questions)
- **Total:** ~330k tokens for R5–R7 (vs. 72k per session today; a one-time investment)

### Runtime (Token Budget in Deployed Studio)

- **P0:** Single session creation + dashboard view = ≤ 15k tokens
- **P1:** Full workflow (view + traceability + inbox + approve) = ≤ 20k tokens
- **P2:** With cost meter + analysis = ≤ 25k tokens
- **Deterministic operations (list, filter, status change):** 0 tokens

---

## Success Metrics

### User Experience

- [ ] Time to understand Catalyst's value: <3 minutes (vs. 30 min docs read today)
- [ ] Time to take an action (e.g., approve a proposal): ≤3 clicks
- [ ] Confidence in system consistency: "I trust this; everything's traced" (survey)

### Technical

- [ ] Portability: Same bundle runs in 3+ shells
- [ ] Module agnostic: Second module works with zero code changes
- [ ] Token efficiency: ≥50% reduction in tokens-per-session (from 72k to ≤35k)
- [ ] Performance: P95 response time <200ms for any navigation

### Adoption

- [ ] Shipped to Marketplace (VS Code extension)
- [ ] Browser version used by ≥3 external teams
- [ ] Desktop version (Electron) tested by internal team
- [ ] Feature parity with CLI (everything `catalyst` can do, Studio can do)

---

## Known Unknowns & Decision Points

| Question | Impact | Defer to |
|----------|--------|---------|
| Should Desktop shell be Electron or Tauri? | Bundle size, auto-update, PTY support, signing | R5 spike (ADR-003 revisited) |
| How to handle module execution (if ever)? | Sandbox design, CSP policy, test coverage | R2 (ADR proposal for R7) |
| Real-time vs. polling sync? | Latency, CPU, complexity | Prototype P1 (profile first) |
| Markdown rendering: sanitized or trusted? | Security, features (embedded iframes) | Security review + ADR |
| Should Studio support offline mode? | Sync strategy, data model, conflict resolution | User research (P1) |

---

## Summary

**Catalyst Studio transforms from a thin extension into a best-in-class governance UI by R7.**

- **P0 (R5):** Prove portability; ship MVP with core features (dashboard, explorer, inbox, drift)
- **P1 (R6):** Complete "richer" UI; multiple visualizations; second module works
- **P2 (R7):** Advanced features (cost meter, analysis, sandbox); embeds; audit compliance

Every phase is grounded in the philosophy (01), uses proven patterns from modern products (04), and leverages visualization techniques (03) that make Catalyst's unique value—traceability—obvious to every user.

The result: **"This is what happens when you give a project verifiable memory."**
