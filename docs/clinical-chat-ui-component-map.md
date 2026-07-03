# Clinical Chat UI Component Map

Date: 2026-06-24

> **Revised 2026-07-03 — colour aligned to Clinical White / Aegean Graphite.** The colour aliases in this Phase-2 map have been rewritten in-body onto the role tokens now in `globals.css`: `--command` (graphite) for primary command, `--clinical-accent` (Aegean) for clinical identity, and `--success` (green) for status only. See [`redesign/02-design-direction.md`](redesign/02-design-direction.md) and [`redesign/permanent-colour-direction.md`](redesign/permanent-colour-direction.md). The component/file mapping and preservation rules are unchanged from the original 2026-06-24 draft.

## Purpose

This document translates the approved clinical chat UI direction into a practical component-level implementation map. It identifies what each current UI area should become, which files are likely involved, what should be preserved, and what should be moved, collapsed, or restyled.

This is Phase 2 of the redesign process. It is a planning and mapping artifact only.

## Implementation posture

The redesign should be implemented as a careful reskin/recomposition of existing functionality, not a product rewrite.

Rules:

- Preserve answer/search/document/evidence API behavior.
- Preserve current source, quote, image, table, PDF, and document data structures.
- Avoid touching backend routes unless a UI integration blocker is found.
- Prefer shared primitives over one-off Tailwind class strings.
- Keep each implementation slice visually testable before moving deeper.

## File-level map

### `src/components/ClinicalDashboard.tsx`

Current role:

- Main dashboard shell.
- Holds answer/document state.
- Renders answer result surface.
- Renders evidence, quotes, visuals, sources, documents, upload/indexing, guide, mobile FAB.

Final role:

- Main chat shell and orchestration layer.
- Owns desktop sidebar layout.
- Owns main chat canvas.
- Owns conditional answer/evidence/document mode composition.
- Should stop presenting daily use as a dashboard of many separate panels.

Expected changes:

- Add or compose persistent desktop sidebar.
- Remove or disable mobile bottom section FAB in the final chat UI.
- Reorganize answer result surface so natural answer appears first.
- Move source/evidence/quote/image/table/PDF details into unified Evidence drawer.
- Keep upload/indexing/admin surfaces available but outside daily `+` menu.
- Add collapsed Clinical notes and Evidence rows below answer.
- Show inline table card only when table/visual evidence is central to the query.
- Keep existing document drawer/upload drawer functionality reachable from sidebar/settings/upload flows.

Must preserve:

- Existing answer request flow.
- Existing document search request flow.
- Existing `RagAnswer`, `SearchResult`, `VisualEvidenceCard`, `QuoteCard`, and document data usage.
- Existing signed image loading behavior.
- Existing table expansion behavior.
- Existing source opening and document viewer URLs.

High-risk areas:

- `StagedAnswerResultSurface`
- `VisualEvidenceStrip`
- `QuoteCards`
- `SourceList`
- `MobileSectionFab`
- upload/indexing drawers

Implementation note:

Do not delete evidence panels immediately. First route them into the new unified Evidence drawer, then remove visual duplication after screenshots confirm behavior.

## `src/components/clinical-dashboard/master-search-header.tsx`

Current role:

- Sticky header.
- App title.
- Answer/Documents selector.
- Refine/scope controls.
- Query input and submit button.
- Guide/theme/tools buttons.

Final role:

- Clean top bar plus composer behavior.
- Desktop top bar should show only: sidebar/hamburger, Answer/Documents, explicit scope state, New chat, profile/status.
- Composer should be clean: `+`, input, mic, send.
- Mobile header should omit title and keep only essential controls.

Expected changes:

- Remove heavy/dark dashboard header treatment from the daily chat surface.
- Remove visible upload/evidence/admin controls from top bar.
- Change Documents mode placeholder to `Search your clinical documents...`.
- Change Answer mode placeholder to `Ask a clinical question...`.
- Keep explicit scope text: `All sources`, scoped document/folder name, or selected count.
- Add `+` menu trigger and daily menu actions.
- Ensure mobile controls remain 44px minimum.

Must preserve:

- Scope selection behavior.
- Scope popover/sheet behavior.
- Answer/Documents mode switching.
- Query submission behavior.
- Existing keyboard submission behavior where appropriate.

High-risk areas:

- Scope popover focus restoration.
- Mobile scope sheet.
- Existing UI tests that target `data-testid="scope-trigger"` and scope popover.

Implementation note:

Keep existing test IDs where possible. Add new test IDs rather than renaming existing ones.

