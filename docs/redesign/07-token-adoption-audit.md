# Token Adoption Audit — Clinical KB (July 2026)

## July 3 run — design-token adoption sweep across `src/components`

This run audits **how consistently the codebase consumes the design tokens**, not the
token system itself. The token _foundation_ in `src/app/globals.css` is strong; the
findings below are all about call-site adoption drift — tokens that exist but are
reached past, defined-but-unused utilities, and hardcoded values that bypass the scale.

Scope: `src/components` (50 `.tsx` files, ~40 className recipes in
`src/components/ui-primitives.tsx`) plus a repo-wide check for the `@theme inline`
bridge utilities. Two files carry most of the palette leaks
(`ClinicalDashboard.tsx`, `differentials/differential-presentation-workflow-page.tsx`)
and are both active mockup surfaces on `feature/tools-page-mockups` — treat their
findings as "clean before the pattern spreads," not shipped-primitive regressions.

**Score: 78/100** — 0 critical · 3 medium · 6 low.

## Summary

| Area                     | State  | Note                                                                                                                             |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Token foundation         | Keep   | Full neutral + accent ramps, semantic triads, dark, forced-colors, reduced-motion, elevation, motion, safe-areas. Best-in-class. |
| Color discipline (hex)   | Keep   | 0 hardcoded hex in components (1 legit SVG logo fill). Palette leaks contained to 2 mockup files.                                |
| Token-access consistency | Fix    | A defined-but-dead utility bridge means two ways to reach every color; the verbose form is used universally.                     |
| Type scale               | Fix    | Scale mostly followed, but ~295 hardcoded px font sizes; the `text-2xs` token is defined yet unadopted.                          |
| File naming              | Polish | PascalCase vs kebab-case split, mixed inside the same folder.                                                                    |
| Component docs           | Polish | Recipe pattern is sound but has no documented state/variant contract.                                                            |

## Findings

### Naming consistency

| Location                               | Finding                                                                                                                                                                                                             | Class  | Planned action                                           | Tier |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- | ---- |
| `src/components/*` file names          | 11 PascalCase files (`ClinicalDashboard`, `ClinicalSidebar`, `DocumentManagerPanel`…) vs ~39 kebab-case, **mixed inside the same folder** (`clinical-dashboard/ClinicalSidebar.tsx` next to `dashboard-shell.tsx`). | Polish | Standardize on kebab-case (majority + newer convention). | 3    |
| `src/components/ServiceDetailPage.tsx` | 1-line re-export shim to `services/service-detail-page.tsx`; PascalCase shims keep the naming drift alive.                                                                                                          | Polish | Track for removal once import paths are migrated.        | 3    |

### Token coverage

