---
name: ux-review
description: Reviews the question-to-answer flow, source-review friction, evidence navigation, mobile/desktop usability, and global search composer behaviors. Use during UX/UI refactoring.
---

# UX Review Skill

Use this skill when reviewing user interface flows, search input behaviors, sidebars, modal navigation, and responsiveness.

## Repository Review Protocol

Follow `AGENTS.md` review throttling and `docs/codex-review-protocol.md` before starting. Do not review opportunistically, do not mutate files during pure review, and update `docs/branch-review-ledger.md` after completed branch/PR reviews.

## Review Checklist

### 1. Search Composer Integration

- **Composer Placement:** Verify that the shared composer (`master-search-header.tsx`) matches the correct placement rules (inline in heroes on home views, fixed bottom/sticky top on results, and absent on document viewers).
- **Navigation:** Check that search queries trigger the correct routing paths (`?q=...&run=1`) and preserve active filters.

### 2. User Flows & Responsiveness

- **Source-Review Friction:** Ensure the document drawer and PDF previewer load with minimal user interaction and maintain focus.
- **Mobile Usability:** Verify touch boundaries, drawer slide-up interactions, and layout density on mobile/tablet widths.
