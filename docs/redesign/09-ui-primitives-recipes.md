# UI Primitives — Recipe Reference & State Contract — Clinical KB (July 2026)

> **Entry point:** day-to-day UI rules live in [`docs/design-system.md`](../design-system.md); this document remains the recipe catalogue it links to.

Resolves **L8** from `07-token-adoption-audit.md`: the `ui/` component layer is
~55 className **recipes** (exported `const` strings) + `cn()` + five small React
components in `src/components/ui-primitives.tsx`, plus one real component
(`src/components/ui/sheet.tsx`). The pattern is sound but had **no documented
state/variant contract** — so call sites hand-roll hover/focus/disabled and drift.
This file documents the intended contract, catalogs every recipe, and lists the
gaps to reconcile.

## The pattern

A recipe is an exported string of Tailwind utilities, composed at the call site
with `cn(...)` (a `filter(Boolean).join(" ")` helper — falsey args drop out, so
`cn(base, cond && extra, className)` is the standard shape). Recipes compose by
template literal (`` `${controlBase} …` `` / `` `${quietPanel} …` ``). All colour,
radius, shadow, and type values go through design tokens
(`text-[color:var(--…)]`, `rounded-lg`, `shadow-[var(--…)]`) — never raw palette
or hex (see M1/M2 in `07-token-adoption-audit.md`).

Recipes are **structure + resting appearance + state contract**. The call site
supplies only layout deltas (width, margin, one-off padding) and behaviour.

## State contract (the intended convention)

Any recipe a user can click, type into, or focus should satisfy this contract.
Values are tokens; the target sizes follow the `-11`/`-12` spacing scale (L6).

| Concern             | Convention                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tap size**        | Interactive controls: `min-h-11` / `h-11 w-11` (44px, WCAG 2.5.5). Large inputs / rows: `min-h-12` (48px). Non-tap labels/pills may be smaller (`min-h-7`/`min-h-10`).        |
| **Transition**      | `transition` whenever any state changes appearance.                                                                                                                           |
| **Hover**           | Token shifts: `hover:border-[color:var(--border-strong)]`, `hover:bg-[color:var(--surface-subtle)]`, or accent (`hover:bg-[color:var(--…-hover)]`).                           |
| **Active**          | Press feedback `active:translate-y-px` on buttons.                                                                                                                            |
| **Focus (buttons)** | `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]`.                                                    |
| **Focus (inputs)**  | `focus:border-[color:var(--focus)] focus:ring-4 focus:ring-[color:var(--focus)]/25` + `outline-none`, or `focus-within:` on the wrapping shell.                               |
| **Disabled**        | `disabled:cursor-not-allowed disabled:opacity-{45–55} disabled:hover:shadow-none`.                                                                                            |
| **Loading**         | Use the `LoadingPanel` component (`spinner` \| `skeleton`), not a recipe; it sets `role="status"` + `aria-label`. Buttons show loading via a spinning `Loader2` + `disabled`. |

## Recipe catalog

### Interactive controls (tap targets)

| Recipe                   | Purpose                               | Tap                                      | Hover             | Active | Focus-visible             | Disabled |
| ------------------------ | ------------------------------------- | ---------------------------------------- | ----------------- | ------ | ------------------------- | -------- |
| `controlBase`            | Base for buttons (composed by others) | `min-h-11`                               | — (subclass adds) | ✅     | ✅                        | ✅       |
| `primaryControl`         | Primary command button                | ✅                                       | ✅                | ✅     | ✅                        | ✅       |
| `floatingControl`        | Secondary / floating button           | `min-h-11`                               | ✅                | ❌     | ✅                        | ✅       |
| `toolbarButton`          | Square icon button                    | `h-11 w-11`                              | ✅                | ❌     | ✅                        | ✅       |
| `navPill`                | Nav / segmented pill                  | `min-h-11`                               | ✅                | ❌     | ✅                        | ✅       |
| `chatMicroAction`        | Small chat action (copy, retry…)      | `min-h-11 min-w-11`                      | ✅                | ❌     | ✅                        | ✅       |
| `sourceCapsule`          | Inline citation capsule               | `min-h-11` mobile / `sm:min-h-8` desktop | ✅                | ❌     | ✅ (`focus-ring-premium`) | ❌       |
| `chatComposerIconButton` | Composer icon button                  | `h-11 w-11`                              | ✅                | ❌     | ✅                        | ✅       |
| `chatSendButton`         | Composer send (accent)                | `h-11 w-11`                              | ✅                | ❌     | ✅                        | ✅       |
| `sidebarItem`            | Sidebar nav row                       | `min-h-11`                               | ✅                | ❌     | ✅                        | ✅       |
| `sidebarToolTile`        | Sidebar tool tile                     | `min-h-[64px]`                           | ✅                | ❌     | ✅                        | ❌       |
| `shellChip`              | Filter / mode chip                    | `min-h-11`                               | ✅                | ❌     | ❌                        | ❌       |

### Form fields

