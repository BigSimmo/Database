# Supabase Migration Reconciliation

Last reviewed: 2026-07-07

Target project: Clinical KB Database (`sjrfecxgysukkwxsowpy`)

## Policy

- Do not use `supabase db push` while local and remote migration history are divergent.
- **Never change a retrieval RPC, index, or function on the live project with raw SQL in the dashboard.** Use a committed migration under `supabase/migrations/` and reconcile `supabase/schema.sql` in the same change.
- Use `supabase migration repair --linked --status applied <version>` only when live database evidence proves the migration effect already exists.
- Leave other local-only migrations unrepaired until their effects are verified or deliberately applied.
- Run `npx supabase migration list --linked` at apply/reconcile time; do not rely on a frozen “aligned through” snapshot in this doc alone.
- **History presence is not effect presence.** `20260703030000` is recorded as applied on live while its index changes are absent. After every apply, verify object state with `npm run check:drift` (and `search_schema_health()`), not the history table.
- Any PR that changes `supabase/schema.sql` regenerates `supabase/drift-manifest.json` in the same PR (`npm run drift:manifest`, Docker required); `tests/drift-detection.test.ts` fails otherwise. This doubles as a from-scratch replay proof of schema.sql.

## Expand/contract policy for retrieval tables

Applies to anything touching `documents`, `document_chunks`,
`document_embedding_fields`, `document_index_units`, `document_memory_cards`,
`document_table_facts`, embedding columns, or the RPCs that read them. Written
after the 2026-07-07 DR rehearsal
([disaster-recovery-runbook.md](disaster-recovery-runbook.md)), which showed
(a) live carried worker-written columns that existed in no repo lineage, so a
restored/branch database silently broke ingestion, and (b) a "recorded as
applied" migration whose effects never landed.

**Expand phase (additive, ships first):**

- New columns are `add column if not exists`, nullable or defaulted — the RAG
  tables have 69k–215k rows; a table rewrite (non-constant default, type
  change) needs an explicit lock/duration plan in the migration header.
- New/changed RPC behaviour ships as a side-by-side version
  (`match_document_memory_cards_hybrid_v2` precedent) with the old RPC left
  callable until the app is fully cut over; grants replicated explicitly
  (`revoke ... from public, anon, authenticated; grant ... to service_role`).
- New constraints on populated tables use `NOT VALID` now + `VALIDATE
CONSTRAINT` in a later migration (the live `*_content_not_blank` checks are
  the precedent).
- Index replacements create the new index first (on live, prefer
  `CONCURRENTLY` run manually outside the transaction — CLI migrations are
  transactional); the old index is NOT dropped in the same migration.
- Embedding columns: `vector(N)` is coupled to `EMBEDDING_DIMENSIONS` and the
  worker's startup check — a dimension change is a re-index project with the
  reindex-eval gate, never a plain migration.
- The same PR updates `supabase/schema.sql`, regenerates the drift manifest,
  and (for anything behaviour-adjacent) passes `npm run
eval:retrieval:quality` per the standing merge gate.

**Verify phase (between expand and contract):**

- Apply to live only through the linked workflow with explicit approval, then
  immediately run `npm run check:drift` — the applied objects must match the
  manifest (this is what catches recorded-but-ineffective applies).
- Run `search_schema_health()` / `npm run check:indexing` and the golden
  retrieval eval against live before relying on the new path.
- Dual-read/dual-write windows (old + new column/RPC) stay until the eval and
  telemetry confirm the new path.

**Contract phase (destructive, ships last and separately):**

- Drops (columns, old RPC versions, superseded indexes) go in their own
  migration, at least one release after expand, never bundled with it.
- Before contracting: a fresh backup/PITR point exists, `pg_stat_user_indexes`
  scan evidence for index drops (the `20260702014803` discipline), and
  check:drift green so the pre-contract state is fully accounted for.
- Rollback plan is written in the migration header (what to recreate, from
  where) — after contract, rollback means restore-from-backup for data-bearing
  drops, so say so explicitly.

## Verified Applied (through June 2026)

These previously local-only versions were verified in the live project history before the July 2026 reconciliation wave:

- `20260625033425` - `document_strict_gate_status` exists, `repair_strict_enrichment_gate_batch(integer)` exists, service role can read/execute, and anon cannot read/execute.
- `20260625033944` - `complete_strict_enrichment_job(uuid, uuid, text, text, text)` exists, service role can execute, and anon cannot execute.
- `20260626000000` - duplicate index `ingestion_job_stages_doc_idx` is absent and canonical index `ingestion_job_stages_document_started_idx` exists.
- `20260626020000` - retrieval RPC performance migration is present in remote history.
- `20260626030000` - document organisation profile label constraint migration is present in remote history.
- `20260627000000` - deliberately applied as a no-op deferral for retrieval HNSW `ef_search`; hosted migrations cannot set this function GUC for this project, and the live vector RPC bodies already use session-local `set_config('hnsw.ef_search', '100', true)` where relevant.
- `20260628000000` - atomic document index generation commit RPC and committed-generation retrieval filters are present and verified in live.
- `20260628135727` - explicit `invoke_indexing_v3_agent(integer)` execute grant hardening is present and verified in live.

