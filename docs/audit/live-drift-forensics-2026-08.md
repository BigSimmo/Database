# Live-drift forensics — 2026-08

Evidence record for the phased database remediation plan and playbook. No hosted reads or mutations
were performed while creating this file. Add dated, source-linked evidence here as each approved
phase completes.

**Tracking anchor:** ledger `#316` — "Live DB is missing 21 repo-defined indexes and 10 retrieval
RPC bodies diverge; weekly live-drift has been red since 2026-07-26 with no routing". Update it via
`npm run issues:update` at the end of every phase; never hand-edit `docs/outstanding-issues.md`.

**Plan of record:** [`docs/database-remediation-plan.md`](../database-remediation-plan.md) and
[`docs/database-remediation-playbook.md`](../database-remediation-playbook.md). Read both before
adding to this file.

**How to use this file.** Every section below is deliberately empty until its phase runs inside an
approved hosted window. Record the decisive output — pasted lines, run IDs, dates — not a summary
and not an exit code. An empty section means the phase has not run; it never means the phase found
nothing. Leave a section empty rather than filling it from inference.

## Phase 0 — Enablement (repo-side, no hosted access)

_2026-08-14._ Drift-failure routing and the post-migration trigger landed in
`.github/workflows/live-drift.yml`: a failed run now creates or updates a single pinned issue
titled "Live drift check failing" (label `live-drift-failure`) carrying the captured finding lines
and the run URL, and the next green run comments the resolution and closes it. The workflow also
runs on pushes to `main` touching `supabase/migrations/**` or `supabase/schema.sql`. Schedule,
`workflow_dispatch`, the secret preflight, and `concurrency.cancel-in-progress: false` were kept
unchanged. No hosted Supabase call was made.

_2026-08-14, forced-dispatch proof (owner-authorized)._ `live-drift` dispatched on `main`
(Actions run `31813064485`). The definition-of-done behaviour was observed end-to-end:

- `live-drift` job **failed** at `Compare live schema drift`, as intended for this proof.
- `Capture drift and migration-history findings` still ran (`if: always()`), and
  `Align migration history for Supabase Preview` correctly **skipped** after the failing step.
- The separate `drift-routing` job then ran (`if: ${{ !cancelled() }}`) and **succeeded**,
  creating issue **#1963 "Live drift check failing"** with label `live-drift-failure`, the run
  URL, `Job result: failure`, `Trigger: workflow_dispatch`, and the full findings block.

That run also supersedes the stale 2026-08-09 figures this file was opened with. Measured
2026-08-14, `UNEXPECTED DRIFT (32)`:

| Category                                 | 2026-08-09 | 2026-08-14         |
| ---------------------------------------- | ---------- | ------------------ |
| `match_*` function `def_hash` mismatches | 10         | **10 — unchanged** |
| `missing_live` indexes                   | 21         | **20**             |
| `unexpected_live` indexes                | 2          | **2 — unchanged**  |

`documents_title_trgm_idx` and `document_chunks_content_trgm_idx` are absent from the missing
list, independently corroborating the Phase 4 restoration below (verified separately by
read-only query against `sjrfecxgysukkwxsowpy`: both `indisvalid`/`indisready`, 648 kB and
68 MB). The 10 RPC mismatches are untouched, so **Phase 3 remains entirely outstanding** and is
the next step per the plan's ordering.

Routing is also covered offline by `tests/live-drift-workflow.test.ts` (mutation-verified), so a
future regression fails a test rather than waiting for a live failure to be mishandled.

Outstanding for the operator: add `SUPABASE_ACCESS_TOKEN` to environment secrets per plan step
0.3 and ledger `#183` (dashboard work; names only, never values).

## Phase 1 — Read-only forensics

_Partially run 2026-08-14 in an owner-authorized incident window, then extended the same day in a
read-only connector session. **1.2 was completed 2026-08-18** in a second read-only connector
session (all ten RPC mismatches classified — see the dated block in §1.2). The remaining index
sizing (§1.3) and the dashboard audit-history pairing (§1.1) remain pending._

### 1.1 Migration-history fingerprint

_2026-08-14 (owner-authorized Supabase connector session, incident-driven partial run)._
Full `schema_migrations` fingerprint captured. Decisive rows:

- `20260705180000 reconcile_search_health_indexes` — `no_statements = false`, **stmt_count 14**.
  It does **not** carry the mark-applied signal: its DDL was recorded as executed.