| Recipe                                       | Purpose                                             | Focus                        | Notes                                           |
| -------------------------------------------- | --------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `fieldControl`                               | Base text input                                     | `focus:` ring+border         | `h-11`, `outline-none`, `placeholder:text-soft` |
| `fieldControlWithIcon` / `fieldControlPlain` | `fieldControl` + padding for a leading icon / plain | —                            | compose `fieldControl`                          |
| `commandInput`                               | Large command-bar input                             | `focus:` ring+border         | `min-h-12`, `motion-safe:transition`            |
| `chatComposerShell`                          | Composer wrapper                                    | `focus-within:border-accent` | `min-h-[56px]` pill container                   |
| `chatComposerInput`                          | Bare composer input                                 | via shell `focus-within`     | `min-h-11`, `outline-none`                      |
| `fieldLabel`                                 | Field label (= `eyebrowText`)                       | —                            | —                                               |
| `fieldIcon`                                  | Absolutely-positioned leading icon                  | —                            | `pointer-events-none`                           |

### Surfaces & cards (non-interactive unless noted)

`raisedCard`, `insetCard`, `glassPanel`, `quietPanel`, `panel`, `panelSubtle`
(= `quietPanel`), `answerSurface`, `evidenceSurface`, `tableCard`,
`tableCardHeader`. Interactive exception: **`sourceCard`** = `quietPanel` +
`hover:border-strong hover:shadow-hover` (a clickable card).
Overlay: **`sheetSurface`** / `sheetHandle` for the mobile bottom sheet
(`ui/sheet.tsx`).

### Rows

| Recipe                | Tap                   | Interactive states         |
| --------------------- | --------------------- | -------------------------- |
| `evidenceRow`         | `min-h-12`            | hover + focus-visible ✅   |
| `clinicalNotesRow`    | `min-h-12`            | hover + focus-visible ✅   |
| `chatActionRow`       | `min-h-11 sm:min-h-8` | layout row (holds actions) |
| `tableMicroActionRow` | `min-h-11 sm:min-h-9` | layout row                 |
| `compactMetadataRow`  | —                     | metadata line              |

### Pills, badges, dots, tones

- **Pills:** `metadataPill`, `subtleStatusPill` (`min-h-7`, non-tap labels).
- **Status dots:** `statusDotBase` + `statusDotReady` (success) / `statusDotReview`
  (warning) / `statusDotMuted`.
- **Semantic tone triads** (border+bg+text, dark-mode-safe): `toneSuccess`,
  `toneDanger`, `toneInfo`, `toneWarning`, `toneWarningQuiet`, `toneNeutral`.
  These are the canonical tone source — hand-rolled palette tone helpers were
  removed in M2; reuse these instead of re-deriving.

### Icon tiles & text

- **Icon tiles** (decorative, `h-9 w-9`): `iconTile`, `iconTilePremium`.
- **Text:** `textMuted`, `eyebrowText` (2xs uppercase, `tracking-[0.06em]`),
  `proseMeasure` (`max-w-[68ch]`), `codeText` (mono tabular for clinical
  codes/IDs), `chatAnswerText`.
- **Misc:** `clinicalDivider`, `appBackdrop`.

### React components

| Component           | Variants / states                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SourceStatusBadge` | tone chosen from `document_status`: `current`→success, `outdated`→danger, `review_due`→warning, else `toneWarningQuiet`. |
| `SourceProvenance`  | dot-separated validation / review-date / jurisdiction / extraction-quality line; drops unknown segments.                 |
| `PanelHeading`      | `icon` + `title` + optional `description`.                                                                               |
| `LoadingPanel`      | `variant: "spinner" \| "skeleton"`, `lines` (skeleton count); `role="status"` + `aria-label`.                            |
| `EmptyState`        | `icon` + `title` + `body`.                                                                                               |

## Gaps to reconcile (follow-ups, not yet fixed)

Documenting the contract surfaces where recipes don't meet it. These are
**a11y/consistency debts**, not covered by this doc's change:

1. ✅ **FIXED (2026-07-03).** `focus-visible` was missing on the core button family
   — `controlBase`, `primaryControl`, `floatingControl`, `toolbarButton`, `navPill`.
   Added the standard `focus-visible:outline focus-visible:outline-2
focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]` block
   to `controlBase` (inherited by `primaryControl`), `floatingControl`,
   `toolbarButton`, and `navPill`. Keyboard users now get a visible focus ring on
   the primary buttons, matching the newer recipes (`chatSendButton`, etc.).
2. **`active:translate-y-px` only on the `controlBase` family** — other buttons
   (`toolbarButton`, `chatSendButton`, icon buttons) have no press feedback.
3. ✅ **FIXED (2026-07-03).** Added `disabled:cursor-not-allowed disabled:opacity-50`
   to `navPill`, `chatMicroAction`, `chatComposerIconButton`, `sidebarItem` — they now
   honour the documented disabled state, including the disabled
   `chatComposerIconButton` in `applications-launcher-page.tsx`.
4. ✅ **FIXED (2026-07-03).** `shellChip` bumped `min-h-10` → `min-h-11` (40→44px) to
   meet the WCAG tap minimum — it's used on a real `<button>` filter ("All documents"
   in `master-search-header.tsx`).
5. **Input focus uses `focus:` not `focus-visible:`** (`fieldControl`,
   `commandInput`) — intentional for text fields (focus ring should show on
   pointer focus too), but noted so it isn't "corrected" to `focus-visible:`.

Gaps 1, 3, and 4 are now closed. Remaining: **gap 2** (`active:` press feedback
beyond the `controlBase` family — an aesthetic/design-team call) and **gap 5**
(inputs intentionally use `focus:`, no change needed).
