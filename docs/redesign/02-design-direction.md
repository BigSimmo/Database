# Design Direction — Clinical KB

## Point of view

A precision clinical instrument: calm, quiet, and trustworthy. A teal-tinted neutral foundation carries almost everything; the single teal accent is spent only on primary actions, evidence highlights, and focus. Depth comes from hairline borders and small layered shadows — never from heavy blur — and typography does the hierarchy work: confident headings, a 16px reading body with a capped measure, and tabular numerals wherever data lives.

## Token set (implemented in `src/app/globals.css`)

### Color

- **Neutral ramp** `--neutral-0 … --neutral-950`: 12 steps, hue-tinted toward teal-slate (not pure grey), defined per scheme. All surface/border/text vars re-point at the ramp; existing var names (`--surface`, `--border`, `--text-muted`, …) remain the public API.
- **Primary ramp** `--primary-50 … --primary-900`: teal anchored on `#0e8f85` (light) / `#33d4c2` (dark). `--primary`, `--primary-strong`, `--primary-soft`, `--focus` re-point at it.
- **Semantic triads**: `--{info,success,warning,danger}-{text,bg,border}` tuned for ≥4.5:1 text contrast on their backgrounds in both schemes. Legacy `--success`/`--success-soft` names alias the triads.
- Dark theme is designed, not inverted: elevated surfaces lighten, accents brighten and desaturate slightly, shadows are replaced by surface contrast + inset hairlines.

### Typography

- Geist Sans (existing) with tightened display tracking; Geist Mono for code.
- Scale tokens: `2xs 11/16 +0.06em`, `xs 12/18`, `sm 14/22`, `base 16/26`, `lg 18/28 -0.01em`, `xl 22/30 -0.015em`, `2xl 28/36 -0.02em` — exposed via `@theme` so `text-*` utilities emit the pairs.
- `nums` utility = `font-variant-numeric: tabular-nums` for counts, page numbers, byte sizes, timers.
- Reading body: 16px/1.65, measure capped at `68ch`.

### Space, shape, depth

- Spacing: Tailwind 4px grid, used on the 4/8/12/16/24/32/48/64 rhythm; no arbitrary off-scale values in new code.
- Radius scale (Tailwind `@theme` override): `md 0.5rem` chips/inner elements, `lg 0.875rem` controls/inputs, `xl 1.25rem` cards/panels, `2xl 1.75rem` sheets/hero surfaces.
- Elevation, 4 levels (same var names as before): `--shadow-inset` (hairline top-light), `--shadow-tight` (resting card: 1-2px + 8px low-alpha pair), `--shadow-hover`/`--shadow-soft` (raised: + 16px layer), `--shadow-elevated` (overlay: 3 layers to 48px). Dark scheme: lower-alpha shadows + `--shadow-inset` white hairline.

### Motion

- Durations: `--duration-fast 150ms` (state changes), `--duration-base 200ms` (reveals), `--duration-slow 250ms` (sheets/overlays).
- Easing: `--ease-out-soft cubic-bezier(0.22,1,0.36,1)` default; `--ease-spring cubic-bezier(0.34,1.3,0.64,1)` for the mode-toggle thumb and playful affordances.
- Keyframes: `fade-up` (content arrival), `overlay-in` (backdrop), `sheet-up` (bottom sheets), `pop-in` (popovers/dialogs). All suppressed by `prefers-reduced-motion`.
- Micro feedback: every interactive element keeps `active:translate-y-px`; transitions run `--duration-fast` `--ease-out-soft`.

### Component standards

Every interactive component covers: default, hover, focus-visible (global ring tokens), pressed, disabled, loading, and selected/empty where applicable. Overlays animate in and out. Skeletons (shimmer) replace spinners for content loads; spinners remain only for indeterminate _progress_ messaging. Mobile: bottom sheets instead of centered modals below `sm:`, 44px touch targets, safe-area utilities (`pt-safe`, `pb-safe`, `pb-safe-2`).
