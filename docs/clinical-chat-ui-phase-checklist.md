# Clinical Chat UI Phase Checklist

Date: 2026-06-23

This checklist tracks the phased implementation of the final clinical chat redesign.

## Phase 1: Design implementation spec

Status: completed

Goal:

- Save the full UI implementation plan before any app code changes.
- Lock design principles, visual tokens, component mapping, and acceptance criteria.

Deliverables:

- `docs/clinical-chat-ui-implementation-plan.md`
- `docs/clinical-chat-ui-phase-checklist.md`

Checklist:

- [x] Define north-star design direction.
- [x] Define non-goals.
- [x] Define typography scale.
- [x] Define functional colour system.
- [x] Define icon rules and mappings.
- [x] Define default UI states.
- [x] Define source capsule behavior.
- [x] Define evidence drawer behavior.
- [x] Define clinical notes threshold.
- [x] Define table behavior.
- [x] Define Documents mode behavior.
- [x] Define empty state behavior.
- [x] Define accessibility and motion requirements.
- [x] Define implementation iterations.
- [x] User confirms Phase 1 plan is accepted.

Exit criteria:

- The implementation plan exists in repo docs.
- The checklist exists in repo docs.
- No app code has been changed for the redesign.
- User approves moving to Phase 2.

## Phase 2: Component inventory and implementation mapping

Status: completed

Goal:

- Inspect current UI components and map exact edits before styling work.

Likely files:

- `src/components/ClinicalDashboard.tsx`
- `src/components/clinical-dashboard/master-search-header.tsx`
- `src/components/clinical-dashboard/dashboard-shell.tsx`
- `src/components/clinical-dashboard/answer-status.tsx`
- `src/components/ui-primitives.tsx`
- `src/app/globals.css`

Checklist:

- [x] Identify all current answer surfaces.
- [x] Identify all evidence/source/quote/image/table surfaces.
- [x] Identify current mobile navigation/FAB behavior.
- [x] Identify current header/composer behavior.
- [x] Identify reusable primitives.
- [x] Identify admin/setup/indexing surfaces that must leave daily UI.
- [x] Produce precise file-level edit list before code changes.

Exit criteria:

- We know exactly which components will change.
- No backend/search/API changes are required.
- Any risky areas are called out before editing.
- Component map is saved in `docs/clinical-chat-ui-component-map.md`.

## Phase 3: Tokens and primitives

Status: completed

Goal:

- Add final style primitives before composing full screens.

Checklist:

- [x] Add typography primitives.
- [x] Add source capsule primitive.
- [x] Add collapsed Evidence row primitive.
- [x] Add Clinical notes row primitive.
- [x] Add chat composer primitive.
- [x] Add table micro-action primitive.
- [x] Add status-dot primitive.
- [x] Add icon sizing conventions.

Exit criteria:

- New visual style can be reused without large one-off class strings.
- Existing functionality remains connected.
- Shared primitives are available in `src/components/ui-primitives.tsx`.
- Clinical chat colour aliases are available in `src/app/globals.css`.

## Phase 4: Desktop shell and sidebar

Status: completed

Goal:

- Implement persistent, useful, collapsible desktop sidebar.

Checklist:

- [x] Add full sidebar layout.
- [x] Add collapsed icon rail.
- [x] Add New chat.
- [x] Add Search chats.
- [x] Add recent chats.
- [x] Add Top tools.
- [x] Add prominent View all tools.
- [x] Keep Guide/help and Settings in sidebar.
- [x] Add profile initials and ready dot.

Exit criteria:

- Sidebar matches mockup hierarchy.
- Chat has more room when sidebar collapses.

## Phase 5: Header and composer

Status: completed

Goal:

- Replace dashboard-style header with clean chat-style controls.

Checklist:

- [x] Simplify top bar.
- [x] Keep Answer/Documents segmented control.
- [x] Show explicit scope state.
- [x] Move upload/evidence out of top bar.
- [x] Add clean composer.
- [x] Add desktop `+` menu actions.
- [ ] Add mobile `+` bottom sheet actions.
- [x] Hide admin/setup/indexing from daily menu.

Exit criteria:

- Composer feels ChatGPT-like.
- Top bar is useful but quiet.
- Mobile `+` bottom sheet remains deferred to Phase 9 mobile refinement.

