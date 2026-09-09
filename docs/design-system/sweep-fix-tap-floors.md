# Responsive tap-floor sweep: closing a check that could not fail

**Date:** 2026-08-29 · **Scope:** `scripts/design-system-contract-utils.mjs` (Gate 2 tap-floor
check) and the 21 interactive controls it newly reports.

## The defect in the gate

`hasSubFloorEffectiveMinHeight` measured only unprefixed `min-h-*` tokens — it filtered out every
class containing `:` before looking at anything:

```js
.filter((token) => token && !token.includes(":"))
```

So `min-h-12 sm:min-h-9` — 48px on the smallest screens, 36px on every screen above — was read as
`min-h-12` and passed. TOKENS.md §2 names that exact string as the defect the rule exists to close
("Never reuse `--row-compact` (36px) as tap. `sm:min-h-9` / `lg:min-h-9` on an interactive control
is the defect this rule exists to close"), which made this a check that was structurally incapable
of failing for its own headline case.

The blindness was deliberate and documented. The helper's doc comment asserted "a variant-prefixed
short value is a deliberate desktop release, not a violation", and
`tests/design-system-contract-utils.test.ts` pinned it with an assertion that
`min-h-tap sm:min-h-9` produces no finding — an assertion that certified TOKENS.md's verbatim
banned example as acceptable. **That assertion is the one existing check this change alters, and it
is strengthened, not weakened:** it now expects the finding. Nothing else in the gate set was
relaxed.

## What the gate does now, and why this shape

Two floors, because TOKENS.md §2's density table sanctions exactly one step-down and bans the other:

| Band                           | Floor | Source                                                                                                        |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------- |
| base (phones)                  | 48px  | `--spacing-tap`. Unchanged from the previous behaviour.                                                       |
| `sm:` `md:` `lg:` `xl:` `2xl:` | 40px  | `--spacing-compact-meta`, "the named desktop step-down" for metadata/disclosure roles (§2, compact-meta row). |

36px (`--row-compact` / `min-h-9`) is below both, so it is now reportable at every band. A blanket
"48px at every band" rule was rejected: it would contradict §2's own compact-meta row, and it would
have made `min-h-12 sm:min-h-10` — which the repo uses widely and which the existing test correctly
protects — a violation.

Mechanically the helper now builds a per-band cascade: the value winning at a band is the one
declared at the highest band at or below it, ties inside a band going to the last declaration.
Variant prefixes are split on `:` at bracket depth zero, so a `:` inside `min-h-[calc(...)]` or
`text-[color:var(--text)]` is not mistaken for a variant separator.

Corroboration that 40px is the repo's intended answer rather than my invention:
`src/components/clinical-dashboard/search-results-header-band.tsx:1084` already carries the comment
"`sm:min-h-compact-meta`, not `sm:min-h-9`: the desktop floor in this file is 40px compact-meta",
and `result-filter-control.tsx`, `evidence-panels.tsx` and `clinical-output-helpers.tsx` already use
`sm:`/`lg:min-h-compact-meta`.

### The one exclusion added, and why it is not a silencer

A band whose winning `pointer-events` is `none` is skipped: an inert band has no tap target to
floor. This is the deliberate phone-only-disclosure shape — a header that becomes static copy once
the panel is permanently open — and padding it back to 48px would restore a dead 48px block on
desktop. It is narrow by construction: `pointer-events-none` must win in the **same** band, so an
interactive band is never excused by a neighbour's. Two controls qualify, both self-documenting:

- `src/components/clinical-dashboard/universal-search-also-matches.tsx:163` — `sm:pointer-events-none
sm:min-h-0 sm:cursor-default`, `tabIndex={isWide ? -1 : undefined}`, with the in-file comment "On
  desktop the panel is always open, so the header is inert copy rather than a control."
- `src/components/dictionary/dictionary-term-page.tsx:369` — `sm:pointer-events-none sm:min-h-0`.

## Real count

**21 interactive controls** carried a responsive sub-floor. That breaks down as:

- **20** raw findings when the band model was first switched on (metric `3 → 23`).
- **−2** removed by the inert-band exclusion above (metric `3 → 21`), leaving **18 gate-visible
  defects** across 7 files.
- **+3** further controls found by hand in the same files, invisible to the gate because the AST
  walker matches HTML tag names only (`a`, `button`, `input`, `select`, `summary`, `textarea`) and
  these are `<Link>` components.

The broad grep of ~65 raw `(sm|md|lg|xl):min-h-(6|7|8|9|10)` occurrences was mostly non-interactive:
the large majority are `sm:min-h-0` flex-shrink idioms on `<div>`s and layout wrappers.

## Every control fixed

Two remedies, both named by TOKENS.md §2's own sentence — "either keep `min-h-tap` (primary) or
migrate to `min-h-compact-meta` (documented metadata/disclosure)". `min-h-compact-meta` was used
only where the control matches a role named verbatim in §2's compact-meta row; everything else keeps
`min-h-tap` at every band. **`min-h-11` was not used anywhere** — it is banned in this repo and
reintroduces the known `ui-smoke` sub-pixel flake.

### Step-down removed entirely — keeps `min-h-tap` at all bands (4)

| Control                                                       | Was          | Why                                                                                    |
| ------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `document-viewer/manual-tag-editor.tsx:223` (Save)            | `sm:min-h-9` | `primaryButton` = `primaryControl`, a filled primary. §2: "Never step a primary down." |
| `favourites-command-library-page.tsx:540` (set `<select>`)    | `sm:min-h-9` | Data-entry control; not in the compact-meta role list, so the stricter floor applies.  |
| `favourites-command-library-page.tsx:1256` (Move up/down)     | `sm:min-h-9` | Mutating command, not metadata chrome.                                                 |
| `favourites-command-library-page.tsx:1282` (Remove favourite) | `sm:min-h-9` | Destructive command, not metadata chrome.                                              |

### Migrated 36px → 40px `min-h-compact-meta` (14 gate-visible + 3 manual)

| Control                                                                            | Was                 | Role in §2's compact-meta list                             |
| ---------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| `calculators/search-detail.tsx:292` domain chips                                   | `lg:min-h-9`        | filter chips                                               |
| `clinical-dashboard/cross-mode-links.tsx:118` "Search in …"                        | `md:min-h-9 md:w-9` | card micro-action (width paired to `md:w-compact-meta`)    |
| `favourites-command-library-page.tsx:705` "View all"                               | `sm:min-h-9`        | catalogue "Show all" chip                                  |
| `master-search-header.tsx:1747` Clear refine filters                               | `lg:min-h-9`        | search header-band chrome                                  |
| `master-search-header.tsx:1755` label-filters `<summary>`                          | `lg:min-h-8`        | source `<summary>` rows                                    |
| `master-search-header.tsx:1770` Clear refine filters                               | `lg:min-h-9`        | search header-band chrome                                  |
| `document-viewer/document-clinical-summary.tsx:271` "View p.N"                     | `sm:min-h-9`        | metadata                                                   |
| `manual-tag-editor.tsx` ×5 (Cancel, Confirm remove, Cancel remove, Rename, Remove) | `sm:min-h-9`        | table micro-actions                                        |
| `forms/form-detail-page.tsx:309, 325` Pathway / Source info tabs                   | `sm:min-h-9`        | view-mode segments                                         |
| **manual:** `cross-mode-links.tsx:98` card title `<Link>`                          | `md:min-h-9`        | sibling of the fixed button; would otherwise misalign      |
| **manual:** `favourites-command-library-page.tsx:734, 1908` item `<Link>`s         | `sm:min-h-9`        | interactive rows, gate-invisible (`<Link>` is a component) |

`md:w-compact-meta` had no prior usage in the repo. Verified generated and resolving in the running
dev server: `.md\:w-compact-meta { width: var(--spacing-compact-meta); }` with
`--spacing-compact-meta: 2.5rem` (40px).

## Deliberately not fixed

- **`manual-tag-editor.tsx:251`** — a `<span>` reading "Remove this tag?" still carries
  `sm:min-h-9`. It is non-interactive, so the tap-floor rule does not apply. Its flex parent is
  `flex flex-wrap gap-1.5` with default `align-items: stretch`, so it already stretches to its 40px
  siblings; changing it would alter no pixel. Left alone to keep the diff on shared UI minimal.
- **`output-panel.tsx:110`** — `min-h-12 … sm:min-h-9` on a `<span>` status pill with no handler or
  role. Display element, not a tap target.
- **The remaining `sm:min-h-0` occurrences** (~17 files) are flex-shrink idioms on layout
  containers. The gate reports none of them, correctly.

## Mutation test

**Predicted before running.** Re-introduce `sm:min-h-9` in place of `sm:min-h-compact-meta` on the
first `role="tab"` button in `src/components/forms/form-detail-page.tsx`. The gate is a per-path
debt ratchet and that file carries no baseline debt, so I predicted exit 1 with exactly two finding
lines: the total rising `3 to 4`, and that path rising `0 to 1`.

**Observed** — identical, including wording:

```
EXIT=1
Design-system contract failed:
- interactiveTapFloorDeclarations increased from 3 to 4
- interactiveTapFloorDeclarations at src/components/forms/form-detail-page.tsx increased from 0 to 1
```

Restored and proved byte-identical by blob hash rather than by eye — pre-mutation and post-restore
both `346d35d98267437cf1b9d8b94ca01c98ae7f7d00` — with the gate back to exit 0.

## Verification

| Check                                                                                   | Result                                                                                                   |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `check:design-system-contract` (gate red first)                                         | `- interactiveTapFloorDeclarations increased from 3 to 23`, exit 1                                       |
| `check:design-system-contract` (after fixes)                                            | `Design-system contract passed (1079 production files; … sub-floor interactive min-heights 3 …)`, exit 0 |
| `check:type-scale`                                                                      | `✓ type-scale: no arbitrary text-[<n>px\|rem\|em] font sizes in src.`                                    |
| `check:icon-scale`                                                                      | `✓ icon-scale: no retired 4.5 (18px) half-step icon sizes in src.`                                       |
| `vitest run` — 29 covering files, found by grepping `tests/` for each touched component | `Test Files 29 passed (29)` · `Tests 409 passed (409)`                                                   |
| `eslint` — all 9 changed files, `--max-warnings 0`                                      | clean, exit 0                                                                                            |
| `prettier --check` — all 9 changed files                                                | clean (the test file needed `--write`; re-ran the suite green afterwards)                                |

Residual `sub-floor interactive min-heights 3` is the pre-existing baseline debt in
`DocumentTagCloud.tsx` (2) and `answer-content.tsx` (1) — untouched by this change, and unchanged.

## Known residual, left undone rather than papered over

- **The walker is tag-based.** `<Link>`, `<Button>` and other component-tag controls are invisible
  to it. I fixed the three I encountered in files I was already editing, but a repo-wide pass over
  component-tag controls is a separate, larger change with its own false-positive surface.
- **`minHeightPixels` does not resolve `min-h-compact-meta`** (or `min-h-row-compact`), so those
  tokens contribute nothing to the cascade. Teaching it `min-h-compact-meta = 40` would newly flag
  three existing base-band uses in `bedside-sheet.tsx` and `directory-grid.tsx` — which §2 appears
  to sanction for metadata roles at 40px. Resolving that needs a ruling on whether unprefixed
  compact-meta is legal on the base band, so I left the token unmeasured rather than guess. It is a
  narrower hole than the one closed here: the banned 36px value is `min-h-9`, which **is** measured.
- **Non-breakpoint variants are still unmeasured.** `hover:min-h-9`, `max-sm:min-h-9`,
  `data-[…]:min-h-9` neither raise nor lower a band, exactly as before. No interactive control in
  `src` currently carries one, so widening now would add false-positive surface for no live defect.
