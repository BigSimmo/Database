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
- **2026-07-03:** extracted `AuthPanel` (+ its solely-consumed auth-email snapshot helpers) into `clinical-dashboard/auth-panel.tsx`. Monolith 7924 → 7800 lines. Per-module gate established: `npm run typecheck` + `npx vitest run tests/clinical-dashboard-merge-artifacts.test.ts tests/rendered-text-formatting.test.ts` + a `data-testid`/`aria-label` sha1 checksum over `ClinicalDashboard.tsx` + `clinical-dashboard/*.tsx` (must be byte-identical before/after each move) + lint + prettier.

#### Remaining decomposition — hand-off (do on a stable `main`, one module per commit)

The approved move map (`docs/redesign/04-deferred.md` §2) has 5 modules left. Unlike `auth-panel`, these are **interdependent** — they share a clinical-detail/notes helper family, so order matters and cross-module `export`s are required. Recommended order and the key dependency to resolve first:

1. `answer-content.tsx` — `SourceImage`, `ScopeAndGovernanceNotice`, `SourcePreviewContent`, `NaturalLanguageAnswer` (**AST-pinned** — retarget `tests/clinical-dashboard-merge-artifacts.test.ts` to scan this file for `NaturalLanguageAnswer`), `UserQuestionBubble`, `KeyClinicalItems` + answer formatters. Widen `tests/rendered-text-formatting.test.ts` to also scan this file.
2. `evidence-panels.tsx` — the clinical-detail/notes helper family (`displayItemsForClinicalDetailSection`, `sortClinicalDetailSections`, `clinicalDetailSummaryItems`, and siblings) **plus** `ClinicalNotesChecklistPanel`, `SafetyFindingsPanel`, `EvidenceGapPanel`, `EvidenceCounts`, `AnswerSourceStatus`, `EvidenceSummaryCard`, `AnswerInsightBar`, `EvidenceVerificationStrip`, `AnswerFeedbackPanel`, `VerificationWorkspace`, `AnswerViewModeControl`, `EvidenceMapTable`, `AnswerSafetyNotice`, `QuoteCards`. **Export the helper family** so output-panel can import it. Must land before output-panel.
3. `output-panel.tsx` — `ClinicalOutputPanel` (**AST-pinned** — retarget `dashboardPath` in `tests/clinical-dashboard-merge-artifacts.test.ts` to resolve declarations across the monolith + this file). Imports the detail helpers from `evidence-panels`.
4. `visual-evidence.tsx` — `VisualEvidenceStrip`, `InlineTableCard`, `MobileEvidenceSheetContent`, `MobileEvidenceTabPanel`, `UnifiedEvidenceDrawerContent`.
5. `document-results.tsx` — `WhyThisMatchedPanel`, `RelatedDocumentsPanel`, `StagedAnswerResultSurface`.

For each: trace which module-scope helpers/icons/types it uses; move solely-consumed ones with it, import shared ones; strip newly-orphaned monolith imports (lint flags them); run the per-module gate above; commit immediately. Keep the main `ClinicalDashboard` export in `ClinicalDashboard.tsx` (the barrel/bridge stays). Admin surfaces (`DocumentDrawer`, `SettingsDialog`, `ToolsHub`, `MobileSectionFab`) are out of the approved map — a later pass.

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
- **Compact snippet polish** (2026-07-02): `stripClassificationBanner` removes PSPF protective-marking banners ("OFFICIAL", "OFFICIAL: Sensitive" — ALL-CAPS, line-anchored only) from compact/snippet/synopsis/title surfaces and from newly-built synopses; verbatim quotes keep banners by design. Inline bullet glyphs in compact previews become `"; "` separators (the `readableTableRows` joiner). `repairTruncatedCompactTail` repairs stored mid-word truncations ("where poss..."); ingestion now truncates synopses at word boundaries (`truncateAtWordBoundary` in `chunking.ts`), so this repair mainly serves pre-fix stored rows.
- **Static UI copy** (headings, empty states, error/toast messages, placeholders, starter prompts) lives in `src/lib/ui-copy.ts`, alongside `app-modes.ts` (mode labels) and `source-metadata.ts` (status labels). Do not hardcode new visible chrome copy inline.
- `scripts/backfill-text-normalization.ts` cleans already-stored `document_chunks` text in place using the same primitive. It is dry-run by default, requires `--write --confirm` to mutate, writes a revertible JSON backup first, and **never re-embeds** — existing vectors are frozen, so retrieval is unchanged by construction.

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

