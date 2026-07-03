-- The storage_cleanup_jobs.document_id FK added in
-- 20260702130000_storage_cleanup_jobs_document_fk.sql is already covered by
-- storage_cleanup_jobs_document_idx from
-- 20260528007000_database_hardening_before_import.sql and supabase/schema.sql.
-- Do not create a duplicate btree under a second name.

-- Fix: document_embedding_fields is now the largest table in the schema
-- (215k+ rows) and backs an HNSW vector index, but unlike its sibling RAG
-- tables (document_chunks, document_pages, document_images,
-- document_table_facts, document_labels) it was still on default autovacuum
-- thresholds. Match the tuning already applied to those tables.
alter table public.document_embedding_fields set (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- Fix: idle_in_transaction_session_timeout was unset (0 = unbounded) for the
-- app role. With only 60 max_connections on this compute tier, a stuck idle
-- transaction can pin a slot indefinitely. 30s is well above normal
-- request/RPC duration for this app.
alter role authenticator set idle_in_transaction_session_timeout = '30s';