## Current Status (July 2026)

Migration `20260705230000_reconcile_live_database_drift.sql` codifies live-only drift discovered 2026-07-05:

- `indexing_v3_agent_jobs` table and claim/update RPCs (recorded as applied in history but absent on live at inspection time)
- `match_document_embedding_fields_text` RPC with service-role-only execute grants (was present on live with anon/auth execute)
- `rag_visual_eval_cases` / `rag_visual_eval_runs` tables with service-role-only RLS (were present on live without RLS)

`supabase/schema.sql` has been reconciled to match. Apply the migration through the normal linked workflow when ready; do not use raw dashboard SQL for retrieval RPCs.

The repo also includes additional July 2026 migrations beyond the June checkpoint above, including:

- Retrieval RPC codification and hybrid execution smoke (`20260701140631`, related July 1 fixes)
- Legacy vector index drops and `search_schema_health()` reconciliation (`20260702014803`, `20260702021604`)
- Clinical registry tables (`20260703020000`)
- Storage cleanup index reconciliation prep (`20260703030000`, prepared but apply only with explicit approval)
- Indexing v3 agent job table and related hardening (`20260702190000` and neighbors)

Live-only drift, duplicate migration-version churn, and outstanding follow-up debts are tracked in the **Retrieval RPC drift & indexing hygiene** section of [`docs/process-hardening.md`](process-hardening.md). Treat that section as the operational supplement to this reconciliation doc.

**2026-07-07 full-inventory audit:** the standing drift check
([database-drift-detection.md](database-drift-detection.md)) measured live
against both repo lineages. Pending on live as of the audit: `20260705210000`
(owner-sentinel — 8 function bodies), `20260706010000` (M13 guard),
`20260706130000`, plus the new `20260706200000` (drift snapshot RPC) and
`20260707000000` (codification wave, no-op on live). `20260703030000` is
recorded in live history but its effects are absent — repair by re-applying
its statements under a new version, with approval. The complete reconciliation
backlog (index estate, grant posture, remaining live-only functions) lives in
the drift doc.

Before applying pending migrations to live:

1. Run `npx supabase migration list --linked` and confirm local vs remote alignment.
2. Run `npm run supabase:recovery-status` and confirm Supabase is healthy.
3. Apply only through the normal migration workflow; update `supabase/schema.sql` when the migration changes canonical schema shape.

## Supabase Preview / fresh replay rules

GitHub Supabase Preview replays the full migration chain on branch databases. Keep these invariants so preview stays green:

- When a set-returning function gains or loses an OUT column, `drop function ...` before `create or replace` (PostgreSQL SQLSTATE `42P13` otherwise).
- Do not assume `pg_cron` exists on preview branches; guard `cron.schedule` / `cron.job` access with `to_regnamespace('cron') is not null` inside a `DO` block (SQLSTATE `42P01` otherwise).
- Duplicate migration stems that already ran on live should be neutralized as documented no-ops rather than re-appplied.

Regression tests for these guards live in `tests/supabase-schema.test.ts` under "Supabase Preview replay guards".

## Verification Commands

```powershell
npx supabase migration list --linked
npx supabase db advisors --linked
npx supabase db query --linked "select to_regclass('public.document_strict_gate_status') as gate_view, to_regprocedure('public.repair_strict_enrichment_gate_batch(integer)') as repair_rpc, to_regprocedure('public.complete_strict_enrichment_job(uuid, uuid, text, text, text)') as complete_rpc, to_regclass('public.ingestion_job_stages_doc_idx') as duplicate_index, to_regclass('public.ingestion_job_stages_document_started_idx') as canonical_stage_index;"
npx supabase db query --linked "select to_regprocedure('public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb)') as commit_generation_rpc, has_function_privilege('anon', 'public.invoke_indexing_v3_agent(integer)', 'execute') as anon_can_invoke_indexing_v3_agent, has_function_privilege('service_role', 'public.invoke_indexing_v3_agent(integer)', 'execute') as service_role_can_invoke_indexing_v3_agent;"
npm run check:indexing
```

## Operator follow-ups

Manual key rotation and live migration apply decisions are recorded in
[`docs/archive/operator-decisions-2026-07-04.md`](archive/operator-decisions-2026-07-04.md)
and [`docs/archive/operator-decisions-2026-07-06.md`](archive/operator-decisions-2026-07-06.md).
The **July 8 ingestion & tenancy batch** (merged to `main`, pending live apply as of
2026-07-09) is in [`docs/operator-apply-july8-batch.md`](operator-apply-july8-batch.md).
Do not execute live applies from CI or agent automation without explicit operator approval.
