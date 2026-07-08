# Operator decisions — 2026-07-06

Approvals granted during the repository-review follow-up session. When written, no live actions had been taken (the authoring environment had no authenticated Supabase connection). **All items below have since been completed on live and verified 2026-07-08** — see the "Status" notes.

## Pending live migrations — APPROVED to apply → **DONE (verified live 2026-07-08)**

**Decision:** The operator explicitly approved applying both pending migrations to the live `Clinical KB Database` project (`sjrfecxgysukkwxsowpy`).

1. **M13** `supabase/migrations/20260702000000_commit_generation_preserve_legacy_artifacts.sql` — prerequisite for reindex commits safely purging legacy NULL-generation rows.
2. `supabase/migrations/20260703030000_reconcile_storage_cleanup_jobs_indexes.sql` — drops the legacy auto-named indexes and (re)creates the intended named/partial indexes to match `supabase/schema.sql`. (This is the migration the debt log marked "apply to live only with explicit approval" — that approval is now recorded here.)

**Status — APPLIED.** Both appear in the live migration history: `20260702000000_commit_generation_preserve_legacy_artifacts` and `20260703030000_reconcile_storage_cleanup_jobs_indexes` (the latter reinforced by `20260708000000_reapply_storage_cleanup_jobs_indexes`, and M13 guarded by `20260706010000_search_schema_health_m13_guard`). M13 confirmed genuinely live (not just recorded): `public.search_schema_health()` returns `ok: true` with **no** `commit_document_index_generation` staleness key (that key only appears when the live function body is stale). Applied by concurrent live-connected sessions.

## Edge function deploy — APPROVED → **DONE (verified live 2026-07-08)**

**Decision:** Deploy `supabase/functions/indexing-v3-agent` so the JSONB status-RPC parsing is live (follow-up noted in `docs/process-hardening.md` "Live database drift reconciliation (2026-07-05)").

**Status — DEPLOYED.** `indexing-v3-agent` is ACTIVE on the live project at **version 53** (last updated 2026-07-08), carrying the JSONB status-RPC parsing.

## Context

Approval came alongside the operator green-lighting the two structural efforts (finish the ClinicalDashboard admin cutover; decompose `src/lib/rag.ts`) tracked in `docs/process-hardening.md`.