## `src/components/clinical-dashboard/dashboard-shell.tsx`

Current role:

- `SectionHeading`.
- `UtilityDrawer`.
- Guide dialog/trigger.

Final role:

- Standard accordion/sheet primitive layer.
- `UtilityDrawer` should support the final collapsed Evidence and Clinical notes rows.
- Mobile behavior should remain sheet-based for deep detail.

Expected changes:

- Add visual variants for:
  - default evidence row
  - clinical notes row (neutral `--surface-subtle`, no sand tint)
  - compact daily drawer
- Ensure right-aligned chevrons are consistent.
- Keep accessible labels and state.
- Keep mobile sheet behavior clean and native.

Must preserve:

- Existing sheet behavior.
- Existing Guide dialog behavior.
- Keyboard/focus behavior.

High-risk areas:

- Any mobile sheet focus trap behavior.
- Visual regressions in non-chat drawers if shared component changes are too broad.

Implementation note:

Prefer explicit `variant` props over global restyling that changes every drawer at once.

## `src/components/clinical-dashboard/answer-status.tsx`

Current role:

- Copy button.
- Empty answer state.
- Answer skeleton.

Final role:

- Empty state should become quiet and chat-native.
- Copy behavior should support answer-level copy vs evidence-level copy.

Expected changes:

- Update empty state to three starter chips:
  - Ask a question
  - Search documents
  - Upload document
- Keep recent chats out of the main canvas.
- Keep copy button subtle and close to answer.
- Keep skeleton aligned to new chat layout.

Must preserve:

- Existing sample query behavior unless intentionally replaced.
- Existing copy feedback behavior.

High-risk areas:

- Empty state may currently be used in tests or screenshots.

Implementation note:

Do not overload empty state with all capabilities. Keep it quiet.

## `src/components/ui-primitives.tsx`

Current role:

- Shared class constants and small primitives.
- Source status badge.
- Common panels, cards, controls.

Final role:

- Centralized design token bridge and reusable class primitives for the redesign.

Expected additions:

- `chatComposerShell`
- `chatComposerInput`
- `sourceCapsule`
- `evidenceRow`
- `clinicalNotesRow`
- `statusDot`
- `microAction`
- `sidebarItem`
- `tableCard`
- `tableMicroActionRow`

Expected refinements:

- Route active/selected, source-backed, and evidence states through the `--clinical-accent` role tokens; keep primary command on `--command`; use neutral `--surface-subtle` for quiet panels.
- Reduce dependency on heavy dashboard cards for answer surfaces.
- Keep focus styles visible.

Must preserve:

- Existing primitives used by non-redesigned areas until migrated.
- Existing forced-colors compatibility.

High-risk areas:

- Broad primitive changes can affect upload/document/admin drawers.

Implementation note:

Add new primitives first. Migrate surfaces selectively.

## `src/app/globals.css`

Current role:

- Tailwind import.
- Theme tokens.
- Base styles.
- Motion keyframes.
- Accessibility media rules.

Final role:

- Add or refine final UI tokens and utility classes without breaking current theme support.

Expected changes:

- Use the Clinical White / Aegean Graphite role tokens already defined here; do not reintroduce ad-hoc chat aliases:
  - `--command` / `--command-hover` (graphite command)
  - `--clinical-accent` / `--clinical-accent-soft` / `--clinical-accent-border` (Aegean evidence/selected/send/focus)
  - `--info` (document/search signal)
  - `--success` / `--warning` / `--danger` (status dots and safety states)
  - neutral `--surface` / `--surface-subtle` / `--surface-inset` for canvas, quiet panels, and table headers
- Ensure reduced-motion behavior covers new sheet/popover/accordion animation.
- Ensure mobile form controls stay at 16px minimum.

Must preserve:

- Existing light/dark token compatibility.
- Forced-colors behavior.
- Reduced-motion behavior.

High-risk areas:

- Changing root colour tokens may affect the entire app.

Implementation note:

Prefer composing the existing role tokens over introducing new global colour tokens; only change the root palette when the design direction itself changes.

## Component behavior map

### Natural answer

Current source:

- `NaturalLanguageAnswer`
- `StagedAnswerResultSurface`
- `SourceLinkedAnswer`
- `FormattedAnswerContent`

Final behavior:

- Natural answer first.
- One source capsule after the paragraph.
- `Copy · ...` row near answer.
- Plain bullets.
- `More detail` only.

Needed adaptation:

- Split natural answer rendering from evidence/clinical structure.
- Use current answer text sanitation but simplify card treatment.
- Avoid heavy bordered classification cards inside primary answer.

