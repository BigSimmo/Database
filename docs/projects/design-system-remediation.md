# Project: PsychSift Design System, Screen, Accessibility, Responsive & Interaction Remediation

## Architecture

- Frontend application built with Next.js App Router and Tailwind CSS v4 (`@theme`).
- Design System tokens defined in `src/app/globals.css` with strict automated contract guards:
  - `check:design-system-contract`: Token conformance, raw colors, shadows, tap classes.
  - `check:type-scale`: Font size scale floor ($\ge 12\text{px}$ / `0.75rem`).
  - `check:icon-scale`: Icon size token conformance (`size-icon-*`).
  - `check:design-drift-ratchet`: Inline style ceilings and component import bounds.
  - `verify:phone-chrome`: Search chrome scroll hide/reveal, zero-reserve contracts (`docs/search-chrome-behaviour.md`).
- File Boundaries:
  - Phone Chrome & Layout: `src/components/DocumentViewer.tsx`, `src/components/dsm/dsm-search-page.tsx`, `src/app/globals.css`.
  - Design Tokens & Scale: `src/app/globals.css`, `scripts/design-system-contract-baseline.json`, `src/components/on-call/on-call-private-flag.tsx`, `src/components/factsheets/factsheet-detail-page.tsx`, `src/components/first-nations/day-track.tsx`.
  - Button Wiring & A11y: `src/components/roster/manage/roster-approve-tab.tsx`, `src/components/calculators/calculator-sheet.tsx`, `src/components/favourites/favourite-row.tsx`, `src/components/clinical-dashboard/answer-status.tsx`.
  - Touch Targets & Responsive: `src/components/patient-safety-plan.tsx`, `src/components/admin/renewals/checklist-row.tsx`, `src/components/dictionary/dictionary-term-page.tsx`, `src/components/clinical-dashboard/favourites-command-library-page.tsx`, `src/components/calculators/search-page.tsx`, `src/components/services/services-navigator-page.tsx`, `src/components/reference/colour-coding-reference-content.tsx`.

## Feature Inventory

| #   | Feature                                                 | Description                                                                                             | Milestone | Source                   |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------- | ------------------------ |
| 1   | DocumentViewer Invariant 4 Zero-Reserve                 | Replace `max-sm:pb-3` with `max-sm:pb-0` on scroll-hidden composer                                      | M1        | Survey (Explorer 3)      |
| 2   | DSM Mobile Compare Strip Portalling & Scroll-Hide       | Portal compare strip into `PhoneFooterLayerPortal`, remove double-padding, add scroll-hide rules        | M1        | Survey (Explorer 3)      |
| 3   | On-Call Phantom Token Resolution                        | Fix `size-icon-2xs` in `on-call-private-flag.tsx` or define `--spacing-icon-2xs` in `globals.css`       | M2        | Survey (Explorer 1)      |
| 4   | Icon Typography Variable Sizing Fix                     | Replace `var(--text-2xs)` with icon token in `globals.css:3299-3300`                                    | M2        | Survey (Explorer 1)      |
| 5   | Sub-12px CSS Rules Floor Elevation                      | Elevate 10 sub-12px CSS rules in `globals.css` to 12px (0.75rem) floor                                  | M2        | Survey (Explorer 1)      |
| 6   | Factsheets Inline Font Size Floor Elevation             | Elevate `fontSize: "11px"` to `"12px"` in `factsheet-detail-page.tsx`                                   | M2        | Survey (Explorer 1)      |
| 7   | SVG Text Sub-Floor Token Fix                            | Update SVG `<text>` `text-2xs` to `text-xs` in `day-track.tsx:39`                                       | M2        | Survey (Explorer 1)      |
| 8   | Design System Baseline Ratchet Tightening               | Update `disabledOpacityUses` to 36, `visibleLiveRegions` to 20, remove patient-safety-plan shadow alias | M2        | Survey (Explorer 1)      |
| 9   | Explicit Button Type on Roster Tabs                     | Add `type="button"` to buttons in `roster-approve-tab.tsx:53, 69`                                       | M3        | Survey (Explorers 2 & 3) |
| 10  | CalculatorSheet Escape & Sheet Focus Integration        | Connect `pushSheet`/`popSheet` and add Escape keydown handler in `calculator-sheet.tsx`                 | M3        | Survey (Explorer 2)      |
| 11  | Favourites Row Accessible Name Parity                   | Add `aria-label={`Select ${item.title} for workspace`}` to `favourite-row.tsx:277`                      | M3        | Survey (Explorer 2)      |
| 12  | Answer Status Button Focus Ring Fix                     | Move `focus-visible:outline` directly to button in `answer-status.tsx:220`                              | M3        | Survey (Explorer 2)      |
| 13  | Patient Safety Plan Remove Button Touch Target          | Expand horizontal touch hitbox to $\ge 44\text{px}$ in `patient-safety-plan.tsx:889`                    | M4        | Survey (Explorer 3)      |
| 14  | Renewals Checklist Row Interactive Touch Target         | Ensure button carries `min-h-tap min-w-tap` directly in `checklist-row.tsx:99-113`                      | M4        | Survey (Explorer 3)      |
| 15  | Sub-44px Touch Targets Elevation                        | Upgrade touch targets in dictionary topic tags, favourites command library, and calculators             | M4        | Survey (Explorer 3)      |
| 16  | Colour Coding Reference Narrow Screen Squeeze           | Make `w-40 shrink-0` responsive on narrow 320px viewports in `colour-coding-reference-content.tsx`      | M4        | Survey (Explorer 3)      |
| 17  | Comprehensive Automated Verification & Regression Suite | Verify all contract, phone chrome, drift ratchet, lint, and typecheck suites pass                       | M5        | Dispatch Mandate         |

## Milestones

| #   | Name                                                   | Scope                                                                                             | Dependencies   | Status |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------- | ------ |
| M1  | Phone Chrome & Layout Stability Remediation            | Invariant 4 zero-reserve in DocumentViewer, DSM compare strip portalling & scroll-hide            | none           | DONE   |
| M2  | Design System Token, Typography & Icon Remediation     | Phantom token fix, CSS font floor, inline font sizes, baseline ratcheting                         | none           | DONE   |
| M3  | Interactive Controls, Button Wiring & A11y Remediation | Explicit button types, CalculatorSheet lifecycle/Escape, accessible names, focus rings            | none           | DONE   |
| M4  | Touch Target Ergonomics & Responsive Remediation       | Patient safety plan remove button, checklist row, topic tags, narrow viewport squeeze             | none           | DONE   |
| M5  | Automated Verification & Hardening                     | Full check suites (phone-chrome, design-system-contract, type-scale, icon-scale, lint, typecheck) | M1, M2, M3, M4 | DONE   |

## Code Layout

- `src/app/globals.css`: Design tokens, `@theme`, typography floor, and phone chrome CSS transforms.
- `src/components/DocumentViewer.tsx`: Document viewer phone chrome layout and reserve pads.
- `src/components/dsm/dsm-search-page.tsx`: DSM search compare strip.
- `src/components/roster/manage/roster-approve-tab.tsx`: Roster management buttons.
- `src/components/calculators/calculator-sheet.tsx`: Calculator drawer focus and Escape handling.
- `src/components/favourites/favourite-row.tsx`: Accessible names on workspace selection.
- `src/components/clinical-dashboard/answer-status.tsx`: Stop button focus ring.
- `src/components/patient-safety-plan.tsx`: Crisis safety plan remove button tap targets.
- `src/components/admin/renewals/checklist-row.tsx`: Checklist row button tap targets.
- `scripts/design-system-contract-baseline.json`: Design system contract ratchet baseline.