- `20260804110240 restore_rag_search_health_indexes` (the guard) — applied with its statement on
  2026-08-04. Note (per PR #1960 review): that guard validates four **other** indexes and never
  checks this pair, so its application gives **no** existence bound for
  `documents_title_trgm_idx` / `document_chunks_content_trgm_idx`.
- Rows with the mark-applied signal (`statements IS NULL` or empty): the 2026-07-01…07-02 cluster
  (`fix_chunks_hybrid_perf_and_ambiguity`, `fix_remaining_hybrid_perf_and_ambiguity`,
  `schema_health_hybrid_execution_smoke`, `drop_dead_drifted_hybrid_variants`,
  `clinical_query_term_trgm_correction`, `commit_generation_preserve_legacy_artifacts`,
  `add_claim_ingestion_jobs_comment`, `drop_redundant_indexes`, `rag_retrieval_logs_retention`,
  `storage_cleanup_jobs_document_fk`, `fix_reset_document_index_duplicate`,
  `documents_owner_covering_index`, `fix_invoke_agent_url_to_guc`,
  `promote_index_generation_id_columns`) and the 2026-07-12 reconciliation batch
  (`reconcile_ingestion_index_shapes` … `add_legacy_index_health_batch_repair`, stmt_count 0).

**Conclusion for the two retrieval-critical indexes:** their creation was recorded as executed on
2026-07-05 (`20260705180000`, 14 statements), and both were reported missing by the live-drift
runs of 2026-08-02 (Actions 30763871562) and 2026-08-09 (31330856982), with the weekly check red
since 2026-07-26 — so the drop happened **between 2026-07-05 and 2026-08-02** (likely by
2026-07-26). No app/worker/edge-function code issues `DROP INDEX` (repo grep, this session), so a
manual/dashboard action — e.g. an accepted "unused index" advisor suggestion — is the leading
**inference, not an established attribution**; pairing with the dashboard audit/query history for
that window remains **pending** (owner action). `#248` stays open.

### 1.2 RPC divergence dossier

One entry per mismatched `match_*` function, each classified **live-ahead**, **repo-ahead**,
**normalization noise**, or **UNCLASSIFIED**, quoting the decisive diff hunk. Protected RAG
surface: an ambiguous diff is recorded as UNCLASSIFIED and escalated, never guessed.

_2026-08-14 (owner-authorized read-only connector session) — enumeration and noise-separation
complete; per-function diff hunks still pending._

All 93 `public` functions were compared by the manifest's own rule (`pg_get_functiondef`, block
and line comments stripped, whitespace stripped, md5) against `supabase/drift-manifest.json`.
Result: **0 missing on live, 0 extra on live, 16 hash mismatches** — every one a `match_document_*`
retrieval RPC.

**Six of the sixteen are normalization noise and are now closed.** A live session renders
`regprocedure` and body types unqualified (`vector`), while the manifest was generated where they
render schema-qualified (`extensions.vector`). Re-qualifying `vector` → `extensions.vector` before
hashing reproduces the manifest hash **exactly** for these six, so their bodies are byte-identical
to the repo:

| Function                                                           | Classification      | Evidence                                                             |
| ------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------- |
| `match_document_chunks(vector,integer,double precision,uuid,uuid)` | normalization noise | re-qualified hash `cdf9d685c98bc8ff731a0422c29a47a4` = manifest hash |
| `match_document_chunks_v2(vector,…,boolean)`                       | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_chunks_hybrid_v2(vector,…,boolean)`                | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_embedding_fields_hybrid_v2(vector,…,boolean)`      | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_index_units_hybrid_scoped(vector,…,boolean)`       | normalization noise | re-qualified hash matches manifest                                   |
| `match_document_memory_cards_hybrid_v3(vector,…,boolean)`          | normalization noise | re-qualified hash matches manifest                                   |

**The remaining ten are unresolved hash mismatches and are UNCLASSIFIED.** They do not match the
manifest under the raw hash, the `extensions.`-stripped hash, or the re-qualified hash. That rules
out the tested `extensions.vector` rendering variants, but does not establish a body difference:
`pg_get_functiondef` also carries declarations and attributes, and other normalization differences
remain possible. Per the rule above they are recorded UNCLASSIFIED rather than guessed — deciding
whether there is a body difference, and then live-ahead vs repo-ahead, needs the decisive hunk:

`match_document_chunks_text`, `match_document_chunks_text_v2`, `match_document_chunks_hybrid`,
`match_document_embedding_fields_hybrid`, `match_document_index_units_hybrid`,
`match_document_index_units_hybrid_v2`, `match_document_lookup_chunks_text`,
`match_document_memory_cards_hybrid`, `match_document_memory_cards_hybrid_v2`,
`match_document_table_facts_text`.

This confirms ten unresolved retrieval-RPC hash mismatches after excluding the six proven
qualification artefacts. It does **not** yet confirm that ten RPC bodies diverge.

**Method trap, recorded so the next run does not repeat it.** Joining manifest signatures to live
`p.oid::regprocedure::text` directly reports **all 93** functions as simultaneously missing _and_
extra, because the manifest stores `public.fn(extensions.vector,…)` and the live session renders
`fn(vector,…)`. That is a join failure, not a finding. Normalize both sides (strip the `public.`
prefix, fold `extensions.vector` → `vector`) before comparing, then test each surviving mismatch
against the qualification variants before calling it divergence.

#### 1.2 completion — 2026-08-18 (owner-authorized read-only connector session)

**Session note.** Supabase MCP connector, `list_projects` verified the target before the first
query: `sjrfecxgysukkwxsowpy` = `Clinical KB Database` (ACTIVE_HEALTHY, Postgres 17.6.1.127).
Every `execute_sql` call passed that ref literally; the sibling `Clinical KB Staging`
(`ikoiolksxqxfxgiyqpnu`) was never targeted. Session role `postgres`. Four statements were run,
all `SELECT` (one preceded by `set local search_path to ''` inside the same implicit transaction);
**no INSERT/UPDATE/DELETE/DDL**. Captured 2026-08-17 16:28–16:29 UTC and 2026-08-18 04:07 UTC.
Open-PR check (`#292`) before starting: no open PR touched this section, `supabase/migrations/**`,
`schema.sql`, or `src/lib/rag/**`. No RPC, migration, or `src/lib/rag/**` file was edited.

