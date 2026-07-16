# Production-Page Polish & Perfection Plan — Clinical KB (July 2026)

**Status: closed as superseded (reconciled 2026-07-15).** Phase 1 landed in PR #239, and later
design-system, accessibility, type-scale, icon-scale, and page-specific work superseded the remaining
branch-bound checklist. Current regressions are enforced by `brand:check`, `check:type-scale`,
`check:icon-scale`, `verify:cheap`, and the UI gates. Do not restart the obsolete worktree/branch plan;
open new scoped work only from a current failing gate or a fresh product review.

## Context

The premium redesign (docs `01`–`06`) established a tiered design-token system, a
shared `ui/` + `ui-primitives` recipe layer, and mobile bottom-sheet patterns. The
token-adoption audit (`07`, score **78/100**) and the design-review prompts (`08`)
then measured _how consistently the app actually consumes those tokens_ and defined
what "polished" means for this product: a clinical knowledge base used by clinicians
under time pressure, where **safety, clarity, speed, and consistency** beat novelty.

This plan turns that into an execution program to **perfect, upgrade, optimise, and
polish every production page**. It is deliberately _foundation-first_: the app's
pages are composed from a few shared layers, so fixing those layers polishes many
pages at once before we touch pages individually.

**Scope decisions (confirmed with the user):**

- **Production pages only** — the 14 real user-facing routes. The 18 `/mockups`
  prototype pages are **out of scope**.
- **Polish only — no behaviour change.** Token adoption, accessibility, state
  coverage, responsive/mobile, type scale, microcopy. No logic, data-flow, or
  routing changes; no structural decomposition of the `ClinicalDashboard` /
  `DocumentViewer` monoliths (that stays PAUSED per project memory).

**Isolation:** all work happens in the dedicated worktree
`C:\Dev\Apps\_wt-page-polish` on branch **`claude/page-polish`** (branched off the
token-infra HEAD `46b433b7a`, which is only on `feature/tools-page-mockups`, not
`main`). The main checkout is a shared workspace with ~17 concurrently-modified
files — we never edit there. Commits stay path-scoped; rebase before any PR.

## Surfaces in scope (14 production routes)