| Location                                                                                            | Finding                                                                                                                                                                                                                                                                                                                                                                                | Class  | Planned action                                                                                                                                                                                                                     | Tier |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `globals.css:46-77` (`@theme inline` bridge)                                                        | **M1.** Defines `--color-surface`/`--color-muted`/`--color-heading`/`--color-clinical-accent`… → generates `bg-surface`/`text-muted`/`text-heading` utilities. **Repo-wide usage: 0.** All ~1374 call sites use the verbose `text-[color:var(--text-muted)]` form instead. The line-45 comment ("lets new/refactored code use bg-surface, text-muted") is aspirational — no code does. | Fix    | Decide: adopt short utilities repo-wide (1374-site churn) **or** delete the dead bridge + fix the comment (small, safe — zero-usage confirmed across `src`).                                                                       | 2    |
| `ClinicalDashboard.tsx:6052-6055`; `differential-presentation-workflow-page.tsx:47-72`              | **M2.** Hand-rolled tone helpers re-implement the danger/info/warning/success triads with raw Tailwind palette classes (`border-red-200 bg-red-50 text-red-700`). They **don't respond to `.dark`** and are mutually inconsistent (differentials maps *warning*→`rose`; the `--warning-*` token is amber). 27 raw-palette instances, confined to these 2 mockup files.                 | Fix    | Route through `--danger-*` / `--warning-*` / `--info-*` / `--success-*` triads; fold into the mockup work before the pattern is copied.                                                                                            | 2    |
| `text-[11px]` ×142 (`text-2xs` ×2), `text-[10px]` ×58, `text-[15px]` ×45, `text-[13px]` ×30, +8/9px | **M3.** ~295 hardcoded px font sizes bypass the scale. `--text-2xs` (11px) is defined with its own line-height + letter-spacing yet almost unused. Sub-`xs` (8–10px) and "between" sizes (13px, 15px) have **no** scale tokens. Default scale is otherwise well followed (`text-xs` ×452, `text-sm` ×383).                                                                             | Fix    | Add tokens for 13/15px (optionally 8–10px). **Note:** `text-[11px]`→`text-2xs` is _not_ a pure swap — `text-2xs` adds `letter-spacing: 0.06em` + `line-height: 1rem`, so it changes rendering. Needs a visual pass, not a codemod. | 2    |
| `bg-white` ×7, `text-white`/`ring-white` ×35, `bg-black` ×1                                         | **L4.** Hardcoded white/black neutrals. `bg-white` is the real dark-mode risk (should be `--surface`); `text-white`/`ring-white` on accent buttons should use `--clinical-accent-contrast` / `--command-contrast`.                                                                                                                                                                     | Polish | Swap `bg-white`→`--surface`; accent-button text→`*-contrast` tokens.                                                                                                                                                               | 2    |
| `ClinicalDashboard.tsx:6138`                                                                        | **L5.** Hardcoded `border-blue-400` + arbitrary accent shadow bypasses `--clinical-accent` / `--glow-*`.                                                                                                                                                                                                                                                                               | Polish | Use accent + glow tokens.                                                                                                                                                                                                          | 3    |
| `min-h-[44px]`/`min-h-[48px]`/`min-w-[48px]`/`h-[44px]`/`w-[44px]` ~74×                             | **L6.** Repeated WCAG tap-target magic numbers with no token. Good that the minimums exist; bad that they're copy-pasted px.                                                                                                                                                                                                                                                           | Polish | Introduce a `min-h-tap` (44px) utility/token.                                                                                                                                                                                      | 3    |
| `rounded-[var(--radius-lg)]` ×4                                                                     | **L7.** Token reached the long way when the `rounded-lg` utility exists.                                                                                                                                                                                                                                                                                                               | Polish | Replace with `rounded-lg`.                                                                                                                                                                                                         | 3    |

### Component layer

| Location                          | Finding                                                                                                                                                                                                                                                                               | Class  | Planned action                                                                  | Tier |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- | ---- |
| `ui-primitives.tsx` (~40 recipes) | **L8.** The "component library" is ~40 className _recipes_ (`primaryControl`, `fieldControl`, `metadataPill`…) + `cn()`, plus one real React component (`ui/sheet.tsx`). Solid pattern, but no documented state contract (hover/active/disabled/loading) per recipe and no docs file. | Polish | Document the recipe state/variant contract; consider a short recipes reference. | 3    |

## Priority actions

1. **M1 — resolve the bridge (recommended first).** Zero-usage is confirmed across all
   of `src`, so deleting the dead `@theme inline` aliases + fixing the misleading
   comment is the small, honest fix. The "adopt short utilities" alternative is a
   1374-site codemod — only worth it if the team wants the readability/bundle win.
2. **M2 — token-ize the two mockup files** before their raw-palette tone helpers get
   copied into real components; this also fixes their dark mode.
3. **M3 — close the type-scale gap** by adding the missing size tokens. Do **not**
   codemod `text-[11px]`→`text-2xs` blindly — that token carries extra tracking/leading
   and will shift rendering; it needs a design pass.

## Method / reproduce

- Hardcoded hex: `rg '#[0-9a-fA-F]{3,8}\b' src/components -g '*.tsx'`
- Raw palette: `rg '\b(bg|text|border|ring|from|to|via|fill|stroke)-(gray|slate|…|rose)-(50|…|950)\b' src/components -g '*.tsx'`
- Dead bridge: `rg '("|'"'"'| )(bg-surface|text-muted|text-heading|…)( |"|'"'"')' src` → 0 hits.
- Arbitrary values ranked: `rg -oN '…-\[[^]]+\]' src/components -g '*.tsx' | sort | uniq -c | sort -rn`
