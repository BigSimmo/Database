# Handover — RAG scalability WIP review findings (2026-07-15)

**Status:** findings + remediation plan recorded; **fixes not yet applied**.  
**Review date:** 2026-07-15  
**Git state at review:** detached HEAD `570e6ba56ae60bea56a32801b9cc96c5a8dfde4f` (`feat(rag): ship D4/D5 governance levers…` / aligned with then-current main tip) plus uncommitted WIP listed below.  
**Ledger row:** `docs/branch-review-ledger.md` — scope `thorough multi-lens review: WIP RAG/schema + clinical design/UI + architecture/bug-hunt`.  
**Product context:** Clinical KB Next.js + Supabase; target project `Clinical KB Database` / `sjrfecxgysukkwxsowpy`. Provider-backed apply/eval requires explicit confirmation.

This file is the single handoff artifact for the next agent or engineer. It consolidates the multi-lens review (design-review, architecture, bug-hunter, code-review, clinical UI) and the remediation plan. Do **not** ship the WIP as-is.

---

## 1. Snapshot of the working tree (at review)

### Modified

| Path                               | Role in WIP                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `src/lib/rag-candidate-sources.ts` | New `ChunkLoadCache` + shared hydration caching                                                               |
| `src/lib/rag.ts`                   | Wires one `chunkLoadCache` into table-facts / embedding-field / index-unit paths                              |
| `src/lib/registry-corpus-links.ts` | Tightened `registryCorpusDetailHref` arg types                                                                |
| `supabase/schema.sql`              | Appended registry cleanup, `document_title_words`, corrector vocab source change, wide table-facts trgm index |
| `tests/supabase-schema.test.ts`    | Weak “identical” substring checks for new objects                                                             |
| `docs/branch-review-ledger.md`     | Review record appended (allowed during pure review)                                                           |

### Untracked (WIP)

