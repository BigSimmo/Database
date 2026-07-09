# Operator apply — July 8 ingestion & tenancy batch

Consolidated runbook for migrations merged to `main` in PRs **#380**, **#405**,
**#408**, and **#409** that are **in the repo but not yet verified on live** as
of 2026-07-09. Companion to
[`docs/supabase-migration-reconciliation.md`](supabase-migration-reconciliation.md)
and [`docs/ingestion-concurrency-fix-workorder.md`](ingestion-concurrency-fix-workorder.md).

## Pre-flight

```bash
npx supabase migration list --linked
npm run supabase:recovery-status   # or npm run check:supabase-project
npm run reindex:health             # jobs_pending = 0 AND jobs_processing = 0 before R17
```

Do **not** redeploy the ingestion worker from current `main` until step 2 below
is live — `worker/main.ts` already passes `p_worker_id` to completion RPCs.

## Apply order

All steps below are safe through a single `supabase db push` when the ingestion
queue is quiet. R17 uses its **own migration version** (`20260708170000`, not
`20260708160000`) so history/repair cannot collide with the fail-closed tenancy
migration at `20260708160000`.

| Step | Migration                                                 | What                                         | How                                            |
| ---- | --------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| 1    | `20260708140000_drop_ingestion_job_stages_job_id_fk.sql`  | R24e — drop phantom FK from fresh-env schema | Normal `supabase db push` (no-op on live)      |
| 2    | `20260708130000_ingestion_concurrency_rpc_hardening.sql`  | R1/R2 lease fences, R7/R9/R23 RPC hardening  | Normal push — **apply before worker redeploy** |
| 3    | `20260708150000_ensure_retrieval_owner_matches.sql`       | Ensure helper exists before fail-closed      | Normal push                                    |
| 4    | `20260708160000_retrieval_owner_matches_fail_closed.sql`  | Tenancy fail-closed (#409)                   | Normal push                                    |
| 5    | `20260708310000_r5_document_metadata_merge.sql`           | R5 metadata deep-merge (#408)                | Normal push (safe before worker)               |
| 6    | `20260708170000_ingestion_jobs_one_open_per_document.sql` | R17 one-open-job index (#405)                | Normal push when queue quiet — see below       |

Reindex routes for R17 (409 on duplicate job) are already on `main`.

### R17 on a busy live queue (optional)

When `jobs_pending` / `jobs_processing` are non-zero, or you want a lock-free
build, apply the index manually **before** recording migration history:

```sql
create unique index concurrently if not exists ingestion_jobs_one_open_per_document_uidx
  on public.ingestion_jobs (document_id)
  where status in ('pending', 'processing');
```

Then mark only the R17 version as applied (never `20260708160000`):

```bash
supabase migration repair --linked --status applied 20260708170000
```

If the queue is quiet, skip the manual SQL — step 6 in the table applies the
transactional `CREATE UNIQUE INDEX` via `db push`.

## Post-apply verification

```bash
npm run check:july8-live-batch    # requires live keys — fails if absent
npm run check:drift
npm run check:indexing
npm run eval:retrieval:quality    # must stay 36/36 (retrieval-affecting: step 4 only)
```

Then redeploy the ingestion **worker** so R5 merge + `p_worker_id` fences are
active end-to-end.

## Probe semantics (`check:july8-live-batch`)

| Check                                    | Pass means                                                                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retrieval_owner_matches(null, …)`       | Returns **false** (fail-closed live)                                                                                                                                                     |
| `jsonb_merge_deep`                       | RPC exists and merges objects                                                                                                                                                            |
| `complete_ingestion_job` + `p_worker_id` | Accepts the lease-fence parameter (returns `ok:false`, not signature error)                                                                                                              |
| R17 index                                | Named in `schema_drift_snapshot` with the partial-unique definition on `ingestion_jobs(document_id)`, and a duplicate open-job insert is rejected (catches invalid `CONCURRENTLY` stubs) |

## Still open (not this batch)

- Forward-codify live-ahead retrieval RPC bodies (`docs/database-drift-detection.md` backlog #0)
- deep-memory delete scoping design (`docs/ingestion-concurrency-fix-workorder.md`)
- Staging soak (`docs/staging-setup.md`, `docs/capacity-review.md`)
- `registry:seed` per owner (`docs/process-hardening.md`)
