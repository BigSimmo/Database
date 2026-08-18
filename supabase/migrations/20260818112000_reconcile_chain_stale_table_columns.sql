-- Reconcile three chain-stale table columns so a clean migration replay matches
-- supabase/schema.sql (and production) column-for-column.
--
-- Plan of record: docs/database-remediation-plan.md Phase 3 (reframed 2026-08-18);
-- evidence: docs/audit/live-drift-forensics-2026-08.md section 2.3 (c), expanded per
-- column in section Phase 3 against a read-only staging snapshot. Ledger anchor #316.
-- In every case schema.sql is the correct side (it matches production: the
-- 2026-08-14 live-drift run reported no table drift) and is left unchanged; the
-- migration chain is what disagrees. Each statement is idempotent on production.
--
-- 1. document_chunks.token_estimate — the chain builds 18 columns, schema.sql
--    declares 19: `token_estimate integer not null default 0` (schema.sql line 309)
--    is mentioned by zero migrations, yet the application writes it
--    (src/lib/chunking.ts, src/lib/registry-corpus.ts), the generated types require
--    it (src/lib/supabase/database.types.ts) and production carries it. A database
--    built from migrations alone would reject every chunk insert. On PostgreSQL 11+
--    adding a column with a constant default is catalog-only (no table rewrite);
--    on production the column exists with this exact shape, so this is a no-op.
--
-- 2/3. rag_visual_eval_cases.id and rag_visual_eval_runs.id defaults —
--    20260705230000_reconcile_live_database_drift.sql opens with
--    `set search_path = public, extensions, pg_catalog;` (pg_catalog LAST), so its
--    bare `default gen_random_uuid()` bound to pgcrypto's
--    extensions.gen_random_uuid() rather than the core pg_catalog function.
--    schema.sql (search_path `public, extensions`, pg_catalog implicitly first)
--    and production bind the core function, which the drift snapshot renders as
--    `gen_random_uuid()`; the staging chain replay renders
--    `extensions.gen_random_uuid()`. Both generate v4 UUIDs — no behavioural
--    difference — but the column-set comparison is a real OID mismatch. Rebinding
--    to the schema-qualified core function is a no-op on production and makes the
--    chain agree with schema.sql. (indexing_v3_agent_jobs.id is NOT touched:
--    schema.sql itself declares extensions.gen_random_uuid() there, so chain,
--    mirror and live already agree.)

alter table public.document_chunks
  add column if not exists token_estimate integer not null default 0;

alter table public.rag_visual_eval_cases
  alter column id set default pg_catalog.gen_random_uuid();

alter table public.rag_visual_eval_runs
  alter column id set default pg_catalog.gen_random_uuid();