| Path                                                                         | Notes                                                                                                         |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260714180000_patch_rag_and_corrector_scalability.sql` | Registry cascade delete + title-words table + corrector rewrite (incomplete scalability)                      |
| `supabase/migrations/20260714190000_document_table_facts_trgm_idx.sql`       | Wide GIN trgm index — **mismatched** to live `trgm_matches` predicate                                         |
| `pnpm-lock.yaml`                                                             | **Accidental** — repo is npm (`packageManager: npm@…`, committed `package-lock.json`). Delete; do not commit. |

### Environment caveats

- Many concurrent worktrees existed at review time; park this WIP on a **named feature branch** before committing.
- Stale `.next/types` `/applications` layout errors also appeared during typecheck; treat as separate from WIP registry typing failures (clear/regenerate `.next` if they persist after A1).

---

## 2. Verdict

| Severity | Count   | Bottom line                                                                                                              |
| -------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| P0       | 0       | No immediate data-loss / clinical-harm P0 confirmed                                                                      |
| P1       | 5       | Typecheck break; cache error poisoning; registry `::uuid` abort; unused corrector GIN; mismatched table-facts trgm index |
| P2       | several | Scope/race cache footguns; schema/migration/test drift; SECURITY DEFINER revoke gaps; design gradient density            |
| P3       | several | Accidental pnpm lock; mockup hex drift; optional pill/glow pass                                                          |

**Highest residual risk if shipped unchanged:** red typecheck + false-scalability migrations + registry delete brittleness + hydration cache coupling under transient DB errors.

---

## 3. Findings (complete catalog)

### P1 — must fix before merge

#### F1. `registryCorpusDetailHref` typing breaks callers

- **Where:** `src/lib/registry-corpus-links.ts` (params narrowed to `string` / `RegistryCorpusKind | string`).
- **Callers failing typecheck:**
  - `src/app/api/documents/[id]/signed-url/route.ts`
  - `src/components/clinical-dashboard/source-actions.tsx`
  - `src/lib/citations.ts`
  - `src/lib/universal-search.ts`
- **Trigger:** Pass `unknown` / nullable metadata fields into the helper.
- **Expected:** Runtime `typeof` guards accept loose metadata; types stay compatible.
- **Actual:** `npm run typecheck` fails (`Type 'unknown' is not assignable to type 'string'`).
- **Proof:** `npm run typecheck` (already red at review).
- **Fix:** Restore args to `unknown` (or `string | null | undefined`) and keep runtime guards. Prefer not changing every call site.

#### F2. `ChunkLoadCache` negative-caches failures across parallel hydrations

- **Where:** `src/lib/rag-candidate-sources.ts` (`loadChunksForSignalMatches`); wired in `src/lib/rag.ts` via shared `createChunkLoadCache()`.
- **Trigger:** `{ error }` or missing `data` on a batch fetch → empty `Map` → per-id promises resolve `null` and stick for the request.
- **Expected:** Transient failure degrades that path only; siblings can still hydrate overlapping ids.
- **Actual:** Shared cache poisons table-facts + embedding-field + index-unit for overlapping chunk/doc ids.
- **Proof:** Unit test with shared cache: first load mock `{ data: null, error }`; second healthy mock for same ids must still return chunks (today: `[]` from cache).
- **Fix:** Do not cache hard failures (leave keys unset or reject without caching). Optionally fail the batch loudly via existing RPC/hydration telemetry.

#### F3. Registry cleanup trigger: non-UUID `registry_record_id` aborts deletes

- **Where:**
  - Migration `20260714180000_…` lines ~8–12
  - `supabase/schema.sql` appended `cleanup_registry_corpus_document`
- **SQL hazard:** `(metadata->>'registry_record_id')::uuid = OLD.id`
- **Trigger:** Delete from `clinical_registry_records` / `medication_records` / `differential_records` while any `documents` row has `source_kind = 'registry_record'` and a non-UUID `registry_record_id`.
- **Expected:** Ignore malformed metadata (elsewhere the repo regex-guards UUID casts).
- **Actual:** Cast can throw → **entire registry DELETE transaction fails**. SECURITY DEFINER amplifies blast radius.
- **Proof:** SQL insert dummy doc with `registry_record_id: 'not-a-uuid'`, delete a registry row → expect cast exception today.
- **Fix:** Compare as text: `metadata->>'registry_record_id' = OLD.id::text`. Prefer also match `registry_record_kind` (or map via `TG_TABLE_NAME`). Revoke `EXECUTE` on helpers from `public`/`anon`/`authenticated`.

#### F4. Corrector “scalability” table/index unused by query path

- **Where:** Migration `20260714180000_…` — `document_title_words`, GIN `document_title_words_word_trgm_idx`, rewritten `correct_clinical_query_terms`.
- **Trigger / pattern:** Function still `array_agg(distinct term)` over aliases ∪ all title words, then per-token `similarity()` over `unnest(vocab)`.
- **Expected:** Hot path probes the GIN (`%` / similarity lookup) so cost scales with candidates, not full vocab.
- **Actual:** GIN never used; write amplification on every title sync with no planner win. Large corpora → corrector latency/timeouts → weaker lexical/retrieval paths.
- **Proof:** Read function body; no `word % tok` / indexed probe. Schema tests today pass with mere `toContain`.
- **Fix (preferred):** Per-token indexed probe against aliases + `document_title_words` (`LIMIT 1`, keep `min_sim` and length 4–40). Cap candidates. Verify with `EXPLAIN` only under confirmed live access later.
- **Alt:** Drop unused GIN (or table) until rewrite lands — do not ship dead “scalability” scaffolding.

#### F5. New table-facts trgm index does not match `trgm_matches`

- **Where:**
  - New: `20260714190000_document_table_facts_trgm_idx.sql` / `schema.sql` `document_table_facts_text_trgm_idx` (title + row + param + **threshold_value** + **action**)
  - Live predicate: `schema.sql` `trgm_matches` (~6236–6244) uses only title + row + clinical_parameter
  - Existing matching index: `document_table_facts_title_row_param_trgm_idx`
- **Expected:** GIN expression equals `%` / `similarity()` expression used by the RPC.
- **Actual:** Wide index is dead weight for current trgm path; dual overlapping GIN indexes raise ingest write cost. FTS already covers wider text via `search_tsv`.
- **Proof:** Diff index expression string vs `trgm_matches` expression (architecture agent correct; one conflicting note claimed alignment — **disproven** by schema lines above).
- **Fix (default):** Remove migration `…190000…` and schema index line; keep narrow index.
- **Alt:** Widen `trgm_matches` to the wide expression **and** drop the narrow index so only one remains. Add schema test for expression equality.

---

### P2 — should fix in same remediation wave

#### F6. Cache not keyed by access scope (latent authz)

- **Where:** `ChunkLoadCache` maps keyed only by id; contrast `rag-cache.ts` which uses `retrievalAccessScopeKey`.
- **Current call site:** One scope per `searchChunksWithTelemetry` — production path OK today.
- **Risk:** Reuse across public-only then owner+public → cached `null` deny, or inverse over-share within process.
- **Fix:** Bind scope at cache creation or include scope in keys; refuse mismatched scope. Test in `tests/retrieval-hydration-scope.test.ts`.

#### F7. Concurrent overlapping miss race

- **Where:** Parallel embedding-field + index-unit hydration both compute `missing*` before either finishes `cache.*.set`.
- **Risk:** Later writer overwrites in-flight promise; erroring batch can poison a successful first waiters’ result.
- **Fix:** Single in-flight promise per id (check-then-set before creating fetch); never overwrite a healthy promise with a failing one.

#### F8. Schema / migration / test drift

| Concern                                     | Migration `…180000…` | `schema.sql`                                       |
| ------------------------------------------- | -------------------- | -------------------------------------------------- |
| `DROP TRIGGER IF EXISTS` before create      | yes                  | **no**                                             |
| Backfill `INSERT INTO document_title_words` | yes                  | **no**                                             |
| Corrector body rewrite                      | yes                  | vocab source already updated; lifecycle incomplete |
| `…190000…` index                            | separate file        | present in schema                                  |
| New test “identically”                      | weak `toContain`     | misses drops, backfill, expression contracts       |

- **Risk:** Schema-only bootstrap → empty title vocab until document writes; trigger-already-exists on reapply; CI green on broken contracts.
- **Fix:** Mirror lifecycle in schema; strengthen `tests/supabase-schema.test.ts` (load both migrations; assert text UUID compare, revoke lines, corrector probe shape, index↔RPC equality for remaining trgm index).

#### F9. New SECURITY DEFINER helpers miss privilege hardening

- **Where:** `cleanup_registry_corpus_document`, `sync_document_title_words` created without `revoke execute … from public, anon, authenticated` (unlike `correct_clinical_query_terms`).
- **Fix:** Revoke execute; grant only if something other than triggers must call them (usually none).

#### F10. Title vocabulary is global under SECURITY DEFINER (tenancy product decision)

- **Where:** Corrector reads all `document_title_words` with no owner filter; sync indexes every indexed title.
- **Risk:** Private title tokens can bias corrections / existence side-channel for other users (pre-existing shape had similar full-title scan).
- **Fix options:** Public-only (`owner_id is null`) ± caller-owner filter passed like retrieval RPCs. **Needs product decision** (see §7).

#### F11. Favourites set accent gradient bars (design)

- **Where:** `src/components/clinical-dashboard/favourites-library-nav.tsx` — `setAccentBars` with purple→rose / multi-hue gradients.
- **Why it matters:** Conflicts with clinical “dense, calm, scan-fast” (design-review). Decorative vs semantic.
- **Fix:** Single clinical accent or discrete set-color tokens without marketing multi-hue bars. Preserve selected/hover/`focus-visible`.

---

### P3 — hygiene / optional

#### F12. Accidental `pnpm-lock.yaml`

- Delete untracked file; do not commit. Repo lockfile is `package-lock.json`.

#### F13. Mockup hardcoded hex / focus colors

- **Where:** `src/components/favourites-page-mockups/favourites-library-redesign-page.tsx` etc. (`#0e7490`, `#64748b`, …).
- Mockup routes under `/mockups/…`. Retokenize if long-lived; do not promote into production shell without tokens.

