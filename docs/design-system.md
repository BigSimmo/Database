# Clinical KB Design System — the front door

This is the single entry point for how UI is designed and built in this app. It states the
contract; the deep documents hold the rationale. Precedence when documents disagree:

1. **This file** — the working contract for day-to-day UI changes.
2. [`docs/redesign/permanent-colour-direction.md`](./redesign/permanent-colour-direction.md) — the authoritative colour specification ("Clinical White / Aegean Graphite"). Colour disputes end here.
3. [`docs/redesign/02-design-direction.md`](./redesign/02-design-direction.md) — token rationale: type scale, spacing, radii, elevation, motion.
4. [`docs/redesign/09-ui-primitives-recipes.md`](./redesign/09-ui-primitives-recipes.md) — the recipe catalogue for `src/components/ui-primitives.tsx`.

Design direction is **settled**. Work on the UI is convergence — closing the gap between the
contract and the code — not reinvention. If a change genuinely needs a new direction, update
`permanent-colour-direction.md` first, then the code.

## 1. Non-negotiables

- **Tokens only.** Every colour comes from a CSS custom property defined in
  `src/app/globals.css` (`:root` + `.dark`). No raw Tailwind palette classes (`red-50`,
  `slate-200`, `bg-white`) and no hex values in components. **If you typed a hex or a Tailwind
  colour name in a component, you broke dark mode** — those values have no `.dark` override.
  Sanctioned raw-colour exceptions are explicit and narrow: the token definitions in
  `globals.css` itself, brand artwork, diagnostic-only visualizations, generated OpenGraph
  artwork, emergency error fallbacks, the two pre-paint theme-colour values in
  `src/lib/theme.ts` (read by the pre-hydration script before any CSS exists), the scoped
  fixed-white Therapy patient sheet, and the scoped factsheet print sheet.
  `RAW_COLOR_EXEMPTIONS` in `scripts/design-system-contract-utils.mjs` owns the path allowlist
  and each entry's `scope`. Prefer a bounded scope over `whole-file` so unrelated colours in
  the same file stay counted, and make a missing boundary fail closed; adding a category
  requires documenting why semantic app tokens are wrong.
- **Semantic vs categorical vs brand.** Three token families, never interchangeable:
  - Semantic triads (`--info/-soft/-border`, `--success-*`, `--warning-*`, `--danger-*`) mean
    something happened or matters clinically. Green is success-only; red is safety/danger-only.
  - Categorical triads (`--type-document/table/search/source/service/form` + `-soft`/`-border`)
    give _identity_ to kinds of things (chips, icon tiles). They carry no status meaning.
  - Brand: `--clinical-accent*` (Aegean) for clinical/evidence identity and primary-action
    accents; `--command*` (graphite) for the primary CTA family.
- **Dark mode is class-based and mandatory.** The `.dark` block re-tunes every token; a
  pre-paint script in `src/app/layout.tsx` applies the stored theme. Nothing else is required
  from components — _if_ they use tokens.
- **Forced-colors and reduced-motion are first-class.** `globals.css` remaps all tokens under
  `@media (forced-colors: active)` and zeroes motion under `prefers-reduced-motion: reduce`.
  Never inline a style that defeats these. Every bespoke `transition`/`animate` needs
  `motion-reduce:` handling or one of the pre-wired `--animate-*` tokens. Scripted
  `scrollTo`/`scrollIntoView` must resolve `behavior` through `resolveScrollBehavior()`
  (`src/lib/scroll-behavior.ts`) — a hard-coded `behavior: "smooth"` overrides the
  reduced-motion CSS and ignores the preference.

### Legacy-hex migration table

When you meet a pre-token hardcode (mockups being promoted, old branches), map it:

| Legacy value                                  | Token                                                             |
| --------------------------------------------- | ----------------------------------------------------------------- |
| `#007a78`, `#006d6b` (old teal action)        | `var(--clinical-accent)` / `var(--clinical-accent-hover)`         |
| `#00669a` (blue icon)                         | `var(--clinical-accent)`                                          |
| `#061740`, `#071844` (navy ink)               | `var(--text-heading)`                                             |
| `#b8dedb` / `#e3f4f5` (teal border/wash)      | `var(--clinical-accent-border)` / `var(--clinical-accent-soft)`   |
| `#f8fbfd`, `#f8fcfc`, `#fbfdff` (page washes) | `var(--surface-wash)` / `var(--surface-subtle)`                   |
| `bg-white`                                    | `bg-[color:var(--surface)]` (or `--surface-lux` for raised cards) |
| `slate-200` / `slate-500` / `slate-600`       | `var(--border)` / `var(--text-soft)` / `var(--text-muted)`        |
| ad-hoc `rgba(...)` shadows                    | `var(--shadow-tight/soft/hover/elevated/inset)` or `--glow-*`     |

## 2. Type & icon scale

### Type

Named steps live in the `@theme` block of `globals.css` and are **size-only** (no baked
line-height/tracking — set `leading-*`/`tracking-*` at the call site):

`text-4xs` 8px · `text-3xs` 10px · `text-2xs` 11px · (`text-xs` 12 / `text-sm` 14 / `text-base`
16 from Tailwind) · `text-sm-minus` 13px · `text-base-minus` 15px · (`text-lg` 18 / `text-xl`
20 / `text-2xl` 24 from Tailwind) · `text-lg-minus` 17px · `text-2xl-minus` 22px.

- Arbitrary `text-[Npx]` is **banned**; `npm run check:type-scale` counts offenders.
  **Ratchet:** the count must never rise (baseline recorded in
  `docs/process-hardening.md`). When it reaches 0, wire `check:type-scale --strict` into
  `verify:cheap`.
- Tailwind's own `text-xs`/`text-sm`/… carry a baked line-height. When retiring a raw px value
  onto one of them, check the call site for `leading-*` and pin the current effective leading
  explicitly if absent, so nothing shifts.
- **Accepted exceptions:** one-off rem display headings (`text-[2rem]`, `text-[2.7rem]`, …)
  on hero/mode-home titles, and `*-mockups` files. Don't add scale steps for one-off display
  sizes.

### Icon size

Icon **glyphs** use the parallel `--spacing-icon-*` scale in `@theme`:
`size-icon-xs` 12 · `size-icon-sm` 14 · `size-icon-md` 16 (default) · `size-icon-lg` 20 ·
`size-icon-xl` 24 (px). These generate `size-icon-*` / `h-icon-*` / `w-icon-*`, exactly like
`--spacing-tap` → `size-tap`.

- Prefer `size-icon-md` over raw `h-4 w-4` for an icon glyph. `npm run check:icon-scale --strict`
  (in `verify:cheap`) blocks the retired `4.5` (18px) half-step — icon glyphs resolve to
  `size-icon-lg`, non-icon 18px boxes to `h-5`. It does **not** touch raw `h-4 w-4` (which also
  sizes non-icons), so migrating the long tail onto `size-icon-*` is opportunistic, not enforced.
- **Responsive** icons add a breakpoint variant — `size-icon-md sm:size-icon-lg`. Reserve it for
  a few roles (nav, composer, hero, panel headings); most icons stay one fixed size.
- **Not** for container tiles (`iconTile` h-9, empty-state tile h-10) or non-icon boxes (the
  `ToggleSwitch` knob, status dots) — those keep the integer spacing scale. Icon glyph size is
  independent of the 44px tap target (§3), which stays on `--spacing-tap`.

## 3. Spacing & tap targets

- 4px grid via Tailwind spacing; safe-area env paddings on shell edges.
- Interactive targets use the `--spacing-tap` token (44px): `min-h-tap` / `min-w-tap` /
  `size-tap`. Do **not** hand-write `min-h-11` / `h-[44px]` for tap semantics.
- Exception (documented in `globals.css`): controls scrolled deep inside sheets stay on
  `min-h-12` (48px) to satisfy the ui-smoke sub-pixel tap check — do not "fix" them down.

## 4. Radius & shadows