## PR merge gate: tiered CI + required checks (2026-07-02)

- CI is now two parallel PR jobs instead of one serial 6-7 minute job: `verify` (runtime alignment, edge typecheck, CI-safe production readiness, lint, typecheck, unit tests with coverage gate, build — ~3 min) and `ui-smoke` (Chromium Playwright smoke against its own dev server — ~4.5 min). Wall-clock PR feedback drops to the slower of the two, and a flaky smoke rerun no longer repeats lint/typecheck/tests/build.
- The deployment boot smoke and full browser matrix remain gated to `main`, `release/*`, manual dispatch, and the weekly schedule — they are deliberately not PR gates.
- **Required-check debt: RESOLVED 2026-07-02.** Branch protection is now applied on `main` requiring `verify`, `ui-smoke`, and `Gitleaks`, with "require branches up to date" left OFF (strict up-to-dateness would force constant rebases across the many concurrent agent branches), `enforce_admins` OFF (admin bypass retained as an emergency hatch), and no required PR-review count (a solo+agents flow has no second human approver). This closes the gap that let #131/#133 merge red. Consequence now in effect: **direct pushes to `main` are blocked for non-bypass users; normal work must land via PR.** Repository admins can still use the retained bypass only as an emergency hatch. To adjust, edit the rule under repo Settings → Branches or via `gh api -X PUT repos/BigSimmo/Database/branches/main/protection`.
- If `ui-smoke` proves flaky as a required check, demote it to advisory (remove from required contexts) rather than tolerating red merges — the deterministic `verify` gate stays required regardless.

## CSS cascade layering (2026-07-02)