## Phase 6: Answer presentation

Status: completed

Goal:

- Make natural answer the primary surface.

Checklist:

- [x] Natural answer first.
- [x] Source capsule at paragraph end.
- [x] Tiny `Copy · ⋯` action row.
- [x] Plain bullets.
- [x] Single More detail control.
- [x] Conditional Clinical notes row.
- [x] Collapsed Evidence row.
- [x] Optional table card only when central.

Exit criteria:

- Answer is readable before evidence/tools.
- No large clinical-card wall.
- Existing clinical details are now behind the Clinical notes drawer instead of always open inline.

## Phase 7: Evidence and source behavior

Status: completed

Goal:

- Move all source/evidence details into progressive disclosure.

Checklist:

- [x] Evidence collapsed by default.
- [x] Adaptive Evidence tab order.
- [x] Tables tab.
- [x] Sources tab.
- [x] Images tab.
- [x] Quotes tab.
- [x] PDFs tab.
- [x] Map tab.
- [x] Source preview popover/sheet.
- [x] PDF drawer action.
- [x] Copy quote/table/source actions.

Exit criteria:

- All evidence types are available.
- Main answer remains calm.
- Legacy always-visible quote/image/source sections are hidden to reduce duplication.

## Phase 8: Documents mode and empty state

Status: completed

Goal:

- Make Documents mode a true document search mode and simplify empty state.

Checklist:

- [x] Documents placeholder: `Search your clinical documents...`
- [x] Document result cards.
- [x] Open action.
- [x] Ask from this action.
- [x] Scope action.
- [x] Quiet empty state with three starter chips.
- [x] Recent chats remain in sidebar.

Exit criteria:

- Answer and Documents modes are clearly different.

## Phase 9: Mobile refinement

Status: completed

Goal:

- Make mobile feel native, spacious, and strict.

Checklist:

- [x] Remove mobile title.
- [x] Short source capsule.
- [x] 44px targets.
- [x] No bottom nav.
- [x] Closed `+` sheet by default.
- [x] Half-height `+` sheet with five actions.
- [x] Clinical notes and Evidence collapsed rows only.
- [x] Mobile table is compact.

Exit criteria:

- Phone view is clean and usable.

## Phase 10: Screenshot comparison and polish

Status: partial

Goal:

- Compare implementation against mockups and refine.

Screens to capture:

- [ ] Desktop default answer.
- [ ] Desktop sidebar collapsed.
- [ ] Desktop Evidence opened.
- [ ] Desktop source preview.
- [ ] Desktop Documents mode.
- [ ] Desktop empty state.
- [ ] Mobile default answer.
- [ ] Mobile `+` sheet.
- [ ] Mobile Evidence opened.
- [ ] Mobile Documents mode.

Polish checks:

- [x] Typography hierarchy matches code-level design tokens.
- [x] Icons are consistent in updated header/sidebar/composer surfaces.
- [x] Colour is sparse and functional in updated primitives.
- [x] Accordions are clear and collapsed by default.
- [x] Source capsule is clickable.
- [x] Table is secondary and only inline when central.
- [x] Copy behavior is preserved for the answer.
- [x] No admin controls in daily `+` menu.

Exit criteria:

- Visual match is close enough to proceed to verification.
- Manual/browser screenshot review remains recommended because automated browser screenshot control was unavailable in this session.

## Phase 11: Verification

Status: completed

Goal:

- Run appropriate checks after implementation.

Recommended checks:

- [x] `npm run ensure` for local app identity and URL.
- [ ] Browser review at desktop and mobile widths.
- [x] Focused UI smoke checks for chat, table expansion, source/evidence controls, and Documents mode.
- [x] `npm run verify:ui` after UI behavior is complete.
- [x] `npm run verify:cheap` before handoff.
- [x] `npm run check:production-readiness` after source/evidence UI changes.
- [ ] `npm run verify:release` only for release/handoff confidence.

Exit criteria:

- UI works on desktop and mobile.
- Existing critical behavior is not regressed.
- Current automated status: `npm run verify:cheap`, `npm run verify:ui`, and `npm run check:production-readiness` pass.
- Remaining optional handoff gate: `npm run verify:release`.