- Radii come from `@theme`: `rounded-md` chips/pills · `rounded-lg` controls/cards/panels ·
  `rounded-xl`+ sheets/dialogs. Never pass a radius token through an arbitrary value
  (`rounded-[var(--radius-md)]` → `rounded-md`) — the plain utility is the same token.
- Shadows/elevation: `--shadow-tight/soft/card/hover/elevated/lux/inset/rail-active` and `--glow-primary/
soft`, all re-tuned per theme and removed under forced-colors. No literal `box-shadow` values
  in components.

## 5. Z-index ladder

Documented in `globals.css` next to the radius rules. Rungs: **0–40** in-page layering ·
**60** app chrome (master search header) · **80–85** document/table overlays · **95** popovers
that beat overlays · **100** the modal layer (`Sheet`) and the skip link · **max** mockup-only
diagnostics. New overlays go through the `Sheet` primitive; anything else picks an existing
rung — never a new number.

## 6. Component recipes

- Check `src/components/ui-primitives.tsx` **before hand-rolling anything**: `cn()`,
  `primaryControl`, `fieldControl*`, `toolbarButton`, `metadataPill`, `sourceCapsule`,
  `toneSuccess/Danger/Info/Warning/Neutral`, `EmptyState`, `LoadingPanel`, `ToggleSwitch`,
  `focusRing`, and ~30 more (catalogue: `docs/redesign/09-ui-primitives-recipes.md`).
- **`src/components/ui/sheet.tsx` is the only modal/overlay primitive.** It provides focus
  trap, initial focus, return-focus-on-close, Escape, backdrop dismiss, body scroll lock,
  safe-area padding, and dark-mode surfaces. Do not hand-roll `role="dialog"` overlays —
  the applications-launcher DetailDialog migration is the template for converting one.
- Empty and loading states use `EmptyState` / `LoadingPanel`, not bespoke markup.
- **Icon-only buttons use `IconButton`** (`ui-primitives.tsx`): its `label` prop is required and
  renders `aria-label` + an `aria-hidden` glyph + a 44px tap target, so an unlabeled icon button
  cannot be written by accident. Pass a recipe (`toolbarButton`, …) via `className` for chrome.
- Composer-chrome caveat: the `answer-footer-search-*` / `desktop-home-search-*` classes are
  intentionally **unlayered** and beat Tailwind utilities on the same element — check the class
  body before adding a utility there (see "CSS cascade layering" in
  `docs/process-hardening.md`).

## 7. Accessibility requirements

**Target: WCAG 2.2 AA.** The rules below are the concrete, enforced floor for meeting it; partial
automated coverage is provided by `tests/ui-accessibility.spec.ts` (reduced-motion, forced-colors,
focus, labels, selected axe-core checks) for the areas it covers, rather than enforcing the full
WCAG 2.2 AA standard, with manual checks for the rest.

- Every interactive element has a visible focus state: the global `:focus-visible` rule is the
  floor; use the `focusRing` recipe on custom controls.
- Dialogs/popovers: use `Sheet` (focus handling is free). If something genuinely can't use it,
  it must implement trap + initial focus + return focus itself.
- Tab patterns: `role="tab"` requires `aria-selected`, `aria-controls`, and a reachable
  `role="tabpanel"`. Reference implementations: dashboard upload tabs
  (`src/components/ClinicalDashboard.tsx`, search `role="tablist"`) and the mobile evidence
  tabs (`src/components/clinical-dashboard/visual-evidence.tsx`).
- Disclosure buttons need `aria-expanded` + `aria-controls` (see `MobileDetailSections` in
  `src/components/applications-launcher-page.tsx`).
- Remote images: always provide a fallback alt — `alt={caption?.trim() || "Clinical document
image"}` — never a possibly-empty variable alone.
- Canonical mobile viewport for manual and automated checks: **390×820**
  (matches `tests/ui-accessibility.spec.ts`, which drives reduced-motion and forced-colors).

## 8. Do / Don't