**Result in one line: all ten are classified. Every one of the ten is an attribute-only difference —
the live definition carries a `SET work_mem TO '…'` clause that the manifest's source
(`supabase/schema.sql`) does not — and stripping exactly that one line from the live definition
reproduces the manifest `def_hash` byte-for-byte for all ten.** Bodies, signatures, return shapes,
volatility, `search_path`/`plan_cache_mode` clauses and ACLs are identical to the repo. Zero of
the ten is a body divergence; zero is repo-ahead; none remains UNCLASSIFIED.

**Normalization rule used (quoted, not assumed).** The manifest is produced by
`scripts/generate-drift-manifest.ts` (lines 185–192): it replays `supabase/schema.sql` into a
scratch Supabase Postgres container and calls `public.schema_drift_snapshot()`; there is no
JS-side normalization, so **manifest = `schema.sql` mirror, hashed by the same SQL rule that hashes
live**. That rule is `supabase/migrations/20260706200000_schema_drift_snapshot.sql:89` (the only
migration that defines the function; it runs `security definer set search_path to ''`):

```sql
md5(regexp_replace(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '/\*.*?\*/', '', 'gs'), '--[^\n]*', '', 'g'), '\s+', '', 'g'))
```

It strips block comments, `--` line comments and all whitespace, and nothing else — `SET`
attributes rendered by `pg_get_functiondef` **are** hashed. `check:drift` compares functions on
`def_hash` and `acl` (`scripts/check-drift.ts:68`); ACLs were equal for all ten
(`{postgres=X/postgres, service_role=X/postgres}` on both sides).

**Repo-side facts that make the hypothesis testable.** `grep -n work_mem supabase/schema.sql`
returns **zero** hits. `supabase/migrations/20260724000000_optimize_rpc_work_mem.sql` is the only
migration mentioning `work_mem`; it runs `ALTER FUNCTION … SET work_mem = '64MB'` on exactly eight
of the ten (all except `match_document_chunks_text_v2` and `match_document_index_units_hybrid_v2`).

**Query 1 — live hashes as the drift check computes them** (16:28:35 UTC), so the comparison uses
the RPC's own pinned rendering rather than a session's:

```sql
select f->>'signature', f->>'def_hash', f->'acl'
from jsonb_array_elements(public.schema_drift_snapshot()->'functions') f
where f->>'signature' like 'public.match_document%' order by 1;
```

The ten live hashes equal, line for line, the `live=` values in issue #1963's 2026-08-17 findings
block (e.g. `match_document_chunks_text` `d135c628720cb8a4d86c2ade4cd3b26a`).

**Query 2 — the one query for all ten** (16:29:04 UTC): `set local search_path to '';` then a
`SELECT` of `p.oid::regprocedure::text`, `p.proconfig`, `exists(… c like 'work_mem=%')`,
`exists(… c like 'plan_cache_mode=%')`, the normalization expression above applied to
`pg_get_functiondef(p.oid)` as `raw_hash`, and `pg_get_functiondef(p.oid)` itself, from
`pg_catalog.pg_proc` where `pronamespace = 'public'::regnamespace` and `proname in (<the ten>)`.
Acceptance check before trusting any variant: `raw_hash` equalled Query 1's live `def_hash` for
**all ten**, proving the fetched text is exactly the text the drift RPC hashed.

