# Design Audit — Clinical KB (June 2026 redesign)

## 1. Application map (regression baseline)

### Routes

| Route | Renders | Purpose |
| --- | --- | --- |
| `/` | `src/components/ClinicalDashboard.tsx` | Search + RAG answer workspace |
| `/documents/[id]` | `src/components/DocumentViewer.tsx` | PDF/document viewer with chunk navigation |

### Dashboard surfaces (all must survive the redesign)

- **MasterSearchHeader** (sticky): app identity, demo badge, guide button, theme toggle, Answer/Documents mode switcher, search input with clear button, submit button, document-scope `<details>` popover (filter input, all-documents chip, scrollable selection list, match counts).
- **Answer area**: progress row, `AnswerSkeleton`, error alert, answer surface (`PlainAnswerResponse`, `ClinicalOutputPanel`, evidence drawer with `EvidenceSummaryCard`/`AnswerSafetyNotice`/`EvidenceGapPanel`, raw source-narrative `<details>`, citation chip row), `SafetyFindingsPanel`, `AnswerEmptyState` with sample queries.
- **Documents mode**: `DocumentSearchResultsPanel` with facets, match explanations, scope/answer-from-document actions.
- **Sections**: `QuoteCards` (copy quotes, follow-up, scope), `VisualEvidenceStrip` (lazy signed-URL images), `RelatedDocumentsPanel`, Sources (`SourceList` drawer), Documents drawer (`DocumentDrawer` with pagination, rename/delete), Upload & indexing drawer (`SetupChecklist`, `AuthPanel`, `UploadPanel`, `IndexingMonitor` with retry/reindex/enrich).
- **Chrome**: `GuideTrigger`, `GuideDialog` (modal), mobile bottom nav (#search/#quotes/#images/#sources with counts, safe-area padding).

### Document viewer surfaces

- Toolbar (`data-testid="pdf-toolbar"`): back, page prev/next, fit-width/fullscreen, exit fullscreen.
- PDF page render (pdfjs) with retry, chunk highlighting via `?page=&chunk=`, in-document search ("Search within indexed source text"), indexed chunk list, extracted images/tables, related documents, rename/delete modals (`DocumentManagementActions`).

### Verification infrastructure

- Vitest: 40 files / 252 tests, node-only (logic). `tests/clinical-dashboard-merge-artifacts.test.ts` AST-pins `ClinicalOutputPanel` to `src/components/ClinicalDashboard.tsx`.
- Playwright: `ui-smoke.spec.ts` (18 tests, 320/390/768/1280 viewports, mocked APIs, layout-overflow and header-height ≤180/185px assertions), `ui-stress.spec.ts`, `ui-visual-artifacts.spec.ts` (screenshots, no baselines).
- CI: lint, typecheck, vitest, build.

## 2. Findings

| # | Location | Finding | Class | Action | Tier |
| --- | --- | --- | --- | --- | --- |
| 1 | `globals.css` | No neutral/primary ramps; ad-hoc surface values; no type scale; default Tailwind spacing; single `rounded-lg` radius everywhere; shadows are single heavy large-blur layers; no motion tokens or enter/exit keyframes | Upgrade | Full token system: 12-step tinted neutral ramp, primary ramp, semantic triads, type scale, radius scale, layered shadows, motion tokens + keyframes, `@theme inline` bridge | 2 |
| 2 | `globals.css:224-234` | Reduced-motion rule sets `transform: none !important` on `*` — breaks `-translate-y-1/2` icon centering for reduced-motion users (live a11y bug) | Polish | Remove `transform` from kill-switch | 1 |
| 3 | `ClinicalDashboard.tsx` | 4,655-line monolith blocks per-section polish and maintenance | Rebuild | Decompose into `src/components/clinical-dashboard/` modules (precedent: `search-utils.ts` already lives there) | 2 |
| 4 | Scope picker (`MasterSearchHeader`) | Anchored popover on mobile: cramped, top-anchored, fights thumb reach | Rebuild | Bottom sheet below `sm:`, anchored popover above, CSS-only; keep `<details>` semantics + testids | 2 |
| 5 | Scope popover internals | Hardcoded `white/N`, `slate-*`, `teal-*` classes that assume the dark shell; light-mode panel renders dark-styled rows | Upgrade | Re-token internals with shell-scoped vars | 1 |
| 6 | Mode toggle | Plain background swap, no slide; active state is flat white | Upgrade | Sliding-thumb segmented control with spring easing | 1 |
| 7 | Answer reading experience | No measure cap, 14px-ish body text, citations as wide pill rows | Upgrade | 68ch measure, 16px/1.65 reading body via type tokens, compact citation chips, fade-up entrance | 1 |
| 8 | Loading states | Spinner rows/panels (`LoadingPanel`, `answerProgress`) where skeletons fit better | Upgrade | Shimmer `Skeleton` component; keep spinner for true progress contexts | 2 |
| 9 | `GuideDialog`, `DocumentManagementActions` | Desktop-style centered modals on mobile | Rebuild | Responsive `Sheet` (bottom sheet < `sm:`, dialog above) with enter/exit animation, focus return | 2 |
| 10 | Mobile bottom nav | Sound structure; active state subtle; hand-rolled safe-area calc | Polish | Active pill, `pb-safe-2` utility, tabular-nums counts | 1 |
| 11 | `DocumentViewer.tsx` toolbar | Top toolbar on mobile; page indicator non-tabular; fullscreen lacks safe-area | Upgrade | Bottom-anchored mobile grouping, `nums`, `pb-safe` in fullscreen | 2 |
| 12 | Numerals (counts, pages, bytes) | Proportional figures wiggle in tables/counters | Polish | `nums` utility (`font-variant-numeric: tabular-nums`) applied at data sites | 1 |
| 13 | Header/sheets | No `env(safe-area-inset-*)` handling except one hand-rolled bottom-nav calc | Polish | `pt-safe`/`pb-safe`/`pb-safe-2` utilities | 1 |
| 14 | `ui-primitives.tsx` | Good token discipline; states inconsistently applied; hardcoded `ring-teal-300/20` focus | Upgrade | Restyle constants on new tokens; full state coverage; add Button/IconButton/Sheet/Skeleton components | 2 |
| 15 | Focus rings, forced-colors, print, selection styling | Already well built | Keep | Protect through redesign | — |
| 16 | Dark theme | Structurally complete; shadows too heavy, surfaces slightly muddy | Upgrade | Retune via ramps; inset hairlines instead of giant blooms | 1 |
| 17 | `AccessibleTable`, `SafeBoldText`, badges | Sound semantics | Keep + polish | Token-level refresh only | 1 |

## 3. Tier 3 items

None planned. No dependencies added, no routes/API/data changes, no capability removed.

## 4. Baseline results (Phase 0)

- `npm run lint` — pass (no output)
- `npm run typecheck` — pass
- `npm run test` — 40 files, 252 tests, all pass
- Playwright chromium smoke (pristine checkout, after worktree `npm ci`) — **14 passed / 5 failed**. The 5 failures are **pre-existing** (present before any redesign change) and consistent with dev-mode compile-latency timeouts (the captured page snapshots show the app rendering correctly):
  1. `demo answer flow reaches a source-backed answer` — "Structured details" heading not visible within 10s.
  2. `document viewer private missing source state is coherent` — pdf-preview text not found within 30s.
  3. `duplicate upload warning…` — "Queue document" button observed disabled.
  4. `guide opens and dismisses at mobile`.
  5. `guide opens and dismisses at desktop` — `role=dialog "Clinical KB guide"` not visible within 10s.

  **Regression baseline = these 14 must stay green.** The 5 pre-existing failures are out of scope to "fix" but I will manually verify the guide, answer, and upload flows in-browser (Phases 4–6) since the redesign touches them, and will not regress them further.

  **Refined baseline (warm server, after Phase 1):** re-running the 5 on a warm dev server, the 2 **guide** tests PASS — they were cold-compile timeouts. **3 remain deterministically failing** and are non-CSS assertions, i.e. pre-existing on this branch, independent of styling:
  - `demo answer flow reaches a source-backed answer` (expects a "Structured details" heading in answer content)
  - `document viewer private missing source state is coherent` (pdf-preview private-state text)
  - `duplicate upload warning…` ("Queue document" enable logic)

  These three do not exercise any CSS the redesign touches; tracked as pre-existing. Phase 1 verification (warm server): all 6 layout-overflow tests + both guide tests pass.