#### F14. Pill / glow density (optional design pass)

- Widespread `rounded-full` + soft glow is existing product chrome, not a defect. Separate intentional de-pill pass only if product wants it.
- **Non-goal:** Do **not** replace the clinical design system with the marketing `/10-experience-and-design-system` dark-cyan DTCG aesthetic.

#### F15. Broader architecture residual (out of this WIP’s minimal fix)

- `rag.ts` remains a large facade (~4.8k lines). Keep hydration/cache testable in `rag-candidate-sources`; avoid new re-exports that force everything through `rag.ts`.
- Process-global answer/search caches in `rag-cache.ts` are pre-existing scale/ops residual.

#### F16. Cross-table shared cleanup key (low probability)

- Same cleanup fn matches only `registry_record_id` across registry tables → theoretical UUID collision deletes wrong corpus doc. Mitigate with `registry_record_kind` filter (see F3).

---

## 4. What looked solid (do not regress)

- Intent of request-scoped dedupe for parallel signal hydrations is good (happy path).
- `document_title_words` RLS + service_role grants + sync-on-indexed status logic is coherent **once** the corrector actually queries the table.
- Existing narrow `document_table_facts_title_row_param_trgm_idx` correctly matches current `trgm_matches`.
- Ingestion ↛ importing `rag.ts` dependency direction is healthy — preserve it.
- Production clinical shell mostly uses `@theme` tokens, `focus-visible`, `prefers-reduced-motion`, and `forced-colors` in `src/app/globals.css`.

---

## 5. Remediation plan (ordered)

### Track A — correctness (same PR / branch)

