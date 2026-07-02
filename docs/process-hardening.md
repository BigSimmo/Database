# Process Hardening Plan

This document turns the current process review into phased, durable repo practice. It separates changes that already take effect from work that should stay explicit until it is implemented.

## Phase 1 - Active now

- `npm run verify:cheap` is the default broad local gate for source/config/test changes: lint, typecheck, and unit tests.
- `npm run verify:ui` is the default UI gate: Chromium Playwright smoke, stress, and accessibility media checks.
- `npm run verify:release` is the release-confidence gate: lint, typecheck, unit tests, build, and the full Playwright browser project set.
- CI now installs Chromium and runs the Chromium UI gate after build on all branches; a gated release-browser job runs the full Playwright browser matrix on `main`, `release/*`, manual dispatch, and the weekly schedule.
- `tests/ui-accessibility.spec.ts` covers reduced-motion and forced-colors dashboard usability so those modes are no longer only reviewed by inspection.
- `tests/ui-tools.spec.ts` covers the Applications dashboard mode at mobile and desktop sizes, including the `/applications` compatibility redirect.
- `AGENTS.md` now points future agents to these gates and to this document.

## Phase 2 - Active now

- Previous deterministic smoke failures are reclassified as resolved in the current Chromium UI gate: `npm run verify:ui` passed 26/26 on June 23, 2026.
- Local scratch and visual-capture output are excluded from Prettier through `.prettierignore` so generated investigation files do not block the format gate.
- Pull requests now include a clinical governance preflight for ingestion, answer generation, source rendering, privacy, production environment, and clinical-output changes.
- Applications mode now has dedicated Playwright coverage in the UI gate.

## Phase 3 - Structural cleanup

- [ ] Decompose `src/components/ClinicalDashboard.tsx` into the planned `src/components/clinical-dashboard/` modules.
- Preserve `data-testid`, `aria-label`, and AST-pinned `ClinicalOutputPanel` contracts during the move.
- After decomposition, run `npm run verify:cheap`, `npm run verify:ui`, and focused visual/browser checks against the dashboard and document viewer.

### Phase 3 progress (started)

- Added `src/components/clinical-dashboard/` as the module boundary.
- `src/app/page.tsx` now imports `ClinicalDashboard` from the module path (`@/components/clinical-dashboard`) while preserving
  the legacy source declaration file for AST and merge-guard compatibility.

## Phase 4 - Release maturity

- `npm run check:runtime` is the strict runtime gate and is now part of `npm run verify:cheap`, `npm run verify:ui`, and `npm run verify:release`; it fails outside Node 24.x or npm 11.x when run through npm.
- CI runs `npm run check:runtime` after dependency install so branch verification cannot silently drift away from Node 24.
- `npm run check:edge:functions` is the Deno type gate for the Supabase `indexing-v3-agent` Edge Function.
- `npm run check:document-label-coverage` is the live Supabase generated-label coverage gate. Run it after ingestion batches, document reclassification, or generated-label migrations; zero indexed documents may be missing generated `site` or `document_type` labels.
- Tune the full-browser CI cadence if release branches or weekly schedules prove too slow or too sparse.
- Add explicit review ownership for clinical source governance, outdated-source handling, incident review, and decommission decisions.
- Record production-readiness outcomes in release notes whenever clinical workflow, source governance, privacy, or deployment assumptions change.

## Text formatting and copy conventions

- **Document-derived text must never be rendered raw.** Any value pulled from an ingested document — answer prose, exact quotes, source snippets, document titles, image captions, extracted table text — must be routed through a `source-text-sanitizer` (`src/lib/source-text-sanitizer.ts`) or `display-text` (`src/components/clinical-dashboard/display-text.ts`) helper before it reaches JSX. Verbatim quotes use `sourceTextForVerbatimQuote`; titles use `cleanDisplayTitle`; snippets/captions use `sourceTextForCompactDisplay`.
- `normalizeExtractedGlyphs` is the shared, lossless glyph-repair primitive (ligatures, soft hyphens, zero-width/control chars). It is wired into the base `compactWhitespace`/`readableWhitespace` cleaners and into ingestion (`buildChunks`), so every formatter and newly-indexed chunk inherits it. It must never strip clinical meaning (numbers, units, dose strings, comparison symbols, hyphens, or legitimate bullet structure). It deliberately does **not** rejoin line-break hyphenation — a soft-wrap hyphen is indistinguishable from a real compound hyphen (`low-dose`, `twice-daily`), so fusing would corrupt clinical compounds and verbatim quotes.
- `tests/rendered-text-formatting.test.ts` is a static guard that fails if a known content surface reintroduces a raw interpolation. Extend it when adding new document-derived render surfaces.
- **Static UI copy** (headings, empty states, error/toast messages, placeholders, starter prompts) lives in `src/lib/ui-copy.ts`, alongside `app-modes.ts` (mode labels) and `source-metadata.ts` (status labels). Do not hardcode new visible chrome copy inline.
- `scripts/backfill-text-normalization.ts` cleans already-stored `document_chunks` text in place using the same primitive. It is dry-run by default, requires `--write --confirm` to mutate, writes a revertible JSON backup first, and **never re-embeds** — existing vectors are frozen, so retrieval is unchanged by construction.

## Known limits

- Chromium UI coverage is active in CI on all branches; Firefox and WebKit run in the gated release-browser CI job and remain available locally through `npm run test:e2e` and `npm run verify:release`.
- The new accessibility media smoke verifies usability and layout in reduced-motion and forced-colors modes; it is not a full WCAG audit.
- The format gate intentionally ignores `.tmp-visual/` and `scratch/`; those folders are local investigation output, not release source.
- Process scripts do not commit, push, deploy, mutate Supabase data, or run dependency updates.
- `npm run check:indexing` includes local OCR prerequisites (`fitz`/PyMuPDF, `pytesseract`, and the Tesseract binary). A failure at that prerequisite step is local machine setup debt, not evidence that indexed production data or search behavior regressed.
- Supabase performance-advisor `unused_index` INFO items are monitored, not automatically fixed. Do not remove search/RAG support indexes until live query evidence, local explain/verification, and rollback planning show the index is safe to drop.
