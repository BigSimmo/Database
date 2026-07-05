# Supabase Migration Reconciliation

Last reviewed: 2026-07-05

Target project: Clinical KB Database (`sjrfecxgysukkwxsowpy`)

## Policy

- Do not use `supabase db push` while local and remote migration history are divergent.
- **Never change a retrieval RPC, index, or function on the live project with raw SQL in the dashboard.** Use a committed migration under `supabase/migrations/` and reconcile `supabase/schema.sql` in the same change.
- Use `supabase migration repair --linked --status applied <version>` only when live database evidence proves the migration effect already exists.
- Leave other local-only migrations unrepaired until their effects are verified or deliberately applied.
- Run `npx supabase migration list --linked` at apply/reconcile time; do not rely on a frozen “aligned through” snapshot in this doc alone.

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

Migration `20260705220000_reconcile_live_database_drift.sql` codifies live-only drift discovered 2026-07-05:

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

Manual key rotation and live migration apply decisions are recorded in [`docs/archive/operator-decisions-2026-07-04.md`](archive/operator-decisions-2026-07-04.md). Do not execute those steps from CI or agent automation without explicit operator approval.
