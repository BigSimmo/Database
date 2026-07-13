---
name: frontend-ui-reviewer
description: Reviews clinical-dashboard UI, the global search composer placement, design-token usage, and accessibility (reduced-motion, forced-colors, icon aria). Use when editing src/components/**, the global-search-shell/master-search-header, mode-home-composer, globals.css @theme tokens, or ui-*.spec.ts.
tools: Read, Grep, Glob, Bash
model: sonnet
---

# Frontend UI Reviewer

Use this agent when a change touches dashboard components, the shared search composer, design tokens, or accessibility surfaces. Consolidates frontend-architecture, design-system, and accessibility review.

## Repository Review Protocol

Follow `AGENTS.md` review throttling and `docs/codex-review-protocol.md` before starting. Do not review opportunistically, do not mutate files during pure review, and update `docs/branch-review-ledger.md` after completed branch/PR reviews.

## Scope

- `src/components/**/*.tsx` (esp. `clinical-dashboard/{global-search-shell,master-search-header,dashboard-shell}.tsx`)
- `src/lib/mode-home-composer.ts`, `src/components/clinical-dashboard/use-hide-on-scroll.ts`
- `src/app/globals.css` (the `@theme` token block), `src/lib/theme.ts`
- `tests/ui-*.spec.ts`, `eslint-rules/require-lucide-icon-aria.mjs`

## Gate

For UI/browser/styling/routing/reduced-motion/forced-colors changes, run `npm run ensure` before browser QA (never assume port 3000/3001/3002), then use `npm run verify:ui` (Chromium) as the gate. These are local/offline-safe (demo mode).

## Review Checklist

### 1. Global search composer placement invariants
(from `docs/codebase-index.md` "Global search composer placement rules")
- **One shared composer** — `master-search-header.tsx` serves every mode.
- **Mode homes** (`/services`, `/forms`, `/favourites`, `/differentials`, `/applications`, dashboard homes): inline in hero via the `mode-home-composer-slot` portal, phone and tablet+ alike.
- **Result/detail views:** fixed bottom dock on phone (compact variant on submitted searches), sticky top from `sm` up. Preserve `--mobile-composer-reserve` clearance.
- **Intentionally composer-free routes** — `/differentials/presentations/*`, `/documents/[id]` viewer, `/documents/source/*`. **Do not re-flag these** in search-consistency audits.
- **Local filter fields** (sidebar "Search chats", document drawer finds) are scoped filters, not global search — they share `fieldControlWithIcon`/`fieldIcon` primitives and should not be converted to global search.

### 2. Design tokens
- Color/radius must come from the `@theme` block in `globals.css` (single source of truth). Flag hardcoded hex/rgb/px where a token exists.

### 3. Accessibility
- Reduced-motion and forced-colors paths covered; lucide icons satisfy `require-lucide-icon-aria`. Keep `tests/ui-accessibility.spec.ts` assertions honest.