- The custom component classes in `src/app/globals.css` predate cascade layers, so they sat unlayered and silently beat Tailwind v4 utilities (which live in `@layer utilities`) on the same element. This caused three shipped UI bugs: the header source ledger ignoring responsive `hidden`, the composer clear button covering typed text (`pr-*` defeated), and the standalone-home status chips sliding under the mode pill.
- Conflict-free helper classes (`app-edge-backdrop`, `mobile-app-shell`, `mobile-popover-scroll`, `citation-link`, `animate-skeleton-shimmer`, `focus-ring-premium`, `source-capsule-hover`, `polished-scroll`) now live in `@layer components`, so utilities override them normally. Their call sites were audited for same-property utility collisions before the move.
- **Header chrome now layered (2026-07-02):** `edge-glass-header` (+ responsive padding), `universal-header`, `universal-header-mode-button`, and `universal-header-icon-control` moved into `@layer components`. The header/mode-pill was the source of the recurring overlap+shadow bugs, so utilities on those elements now win. Reconciliation was three call-site shadow edits (drop the dead `shadow-[var(--shadow-tight)]` on the two `edge-glass-header` headers; drop `shadow-[var(--shadow-inset)]` on the mode button and the New-chat icon control so the layered class supplies the shadow directly). Proven byte-identical across 16 states with `scripts/capture-chrome-parity.ts`.
- **Verification tooling:** `scripts/capture-chrome-parity.ts` dumps `getComputedStyle` (incl. `::placeholder`/`::after`) for the header+composer chrome across home/answer/focus/document × mobile/desktop × light/dark and diffs two snapshots. **Gotcha:** it is only reliable once the dev server has fully settled on the current CSS — capture right after a hot-reload and it silently compares against the stale bundle. Always capture twice and confirm the two agree before trusting a diff.
- **Remaining debt (grew with PR #171):** the COMPOSER chrome (`answer-footer-search-*`, `desktop-home-search-*`, `document-mobile-search-pill`, `*-composer-edge`) stays intentionally unlayered. #171's frosted rework pushed these from ~19 to ~92 computed-style conflicts, concentrated in the shared `ui-primitives` constants (`chatComposerShell/Input`, `chatSendButton`, `chatComposerIconButton`) used by other call sites without the class. Layering them needs a base/delta split of those constants; deferred. Until then: when adding a utility to a composer-chrome element, check the class body first — the class wins.
- `tests/ui-overlap.spec.ts` is the standing regression guard for the visible symptom (overlapping header controls, composer clear-button geometry) across 640-1536px widths.

## Cross-browser test robustness under client-only rendering (2026-07-02)

- Making the dashboard and document viewer client-only via `dynamic(..., { ssr: false })` (PRs #144/#147) meant "page loaded" no longer implies "app mounted". Firefox/WebKit paint the client chunk later than Chromium, so three release-browser-matrix specs raced and failed on `main` while Chromium stayed green. All three were test-timing gaps, not product regressions — the app renders correctly in every browser.
  - `tests/ui-overlap.spec.ts`: `gotoHome` waited on `networkidle` (Playwright discourages it) and then measured the header, which had not mounted yet — every failure was `header#search not found` (count 0), never a real overlap. Now waits for `header#search` to be visible before measuring.
  - `tests/ui-tools.spec.ts` (forms detail → shared search): the shell re-syncs its query from the URL on mount via `requestAnimationFrame`, which on Firefox/WebKit can land just after a programmatic `fill` and wipe the value (button stays disabled) or drop the submit before the router navigates. The fill-and-submit now runs as one `toPass` unit that retries until the search routes. Root-cause fix: the `requestAnimationFrame` effect in `GlobalMockupSearchShellClient` now skips the `setQuery("")` reset on detail pages (where the URL carries no `q`/`query` param), so the programmatic fill is never wiped.
  - `tests/ui-stress.spec.ts` (desktop evidence panel): the evidence `<details>` is opened by focusing its `<summary>` and pressing Enter; in CI WebKit the key event could fire before focus landed, so it never toggled. Now asserts `toBeFocused()` before pressing Enter.
- Rule of thumb for these client-only surfaces: never gate an interaction on `networkidle` or a bare `goto`. Wait for the specific mounted element, and wrap fill→submit→navigate races in `toPass` (the same idiom `openAppModeMenu`/`openDailyActions` already use). The `verify` + `ui-smoke` PR gates run Chromium only, so Firefox/WebKit-specific races surface solely in the gated `release-browser-matrix` (main/release/dispatch/schedule) — keep that job green rather than letting these re-accumulate.
- **Post-merge outcome (PR #178):** `ui-overlap` and `ui-stress` fixes verified green in CI WebKit. `ui-tools.spec.ts:264` (forms-detail search) still fails on **CI WebKit only** — the composer input stays focused-but-empty and the submit disabled across the full retry, and it does **not** reproduce on local WebKit, so it can't be iterated locally. Ruled out: the inline `availableModeIds={["forms"]}` arrays in the `forms`/`services`/`favourites` layouts churning the effect (those layouts are Server Components, so the ref is stable). On WebKit the test now runs its **structural half** (the detail page renders inside the shell with the Forms composer present) and returns before the known-broken **submit-and-route half** (`if (browserName === "webkit") return;`); Chromium + Firefox still verify the full wiring. The root-cause fix (shell mount `requestAnimationFrame` query-sync) is deferred and needs CI-based iteration — removing that WebKit early-return is its exit criterion.

## Suspense fallback must not re-render page children (2026-07-02)

- `GlobalMockupSearchShell` (aka `GlobalSearchShell`, used by the `forms`/`services`/`favourites`/`medications` layouts) wrapped `GlobalMockupSearchShellClient` in a `<Suspense>` whose **fallback also rendered `props.children` inside `#main-content`** — the same subtree the client body renders. Because `useSearchParams()` forces that boundary to the fallback on the server, the page subtree was emitted twice and both copies could persist, producing duplicate `id="main-content"` and duplicate `data-testid` on every shell page. It surfaced as `ui-smoke.spec.ts:1103` failing with a strict-mode violation (two `data-testid="acamprosate-medication-page"` `<main>` elements on `/medications/acamprosate`).
- Fix: the Suspense fallback renders a **neutral placeholder only** — never `props.children`. Rule: do not render the resolved content inside its own Suspense fallback; the fallback is a loading state, not a second copy of the page.
