# Supabase Migration Reconciliation

Last reviewed: 2026-06-27

Target project: Clinical KB Database (`sjrfecxgysukkwxsowpy`)

## Policy

- Do not use `supabase db push` while local and remote migration history are divergent.
- Use `supabase migration repair --linked --status applied <version>` only when live database evidence proves the migration effect already exists.
- Leave all other local-only migrations unrepaired until their effects are verified or deliberately applied.

## Verified Applied

These versions are safe to mark applied in Supabase migration history:

- `20260625033425` - `document_strict_gate_status` exists, `repair_strict_enrichment_gate_batch(integer)` exists, service role can read/execute, and anon cannot read/execute.
- `20260625033944` - `complete_strict_enrichment_job(uuid, uuid, text, text, text)` exists, service role can execute, and anon cannot execute.
- `20260626000000` - duplicate index `ingestion_job_stages_doc_idx` is absent and canonical index `ingestion_job_stages_document_started_idx` exists.

## Skipped

All other local-only migrations from `supabase migration list --linked` remain unrepaired until they are individually verified. This includes older search/retrieval/API-rate-limit migrations and the current `20260626020000` retrieval RPC performance migration.

## Verification Commands

```powershell
npx supabase migration list --linked
npx supabase db advisors --linked
npx supabase db query --linked "select to_regclass('public.document_strict_gate_status') as gate_view, to_regprocedure('public.repair_strict_enrichment_gate_batch(integer)') as repair_rpc, to_regprocedure('public.complete_strict_enrichment_job(uuid, uuid, text, text, text)') as complete_rpc, to_regclass('public.ingestion_job_stages_doc_idx') as duplicate_index, to_regclass('public.ingestion_job_stages_document_started_idx') as canonical_stage_index;"
```
