# Supabase Migration Reconciliation

Last reviewed: 2026-06-28

Target project: Clinical KB Database (`sjrfecxgysukkwxsowpy`)

## Policy

- Do not use `supabase db push` while local and remote migration history are divergent.
- Use `supabase migration repair --linked --status applied <version>` only when live database evidence proves the migration effect already exists.
- Leave all other local-only migrations unrepaired until their effects are verified or deliberately applied.

## Verified Applied

These previously local-only versions have been verified in the live project history:

- `20260625033425` - `document_strict_gate_status` exists, `repair_strict_enrichment_gate_batch(integer)` exists, service role can read/execute, and anon cannot read/execute.
- `20260625033944` - `complete_strict_enrichment_job(uuid, uuid, text, text, text)` exists, service role can execute, and anon cannot execute.
- `20260626000000` - duplicate index `ingestion_job_stages_doc_idx` is absent and canonical index `ingestion_job_stages_document_started_idx` exists.
- `20260626020000` - retrieval RPC performance migration is present in remote history.
- `20260626030000` - document organisation profile label constraint migration is present in remote history.

## Pending

As of this review, the only local-only migrations before the audit-grant follow-up are:

- `20260627000000` - deliberately deferred no-op for retrieval HNSW `ef_search`; hosted migrations cannot set this function GUC for this project.
- `20260628000000` - atomic document index generation commit RPC and committed-generation retrieval filters.

These should be deliberately applied to `sjrfecxgysukkwxsowpy` before running the current branch worker against live if atomic reindex behavior is required.

## Verification Commands

```powershell
npx supabase migration list --linked
npx supabase db advisors --linked
npx supabase db query --linked "select to_regclass('public.document_strict_gate_status') as gate_view, to_regprocedure('public.repair_strict_enrichment_gate_batch(integer)') as repair_rpc, to_regprocedure('public.complete_strict_enrichment_job(uuid, uuid, text, text, text)') as complete_rpc, to_regclass('public.ingestion_job_stages_doc_idx') as duplicate_index, to_regclass('public.ingestion_job_stages_document_started_idx') as canonical_stage_index;"
npx supabase db query --linked "select to_regprocedure('public.commit_document_index_generation(uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb)') as commit_generation_rpc, has_function_privilege('anon', 'public.invoke_indexing_v3_agent(integer)', 'execute') as anon_can_invoke_indexing_v3_agent, has_function_privilege('service_role', 'public.invoke_indexing_v3_agent(integer)', 'execute') as service_role_can_invoke_indexing_v3_agent;"
```
