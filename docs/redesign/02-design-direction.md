# Design Direction — Clinical KB

> **Entry point:** day-to-day UI rules live in [`docs/design-system.md`](../design-system.md); this document remains the token rationale it links to.

## July 1 — Clinical White / Sky Graphite (active direction)

This supersedes the earlier "single teal accent for primary actions" principle. The colour system is now **role-split** rather than single-accent:

- **Command = graphite.** Primary actions (New chat, primary CTAs, the mobile section FAB) use `--command` (`#111827` light / near-white `#F5F7F7` dark) — never teal/green.
- **Clinical accent = Clinical Sky.** A cool clinical blue `--clinical-accent` (`#1D6FB8` light / `#74BDF0` dark) owns clinical identity only: selected mode, evidence/source rails, the composer send action, and focus.
- **Green = success only.** `--success` is reserved for ready/connected/complete; it is never brand, nav, command, send, or evidence.
- **True-white canvas.** The neutral ramp was de-blued to a true-neutral gray scale; the content surface is `#FFFFFF`, with `--surface-chrome` (`#F7F8FA`) for rails/header only. Light mode is de-glassed: flat surfaces + hairline borders + one restrained shadow; glass/blur is reserved for overlays. Dark mode keeps its black polish.

Migration was token-led: `--primary*` now resolves to the clinical accent, `--command*` is new, and legacy `--clinical-chat-teal*` / `--clinical-chat-ready` are retained as compat aliases pointing at the role tokens (`--clinical-accent` / `--success`). New code should reference the role tokens directly. Typography (Geist), spacing, radius, and motion are unchanged from below. See decision log **D11**.

## June 20 scoped run

The active direction for the dashboard and document viewer is a quiet clinical command instrument: neutral, precise, source-first. Teal remains reserved for primary action, evidence, and focus; dense operational details should collapse into progressive sheets/drawers on mobile rather than competing with the answer or PDF.

## Point of view

A precision clinical instrument: calm, quiet, and trustworthy. A true-neutral graphite foundation carries almost everything; the single clinical-blue accent is spent only on clinical identity, evidence highlights, and focus. Depth comes from hairline borders and small layered shadows — never from heavy blur — and typography does the hierarchy work: confident headings, a 16px reading body with a capped measure, and tabular numerals wherever data lives.

## Token set (implemented in `src/app/globals.css`)

> **Revised 2026-07-28.** The values below are kept in step with `globals.css`. The sections above
> dated June 20 / July 1 are a record of past runs and are deliberately left as written.

### Color

- **Neutral ramp** `--neutral-0 … --neutral-950`: 12 steps, true-neutral graphite-to-ash (de-blued), defined per scheme. Most surface/border/text vars re-point at the ramp; existing var names (`--surface`, `--border`, `--text-muted`, …) remain the public API. `--border` / `--border-strong` are per-theme values rather than ramp aliases — tracking `--neutral-300` left the dark hairline effectively invisible.
- **Primary ramp** `--primary-50 … --primary-900`: Clinical Sky anchored on `#1d6fb8` (light) / `#74bdf0` (dark) — the same hue in both themes. `--primary`, `--primary-strong`, `--primary-soft`, `--focus` re-point at it. Re-derive the whole ramp rather than swapping one step.
- **Surfaces** are an ordered five-step scale in both themes: `--surface-inset` < `--surface-wash` < `--surface-subtle` < `--surface` < `--surface-raised`. `--surface-raised` must stay the lightest plane or raised cards read as recesses.
- **Semantic triads**: `--{info,success,warning,danger}-{text,bg,border}` tuned for ≥4.5:1 text contrast on their backgrounds in both schemes. Legacy `--success`/`--success-soft` names alias the triads.
- Dark theme is designed, not inverted: elevated surfaces lighten, accents brighten and desaturate slightly, shadows are replaced by surface contrast + inset hairlines.

### Typography

- Geist Sans (existing) with tightened display tracking; Geist Mono for code.
- Scale tokens: `2xs 11/16 +0.06em`, `xs 12/18`, `sm 14/22`, `base 16/26`, `lg 18/28 -0.01em`, `xl 22/30 -0.015em`, `2xl 28/36 -0.02em` — exposed via `@theme` so `text-*` utilities emit the pairs.
- `nums` utility = `font-variant-numeric: tabular-nums` for counts, page numbers, byte sizes, timers.
- Reading body: 16px/1.65, measure capped at `68ch`.

### Space, shape, depth

- Spacing: Tailwind 4px grid, used on the 4/8/12/16/24/32/48/64 rhythm; no arbitrary off-scale values in new code.
- Radius scale (Tailwind `@theme` override), on the 4px grid: `xs 0.25rem` (4) · `sm 0.375rem` (6, the one deliberate half-step, for chips/pills) · `md 0.5rem` (8) chips/inner elements · `lg 0.75rem` (12) controls/inputs/cards/panels · `xl 1rem` (16) sheets/dialogs · `2xl 1.25rem` (20) large shells.
- Elevation is a numbered ladder `--e0 … --e4`: one monotonic sequence that sorts by name, hue-tinted rather than flat grey, with negative spread so a shadow pulls inward instead of bleeding. `--e0` flush · `--e1` resting hairline · `--e2` cards/popovers · `--e3` hover/lifted chrome · `--e4` modals/sheets/drawers. The role names are aliases onto tiers, not independent values: `--shadow-tight`→`--e1`, `--shadow-card`/`--shadow-soft`→`--e2`, `--shadow-hover`→`--e3`, `--shadow-elevated`/`--shadow-lux`→`--e4`. `--shadow-inset` stays a bespoke hairline top-light. Dark lifts with a top highlight rather than more black. Never hand-roll a `shadow-[0_…]` literal.

### Motion

- Durations: `--duration-fast 120ms` (state changes), `--duration-base 180ms` (reveals), `--duration-slow 240ms` (sheets/overlays).
- Easing: `--ease-out-soft cubic-bezier(0.22,1,0.36,1)` default; `--ease-spring cubic-bezier(0.34,1.3,0.64,1)` for the mode-toggle thumb and playful affordances.
- Keyframes: `fade-up` (content arrival), `overlay-in` (backdrop), `sheet-up` (bottom sheets), `pop-in` (popovers/dialogs). All suppressed by `prefers-reduced-motion`.
- Micro feedback: every interactive element keeps `active:translate-y-px`; transitions run `--duration-fast` `--ease-out-soft`.

### Component standards

Every interactive component covers: default, hover, focus-visible (global ring tokens), pressed, disabled, loading, and selected/empty where applicable. Overlays animate in and out. Skeletons (shimmer) replace spinners for content loads; spinners remain only for indeterminate _progress_ messaging. Mobile: bottom sheets instead of centered modals below `sm:`, 44px touch targets, safe-area utilities (`pt-safe`, `pb-safe`, `pb-safe-2`).
