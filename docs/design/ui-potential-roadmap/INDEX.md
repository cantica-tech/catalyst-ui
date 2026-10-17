# Catalyst Studio UI Roadmap — Complete Index

**Created:** 2026-10-08  
**Total:** 2,087 lines across 7 documents  
**Scope:** Vision, philosophy, features, patterns, references, implementation plan for R5–R7 (2027)

---

## Quick Navigation

### For Executives / Product Leadership

→ Start with **[00-EXECUTIVE-SUMMARY.md](00-EXECUTIVE-SUMMARY.md)** (5 min read)

- One-paragraph vision
- Five design laws (invariants)
- 16 innovative functionalities overview
- Success metrics and resource plan

### For Designers / UX

→ Start with **[01-ui-philosophy.md](01-ui-philosophy.md)** (10 min read), then explore:

- **[03-visualization-patterns.md](03-visualization-patterns.md)** — Seven core patterns with mockups
- **[04-modern-reference-analysis.md](04-modern-reference-analysis.md)** — Lessons from 8 modern products

### For Engineers / Technical Teams

→ Start with **[05-implementation-roadmap.md](05-implementation-roadmap.md)** (15 min read)

- Three phases (P0/P1/P2) with effort estimates
- Technical prerequisites and dependencies
- Resource plan, risks, and success criteria
- Performance and security requirements

### For Product Managers / Feature Planning

→ Read **[02-innovative-functionalities.md](02-innovative-functionalities.md)** (20 min read)

- 16 features with detailed specs
- Priority tiers (P0, P1, P2)
- Effort estimates and dependencies
- Use cases and patterns per feature

### For Research / Strategy

→ Review **[04-modern-reference-analysis.md](04-modern-reference-analysis.md)** (20 min read)

- Analysis of 8 best-in-class products (GitHub, Linear, Figma, Notion, etc.)
- Synthesized principles
- Catalyst-specific adaptations

---

## Document Breakdown

| #                                 | Title             | Audience            | Length    | Key Content                                                                             |
| --------------------------------- | ----------------- | ------------------- | --------- | --------------------------------------------------------------------------------------- |
| **00-EXECUTIVE-SUMMARY**          | One-page brief    | C-level, Product    | 272 lines | Vision, 5 laws, 16 features, 3 phases, success metrics                                  |
| **00-README**                     | Navigation guide  | All                 | 136 lines | How to use this roadmap, document structure                                             |
| **01-ui-philosophy**              | Design principles | Designers, PM       | 204 lines | 5 laws, design principles, goals, "aha" moment                                          |
| **02-innovative-functionalities** | Feature specs     | PM, Engineers       | 373 lines | 16 features grouped by category (Discovery/Action/Visualization/Collaboration/Learning) |
| **03-visualization-patterns**     | UI patterns       | Designers, UX       | 473 lines | 7 core patterns with mockups, use cases, inspiration sources                            |
| **04-modern-reference-analysis**  | Competitive intel | Designers, Strategy | 358 lines | 8 products analyzed, synthesized principles, Catalyst adaptations                       |
| **05-implementation-roadmap**     | Execution plan    | Tech Lead, PM       | 271 lines | 3 phases, effort estimates, resources, risks, success criteria, milestones              |

**Total:** ~2,087 lines, ~56,000 words

---

## The Five Design Laws (Tl;dr)

1. **Traceability is the default view** — Context is there by default; you don't drill down for it
2. **Causality is visual, not textual** — Dependencies shown as graphs; shape reveals structure
3. **Context compounds (progressive disclosure)** — Start simple, reveal complexity on demand
4. **Drift is always visible** — Violations and inconsistencies woven into every view
5. **Decisions are first-class** — Rules, ADRs, and constraints are active entities, not documentation

---

## The 16 Innovative Functionalities (Tl;dr)

**Discovery (4):**

1. Dashboard — system health snapshot
2. Studio Map — entity type relationships
3. Traceability Explorer — bi-directional chain
4. Drift Dashboard — centralized health monitor

**Action (3):** 5. Judgment Inbox — decision requests 6. Command Palette + Agent Console — search + dispatch + run history 7. Batch Operations — multi-select bulk work

**Visualization (3):** 8. Journal Timeline + Diff — rich change history 9. Impact Analysis — red cascades of affected items 10. Roadmap Timeline — Gantt view with dependencies

**Collaboration (3):** 11. Approval Workflows — gate definition + multi-reviewer sign-off 12. Entity Change History & Rollback — time-travel for any entity 13. Team Visibility — activity feed

**Learning (3):** 14. Rule Browser — searchable gallery 15. Analysis & Findings Dashboard — triage and propose fixes 16. Module Administration — install, upgrade, remove

---

## The Seven Visualization Patterns (Tl;dr)

1. **Traceability Tree** — Hierarchical, text-based (VS Code outline style)
2. **Dependency Graph** — Visual network (Obsidian graph style)
3. **Timeline/Gantt** — Temporal view (Jira/Asana style)
4. **Board/Kanban** — State-based (Linear/Trello style)
5. **Inbox/Activity Feed** — Narrative stream (GitHub PR review style)
6. **Diff/Comparison** — Side-by-side changes (GitHub diff style)
7. **Audit Trail** — Forensic timeline (Git blame style)

