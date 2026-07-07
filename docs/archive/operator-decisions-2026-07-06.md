# Operator decisions — 2026-07-06

Approvals granted during the repository-review follow-up session. **No live actions were taken from this checklist** — the authoring environment had no authenticated Supabase connection. Any live-connected session (or the operator) can execute these without re-asking.

## Pending live migrations — APPROVED to apply

**Decision:** The operator explicitly approved applying both pending migrations to the live `Clinical KB Database` project (`sjrfecxgysukkwxsowpy`).

1. **M13** `supabase/migrations/20260702000000_commit_generation_preserve_legacy_artifacts.sql` — prerequisite for reindex commits safely purging legacy NULL-generation rows.
2. `supabase/migrations/20260703030000_reconcile_storage_cleanup_jobs_indexes.sql` — drops the legacy auto-named indexes and (re)creates the intended named/partial indexes to match `supabase/schema.sql`. (This is the migration the debt log marked "apply to live only with explicit approval" — that approval is now recorded here.)

**Post-apply verification (required):**

```bash
npm run check:m13-migration
npm run reindex:health
npm run check:indexing
npm run check:supabase-project
```

## Edge function deploy — APPROVED

**Decision:** Deploy `supabase/functions/indexing-v3-agent` so the JSONB status-RPC parsing is live (follow-up noted in `docs/process-hardening.md` "Live database drift reconciliation (2026-07-05)").

## Context

Approval came alongside the operator green-lighting the two structural efforts (finish the ClinicalDashboard admin cutover; decompose `src/lib/rag.ts`) tracked in `docs/process-hardening.md`.