### Source capsule

Current source:

- Answer source status/evidence summary components.
- Source links and source result helpers.

Final behavior:

- Stateful capsule:
  - `Source-backed · N sources`
  - `Check sources`
  - `No direct source`
- Mobile shorter: `N sources`.
- Click opens preview.

Needed adaptation:

- New component should derive state from:
  - `answer.grounded`
  - current relevance
  - citations/source count
  - weak evidence state
- Source preview should reuse existing source href helpers and source metadata.

### Clinical notes

Current source:

- `ClinicalOutputPanel`
- `buildClinicalOutputSections`
- `buildHighYieldClinicalOutputSections`
- `SafetyFindingsPanel`

Final behavior:

- Show collapsed row only when useful.
- Neutral quiet row (`--surface-subtle`), no sand tint.
- Open detail compactly.

Needed adaptation:

- Build a threshold function:
  - show if sections include safety, monitoring, escalation, contraindication/caution, medication risk, or safety findings.
- Avoid always rendering the large clinical details grid inline.

### Evidence row and drawer

Current source:

- `EvidenceSummaryCard`
- `EvidenceCounts`
- `AnswerInsightBar`
- `EvidenceVerificationStrip`
- `QuoteCards`
- `VisualEvidenceStrip`
- `SourceList`
- `EvidenceMapTable`
- `RelatedDocumentsPanel`

Final behavior:

- One collapsed row by default.
- Drawer tabs adapt ordering to query type.
- Contains Tables/Sources/Images/Quotes/PDFs/Map.

Needed adaptation:

- Create a new `UnifiedEvidenceDrawer` composition using existing panels internally.
- Avoid duplicating full sections below the answer.
- Keep detailed evidence available in drawer/sheet.

### Inline table card

Current source:

- `AccessibleTable`
- `VisualEvidenceStrip`
- clinical detail tables from `ClinicalOutputPanel`

Final behavior:

- Only when central to query.
- Short title.
- Faint table header.
- Micro-actions: Expand, Source, Copy, ellipsis.

Needed adaptation:

- Reuse table extraction logic.
- Detect table-central questions from existing query class/visual evidence.
- Keep full table details in Evidence.

### Documents mode

Current source:

- `DocumentSearchResultsPanel`
- `requestDocuments`
- `searchMode`

Final behavior:

- True document search.
- Placeholder changes.
- Result cards, no assistant answer.

Needed adaptation:

- Mostly restyle and clarify.
- Ensure switching mode clears or visually separates answer state if needed.

### Sidebar

Current source:

- Current layout does not yet match final persistent sidebar.
- Recent query state exists in `ClinicalDashboard`.

Final behavior:

- Full desktop sidebar.
- Collapsed rail.
- Recent chats.
- Top tools + View all tools.

Needed adaptation:

- New sidebar component can live inside `ClinicalDashboard.tsx` initially or separate later.
- Use existing `recentQueries`.
- `New chat` should clear current query/answer state.

### Mobile `+` sheet

Current source:

- No final daily `+` menu yet.
- Existing sheet component can be reused.

Final behavior:

- Closed by default.
- Five half-height actions:
  - Search
  - Add
  - Scope
  - Evidence
  - Tools

Needed adaptation:

- Add composer `+` state.
- Reuse `Sheet`.
- Keep 44px tap targets.

## Data preservation map

Do not change these data flows in visual phases:

- `/api/answer/stream`
- `/api/search`
- `/api/documents`
- `/api/ingestion/*`
- citation/document href helpers
- signed URL image loading
- source governance warnings
- answer ranking/evidence generation

If an implementation requires a backend change, stop and document why before proceeding.

## Test and screenshot targets

Minimum screenshot states after UI coding starts:

- Desktop default answer.
- Desktop sidebar collapsed.
- Desktop source capsule opened.
- Desktop Evidence drawer opened.
- Desktop Documents mode.
- Desktop empty state.
- Mobile default answer.
- Mobile `+` sheet.
- Mobile source preview.
- Mobile Evidence drawer.
- Mobile Documents mode.

Minimum behavior checks:

- Answer generation still works.
- Documents mode still searches.
- Scope selection still works.
- Source links still open.
- Table expansion still works.
- Image previews still load when opened.
- PDF/document drawer links remain available.
- Copy answer copies only natural answer.
- Evidence copy actions are separate.

## Phase 2 exit criteria

- Component mapping is documented.
- File-level responsibilities are clear.
- High-risk areas are identified.
- Next phase can start with shared primitives/tokens.
