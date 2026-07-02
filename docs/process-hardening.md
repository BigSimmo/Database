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

## Known limits

- Chromium UI coverage is active in CI on all branches; Firefox and WebKit run in the gated release-browser CI job and remain available locally through `npm run test:e2e` and `npm run verify:release`.
- The new accessibility media smoke verifies usability and layout in reduced-motion and forced-colors modes; it is not a full WCAG audit.
- The format gate intentionally ignores `.tmp-visual/` and `scratch/`; those folders are local investigation output, not release source.
- Process scripts do not commit, push, deploy, mutate Supabase data, or run dependency updates.
- `npm run check:indexing` includes local OCR prerequisites (`fitz`/PyMuPDF, `pytesseract`, and the Tesseract binary). A failure at that prerequisite step is local machine setup debt, not evidence that indexed production data or search behavior regressed.
- Supabase performance-advisor `unused_index` INFO items are monitored, not automatically fixed. Do not remove search/RAG support indexes until live query evidence, local explain/verification, and rollback planning show the index is safe to drop.

## Retrieval RPC drift & indexing hygiene (2026-07-01)

- The four app-path hybrid retrieval RPCs (`match_document_chunks_hybrid`, `match_document_embedding_fields_hybrid`, `match_document_index_units_hybrid`, `match_document_memory_cards_hybrid` + its `_v2` core) had live-only performance fixes applied via raw SQL that were never captured in migrations, so a `supabase db reset` / branch DB reproduced the slow pre-fix shapes. Migration `20260701140631_codify_live_retrieval_rpcs` codifies the live definitions (validated byte-equivalent to live via whitespace-stripped `pg_get_functiondef` md5 before applying — a confirmed no-op on live), and `supabase/schema.sql` was reconciled to match. A clean replay now reproduces production retrieval.
- **Rule: never change a retrieval RPC (or any function) on the live project with raw `execute_sql`.** Go through a committed migration plus a `supabase/schema.sql` update. Raw-SQL edits are exactly how this drift accumulated.
- `search_schema_health()` runs an execution smoke (invokes each hybrid RPC with a zero vector) that surfaces through `npm run check:indexing`; it fails if an RPC regresses to an error state (e.g. the historical `42702` ambiguous-id break). This is the standing guard against the original bug class.
- **Migration `20260702014803_drop_legacy_vector_indexes` (applied 2026-07-02 with explicit user approval)** reclaimed ~4.4 GB of dead/duplicate vector indexes (embedding_fields ivfflat 3.66 GB @ 8 scans, chunks ivfflat 610 MB, index_units HNSW 640 MB @ 0 scans, plus dead btrees). Verified post-apply: all targets gone, `detect_legacy_ivfflat_indexes()` empty, DB 13 GB -> 8.6 GB, `search_schema_health()` ok. The documented follow-ups are done: `supabase/schema.sql` now declares the live-kept embedding-fields indexes (`owner_id_idx`, `source_chunk_id_idx`, `search_tsv_chunk_gin_idx`, `owner_document_created_idx`, `meta_rag_indexing_version_idx`) instead of the dropped ones, no longer creates the index_units HNSW index, and `tests/supabase-schema.test.ts` asserts the new shape. There is intentionally no HNSW index on `document_index_units.embedding` — re-add only if that RPC gains a vector-first candidate path.
- **`search_schema_health()` two-lineage divergence: RESOLVED** by `20260702021604_reconcile_search_schema_health_superset` (applied live 2026-07-02, verified `ok:true`). The single definition now carries the comprehensive signature checks (incl. `match_document_memory_cards_hybrid_v2`), the full 22-entry required-index list (post-drop: no index_units HNSW, memory_cards HNSW added; every entry verified present live before shipping), the legacy-ivfflat report, AND the hybrid-RPC execution smoke. schema.sql matches exactly (the migration is extracted from it).
- **Known follow-up debts (documented, not actioned):**
  - Live migration history has duplicate-version churn (two each of `api_rate_limits`, `audit_logs`, `rag_queries_retention`, `audit_logs_service_role_policy`, `indexing_reliability_recovery`) from the same raw-apply habit. Do not rewrite history; treat as a caution for future applies.
  - Auth server is capped at 10 absolute DB connections (Supabase advisor); switch to percentage-based allocation in the dashboard before scaling instance size (not settable via SQL/MCP).