1. **Branch hygiene:** From detached HEAD + WIP, create/checkout named branch e.g. `codex/rag-scalability-review-remediation`. Delete `pnpm-lock.yaml`.
2. **F1:** Restore loose types on `registryCorpusDetailHref`. Run `npm run typecheck`.
3. **F2/F6/F7:** Add failing hydration-cache tests (error poisoning, scope reuse, concurrent overlap). Fix cache: no negative-cache on error; scope-bound; single in-flight per id. Green tests.
4. **F3/F9/F16:** Rewrite cleanup SQL (text + kind), revoke execute; sync migration + `schema.sql`. Prefer **edit migration before apply**; if any env already applied WIP SQL, ship a **follow-up** migration instead of rewriting history.
5. **F4:** Rewrite `correct_clinical_query_terms` to indexed per-token probes **or** drop unused GIN/table until rewrite ready. Sync schema.
6. **F5:** Default — remove `…190000…` and wide index from schema; keep narrow index. (Alt — widen RPC and drop narrow.) Assert expression parity in tests.
7. **F8:** Align schema lifecycle (`DROP TRIGGER IF EXISTS`; document or include backfill policy). Strengthen schema tests beyond substrings.

### Track B — design (same PR optional, or follow-up)

8. **F11:** Quiet favourites gradient bars to clinical tokens.
9. **F13:** Optionally retokenize mockups.
10. **F14:** Explicitly defer pill/glow unless requested.

### Verification (local, no providers unless confirmed)

| Gate                                                              | When             |
| ----------------------------------------------------------------- | ---------------- |
| Focused Vitest: hydration cache + `tests/supabase-schema.test.ts` | After A2–A7      |
| `npm run typecheck`                                               | After A1         |
| `npm run verify:cheap` (or lint + unit subset)                    | Before handoff   |
| `git diff --check`                                                | Before commit    |
| `npm run ensure` + screenshots                                    | If Track B ships |
| Live Supabase apply / `check:drift` / OpenAI eval                 | **Ask first**    |

### Rollout notes

- Treat `…180000…` / `…190000…` as **unapplied** unless proven otherwise. Confirm with operator before any live mutation.
- After code + offline gates are green: commit on feature branch, open PR, run PR-local gate; live apply is a separate confirmation.

---

## 6. Suggested implementation ownership (files)

| Concern               | Primary files                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Cache                 | `src/lib/rag-candidate-sources.ts`, `src/lib/rag.ts`, `tests/retrieval-hydration-scope.test.ts` (or new focused test) |
| Registry links typing | `src/lib/registry-corpus-links.ts`                                                                                    |
| SQL patch             | `supabase/migrations/20260714180000_…`, possibly delete `…190000…`, `supabase/schema.sql`                             |
| Schema contracts      | `tests/supabase-schema.test.ts`                                                                                       |
| Favourites design     | `src/components/clinical-dashboard/favourites-library-nav.tsx`                                                        |
| Hygiene               | delete `pnpm-lock.yaml`                                                                                               |

---

## 7. Open questions (block product confidence)

1. **Title vocab tenancy:** Should `correct_clinical_query_terms` use **public titles only**, or **public + caller-owner**?
2. **Table-facts trgm:** **Drop** the wide index (recommended) or **widen** `trgm_matches` and drop the narrow one?
3. **PR packaging:** Ship Track B (favourites design) in the **same** PR as RAG/SQL, or a follow-up?
4. **Live apply status:** Has any environment already applied `20260714180000` / `20260714190000`? (Assumed **no** at review time.)
5. **Corpus scale:** Approx. indexed doc / title-word cardinality — needed to prioritize F4 rewrite urgency vs drop-index interim.

---

## 8. Checks already run (this review)

| Check                                                  | Result                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| Static diff / SQL / RPC expression tracing             | Done — findings above                                                |
| Architecture explore + bug-hunt agents                 | Done — synthesized here                                              |
| Clinical design / token / a11y greps                   | Done inline (`frontend-ui-reviewer` subagent blocked by usage limit) |
| `npm run typecheck`                                    | **Fail** — F1 (+ possible stale `.next` noise)                       |
| Vitest / `verify:*` / browser / live Supabase / OpenAI | **Not run**                                                          |

---

## 9. Next agent prompt (copy-paste)

```text
Read docs/rag-scalability-wip-review-handover-2026-07-15.md and remediate Track A
findings F1–F9 (and F5 by dropping the mismatched trgm index unless told otherwise).
Park WIP on a named feature branch. Delete pnpm-lock.yaml. Do not apply live Supabase
or call OpenAI without confirmation. Use TDD for ChunkLoadCache. Strengthen
tests/supabase-schema.test.ts. End with typecheck + focused Vitest + verify:cheap
(or state what was skipped). Track B (favourites gradients) only if time / same PR
requested. Ask before commit/push/PR.
```

---

## 10. Related docs

- `docs/codex-review-protocol.md` — severity / mutation / ledger rules
- `docs/branch-review-ledger.md` — this review’s ledger row
- `docs/design-system.md` / `docs/redesign/permanent-colour-direction.md` — clinical visual direction
- `docs/search-rag-master-context.md` — RAG orientation
- `AGENTS.md` — provider confirmation boundary, verify gates

---

_Authored as a pure handover artifact from the 2026-07-15 multi-lens review. No production mutations performed._