---

## Three Implementation Phases

| Phase | Name     | Timeline        | Focus                                     | Go-live                     |
| ----- | -------- | --------------- | ----------------------------------------- | --------------------------- |
| P0    | MVP      | R5 (Q1–Q2 2027) | Core: Dashboard, Explorer, Inbox, Drift   | Browser + VS Code + Desktop |
| P1    | Polish   | R6 (Q2–Q3 2027) | All 16 features + multiple views          | Module portability proven   |
| P2    | Advanced | R7 (Q3–Q4 2027) | Cost telemetry, analysis, sandbox, embeds | Compliance audit ready      |

**Key Milestones:**

- R5 Week 8: P0 Alpha (Dashboard + Traceability explorer + Inbox)
- R5 Week 16: P0 Release (all P0 features in 3 shells)
- R6 Week 12: P1 Release (all 16 features, second module works)
- R7 Week 12: P2 Release (cost meter, analysis workspace, audit pack)

---

## Resource & Cost Summary

**Team:** 3.5 FTE (2 Frontend, 1 Backend, 0.5 QA/DevOps)

**Development Token Budget:** ~330k tokens across R5–R7  
(One-time investment for architecture, design, specs)

**Runtime Token Budget (Deployed Studio):**

- P0: Single session + dashboard ≤ 15k tokens
- P1: Full workflow ≤ 20k tokens
- P2: With cost meter ≤ 25k tokens
- Deterministic ops: 0 tokens

**Effort Summary:**

- P0: ~23 weeks of development (R5 = 16 weeks suggests parallel work)
- P1: ~20 weeks of development (R6)
- P2: ~18 weeks of development (R7)
- Total: ~61 weeks across 3 releases

---

## Success Metrics

### User Experience

✅ Time to understand Catalyst's value: <3 minutes  
✅ Time to take an action (approve proposal): ≤3 clicks  
✅ User confidence: "I trust this; everything's traced"

### Technical

✅ Portability: Same bundle in 3+ shells  
✅ Module-agnostic: Second module works with zero code changes  
✅ Token efficiency: ≥50% reduction (from 72k to ≤35k)  
✅ Performance: P95 response <200ms for any navigation

### Adoption

✅ Shipped to VS Code Marketplace  
✅ Used by ≥3 external teams (browser version)  
✅ Desktop version delivered (Electron)  
✅ Feature parity with CLI achieved

---

## How to Use This Roadmap

**Step 1: Align on vision**

- Execs/PMs: Read **00-EXECUTIVE-SUMMARY** (5 min)
- Designers: Read **01-ui-philosophy** (10 min)
- Engineers: Read **05-implementation-roadmap** (15 min)

**Step 2: Explore patterns & features**

- **02-innovative-functionalities** — What are we building?
- **03-visualization-patterns** — How do we show it?
- **04-modern-reference-analysis** — What do others do well?

**Step 3: Plan implementation**

- **05-implementation-roadmap** — Detailed phases, effort, resources, risks

**Step 4: Design & prototype**

- Use **01-ui-philosophy** as the spec
- Use **03-visualization-patterns** as the components
- Use **04-modern-reference-analysis** as the inspiration
- Build 1–2 prototype views to validate patterns

**Step 5: Execute**

- Follow **05-implementation-roadmap** phases
- Measure against success criteria
- Iterate based on user feedback

---

## Open Questions (For Discussion)

- Should P0 include the graph view, or defer to P1? (affects effort)
- Which P1 features matter most for external adoption?
- Electron vs. Tauri for desktop shell? (R5 spike)
- Should Catalyst Studio support offline mode? (R6+ decision)
- Module execution sandbox timeline? (R7 or later?)

---

## Related Documents in Catalyst

These roadmaps and analyses provide context:

- [05-catalyst-ui-analysis.md](../05-catalyst-ui-analysis.md) — Current state analysis (9.2k LOC, 30 bugs, 5 findings)
- [07-ideal-architecture.md](../07-ideal-architecture.md) — Layered architecture (engine, protocol, adapters, shells)
- [09-ui-brand-portability.md](../09-ui-brand-portability.md) — Portability decisions (8 design decisions, brand strategy)
- [docs/adr/ADR-015-016.md](../../docs/adr/) — UI-related ADRs

---

## Next Steps

1. **Review & feedback** — Get stakeholder sign-off on 5 laws and 3 phases
2. **Refine priorities** — Which P1 features matter most?
3. **Resource alignment** — Confirm 3.5 FTE team
4. **Design system kickoff** — Tokens, a11y, dark/light modes
5. **Engine readiness check** — What must be done by R5 kickoff?
6. **Prototype validation** — Build 2–3 key views, test with users

---

## Questions?

See **05-implementation-roadmap.md § Known Unknowns** for decision points, or start a discussion thread.

---

**Vision:** Catalyst Studio makes "persistent, verifiable project memory" visible and delightful.  
**Outcome:** Users instantly understand what makes Catalyst different, and trust that everything is traced and justified.
