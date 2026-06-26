# Process Hardening Plan

This document turns the current process review into phased, durable repo practice. It separates changes that already take effect from work that should stay explicit until it is implemented.

## Phase 1 - Active now

- `npm run verify:cheap` is the default broad local gate for source/config/test changes: lint, typecheck, and unit tests.
- `npm run verify:ui` is the default UI gate: Chromium Playwright smoke, stress, and accessibility media checks.
- `npm run verify:release` is the release-confidence gate: lint, typecheck, unit tests, build, and the full Playwright browser project set.
- CI now installs Chromium and runs the Chromium UI gate after build.
- `tests/ui-accessibility.spec.ts` covers reduced-motion and forced-colors dashboard usability so those modes are no longer only reviewed by inspection.
- `tests/ui-tools.spec.ts` covers the `/tools` launcher at mobile and desktop sizes.
- `AGENTS.md` now points future agents to these gates and to this document.

## Phase 2 - Active now

- Previous deterministic smoke failures are reclassified as resolved in the current Chromium UI gate: `npm run verify:ui` passed 26/26 on June 23, 2026.
- Local scratch and visual-capture output are excluded from Prettier through `.prettierignore` so generated investigation files do not block the format gate.
- Pull requests now include a clinical governance preflight for ingestion, answer generation, source rendering, privacy, production environment, and clinical-output changes.
- `/tools` now has dedicated Playwright coverage in the UI gate.

## Phase 3 - Structural cleanup

- [ ] Decompose `src/components/ClinicalDashboard.tsx` into the planned `src/components/clinical-dashboard/` modules.
- Preserve `data-testid`, `aria-label`, and AST-pinned `ClinicalOutputPanel` contracts during the move.
- After decomposition, run `npm run verify:cheap`, `npm run verify:ui`, and focused visual/browser checks against the dashboard and document viewer.

### Phase 3 progress (started)

- Added `src/components/clinical-dashboard/` as the module boundary.
- `src/app/page.tsx` now imports `ClinicalDashboard` from the module path (`@/components/clinical-dashboard`) while preserving
  the legacy source declaration file for AST and merge-guard compatibility.

## Phase 4 - Release maturity

- `npm run check:runtime` is the strict release runtime gate and is now part of `npm run verify:release`; it fails outside Node 22.x.
- CI runs `npm run check:runtime` after dependency install so branch verification cannot silently drift to Node 24+.
- Decide whether CI should run all Playwright browser projects on protected branches, release branches, or a scheduled workflow instead of every push.
- Add explicit review ownership for clinical source governance, outdated-source handling, incident review, and decommission decisions.
- Record production-readiness outcomes in release notes whenever clinical workflow, source governance, privacy, or deployment assumptions change.

## Known limits

- Chromium UI coverage is active in CI now; Firefox and WebKit remain available through `npm run test:e2e` and `npm run verify:release`.
- The new accessibility media smoke verifies usability and layout in reduced-motion and forced-colors modes; it is not a full WCAG audit.
- The format gate intentionally ignores `.tmp-visual/` and `scratch/`; those folders are local investigation output, not release source.
- Process scripts do not commit, push, deploy, mutate Supabase data, or run dependency updates.
