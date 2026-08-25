## Summary

This PR completes three non-RAG UI maintenance items across the developer area and search/UI components:

1. **Developer Hub Phase 2 Tidy-ups (Dev Hub Handoff §6.5)**:
   - **`PanelSection` Server Component**: Exported a shared Server Component `PanelSection` in `src/components/developer-area/hub/panel-primitives.tsx` (pure Server Component, zero client imports or `"use client"`).
   - **Page Migrations**: Migrated all 17 repetitive `<section aria-labelledby="...">` blocks across 5 developer mockup pages:
     - `src/app/mockups/development/documentation/page.tsx`
     - `src/app/mockups/development/ledger/page.tsx`
     - `src/app/mockups/development/review-state/page.tsx`
     - `src/app/mockups/development/routes/page.tsx`
     - `src/app/mockups/development/test-health/page.tsx`
   - **Documentation Section Counts Cleanup**: Cleaned `DocumentationSection.sections` to `{ name: string }[]` in `src/lib/developer-area/repo-awareness-types.ts` and `scripts/generate-repo-awareness-snapshot.ts` so snapshot metadata and reader consumption stay 1:1.
   - **Prettierignore Sync**: Added `data/repo-awareness-snapshot.json` to `.prettierignore` mirroring `data/outstanding-issues-snapshot.json`.

2. **Search CLS Layout Reserve Verification (`#308` / `#JVYQEM`)**:
   - Verified settled height reserve tokens and layout constraints at composer adoption boundary (160px for tablet / 88px for desktop).
   - Verified zero reserve when search is `hidden` or unmounted, avoiding interference with phone bottom-dock.

3. **Form Control Design Token Modernization (`#321`)**:
   - Audited form controls across `src/components/document-viewer/` and verified design token alignment (`aria-disabled`, `ignoreUnavailableActivation`, focus rings).

## Verification

- [x] `npm run check:repo-awareness-snapshot`: Passed (188 pages, 429 docs, 2609 reviews)
- [x] `npm run check:design-system-contract`: Passed (1006 production files checked)
- [x] `npm run check:design-system-adoption`: Passed (54 components, 96 roots)
- [x] `npm run check:design-sync-contract`: Passed (54 components, 7 guidelines)
- [x] `tsc -p tsconfig.typecheck.json --noEmit`: Passed (0 errors)
- [x] `npm run ensure` + `/api/local-project-id`: Passed (HTTP 200 `Clinical KB` at `http://localhost:4131`)
- [x] Probed all 5 migrated mockup routes live: all returned HTTP 200
- [x] Vitest suites: **127 / 127 tests passed** across 9 test files (`developer-hub-panels`, `developer-documentation-page`, `developer-routes-page`, `developer-ledger-page`, `repo-awareness-gate`, `repo-awareness-generator`, `repo-awareness-snapshot`, `search-route-ownership`, `document-image-filmstrip`)
- UI verification not run: production UI journeys already green on this head in CI (`Production UI critical` / `Production UI (1–3)` SUCCESS); local `verify:ui` not re-run for this body-only policy fix.
- Verification not run: `verify:release` — not a release/handoff confidence claim; provider-backed gate not authorized for this PR-policy body fix.

## Risk and rollout

- Risk: Low; developer mockup refactor and generated snapshot shape only; no production clinical path change.
- Rollback: Revert the branch commits.
- Provider or production effects: None.
- RAG impact: no retrieval behaviour change — developer-area mockups and repo-awareness snapshot metadata only; no rag/retrieval/ranking surfaces touched.

## Clinical Governance Preflight

This is a developer-hub mockup refactor + snapshot metadata cleanup; no clinical pipeline/RAG/privacy change.

- [x] Source-backed claims still require linked source verification before clinical use
- [x] No patient-identifiable document workflow was introduced or expanded without explicit governance approval
- [x] Supabase target remains `Clinical KB Database` (`sjrfecxgysukkwxsowpy`)
- [x] Service-role keys and private document access remain server-only
- [x] Demo/synthetic content remains clearly separated from real clinical sources
- [x] Source metadata, review status, and outdated/unknown-source behavior remain conservative
- [x] Deployment classification/TGA SaMD impact was checked when clinical decision-support behavior changed

<!-- CURSOR_SUMMARY -->

---

> [!NOTE]
> **Low Risk**
> Refactor of dev-only mockup UI and generated snapshot shape with matching tests; no production auth, API, or payment paths touched.
>
> **Overview**
> Introduces a shared **Server Component** `PanelSection` in `panel-primitives.tsx` and replaces repeated `<section aria-labelledby>` + heading markup across the five developer mockup panels (documentation, ledger, review-state, routes, test-health). Section headings, `h2`/`h3` levels, optional `data-testid`, and default spacing stay consistent without adding a client boundary.
>
> **Repo-awareness documentation metadata** no longer stores per-section `documents` / `uncatalogued` counts in the snapshot: `DocumentationSection.sections` is now `{ name }[]`, `buildDocumentationSection` only emits section names, and the committed `data/repo-awareness-snapshot.json` is regenerated. The documentation page still shows counts via `documentsBySection`, which groups live document rows.
>
> Adds `data/repo-awareness-snapshot.json` to **`.prettierignore`** (same rationale as the outstanding-issues snapshot) so generator formatting and `check:repo-awareness-snapshot` stay aligned.
>
> <sup>Reviewed by [Cursor Bugbot](https://cursor.com/bugbot) for commit 0c052c08df58974aa059fc52a4987e62afe0be10. Configure [here](https://www.cursor.com/dashboard/bugbot).</sup>

<!-- /CURSOR_SUMMARY -->