| Don't                                                         | Do                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| `border-red-200 bg-red-50 text-red-700`                       | `toneDanger` recipe, or the `--danger*` triad          |
| `border-cyan-200 bg-cyan-50 text-cyan-700` for identity chips | a categorical `--type-*` triad                         |
| hand-rolled `role="dialog"` + Escape listener                 | `<Sheet open onClose title …>`                         |
| `<button>` with a chevron and no `onClick`                    | wire the disclosure or render a static row             |
| `text-[11px]`                                                 | `text-2xs`                                             |
| `text-[12px]` (no leading set)                                | `text-xs leading-normal` (pin the leading)             |
| `rounded-[var(--radius-md)]`                                  | `rounded-md`                                           |
| `Number(query.page ?? 1)`                                     | `parseInt` + `Number.isFinite` + `>= 1` clamp          |
| `alt={caption}`                                               | `alt={caption?.trim() \|\| "Clinical document image"}` |
| new `z-[73]` for a popover                                    | an existing ladder rung, or `Sheet`                    |
| `shadow-[0_5px_12px_rgba(0,122,120,0.16)]`                    | `shadow-[var(--shadow-tight)]`                         |

## 9. Verification gates — Definition of Done for UI PRs

1. `npm run verify:cheap` — lint, typecheck, unit tests, runtime + sitemap checks (offline-safe).
2. `npm run ensure` then `npm run verify:ui` — Chromium Playwright (smoke, stress,
   accessibility, tools, overlap). Required for any UI/styling/routing change.
3. `npm run check:design-system-contract` — production-only raw colours, literal shadows,
   Therapy inline-parser/style debt, and tap-token drift must not exceed the recorded baseline.
4. `node scripts/check-type-scale.mjs` — the count must not exceed the recorded baseline.
5. Manual dark-mode pass on every screen you touched (theme toggle in the sidebar).
6. Reduced-motion + forced-colors spot check on touched surfaces
   (`ui-accessibility.spec.ts` covers the automated slice; emulate in devtools for the rest).
7. `npm run format:check`.
8. Fill the PR template; the clinical-governance preflight applies only if you touched
   ingestion/answer/search/source-access surfaces — pure UI work states that explicitly.

## 10. File conventions

- New component files are **kebab-case** (`master-search-header.tsx`). The 11 existing
  PascalCase files (`ClinicalDashboard.tsx`, `DocumentViewer.tsx`, …) are grandfathered —
  do not rename them; the churn outweighs the benefit.
- Mockups live under `/mockups/*` routes and `*-mockups.tsx` components. They are shipped,
  noindexed (robots.ts + layout metadata), and exempt from token/type-scale rules — but
  **promoting a mockup to production means bringing it onto the token system first** (see the
  legacy-hex table above).
- **Brand mark** is single-sourced in `src/lib/brand-mark.ts` (geometry + SVG builders).
  `BrandMark` (`clinical-dashboard/brand.tsx`) renders it token-themed; `app/icon.svg`,
  `app/apple-icon`, the PWA maskable icons, and `app/opengraph-image` all derive from it. To
  change the mark, edit `brand-mark.ts` then `npm run brand:update`; `brand:check` (in
  `verify:cheap`) guards `app/icon.svg` from drift. `app/favicon.ico` is a multi-resolution
  binary the toolchain can't emit — regenerate it offline from `icon.svg` when the mark changes.

## 11. What NOT to do

- No visual redesign; the direction is settled in `permanent-colour-direction.md`.
- No new colour systems, no per-page palettes, no hardcoded hex.
- No hand-rolled modals, no new z-index rungs, no z-index token machinery.
- No file renames for naming-convention reasons alone.
- Don't flip `check:type-scale --strict` while accepted rem display exceptions remain.
- Don't downgrade `min-h-12` deep-sheet controls to `min-h-tap`.
- Don't render page children inside their own Suspense fallback (duplicate-DOM bug — see
  process-hardening).
- UI PRs stay out of RAG/clinical logic (`src/lib/rag*`, ingestion, ranking, answer
  generation, Supabase schema) — that work carries its own eval gates.
