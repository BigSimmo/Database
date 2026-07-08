# UX & Accessibility Review — Clinical KB

**Date:** 2026-07-07
**Reviewer role:** senior product designer · UX researcher · frontend engineer · accessibility specialist · QA
**Method:** static review of shipped code (Next.js 16 / React 19 / Tailwind v4). This pass did **not** run the app in a browser, so anything requiring live behaviour is marked **Needs testing** rather than asserted. Every code claim is anchored to a `file:line`.
**Scope:** the production surface — the unified search shell and its 8 modes (answer, documents, services, forms, favourites, differentials, prescribing/medications, tools), the document viewer, auth, and ingestion. The `/mockups/*` prototype tree is dev-only (404 in production, disallowed in robots) and is out of scope except where a "mockup"-named file is actually the production shell.

> **Headline:** this is an unusually mature front end. The design system is documented and largely enforced, and the hardest accessibility work — reduced-motion, forced-colors, focus management, tap targets, no-FOUC theming — is already done and done well. The findings below are mostly _convergence gaps_ (places the code hasn't caught up to its own contract) and a handful of genuine missing behaviours, not a rescue job. The single clear defect is a modal that omits a focus trap.

---

## Summary — the four asks

### 1. What is working well (preserve)

Reduced-motion / forced-colors / reduced-transparency handling; the `Sheet` modal primitive; token-only theming with a pre-paint script; a 44px tap-target token enforced across primitives; skip link + landmarks + `aria-current`; and genuinely resilient search (retry + stale-response guard + keyword fallback + offline/demo adaptation). Details in **Strengths** below.

### 2. What feels confusing / unfinished / inconsistent

Two divergent modal implementations (one missing a focus trap); a mode picker that silently locks to one mode on `/forms` and `/favourites`; no in-page "back/up" from deep detail pages; a single-slot notification model that can overwrite itself; and a stale architecture doc.

### 3. Expected behaviours that are missing

User-facing result **sorting**; breadcrumbs / explicit back affordances on detail routes; **undo** after destructive delete; a notification **queue** (vs a single slot).

### 4. Highest-leverage improvements

The **Top 10** section ranks these. In one line: add the table-dialog focus trap, add a sort control, and run a small-text contrast/size pass.

---

## Strengths to preserve

These are the behaviours most likely to be eroded by future churn — call them out in PR review so they survive.

- **Motion & contrast preferences are first-class.** `globals.css` has a global `prefers-reduced-motion: reduce` kill-switch (`globals.css:1914-1928`) that zeroes animation/transition/scroll durations, a thorough `forced-colors: active` remap of every token to system colors (`globals.css:1930-1992`), and a `prefers-reduced-transparency` fallback that swaps blur scrims for opaque gradients (`globals.css:746-763`). Animations are additionally gated _on_ via `@media (prefers-reduced-motion: no-preference)` and `motion-safe:` utilities. This is above the level most production apps reach.
- **One correct modal primitive.** `src/components/ui/sheet.tsx` implements a Tab/Shift-Tab focus loop (`ui/sheet.tsx:96-117`), Escape-to-close, backdrop dismiss, body scroll-lock (`:81`), rAF initial focus (`:82-88`), and return-focus-to-opener with a 50ms fallback (`:124-137`), all under `role="dialog" aria-modal="true"` with `aria-labelledby`/`aria-describedby`. This is the pattern to standardise on.
- **No-flash theming from tokens only.** A pre-paint inline script applies the stored/OS theme before first paint (`layout.tsx:54-58`); all colour comes from CSS custom properties with a complete `.dark` re-tune. Dark mode is not an afterthought.
- **Tap targets are tokenised, not hand-rolled.** `--spacing-tap: 44px` (`globals.css:40`) drives `min-h-tap`/`size-tap` on `controlBase`, `floatingControl`, `toolbarButton`, `navPill`, composer buttons, etc. (`ui-primitives.tsx:29-99`), with `!important` floors even on ≤430px viewports (`globals.css:1184-1198`). iOS zoom is guarded by a 16px input floor under 640px (`globals.css:438-444`).
- **Keyboard & landmark basics are in place.** Skip link to `#main-content` (`layout.tsx:59-65`), `<html lang="en">`, `#main-content` as a `tabIndex={-1}` focus target (shell `:422`), `aria-current="page"` on active nav (`ClinicalSidebar.tsx:238`), and a global `:focus-visible` ring floor on every interactive element (`globals.css:457-466`).
- **Search is resilient, not brittle.** Automatic retry with backoff `[500,1000,2000]ms` classified by retryable status/error/message (`search-utils.ts:12`, `ClinicalDashboard.tsx:1679`), a monotonic `searchRequestSeqRef` that stops stale/out-of-order responses committing (`ClinicalDashboard.tsx:1711`), a keyword-search fallback when NL search fails, and `navigator.onLine` offline detection with deployed-vs-local specific guidance (`ClinicalDashboard.tsx:1450, 2683, 2719`).
- **Destructive delete has real friction.** Deletion requires typing the exact document title, warns "This action cannot be undone," and enumerates everything removed (source, evidence, images, labels, summaries, query logs) — `DocumentManagementActions.tsx`.
- **Loading & empty states are systematic.** `role="status"` skeletons with `sr-only` "Loading" text (`mode-home-page-skeleton.tsx`), a streaming answer progress banner that is stale-guarded (`ClinicalDashboard.tsx:3026`), and centralized empty-state copy (`ui-copy.ts:48`) rather than ad-hoc strings.

---

## A. UX flow & navigation

### A1 — No user-facing result sorting

- **Type:** Missing behaviour · **Area:** UX flow
- **Screen/interaction:** document search results, services/forms/differentials registries
- **Evidence:** results are server-ranked by relevance; the client offers tag-facet filtering and result-type tabs (all/tables/images/pdfs) — `document-search-results.tsx:222-238` — but no component exposes a sort control (recency, title A–Z, relevance). Registry lists filter in place with no sort.
- **Why it matters:** clinicians scanning a long registry (~220 services, ~200 diagnoses) often want alphabetical or most-recent order; relevance-only ordering makes a known item hard to relocate and defeats "where did I see that yesterday."
- **Severity:** Medium · **Confidence:** Medium (absence confirmed in results components; a hidden control elsewhere is unlikely but unverified)
- **Recommendation:** add a `Sort` control (relevance default; recency; title) to the results header band; persist the choice per mode in the URL grammar so it survives navigation.
- **Acceptance criteria:** a keyboard-reachable, labelled sort control appears on results ≥1 item; changing it re-orders without a full reload; the active sort is reflected in the URL and restored on back/forward.

### A2 — No breadcrumbs and minimal explicit back/up affordances

- **Type:** Missing behaviour · **Area:** UX flow
- **Screen/interaction:** detail routes — `/services/[slug]`, `/forms/[slug]`, `/differentials/diagnoses/[slug]`, `/medications/[slug]`
- **Evidence:** cross-route navigation relies on native browser history (`router.push` / `<Link>`); the only bespoke back control is a mobile "Back to differentials home" button gated to `/differentials` with a query (shell `:389-395`, header `:1551`). No breadcrumb component was found.
- **Why it matters:** users arriving on a detail page via deep link, cross-mode link, or search have no in-page way back to the list they conceptually came from; on mobile there is no browser back chrome, so this is a potential dead-end.
- **Severity:** Medium · **Confidence:** Medium
- **Recommendation:** add a lightweight "← Back to {mode}" affordance (or a breadcrumb) to detail-page headers, using the existing mode metadata for the label/href.
- **Acceptance criteria:** every `[slug]` detail page renders a visible, keyboard-focusable back/up control to its parent list; it works on first load (no history entry required).

### A3 — Mode picker silently locks to one mode on Forms & Favourites

- **Type:** Issue · **Area:** UX flow
- **Screen/interaction:** `/forms`, `/favourites`
- **Evidence:** those layouts pass `availableModeIds={["forms"]}` / `["favourites"]`, which filters the shell's visible modes to one (`global-mockup-search-shell.tsx:95-100`), so the header mode picker offers no alternative there — unlike every other surface.
- **Why it matters:** the mode picker is the primary cross-mode switch. Removing it on two pages (with no visible explanation) breaks the mental model "I can jump modes from anywhere" and can strand a user who navigated in via a mode chip.
- **Severity:** Medium · **Confidence:** Medium (behaviour is intentional per code comments; the UX consequence is the finding, and warrants live confirmation)
- **Recommendation:** either keep the full mode picker on these pages, or replace it with an obvious labelled "Switch mode" entry so the capability isn't invisible.
- **Acceptance criteria:** from `/forms` and `/favourites` a user can reach any other mode in ≤1 interaction without the browser back button, and the available switch is visible.

### A4 — Context preservation leans on the URL; some shell state resets across routes

- **Type:** Needs testing · **Area:** UX flow
- **Screen/interaction:** cross-route navigation (standalone mode homes)
- **Evidence:** durable context is the URL (`?mode/q/focus/run`) plus `localStorage` (recent queries, theme, favourites). Shell `useState` (query, scope filters, queryMode) is per-mount, and each standalone route mounts its own shell (`global-mockup-search-shell.tsx`), so non-URL state can reset on navigation.
- **Why it matters:** if a user sets scope filters or a clinical query-mode, then navigates and returns, those may silently reset — surprising, and easy to miss.
- **Severity:** Low–Medium · **Confidence:** Low (behaviour is plausible from the code but must be observed live)
- **Recommendation:** confirm whether scope/queryMode should persist; if so, lift them into the URL grammar or a shared store.
- **Acceptance criteria (if confirmed):** filters/query-mode set on one route are still applied after navigating away and back.

---

## B. Interaction behaviour & adaptive feedback

### B1 — Single-slot notifications can overwrite each other; success auto-dismiss may be too fast

- **Type:** Issue · **Area:** Interaction
- **Screen/interaction:** any action that fires a notice (delete, rename, label review, job retry, demo-mode guard)
- **Evidence:** notifications use one bespoke `actionNotice` state slot (`ClinicalDashboard.tsx:764`, rendered `:2974` as `role="status"` with a dismiss button). Success auto-dismisses at 4000ms (`:1391-1394`); warnings persist. There is no queue — a second notice replaces the first.
- **Why it matters:** two near-simultaneous actions (e.g. bulk operations) can hide the first result; a 4s success may vanish before a returning/AT user reads it, undercutting the acknowledgement the design otherwise provides well.
- **Severity:** Medium · **Confidence:** Medium (single-slot confirmed in code; 4s adequacy is **Needs testing** with a screen reader)
- **Recommendation:** add a minimal notice queue (or stack), and lengthen/soften the success dismiss (or make it dismiss-on-next-action) so announcements aren't clipped.
- **Acceptance criteria:** two notices fired in quick succession are both perceivable; success notices remain until dismissed or for a duration validated as SR-readable.

### B2 — Duplicate-submit protection concentrated on one guard

- **Type:** Needs testing · **Area:** Interaction
- **Screen/interaction:** primary search submit
- **Evidence:** re-submit is blocked by `canAsk = … && !loading …` disabling the button (`master-search-header.tsx:295, 1374`), and stale responses are dropped by `searchRequestSeqRef` (`ClinicalDashboard.tsx:1711`). Programmatic callers of `executeSearch` (recent-query pick, cross-mode search) rely on the seq-guard rather than an in-flight lock.
- **Why it matters:** the visible path is well-protected, but rapid programmatic triggers could still fire overlapping requests; the seq-guard prevents _stale commits_ but not duplicate _network calls_.
- **Severity:** Low · **Confidence:** Medium
- **Recommendation:** verify under fast repeated triggers; if duplicates occur, add an in-flight ref that short-circuits `executeSearch`.
- **Acceptance criteria:** rapidly triggering the same search (button + Enter + recent-pick) issues at most one in-flight request.

### B3 — Strong adaptive feedback (preserve, with one gap)

- **Type:** Strength · **Area:** Interaction
- **Evidence:** offline/degraded notices (`ClinicalDashboard.tsx:2719`), demo-mode banners and upload lock (`DocumentManagerPanel.tsx:35`), setup-readiness gating the submit button's title ("Search setup not ready", `master-search-header.tsx:1376`), and polling that pauses on hidden tabs (`:1408`). This is genuinely context-adaptive.
- **Why it matters:** worth preserving; the only adjacent gap is B1 (no queue).

---

## C. Visual hierarchy & interface polish

### C1 — Very small production type for dense metadata

- **Type:** Issue · **Area:** Visual design / Accessibility
- **Screen/interaction:** clinical metadata rows, eyebrow labels, badges across ~34 files
- **Evidence:** `text-3xs` (10px) and `text-4xs` (8px) tokens exist (`globals.css:63-69`) and are used widely for dense metadata.
- **Why it matters:** 8–10px text is below comfortable reading size for clinical detail, especially for presbyopic or low-vision users; contrast can be fine while legibility is not.
- **Severity:** Medium · **Confidence:** High (usage confirmed) / the _impact_ is Medium
- **Recommendation:** audit `text-4xs`/`text-3xs` call sites; reserve ≤10px for truly non-essential ornamentation and lift primary metadata to `text-2xs`+.
- **Acceptance criteria:** no clinically meaningful text renders below 11px; a documented list of the remaining ≤10px ornamental uses.

### C2 — Design system is consistently applied (strength)

- **Type:** Strength · **Area:** Visual design
- **Evidence:** ~50 shared class recipes centralised in `ui-primitives.tsx`; tokens-only colour with a CI type-scale guard (`scripts/check-type-scale.mjs`). The interface reads as finished and deliberate, not ad-hoc.

---

## D. Performance feel & technical UX behaviour

> All of section D is **Needs testing** — frame timing, jank, and layout shift cannot be measured from source. The static signals below indicate the _intent_ is right.

### D1 — Loading choreography looks well-structured (verify live)

- **Type:** Needs testing · **Area:** Performance
- **Evidence:** route-level `loading.tsx` files across every mode, shared skeleton primitives, a shimmer answer skeleton (`answer-status.tsx:87`), and streaming answer progress. The Suspense fallback deliberately avoids re-rendering children to prevent duplicate-DOM (`global-mockup-search-shell.tsx:64-78`).
- **Why it matters:** the structure should give smooth perceived loading, but streaming flicker, skeleton-to-content shift (CLS), and scroll smoothness must be observed.
- **Recommendation / acceptance:** run `npm run ensure` + `npm run verify:ui`; capture CLS on answer render and results paint; confirm no visible skeleton→content jump and no scroll hitching on long results.

### D2 — Animations are motion-gated (strength, verify)

- **Type:** Strength / Needs testing · **Area:** Performance
- **Evidence:** keyframes are token-exposed and every one is gated on reduced-motion (`globals.css:1692-1792, 1914`). Confirm transforms are GPU-friendly and don't drop frames on low-end mobile.

---

## E. Forms, errors & recovery

### E1 — No undo after destructive delete

- **Type:** Missing behaviour · **Area:** Interaction / Trust
- **Screen/interaction:** document delete
- **Evidence:** delete is final by design — strong type-to-confirm friction (`DocumentManagementActions.tsx`) but no soft-delete/undo window; the confirmation copy states it cannot be undone.
- **Why it matters:** type-to-confirm prevents _accidental_ deletion, but a mis-identified document (right title, wrong doc) is unrecoverable. An undo window is the modern safety net.
- **Severity:** Medium · **Confidence:** High
- **Recommendation:** consider a short-lived soft delete with an "Undo" action in the success notice, or keep hard-delete but document the deliberate choice.
- **Acceptance criteria:** either an undo path exists for ≥N seconds post-delete, or the decision is recorded as intentional in the design system.

### E2 — Error handling & recovery is thorough (strength)

- **Type:** Strength · **Area:** Interaction
- **Evidence:** global + segment `error.tsx` boundaries with reset/reload, `not-found.tsx`, inline `role="alert"` banners (`ClinicalDashboard.tsx:3016`), manual retry for images and ingestion jobs, per-action `try/catch/finally` with API error extraction and 401 → `markSessionExpired()`. Input is preserved on error (the controlled query state is not cleared on failure). Preserve this.

### E3 — Labels, autofill & focus order (verify)

- **Type:** Needs testing · **Area:** Accessibility
- **Evidence:** `label htmlFor` with `sr-only` labels exists (`DocumentViewer.tsx:1533`), inputs use `type="search"`/16px floor. Autofill behaviour, tab order through the composer + filters, and focus order in multi-field forms need a live keyboard pass.

---

## F. Accessibility, trust & safety

### F1 — Fullscreen table dialog has no Tab focus trap _(primary defect)_

- **Type:** Issue · **Area:** Accessibility
- **Screen/interaction:** expanding a clinical table to full screen (answer/evidence surfaces)
- **Evidence:** `AccessibleTable.tsx:455-490` renders `role="dialog" aria-modal="true"` with Escape (`:363`), initial focus to the close button (`:361`), body scroll-lock (`:360`), and focus restore (`:370`) — but **no Tab/Shift-Tab focus loop**. Compare the canonical `ui/sheet.tsx:96-117` which implements the trap. Confirmed by direct read.
- **Why it matters:** `aria-modal="true"` tells assistive tech that content outside is inert, but without a trap, sighted keyboard and screen-reader users can Tab out to the (visually hidden, still-focusable) page behind — a WCAG 2.4.3 / 2.1.2 focus-management failure and a confusing, inconsistent experience.
- **Severity:** High · **Confidence:** High
- **Recommendation:** route this dialog through the `Sheet` primitive (`mobilePlacement="fullscreen"` already exists), or add the same Tab loop inline. Routing through `Sheet` also resolves F2.
- **Acceptance criteria:** Tab/Shift-Tab cycles only within the open table dialog; focus never reaches background content while it is open; verified in `tests/ui-accessibility.spec.ts`.

### F2 — Two divergent modal implementations

- **Type:** Issue · **Area:** Accessibility / maintainability
- **Evidence:** the design system states `ui/sheet.tsx` is "the only modal/overlay primitive" (`docs/design-system.md:104-106`), yet `AccessibleTable` hand-rolls a second dialog (F1). Divergence is exactly how a11y regressions like F1 appear.
- **Why it matters:** every hand-rolled dialog is a place the focus/escape/scroll contract can silently drift.
- **Severity:** Medium · **Confidence:** High
- **Recommendation:** migrate the table dialog onto `Sheet`; add a lint/review note that new `role="dialog"` outside `Sheet` is disallowed.
- **Acceptance criteria:** no `role="dialog"` markup exists outside `ui/sheet.tsx` (or each exception is documented and independently trap-tested).

### F3 — Edge-of-AA contrast on the weakest text token at small sizes

- **Type:** Needs testing · **Area:** Accessibility
- **Screen/interaction:** eyebrow labels, field labels, input placeholders
- **Evidence:** `--text-soft` = `--neutral-500` (`#667085`) ≈ **4.6:1** on white — passes AA for normal text only just, and it is applied to 11px `text-2xs` labels (`ui-primitives.tsx:36-37`) and placeholders (`fieldControl`). Dark mode's `--text-soft` (`#7f8987` on `#060708`) is comfortably above 4.5:1.
- **Why it matters:** at ~4.6:1 on 11px, the light-theme margin is thin; sub-pixel rendering and real displays can push perceived contrast below comfort even if the computed ratio passes.
- **Severity:** Medium · **Confidence:** Medium (computed ratio is borderline-pass; the finding is about small-size comfort and needs a rendered check)
- **Recommendation:** for text below 12px, prefer `--text-muted` (darker) over `--text-soft`; keep `--text-soft` for ≥14px secondary text and non-text placeholders.
- **Acceptance criteria:** all <12px text meets ≥4.5:1 with margin in light and dark; placeholder contrast verified in context.

### F4 — Interactive table surface is a `div[role="button"]`, not a native button

- **Type:** Issue · **Area:** Accessibility
- **Evidence:** `AccessibleTable.tsx:419-434` uses a `div` with `role="button"`, `tabIndex={0}`, and a manual Enter/Space handler (`:409-414`). The design system's own Do/Don't table flags non-native buttons.
- **Why it matters:** native `<button>` gives keyboard activation, form semantics, and AT behaviour for free; the manual re-implementation is a maintenance and correctness risk (e.g. Space-to-activate and default focus styling).
- **Severity:** Low · **Confidence:** High
- **Recommendation:** render the expand affordance as a native `<button>` (an adjacent "Expand table" button already exists at `:438-453` — consider making it the sole trigger).
- **Acceptance criteria:** the table-expand trigger is a native button, keyboard-activatable with Enter and Space, with the global focus ring.

### F5 — Trust: stale architecture documentation

- **Type:** Issue · **Area:** Trust / Content
- **Evidence:** `docs/codebase-index.md` references files that do not exist (`src/app/app-shell-client.tsx`, `src/lib/shell-route-config.ts`); the real shell is `global-search-shell.tsx` → `global-mockup-search-shell.tsx`.
- **Why it matters:** onboarding devs (and agents) are pointed at phantom files, eroding trust in the docs and slowing orientation.
- **Severity:** Low · **Confidence:** High
- **Recommendation:** regenerate/patch `codebase-index.md` to point at the real shell files.
- **Acceptance criteria:** every path referenced in `codebase-index.md` resolves.

### F6 — Accessibility foundations (strength)

- **Type:** Strength · **Area:** Accessibility
- **Evidence:** 493 `aria-*`/`role` occurrences across 40 files; live regions (`aria-live="polite"`, `role="status"`, `role="alert"`); semantic tables with `<th scope>`; alt text with clinical fallbacks (`answer-content.tsx:153`); `aria-expanded`/`aria-controls` disclosures; `role="tab"`+`aria-selected`+`aria-controls` tab patterns. This is a strong baseline — the findings above are the exceptions, not the rule.

---

## Top 10 findings (prioritised)

| #   | Finding                                                           | Type          | Area        | Severity | Confidence | Ref |
| --- | ----------------------------------------------------------------- | ------------- | ----------- | -------- | ---------- | --- |
| 1   | Fullscreen table dialog has **no Tab focus trap**                 | Issue         | A11y        | **High** | High       | F1  |
| 2   | **No user-facing result sorting**                                 | Missing       | UX flow     | Medium   | Medium     | A1  |
| 3   | **Very small type** (8–10px) for clinical metadata                | Issue         | Visual/A11y | Medium   | High       | C1  |
| 4   | **Edge-of-AA contrast** on 11px `--text-soft` labels/placeholders | Needs testing | A11y        | Medium   | Medium     | F3  |
| 5   | **Two divergent modal implementations**                           | Issue         | A11y        | Medium   | High       | F2  |
| 6   | **No breadcrumbs / back affordance** on detail routes             | Missing       | UX flow     | Medium   | Medium     | A2  |
| 7   | **Mode picker locked** on `/forms` & `/favourites`                | Issue         | UX flow     | Medium   | Medium     | A3  |
| 8   | **Single-slot notifications**; 4s success dismiss                 | Issue         | Interaction | Medium   | Medium     | B1  |
| 9   | **No undo** after destructive delete                              | Missing       | Trust       | Medium   | High       | E1  |
| 10  | Interactive table surface is a **non-native button**              | Issue         | A11y        | Low      | High       | F4  |

---

## Closing

**The 3 strongest behaviours to preserve**

1. The reduced-motion / forced-colors / reduced-transparency system in `globals.css` — comprehensive and rare.
2. The `Sheet` modal primitive's focus management (trap + return-focus + escape + scroll-lock).
3. Search resilience — retry with backoff, the stale-response `searchRequestSeqRef` guard, keyword fallback, and offline/demo adaptation.

**The 3 most important fixes**

1. Add the Tab focus trap to the fullscreen table dialog — ideally by routing it through `Sheet` (fixes #1 and #5 together).
2. Add a user-facing sort control to results/registries (#2).
3. Run a small-text contrast + size pass: lift <12px `--text-soft` labels to `--text-muted` and pull clinical metadata off `text-4xs`/`text-3xs` (#3, #4).

**The fastest polish wins**

- Swap `--text-soft` → `--text-muted` on sub-12px labels (token change, no structural work).
- Make the table-expand trigger a native `<button>` (#10) — an adjacent one already exists.
- Fix the phantom file references in `docs/codebase-index.md` (#F5).
- Add a small notice queue / lengthen the success dismiss for SR readability (#8).

**Behaviours that require live testing** (run `npm run ensure` + `npm run verify:ui`; `tests/ui-accessibility.spec.ts` already drives reduced-motion + forced-colors at 390×820)

- Rendered contrast ratios in context (light theme, 11px labels/placeholders — F3).
- Scroll smoothness, dropped frames, streaming-answer flicker, and skeleton→content layout shift (D1/D2).
- Screen-reader announcement quality of the `aria-live="polite"` progress banner and rotating placeholder.
- The table-dialog focus leak, by manual keyboard pass (F1).
- Notification collision and whether 4s success dismiss is SR-readable (B1).
- Duplicate in-flight requests under rapid programmatic search triggers (B2).
- Mobile bottom-composer hide-on-scroll behaviour; form autofill + tab/focus order (E3).
- Whether scope filters / clinical query-mode should persist across route changes (A4).

---

_Method note: this review is a static read of shipped code on branch `claude/ux-accessibility-review-xekl4s`. No product code was changed. Findings marked "Needs testing" are hypotheses from code structure that require the running app to confirm._
