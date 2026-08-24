## Summary

This PR lands Group B (Design System, UI Components & Test Lab Quality) implementing the new shared `InteractiveRow` primitive, adopting shared UI kit components in Therapy Compass, verifying Docling lab table hardness fixtures, and isolating forms preview flake.

### 1. `InteractiveRow` Primitive & `therapyBtn` Cleanup (`#VTEW3W`)

- Created `src/components/ui/interactive-row.tsx` providing a polymorphic, token-driven `InteractiveRow` primitive and `interactiveRowBase` recipe with `min-h-tap` (48px), `focusRing`, and tokenized surface/hover/active states.
- Standardized all 13 `therapyBtn` call sites across Therapy Compass screens (`brief-screen.tsx`, `pathways-screen.tsx`, `recommend-screen.tsx`, `sheets-screen.tsx`, `therapy-card.tsx`, `related-therapies.tsx`, `therapy-record-nav-header.tsx`, `prose.tsx`).
- `interactiveRowBase` is layout-neutral (no `w-full`). Full-width rows keep `w-full` on `InteractiveRow` / `therapyBtn`; compact chips and Show more stay `w-auto`.
- Sheets picker trigger keeps the 48px tap floor and anchors its menu at `top-full` instead of a 46px/52px height fight.

### 2. Therapy Compass UI Kit Adoption (`#NEBJAM`)

- Migrated private UI elements in `src/components/therapy-compass/ui.tsx` to shared primitives (`Chip`, `LoadingPanel`, `SharedEmptyState`, token typography).
- Refactored `StatusBadge` to compose `Chip` with status appearance and clinical icons (`ShieldCheck`, `TriangleAlert`).
- Standardized `IconTile` on token palette and `size-tap` (48px).

### 3. Docling Table Hardness Test Fixtures (`#BSBE9B`)

- Validated `docling-lab-fixtures.v2` in `eval/docling/fixtures/manifest.v2.json`, `eval/docling/report/lab-contract.mjs`, and `tests/docling-lab-contract.test.ts`.
- Verified all 3 hard table geometries (`unruled`, `merged_cell`, `rotated_header`) with exactness assertions and zero leakage.

### 4. Forms Preview Spec Flake Isolation (`#5DYBQQ`)

- Fortified `tests/ui-forms-section-nav.spec.ts` (`expands information previews into one continuous answer`) with explicit selector settlement assertions.

## Verification

- [x] `npm run check:outstanding-issues-snapshot` — `[snapshot] in step with data/outstanding-issues-snapshot.json (73 open, 115 pending)`
- [x] `npm run check:design-system-contract` — `Design-system contract passed (982 production files; raw colors 2; literal shadows 0; legacy tap classes 0)`
- [x] `npm run check:design-system-adoption` — `design-system adoption checked: 54 components, 94 roots`
- [x] `npm run check:design-sync-contract` — `design-sync contract checked: 54 components and 7 guidelines`
- [x] `npm run test:focused -- --files src/components/ui/interactive-row.tsx,src/components/therapy-compass/controls.ts,src/components/therapy-compass/screens/sheets-screen.tsx,src/components/therapy-compass/prose.tsx,src/components/therapy-compass/screens/recommend-screen.tsx` — `Test Files  5 passed (5)` / `Tests  32 passed (32)`
- [x] UI verification not run: Production UI on the previous head was already green; this follow-up only moves width/height onto existing recipes and regenerates the issues snapshot.

## Risk and rollout

- Risk: Low. Layout-only: compact chips stay content-sized, full-width rows still span their container, and the sheets picker uses the 48px tap floor. Snapshot regenerate after merging `main` is generated output, not a ledger-table edit.
- Rollback: Revert the follow-up commits on this branch.
- Provider or production effects: None
- RAG impact: none

## Clinical Governance Preflight

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed
