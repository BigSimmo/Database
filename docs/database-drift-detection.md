# Database drift detection (`npm run check:drift`)

Last updated: 2026-07-10

This repo's worst operational incidents were live-vs-repo schema drift: hybrid
retrieval RPCs silently broken on live for an unknown period, and migrations
recorded as applied whose objects were absent. `search_schema_health()` guards
a curated subset (signatures, 22 required indexes, execution smoke).
`check:drift` generalizes that into a full-inventory comparison of **every**
application-owned object against `supabase/schema.sql`.

## How it works

Three committed artifacts:

| Artifact                                                       | Role                                                                                                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260706200000_schema_drift_snapshot.sql` | `public.schema_drift_snapshot()` — service-role-only RPC returning the normalized live inventory (also declared in `supabase/schema.sql`; a test enforces byte parity).                                                                     |
| `supabase/drift-manifest.json`                                 | The expected state: the same snapshot captured from a **from-scratch replay of `supabase/schema.sql`** into a disposable `supabase/postgres` Docker container (`npm run drift:manifest`). Embeds the sha256 of the schema.sql it came from. |
| `supabase/drift-allowlist.json`                                | Known, documented divergence (each entry has a `reason`). Reported as warnings; anything not listed fails the check.                                                                                                                        |

`npm run check:drift` (needs live service-role env) verifies the project ref,
fails fast if the manifest is stale, calls the RPC, diffs, applies the
allowlist, and exits 1 on unallowlisted divergence. The offline half runs in
`tests/drift-detection.test.ts` under `verify:cheap`: manifest freshness
(sha256), migration↔schema.sql parity for the snapshot function, allowlist
hygiene, and unit tests of the comparison engine.

Inventory coverage: functions (comment/whitespace-stripped `pg_get_functiondef`
md5 + sorted ACLs), indexes (normalized `pg_get_indexdef`), RLS policies
(permissive/roles/cmd/qual/with_check), table shapes (columns sorted by name,
RLS flags, reloptions, ACLs), constraints, triggers, views, extensions, and
storage bucket rows + storage.objects policies.

### Noise sources handled by design

- **Whitespace/comments in function bodies** — `prosrc` is stored verbatim, so
  migration text vs schema.sql text differ trivially; both are stripped before
  hashing (the same trick `20260701140631` used to validate byte-equivalence).
- **Rendering search_path** — the snapshot pins `search_path = ''` so
  `pg_get_expr`/`pg_get_indexdef`/policy quals render fully qualified and
  identically on live and replay.
- **Column ordinal drift** — live tables grew via `ALTER TABLE ADD COLUMN`;
  columns compare sorted by name, not `attnum`.
- **ACL append order** — aclitem arrays are sorted.
- **Duplicate migration-history versions** — history is _not_ compared at all;
  the check compares actual object state (history presence proved unreliable:
  see `20260703030000` below).
- **Platform-provisioned extensions** (pg_net, pgsodium, pgmq, …) — extra live
  extensions are informational; missing schema.sql-declared ones fail.
- **Legacy index names** — `alias` allowlist entries assert the live database
  carries the _identical_ name-stripped index definition under a legacy name
  (the machine-checked version of `search_schema_health()`'s `index_aliases`).

### Workflow

- Change `supabase/schema.sql` → run `npm run drift:manifest` (Docker) in the
  same PR. The freshness test fails otherwise. This also continuously proves
  schema.sql replays from scratch — which it did **not** before 2026-07-07
  (`document_index_units` was declared after its first validating reference).
- Live drifts (check:drift red) → either codify live state (migration +
  schema.sql + manifest regen) or fix live **through an approved migration**.
  Never raw SQL against live; that is how this incident class started.
- New known-divergence → allowlist entry with a reason and a backlog line here.
- After the pending-migration backlog lands, delete the matching allowlist
  entries; check:drift reports stale entries so they cannot silently linger.

## 2026-07-07 baseline audit (three-way: live vs schema.sql vs migration chain)

Both repo lineages were replayed into scratch containers and compared with the
live inventory. 166 divergent keys, fully classified:

- **Reconciled in this PR (schema.sql/migrations only, live untouched):**
  replay-order fix; `20260707000000_codify_live_observed_drift.sql` codifying
  15 live-only columns (`document_images` ×7, `document_index_quality` ×6,
  `ingestion_job_stages` ×2 — worker-written, branch DBs broke without them),
  3 `content_not_blank` NOT VALID checks, autovacuum reloptions on 5 RAG
  tables, `content_hash` nullability alignment, 4 live-only functions
  (`set_owner_id_from_auth_uid` + rag_queries/misses triggers,
  `purge_expired_rag_queries`, `correct_clinical_query_terms`,
  `invoke_ingestion_worker`) and 2 ACL tightenings; schema.sql function/policy
  text realigned to the migration-chain truth for `analyze_rag_tables`,
  `claim_indexing_v3_agent_jobs`, `is_committed_artifact_generation(uuid,jsonb)`,
  `match_document_memory_cards_hybrid`, and 6 owner-read policies (operand
  order only).
- **Allowlisted (124 entries)** — see `supabase/drift-allowlist.json`; backlog
  below.

## Reconciliation backlog

Ordered; each item removes allowlist entries when it lands. Items touching the
live project need explicit operator approval.

> **2026-07-08 update:** the safe pending migrations were **applied to live**
> (`20260706010000`, `20260706130000`, `20260706200000`, `20260707000000`, and
> `20260708000000` re-applying `20260703030000`'s storage-index effects — items 1
> and 2 below are DONE, verified byte-faithful + site retrieval green).
> `20260705210000` was **NOT applied and was neutralized** — the investigation
> found live had diverged _forward_ from its retrieval bodies (item 0, new).
> Live is under active concurrent multi-session editing, so the allowlist is a
> point-in-time snapshot needing periodic regeneration.
>
> **2026-07-10 update:** local `check:drift` surfaced five repo-ahead live debts
> for the July 8 hardening batch: fail-closed `retrieval_owner_matches`, R17's
> one-open-ingestion-job index, and R5's document metadata deep-merge helpers /
> `commit_document_index_generation` body. These are now allowlisted as known
> pending live-apply work. Applying them to live remains an explicit
> operator-approved migration action.

0. **NEW — forward-codify the live-ahead retrieval RPCs** (was the "apply
   20260705210000" item, inverted). **Staged runbook:
   `docs/forward-codify-retrieval-rpcs-workorder.md`** — the read-only capture
   query (`scripts/sql/capture-live-retrieval-rpcs.sql`), the fill-in-the-blanks
   migration skeleton, the byte-faithful validation, and the allowlist cleanup;
   a guard test (`tests/forward-codify-retrieval-targets.test.ts`) keeps the
   capture query and this allowlist in lockstep. The capture + apply steps still
   need a quiescent live DB and operator approval. Live carries newer raw-SQL retrieval bodies
   than the repo: `match_document_chunks` (hnsw.ef_search=100 plpgsql wrapper),
   `match_document_chunks_text` / `match_document_table_facts_text` (richer
   multi-strategy), `match_document_chunks_hybrid` (left-join quality_score),
   plus `match_documents_for_query`, `get_related_document_metadata`,
   `match_document_memory_cards_hybrid`, `repair_strict_enrichment_gate_batch`.
   Applying the OLD `20260705210000` bodies would regress live, so it is
   neutralized. Codify the **live** bodies into schema.sql + a new migration (a
   generation script, not hand-editing — the bodies are complex and actively
   churning) so the repo matches live and a `db push` never regresses it. These
   are the currently-allowlisted retrieval entries.
   - **Partially reconciled 2026-07-08:** `retrieval_owner_matches` was in this
     group by mistake — its **body is identical** to schema.sql; it only drifted
     on `search_path` (live `pg_catalog` vs repo `pg_temp`) and ACL. The
     search_path half is now codified into schema.sql + the manifest `def_hash`
     (verified read-only against live via `schema_drift_snapshot`); only the
     PUBLIC-execute ACL remains allowlisted, same as `search_document_chunks`.
1. ✅ **DONE 2026-07-08** — applied `20260706010000`, `20260706130000`,
   `20260706200000`, `20260707000000` to live (verified). `check:drift` can now
   run against live once a service-role key is available in the environment.
2. ✅ **DONE 2026-07-08** — `20260703030000`'s effects (recorded-but-absent on
   live) re-applied via `20260708000000_reapply_storage_cleanup_jobs_indexes`;
   live storage_cleanup_jobs indexes now match schema.sql.
   2a. **Apply the remaining July 8 hardening batch to live**: run the approved
   migration workflow for `20260708160001_retrieval_owner_matches_fail_closed`,
   `20260708170000_ingestion_jobs_one_open_per_document`, and
   `20260708310000_r5_document_metadata_merge`. Remove the matching allowlist
   entries for `retrieval_owner_matches`, `ingestion_jobs_one_open_per_document_uidx`,
   `jsonb_merge_deep`, `apply_document_metadata_patch`, and
   `commit_document_index_generation` after `check:drift` verifies live parity.
3. **Codify the remaining live-only functions**: `get_visual_evidence_cards`,
   `repair_enrichment_quality_batch`, `run_all_visual_eval_cases`,
   `run_visual_eval_case` (same pattern as `20260707000000`).
4. **Authenticated-grant posture decision**: live revoked the authenticated
   Data API grants on 17 tables (fail-closed hardening; the owner-read RLS
   policies are currently dead on live) while schema.sql still declares them.
   Either codify the revokes (schema.sql + tests + migration) or restore the
   grants live.
5. **PUBLIC-execute revokes**: 4 security-invoker functions retain default
   PUBLIC execute on live (`detect_legacy_ivfflat_indexes`,
   `document_summary_text`, `search_document_chunks`,
   `set_document_embedding_field_content_hash`).
6. **`document_label_metadata` direction**: schema.sql is AHEAD (hidden-label
   filtering added without a migration). Ship the migration or revert.
7. **Index estate**: rename 10 legacy-named live indexes to schema.sql names;
   decide the 24 schema.sql-declared indexes absent on live (recreate vs
   remove — includes `documents_search_idx`, `document_chunks_anchor_idx`,
   `documents_owner_content_hash_unique_idx`); drop ~45 live-only duplicate
   indexes after `pg_stat_user_indexes` scan verification; reshape 3
   (`import_batches_status_created_idx`, `ingestion_jobs_document_status_idx`,
   `ingestion_jobs_status_next_run_idx`).
8. **Constraints**: ~~add `ingestion_job_stages_job_id_fkey` to live~~ —
   **reversed (R24e, 2026-07-08):** the FK was **removed from `schema.sql`**
   (migration `20260708140000`) instead of added to live. Live has ~253 orphan
   stage rows and 0 rows whose `job_id` resolves to an `ingestion_jobs` row, and
   the column holds `indexing_v3_agent_jobs` ids — so adding + VALIDATE-ing the
   FK would destroy stage-log history and break the edge agent (see
   `docs/ingestion-state-machine.md` R24e). Allowlist entry removed. Still open:
   align the `rag_visual_eval_*` document FK definitions.
9. **`invoke_ingestion_worker`** hardcodes the project URL — migrate to the
   GUC pattern (`20260702160000` precedent).
10. **Migration-chain fidelity** (affects Supabase Preview/branches, not
    live): 13 keys where the chain diverges from schema.sql — buckets are only
    created by schema.sql, `documents`/`ingestion_jobs` updated*at trigger
    variants, post-legacy-drop embedding-fields index set,
    `document_chunks_content_trgm_idx` shape, `rag_visual_eval*\*` shapes.