**Query 3 — hash variants over the same text**, computed in SQL with the identical expression (so
Postgres ARE semantics decide, not a JS re-implementation): as-is; minus the `SET work_mem TO
'…'` line; minus `SET plan_cache_mode …`; minus both; with `work_mem` rewritten to `'64MB'`; with a
`plan_cache_mode` line added. Outcome: `no_workmem_match = true` for **10/10**; `asis`, `no_pcm`
and `add_pcm` matched for 0/10. (`no_workmem_no_pcm` also matched for the six that carry no
`plan_cache_mode`, which is the same fact.) The `work_mem → '64MB'` variant reproduces the live
hash for the six whose live value is already 64MB and a third, different hash for the four at
128MB — i.e. those four are not "the repo's 64MB rendered differently".

**Query 4 — migration history** (04:07 UTC) for the interacting versions, plus any row whose
recorded statements mention `work_mem`:

| version          | name                                     | `no_statements` | `stmt_count` | statements mentioning `work_mem` |
| ---------------- | ---------------------------------------- | --------------- | -----------: | -------------------------------: |
| `20260701140631` | `codify_live_retrieval_rpcs`             | false           |            1 |                                0 |
| `20260711120000` | `retrieval_fn_plan_cache_mode`           | false           |            4 |                                0 |
| `20260713020000` | `owner_plus_public_retrieval`            | false           |           37 |                                0 |
| `20260714110000` | `promote_documents_index_generation_id`  | false           |           17 |                                0 |
| `20260717160000` | `optimize_owner_public_retrieval`        | false           |           12 |                                0 |
| `20260717162000` | `bound_versioned_retrieval_match_count`  | false           |            6 |                                0 |
| `20260724000000` | `optimize_rpc_work_mem`                  | false           |            9 |                            **8** |
| `20260724120000` | `table_facts_plpgsql_execute`            | false           |            3 |                                0 |
| `20260724130000` | `explicit_base_match_rpc_execute_grants` | false           |            1 |                                0 |

`20260724000000` is the **only** recorded migration touching `work_mem`, and it records eight
`64MB` statements — so no recorded history produces a `128MB` value, a `work_mem` on either `_v2`,
or a `work_mem` on `match_document_table_facts_text` after `20260724120000` re-created it (a
`CREATE OR REPLACE FUNCTION` replaces the whole config-item set; a clean replay of the recorded
chain leaves that function without `work_mem`). Live `proconfig` order on `table_facts_text` is
`[search_path, plan_cache_mode, work_mem]` — the recreate's two clauses followed by an appended
`ALTER … SET work_mem` — which is direct evidence that `work_mem` was re-applied to it **after**
`20260724120000`, outside recorded history.

**Per-function table.** "Repo chain" = what a clean replay of `supabase/migrations/**` produces;
"mirror" = `supabase/schema.sql` (the manifest source). Manifest/live hashes are those of Query 1
and `supabase/drift-manifest.json` (`generated_at 2026-08-16T14:37:41Z`); "hash outcome" is the
Query 3 variant that reproduced the manifest hash exactly.

