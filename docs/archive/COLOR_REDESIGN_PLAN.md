> **SUPERSEDED — historical exploration only.** Do not implement from this file.
<<<<<<< HEAD:COLOR_REDESIGN_PLAN.md
> Active design direction: [`docs/redesign/02-design-direction.md`](docs/redesign/02-design-direction.md)
=======
> Active design direction: [`docs/redesign/02-design-direction.md`](../redesign/02-design-direction.md)
>>>>>>> origin/main:docs/archive/COLOR_REDESIGN_PLAN.md
> (Clinical White / Aegean Graphite).

# Luxury Black-First Color Redesign Plan (Global UI Polish)

## 1) Intent

Apply a refined, premium dark-first visual system across the app with minimal risk:

- Keep semantics and component behavior unchanged.
- Keep token architecture centralized in CSS variables.
- Preserve accessibility and clinical readability.
- Ensure light mode remains available but visually secondary.

## 2) Boundaries and Constraints

- No functional/logic edits.
- No route/path rewrites, no new UI behavior.
- No dependency/toolchain changes.
- Primary work only in style tokens and tokenized usage in key components.
- All work is reversible and should be diff-reviewable in 3 small stages.

## 3) Success Definition (Done Criteria)

- Global theme reads as `obsidian/charcoal/luxury` (dark-first) while keeping high contrast.
- `--surface`, `--text`, `--primary`, `--border`, focus and state tokens are consistently used.
- Hard-coded production color usage reduced to near-zero in high-impact files.
- No visual behavior regressions observed on target screens (search, dashboard, viewer, modal/sheet).
- Diff is split by stage for easy rollback.

## 4) Stage Overview

### Stage 1 — Token Refresh + Theme Metadata (No behavior change)

**Goal:** finalize token system to luxury black-first in one controlled sweep.

#### Files

- `C:\Dev\Apps\Database\src\app\globals.css`
- `C:\Dev\Apps\Database\src\app\layout.tsx`
- `C:\Dev\Apps\Database\src\lib\theme.ts`

#### Edit checklist

1. In `globals.css`, set foundation tokens for dark-first aesthetic:
   - Neutral ramps (`--background`, `--surface*`, `--text*`, `--border*`, `--ring*`, `--shadow*`, `--overlay-backdrop`, `--panel-gloss`)
   - Primary/accent tokens (reduced-brightness, high contrast on dark)
   - Semantic status tokens (`--info`, `--success`, `--warning`, `--danger`) and clinical-specific tokens
2. Ensure `.dark` token map remains consistent and richer than `:root` light map.
3. Update `@theme` bridges if needed so utility mappings stay clean and exhaustive.
4. In `layout.tsx`, revise theme metadata/colors to match palette intent.
5. In `theme.ts`, keep server snapshot/default aligned with dark-first philosophy.

#### Exit checks

- `rg -n "(background|surface|text|border|primary|ring|shadow|overlay|panel-gloss)" src\app\globals.css`
- Confirm no token names were removed/renamed (only value changes).

---

### Stage 2 — Token Migration of Production Color Exceptions

**Goal:** remove hardcoded/non-token surface/color usage from high-impact components.

#### Files

- `C:\Dev\Apps\Database\src\components\ui\sheet.tsx`
- `C:\Dev\Apps\Database\src\components\ui-primitives.tsx`
- `C:\Dev\Apps\Database\src\components\DocumentViewer.tsx`
- `C:\Dev\Apps\Database\src\components\ClinicalDashboard.tsx`
- `C:\Dev\Apps\Database\src\components\clinical-dashboard\medication-prescribing-workspace.tsx`

#### Edit checklist

1. Replace `bg-white`, `text-white`, `border-white`, direct slate utilities and hex fills with token-backed references.
2. Replace hardcoded status badges with semantic variants (`toneDanger`, `toneInfo`, `toneSuccess`, etc.) where available.
3. Keep spacing/layout/logic unchanged.
4. Confirm sheet, modal, viewer, dashboard, and medication workspace now visually map to token surfaces.

#### Exit checks

- Token-first grep in target files:
  - `rg -n "bg-white|text-white|border-white|bg-slate|text-slate|border-slate|#([0-9a-fA-F]{3,8})" src\components\ui\sheet.tsx src\components\ui-primitives.tsx src\components\DocumentViewer.tsx src\components\ClinicalDashboard.tsx src\components\clinical-dashboard\medication-prescribing-workspace.tsx`
- No behavior edits committed.

---

### Stage 3 — Depth & Polish + QA Validation

**Goal:** finalize tactile depth and verify polished output across themes.

#### Files (primarily)

- `C:\Dev\Apps\Database\src\app\globals.css`
- Any residual files flagged in Stage 2 follow-up

#### Edit checklist

1. Fine-tune overlay/gloss/shadow stack:
   - reduce harsh white borders
   - convert glow to low-sheen, alpha-safe ink reflections
   - keep focus ring high contrast and unmistakable
2. Normalize any remaining direct color-mix / white-overlay hacks to token values.
3. Run final style consistency sweep for production files.

#### Exit checks

- Manual visual QA after server boot:
  - `npm run ensure`
  - Browse sample flows: search, dashboard, document viewer, sheet/modal, medication prescribing workspace.
- Contrast check on dark mode primary surfaces:
  - body text, headings, disabled, links/buttons, focus, and success/info/warning/danger states.

---

## 5) Suggested Execution Order (Pragmatic)

1. Stage 1 tokens + metadata
2. Stage 2 component hardcode replacement
3. Stage 3 polish + QA

This keeps risk low and allows rollback at each stage.

## 6) Rollback Strategy

- Stage-specific commits (or checkpoints): Stage1 / Stage2 / Stage3.
- If any stage causes visual regression, revert only that stage’s files first.
- Preserve `git status` checkpoints between stages.

## 7) Risk Register

- **Contrast drift (high):** especially in dense clinical content -> verify muted text/disabled states.
- **Component inconsistency risk:** token-mapped components that rely on literal colors for hierarchy -> preserve local contrast hierarchy via token swaps only.
- **Theme metadata mismatch:** server/client defaults mismatch -> validate first paint and browser local toggle.

## 8) Done Checklist (single source of truth)

- [ ] Stage 1 complete (tokens + metadata)
- [ ] Stage 2 complete (component token migration)
- [ ] Stage 3 complete (polish + QA)
- [ ] Final review with screenshot evidence of main routes in dark mode

## 9) Current status (from this session)

- Stage 1 is partially started in `globals.css`.
- `layout.tsx` and `theme.ts` still need completion before Stage 1 is final.
- No files outside the plan scope should be edited until this document is approved.