| Route                                  | Top component                                       | Shared layer it rides on                                                          |
| -------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/`                                    | `ClinicalDashboard.tsx` (~9.6k LOC)                 | `global-search-shell`, `master-search-header`, `ClinicalSidebar`, `ui-primitives` |
| `/applications`                        | `applications-launcher-page.tsx` (1,491)            | `global-search-shell`, `ui-primitives`                                            |
| `/documents/[id]`                      | `DocumentViewer.tsx` (~3.6k)                        | `ui-primitives`                                                                   |
| `/differentials`                       | `differentials-home-page.tsx` (15)                  | **`mode-home-template`**                                                          |
| `/differentials/diagnoses`             | `differential-stream-page.tsx` (111)                | shell + `ui-primitives`                                                           |
| `/differentials/diagnoses/[slug]`      | `differential-detail-page.tsx` (525)                | `ui-primitives`                                                                   |
| `/differentials/presentations`         | `differential-presentation-workflow-page.tsx` (635) | `ui-primitives`                                                                   |
| `/services`                            | `services-home-page.tsx` (104)                      | **`mode-home-template`**                                                          |
| `/services/[slug]`                     | `service-detail-page.tsx` (780)                     | `ui-primitives`                                                                   |
| `/forms`                               | `forms-home-page.tsx` (90)                          | **`mode-home-template`**                                                          |
| `/forms/[slug]`                        | `form-detail-page.tsx` (802)                        | `ui-primitives`                                                                   |
| `/favourites`                          | `favourites-home-page.tsx` (33)                     | **`mode-home-template`**                                                          |
| `/medications` → `/medications/[slug]` | `medication-prescribing-workspace.tsx`              | shell + `ui-primitives`                                                           |

**Leverage layers (fix once → many pages improve):**
`src/components/ui-primitives.tsx` (recipe strings, every page) ·
`src/components/mode-home-template.tsx` (services/forms/differentials/favourites
homes) · `src/components/clinical-dashboard/{global-search-shell,
master-search-header,ClinicalSidebar}.tsx` (chrome around every mode page) ·
`src/app/globals.css` (tokens).

## What "polished" means here — workstreams

Derived from the `08` PR-pass checklist and the `07` audit debts:

- **W1 — Token discipline.** Color/space/type/radius/elevation come from tokens, no
  hardcoded one-offs. Audit debts: **M3** (~295 `text-[Npx]` → scale tokens), **L4**
  (`bg-white`→`--surface`; `text-white`/`ring-white`→`*-contrast`), **L5**
  (`border-blue-400` + arbitrary accent shadow → `--clinical-accent`/`--glow-*`),
  **L6** (tap-target magic numbers → token), **L7** (`rounded-[var(--radius-lg)]` →
  `rounded-lg`). Plus inline `style={{minHeight,minWidth}}` → utility classes.
- **W2 — State coverage.** Every interactive element has distinct default / hover /
  focus / active / disabled / selected / loading / empty / error states; system
  status always visible. Reuse `LoadingPanel` / `EmptyState` primitives.
- **W3 — Accessibility.** Touch targets ≥44px with spacing; keyboard-operable with
  visible `focus-visible` ring; labeled icon-only controls; `prefers-reduced-motion`
  and `forced-colors` respected; AA contrast in light **and** dark; 200% zoom / reflow.
- **W4 — Responsive & mobile.** Holds at mobile/tablet/desktop; mobile bottom-sheet,
  safe-area, thumb-reach correct; long-text truncation/wrap/overflow; mobile-first
  defaults (avoid desktop-first `hidden sm:block` where it strands mobile content).
- **W5 — Content & clinical safety.** Microcopy specific and action-oriented;
  error/empty copy actionable; units explicit (mg vs mcg); no dangerous decimals
  ("1.0", leading zero for "<1"); source/provenance and uncertainty legible; no
  emphasis that could bias a clinical decision.
- **W6 — Consistency.** Reuse shared `ui/` components and recipes instead of
  re-inventing; match patterns across pages; honour the unlayered-composer-chrome
  gotcha (a call-site utility must not silently lose to a layered/unlayered class).

## Phased execution

### Phase 1 — Shared recipe foundation _(this session)_

Highest leverage: fixes the recipe layer that every page consumes.

- `globals.css`: add a **`--spacing-tap: 2.75rem`** (44px) named token → generates
  `min-h-tap` / `h-tap` / `w-tap` / `min-w-tap` / `size-tap` utilities (audit **L6**).
- `ui-primitives.tsx`:
  - Standardise disabled opacity — `disabled:opacity-55` (`controlBase`) and
    `disabled:opacity-45` (`toolbarButton`) → **`disabled:opacity-50`** (the majority
    value already on `floatingControl`/`chatSendButton`).
  - Adopt tap tokens: `min-h-[44px]`→`min-h-tap`, `h-[44px] w-[44px]`→`h-tap w-tap`,
    `min-h-11`/`min-w-11`→`min-h-tap`/`min-w-tap` in the control/field/nav/chat
    recipes (semantic WCAG intent, single source of truth).
  - Verbose radius → utility: `rounded-t-[var(--radius-xl)]`→`rounded-t-xl`
    (`sheetSurface`, audit **L7**).
- **Verify it compiles** (Tailwind v4 named-spacing utility generation) with a
  worktree typecheck + build before moving on.

### Phase 2 — Shared shells & home template

Cascades to the four mode-home pages and the chrome on every mode page.

- `mode-home-template.tsx`: PR-pass polish (states, tap targets via new tokens,
  type scale, focus rings, reduced-motion, responsive) — improves
  services/forms/differentials/favourites homes together.
- `global-search-shell.tsx`, `master-search-header.tsx`, `ClinicalSidebar.tsx`:
  same pass on the persistent chrome.

### Phase 3 — Type-scale token adoption (audit M3)

Adopt the size-only tokens across production files, per-site (not a blind codemod):
`text-[11px]`→`text-2xs`, `text-[13px]`→`text-sm-minus`, `text-[15px]`→
`text-base-minus`, `text-[10px]`→`text-3xs`, `text-[8px]`→`text-4xs`; one-offs
`text-[17/18/22px]`→`text-lg`/`text-xl`. `text-[9px]` has no exact token → per-site
decision (snaps to `text-4xs`). Batch by page/area; visual-check each batch.

### Phase 4 — Per-page PR-pass polish

Run the `08` PR-pass checklist against each production surface and fix findings.
Order (small/independent → large/hot, to bank wins and de-risk):

1. `favourites-home`, `services-home`, `forms-home`, `differentials-home` (mostly
   covered by Phase 2 — confirm).
2. `differential-stream`, `differential-detail`, `differential-presentation-workflow`.
3. `service-detail`, `form-detail`, `medication-prescribing-workspace`.
4. `applications-launcher-page` (button heights, disabled/loading states, mobile).
5. `ClinicalDashboard` (`/`) and `DocumentViewer` — largest, hottest; surgical
   token/a11y/state polish only, no restructuring.

### Phase 5 — Accessibility + resilience sweep & verification

- Cross-cutting sweep: `motion-reduce:` fallbacks on remaining animated elements;
  `focus-visible` pair on every interactive element; `forced-colors` spot-check;
  0/1/many + very-long-text resilience; loading/empty/error on async surfaces.
- Full verification (see below) in light, dark, reduced-motion, forced-colors, and
  at 200% zoom. Then commit path-scoped, rebase, and hand off.

## Critical files

- **Foundation:** `src/app/globals.css`, `src/components/ui-primitives.tsx`,
  `src/components/ui/sheet.tsx`.
- **Shared shells/template:** `src/components/mode-home-template.tsx`,
  `src/components/clinical-dashboard/global-search-shell.tsx`,
  `src/components/clinical-dashboard/master-search-header.tsx`,
  `src/components/clinical-dashboard/ClinicalSidebar.tsx`.
- **Representative pages:** `src/components/applications-launcher-page.tsx`,
  `src/components/services/service-detail-page.tsx`,
  `src/components/forms/form-detail-page.tsx`,
  `src/components/differentials/differential-detail-page.tsx`,
  `src/components/ClinicalDashboard.tsx`, `src/components/DocumentViewer.tsx`.

Reuse existing utilities — do **not** re-invent: `cn()`, `LoadingPanel`,
`EmptyState`, `PanelHeading`, the tone recipes (`toneSuccess`/`toneDanger`/…), and
the control/field/chat recipes in `ui-primitives.tsx`; `Sheet` in `ui/sheet.tsx`;
`ModeHomeTemplate` for home pages.

## Verification

- **Per phase / cheap gate:** `npx tsc --noEmit`, `npm run lint`, `npm run
format:check` (a required CI check — see project memory), then `npm run
verify:cheap`.
- **UI gate:** `npm run verify:ui` (Chromium Playwright) for any change touching
  rendering/routing/styling.
- **Visual spot-checks:** for each polished page, verify in **light + dark +
  `prefers-reduced-motion` + `forced-colors`** and at **200% zoom**. Preview via a
  dev server _in this worktree_ (needs its own `npm ci` — done). Do **not** run
  `npm run build` in the main checkout while its `:4298` dev server is live (it
  corrupts `.next` and 500s the live preview — project memory).
- **Release confidence (end):** `npm run verify:release` before hand-off.

## Risks & guardrails

- **Concurrent edits:** `ui-primitives.tsx`, `ClinicalDashboard.tsx`, and the chrome
  files are being polished in the main checkout too. Keep commits path-scoped, expect
  trivial merge overlaps (same intent), and rebase before PR.
- **Layered vs unlayered CSS:** header chrome is `@layer components` (utilities win);
  composer chrome (`answer-footer-search-*`, `*-composer-edge`) is intentionally
  **unlayered** (the class wins). Check a class body before adding a utility to an
  element that carries one — see `globals.css` audit notes + `capture-chrome-parity.ts`.
- **Type-scale swaps are size-only now** (`--text-2xs` no longer bakes tracking), so
  exact-match `text-[Npx]`→token is a pure swap — but still visual-check `text-[9px]`
  and any element whose leading/tracking was implicitly relying on an arbitrary size.
- **No behaviour change:** if a "polish" edit would alter logic, data, or routing,
  stop and defer it out of this program.

## Status

- **Closed/superseded.** The phased checklist is retained as historical design context only.