| Function (live signature, `search_path ''` rendering)                                                       | Live `SET work_mem` | Live `plan_cache_mode` | Repo chain `work_mem`                         | Mirror `work_mem` | Hash outcome                                                         | Classification                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------- | --------------------------------------------- | ----------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `match_document_chunks_text(text,integer,uuid[],uuid)`                                                      | yes — `64MB`        | no                     | `64MB` (20260724000000)                       | none              | strip `SET work_mem` → `0e662039807813b400e685d7307d7929` = manifest | **mirror-stale, attribute-only** (live = repo chain; `schema.sql` omits the clause)                                                 |
| `match_document_lookup_chunks_text(text,uuid[],integer,uuid)`                                               | yes — `64MB`        | no                     | `64MB` (20260724000000)                       | none              | strip → `989281557ff4877f8eae5c9a32a3ef8c` = manifest                | **mirror-stale, attribute-only**                                                                                                    |
| `match_document_memory_cards_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)`           | yes — `64MB`        | yes                    | `64MB` (20260724000000)                       | none              | strip → `1a937f133f5cb6e6d59a5b00311ec685` = manifest                | **mirror-stale, attribute-only**                                                                                                    |
| `match_document_memory_cards_hybrid_v2(extensions.vector,text,integer,double precision,uuid[],uuid)`        | yes — `64MB`        | no                     | `64MB` (20260724000000)                       | none              | strip → `0534ad140950e83128b3434caa5ffd32` = manifest                | **mirror-stale, attribute-only**                                                                                                    |
| `match_document_table_facts_text(text,integer,uuid[],uuid)`                                                 | yes — `64MB`        | yes                    | **none** (dropped by 20260724120000 recreate) | none              | strip → `f68e03ca96f8403d171509a59a769682` = manifest                | **live-ahead, attribute-only** (`64MB` re-applied live after the recreate; matches 20260724000000's intent, not the replayed chain) |
| `match_document_chunks_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)`                 | yes — **`128MB`**   | no                     | `64MB` (20260724000000)                       | none              | strip → `b5dfaa5e0d6b27ad0c7cfc89711953cb` = manifest                | **live-ahead, attribute-only** (value raised live; no recorded migration sets 128MB)                                                |
| `match_document_embedding_fields_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)`       | yes — **`128MB`**   | yes                    | `64MB` (20260724000000)                       | none              | strip → `a2d97503e95af88097557029e0ea7836` = manifest                | **live-ahead, attribute-only**                                                                                                      |
| `match_document_index_units_hybrid(extensions.vector,text,integer,double precision,uuid[],uuid)`            | yes — **`128MB`**   | yes                    | `64MB` (20260724000000)                       | none              | strip → `2e8810a1ec9927aba7c1f04fd18287d1` = manifest                | **live-ahead, attribute-only**                                                                                                      |
| `match_document_chunks_text_v2(text,integer,uuid[],uuid,boolean)`                                           | yes — `64MB`        | no                     | **none**                                      | none              | strip → `3d99483e01a5c93374408b9e585d3962` = manifest                | **live-ahead, attribute-only** (no migration ever set it)                                                                           |
| `match_document_index_units_hybrid_v2(extensions.vector,text,integer,double precision,uuid[],uuid,boolean)` | yes — **`128MB`**   | no                     | **none**                                      | none              | strip → `b72c524f3be13ec1a950cc30e922ec78` = manifest                | **live-ahead, attribute-only** (no migration ever set it)                                                                           |

**Decisive hunk (identical shape for all ten; shown for the two `_v2` outliers the hypothesis did
not cover).** Live `pg_get_functiondef` vs the repo's canonical body — for both `_v2`s the newest
migration carrying an actual `create or replace function … as $$ … $$` body is
`20260717162000_bound_versioned_retrieval_match_count.sql` (not the newer files that merely mention
them), and `schema.sql:7761` / `:7943` carry the same body — differs only in the header:

```diff
 CREATE OR REPLACE FUNCTION public.match_document_chunks_text_v2(query_text text, match_count integer DEFAULT 12, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, include_public boolean DEFAULT true)
  RETURNS TABLE(id uuid, document_id uuid, title text, … lexical_score double precision, images jsonb)
  LANGUAGE sql
  STABLE
  SET search_path TO 'public', 'extensions', 'pg_temp'
+ SET work_mem TO '64MB'
 AS $function$
   select *
   from public.match_document_chunks_text_scoped($1, least(greatest(coalesce($2, 12), 1), 96), $3, $4, $5);
 $function$
```

```diff
 CREATE OR REPLACE FUNCTION public.match_document_index_units_hybrid_v2(query_embedding extensions.vector, query_text text, match_count integer DEFAULT 24, min_similarity double precision DEFAULT 0.1, document_filters uuid[] DEFAULT NULL::uuid[], owner_filter uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid, include_public boolean DEFAULT true)
  RETURNS TABLE(id uuid, document_id uuid, … hybrid_score double precision, metadata jsonb)
  LANGUAGE sql
  STABLE
  SET search_path TO 'public', 'extensions', 'pg_temp'
+ SET work_mem TO '128MB'
 AS $function$
   select *
   from public.match_document_index_units_hybrid_scoped($1, $2, least(greatest(coalesce($3, 24), 1), 96), $4, $5, $6, $7);
 $function$
```

For the eight hypothesis functions the hunk is the same single `+ SET work_mem TO '64MB'` /
`'128MB'` line under the existing `SET search_path` (and, where present, `SET plan_cache_mode`)
clauses; the `$function$ … $function$` bodies are unchanged. The Query 3 exact-hash reproduction is
the proof that nothing else differs — a body edit anywhere would have broken it.

**What this means for Phase 3 (owner decisions flagged, not asserted).**

- **Zero repo-ahead entries.** No live function is behind the repo. So the plan's repo-ahead rule
  (eval-canary pair around a deploy) has **no** trigger from this dossier.
- **Four mirror-stale entries** (`chunks_text`, `lookup_chunks_text`, `memory_cards_hybrid`,
  `memory_cards_hybrid_v2`): live already equals the recorded migration chain. Remedy is entirely
  repo-side — add the `SET work_mem = '64MB'` clause to their `schema.sql` definitions and regenerate
  `drift-manifest.json` (`npm run drift:manifest`, Docker). **No hosted change.** Phase 3 may
  execute these now.
- **Six live-ahead, attribute-only entries** (`table_facts_text` 64MB; `chunks_hybrid`,
  `embedding_fields_hybrid`, `index_units_hybrid`, `index_units_hybrid_v2` 128MB; `chunks_text_v2`
  64MB): the live value has no recorded migration. The plan's live-ahead remedy — codify the live
  attribute in a new migration (`ALTER FUNCTION … SET work_mem = '<live value>'`, ordered after
  every recreate of that function) plus the `schema.sql` mirror, PR body `RAG impact: no retrieval
behaviour change — codifying already-live attribute` — needs **no hosted change** either, because
  the migration would be marked applied against a state that already matches. Phase 3 may execute
  these once the owner confirms the live values are the intended ones. **Owner decision:** keep
  128MB on the four (codify as-is), or standardise to the recorded 64MB (that direction _is_ a
  hosted change and should carry at least a before/after latency measurement).
- **Canary exemption — flagged, not asserted.** `work_mem` is a planner/executor memory setting; it
  changes which plan runs (hash vs sort, spill vs in-memory) and therefore latency, not the SQL
  result set. The result set is fully determined by each RPC's `ORDER BY … LIMIT`, so answer
  content and ranking are unaffected **except** that rows with exactly equal sort keys can surface
  in a different order under a different plan. The recommendation is that codify-as-live (no hosted
  change) proceeds without an eval-canary, and that any hosted change of a live value is treated
  as latency-only but confirmed by the Phase 5 `EXPLAIN` re-run rather than an eval dispatch. This
  exemption is the owner's to grant.
- **Nothing remains escalated as UNCLASSIFIED from 1.2.** The residual open question is
  provenance, not classification: who set 128MB / the `_v2` values and when. That pairs with the
  §1.1 dashboard audit-history action already owed to the owner.

**Playbook correction (recorded here; the playbook itself was not edited).** The trap list says
`20260724120000_table_facts_plpgsql_execute.sql` contains zero `create or replace function`. It
contains one, at line 9, and it is the newest canonical body for `match_document_table_facts_text`
— which is exactly why that function's `work_mem` was reset on a clean replay. The trap's lesson
(the newest _mention_ is often not the definition) still stands for `20260724130000`.

**Method note for the next reader.** Rendering matters twice: `regprocedure` and `format_type`
qualify `extensions.vector` only when the session `search_path` excludes `extensions`, and
`schema_drift_snapshot()` pins `search_path` to `''`. Prefixing the fetch with
`set local search_path to ''` in the same implicit transaction (multi-statement `execute_sql`)
made the fetched text hash-identical to the RPC's own output on the first attempt; verify that
equality before trusting any derived variant.

### 1.3 Index inventory, sizing, and EXPLAIN baselines

_2026-08-14 (partial — retrieval-critical scope only)._ Live inventory of the ten
`20260705180000` indexes: **exactly two missing** — `documents_title_trgm_idx` and
`document_chunks_content_trgm_idx`; the other eight present (labels/summaries trgm, table-facts,
index-units, pages, sections, both `rag_retrieval_logs` indexes). Owning tables at repair time:
`document_chunks` 1562 MB / 70,120 live rows; `documents` 18 MB / 3,301 rows.

Before-measurements came from live production probes rather than raw EXPLAIN (the incident was
end-to-end visible): `/api/search` semantic query 2026-08-14 → total 37.7 s,
`supabase_rpc_latency_ms` **31,610**; a second semantic probe 29.9 s / 21,757. The remaining
missing-index sizing and the `rag_retrieval_logs` miss-scan baseline are **pending**.

**Whole-schema inventory — 2026-08-14, after the repair above (owner-authorized read-only
connector session).** The scope above is the ten `20260705180000` indexes; this is the full
`public` schema, and it is **additive to the incident, not a restatement of it**. Both repaired
indexes (`documents_title_trgm_idx`, `document_chunks_content_trgm_idx`) are confirmed **present**
on live now.

|                           Side |  Count | Source                                                                      |
| -----------------------------: | -----: | --------------------------------------------------------------------------- |
|                   Repo-defined |    210 | `supabase/drift-manifest.json` `snapshot.indexes`                           |
|                           Live |    192 | `pg_indexes`, schema `public`                                               |
|           **Absent from live** | **20** | full outer join by name                                                     |
| Orphaned on live (not in repo) |      2 | `document_table_facts_document_id_idx`, `storage_cleanup_jobs_owner_id_idx` |

210 − 20 + 2 = 192, so neither side is a partial read. The 20 absent, retrieval-relevant ones
first:

`document_chunks_anchor_idx`, `document_index_units_heading_path_idx`, `rag_aliases_type_enabled_idx`,
`rag_queries_source_chunk_ids_gin_idx`, `rag_query_misses_aliases_idx`,
`documents_registry_projection_lookup_idx`, `document_images_structured_profile_gin_idx`,
`image_caption_cache_owner_hash_idx`, `api_rate_limits_bucket_updated_idx`,
`audit_logs_action_created_idx`, `audit_logs_owner_created_idx`, `document_images_hash_idx`,
`document_images_visual_intelligence_version_idx`, `document_index_quality_owner_score_idx`,
`document_publication_approvals_document_idx`, `document_summaries_owner_idx`,
`indexing_v3_agent_jobs_locked_at_idx`, `ingestion_job_stages_job_stage_started_idx`,
`medication_records_owner_category_idx`, `storage_cleanup_jobs_owner_status_idx`.

**None is invalid-but-present.** `pg_index` filtered on `indisvalid = false or indisready = false`
returns **zero rows** across the whole `public` schema, so the failed-`CREATE INDEX CONCURRENTLY`
class documented in `docs/database-drift-detection.md` explains none of the 20. The objects are
absent, not broken.

**Five covered creating migrations recorded executed DDL.** Extending the §1.1 fingerprint to the
four further migrations in this sampled set found that none carries the mark-applied signal:

| Migration                                              | `stmt_count` | Mark-applied? |
| ------------------------------------------------------ | -----------: | ------------- |
| `20260528007000 database_hardening_before_import`      |           32 | no            |
| `20260608001000 index_accuracy_usability_improvements` |           36 | no            |
| `20260705180000 reconcile_search_health_indexes`       |           14 | no (per §1.1) |
| `20260712165211 reconcile_missing_operational_indexes` |           27 | no            |
| `20260717170000 registry_projection_cleanup`           |           11 | no            |

This establishes recorded-executed-but-absent evidence across five migrations from 2026-05-28 to
2026-07-17, including one named `reconcile_missing_operational_indexes`; it does **not** cover the
creating migrations for `document_publication_approvals_document_idx`,
`indexing_v3_agent_jobs_locked_at_idx`, or `medication_records_owner_category_idx`. Fingerprint
those histories before classifying those three absences as created-then-dropped. **Root cause
remains unestablished** — §1.1's manual/dashboard-drop inference is the leading hypothesis and the
dashboard audit-history pairing is still the owner action that would confirm or refute it. This
inventory widens what that pairing has to explain; it does not by itself attribute anything.

## Phase 2 — Staging parity rehearsal

_Not yet run. Requires an approved staging window; production stays read-only._

_Pending._ Migration-replay tail, any migration that misbehaved on clean replay (a finding in its
own right), and the green `check:drift` output against staging.

## Phase 3 — RPC reconciliation

_Not yet run. Requires an approved production window, plus a separate canary approval per
repo-ahead RPC._

_Pending._ Per-RPC outcome against the Phase 1.2 classification, the migration that codified each
live-ahead body, and eval-canary evidence (36/36, recall 1.0, zero per-case rr regressions) for any
behaviour-changing deploy.

## Phase 4 — Index restoration

_2026-08-14 (partial, incident-driven: the two retrieval-critical indexes only, owner-approved
"i authorise" in-session)._ Executed via the owner-authorized Supabase connector:

- `create index concurrently if not exists documents_title_trgm_idx …` — definition verbatim from
  `20260705180000`. Result: `indisvalid = true`, `indisready = true`, 648 kB.
- `create index concurrently if not exists document_chunks_content_trgm_idx …` — same source.
  Result: `indisvalid = true`, `indisready = true`, 68 MB.
- `ANALYZE public.documents; ANALYZE public.document_chunks;` after both builds.
- Canonical-shape validation (per PR #1960 review — `IF NOT EXISTS` could otherwise no-op on a
  same-named index; here the prior inventory proved both absent, and post-build `pg_indexes`
  returns the canonical normalized definitions verbatim):
  `CREATE INDEX document_chunks_content_trgm_idx ON public.document_chunks USING gin (lower(((COALESCE(section_heading, ''::text) || ' '::text) || COALESCE(content, ''::text))) gin_trgm_ops)` and
  `CREATE INDEX documents_title_trgm_idx ON public.documents USING gin (lower(((COALESCE(title, ''::text) || ' '::text) || COALESCE(file_name, ''::text))) gin_trgm_ops)` —
  both matching `20260705180000` / `schema.sql`.

Deviation from the phase template, recorded honestly: no PITR restore point was captured first —
the operation was additive index creation with a one-statement rollback
(`drop index concurrently`), no data-loss surface. No migration was added in the incident window:
the definitions are already codified in `20260705180000` + `schema.sql`, and this was the
documented operator prebuild for a drifted hosted target. **Outstanding phase debt (PR #1960
review):** plan phase 4.4 still requires a fail-fast reconcile/guard migration for this repaired
pair (the `20260804110240` pattern names four other indexes only), so a later replay cannot
silently proceed if either index disappears again — queued as follow-up work for the full Phase 4
batch, deliberately not bundled into this docs-only PR because migrations are an operational-risk
surface with their own replay gates. The other 19 drift findings, the 2 unexpected live indexes,
and the green live-drift dispatch also remain **pending** for the full phase.

## Phase 5 — Measure and close the loop

_Partially run 2026-08-14 (incident scope); full close-out still requires the remaining phases._

_2026-08-14 (partial)._ Before/after production probes (identical endpoint and query style):

| Measurement                                                         | Before               | After restore + ANALYZE |
| ------------------------------------------------------------------- | -------------------- | ----------------------- |
| Semantic query, text fast path — total / `supabase_rpc_latency_ms`  | 37.7 s / 31,610      | 4.8 s / **1,535**       |
| Semantic query, hybrid strategy — total / `supabase_rpc_latency_ms` | 29.9 s / 21,757      | 17.2 s / 8,519          |
| `match_document_chunks_text_v2` single call                         | (dominated the 31 s) | 14 ms                   |

**#231 verdict from this evidence:** the 25 s fast-route budget was being consumed by retrieval
itself while the two trigram indexes were missing — pre-generation latency was the binding cause
of semantic-query source-only fallbacks in this window (README §A1 ladder rung 2, now measured).
The A1/S1 packet must re-verify `generation_quality_gate:*` dominance on healthy latency before
choosing any code mitigation. Residual: hybrid fan-out still costs ~8.5 s worst-observed — owned
by the remaining remediation phases, not a route-budget change (`#231`'s stop condition stands).
`check:production-readiness` on the final state is **pending**.

## Phase 6 — Future-proofing (repo-side; one migration authored, NOT deployed)

_2026-08-18 (repo-only session; no hosted read or mutation)._ Built per plan §6.1–6.3, worker chat
without a ledger row (residual queued via `npm run issues:add`, not on `#316`):

- **6.1 History-integrity probe.** `20260818090000_schema_drift_snapshot_history_probe.sql` redefines
  `public.schema_drift_snapshot()` (v2) to also return `migration_history` — every
  `supabase_migrations.schema_migrations` version with `statements IS NULL` or empty — plus
  `migration_history_probe` (`ok` / `no_history_table` / `no_statements_column`). Mirrored into
  `schema.sql`; `drift-manifest.json` regenerated (Docker replay executed the new body: probe
  `no_history_table`, `snapshot_version` 2). `check:drift` reports each live row as
  `! [migration_history] no_statements <version>` unless a validated allowlist entry covers it.
  **Not deployed** — needs the owner-approved production migration window (approval map, Phase 6.1,
  after Phase 4). Until then the live run shows the `schema_drift_snapshot()` function `def_hash`
  mismatch (repo-ahead) and an info line naming the pending deploy.
- **6.2 Guard-migration contract.** Written into `docs/database-drift-detection.md` and `AGENTS.md`
  ("Supabase project safety"). Allowlist `migration_history` entries carry `guard {class, migration,
objects}`; classes `validation` (mandatory from 2026-08-18), `superseded`, `no_ddl`.
  `tests/migration-history-guards.test.ts` verifies each guard file really covers its objects. Seeded
  five §1.1 versions with repo-provable `superseded` guards (`20260701010000`, `20260701020000`,
  `20260701030000`, `20260701060000`, `20260702000000`); the remaining §1.1 rows and the 2026-07-12
  batch are deliberately **not** allowlisted and are the expected findings of the first post-deploy run.
- **6.3 Runtime coverage ratchet.** `tests/search-health-index-coverage.test.ts` +
  `supabase/search-health-unmonitored-indexes.json`: every repo-defined index on the six
  retrieval-critical tables is monitored or listed with reason + disposition. Failed with exactly 44
  names before the list existed; passes with 44 entries (8 `monitor-candidate`, including the three
  §1.3-absent indexes on those tables: `document_chunks_anchor_idx`,
  `document_index_units_heading_path_idx`, `documents_registry_projection_lookup_idx`).
