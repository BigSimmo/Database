-- Codify eight objects that supabase/schema.sql declares but no migration creates.
--
-- Plan of record: docs/database-remediation-plan.md Phase 3 (reframed 2026-08-18);
-- evidence: docs/audit/live-drift-forensics-2026-08.md section 2.3 (b) — the
-- staging replay of the full committed chain (194/194, byte-verified) reported
-- these eight as declared in schema.sql with no creating and no dropping migration
-- anywhere in supabase/migrations/**. Ledger anchor #316.
--
-- WHY: any environment built from migrations alone (staging, disaster-recovery
-- replay, `supabase db reset`) lacks them. Five are btree/GIN indexes on the
-- retrieval-path table document_embedding_fields, one is the plain documents.status
-- index, and two are set_updated_at() triggers whose absence silently stops
-- updated_at maintenance on documents and ingestion_jobs.
--
-- Provenance: 20260702014803_drop_legacy_vector_indexes.sql dropped the legacy
-- embedding-fields btrees and named these five as the "live-kept equivalents ...
-- declared instead" in schema.sql — declared, but never given a migration.
--
-- Definitions are verbatim from supabase/schema.sql (lines 678, 763-776,
-- 1073-1081) so the drift manifest, which replays schema.sql, is unchanged.
-- Not #102: that item's bare-column indexes (documents_title_bare_trgm_idx,
-- documents_file_name_bare_trgm_idx, documents_status_id_idx) are different
-- objects and stay canary-gated in their own work.
--
-- Monitoring: all six indexes remain on supabase/search-health-unmonitored-indexes.json
-- (five accepted-unmonitored, document_embedding_fields_search_tsv_chunk_gin_idx a
-- monitor-candidate). search_schema_health() required_indexes is not changed here;
-- that decision travels with Phase 4.4 by its own migration.
--
-- Dependencies: public.document_embedding_fields and all referenced columns from
-- 20260608001000; documents.status from 20260527000000; public.set_updated_at()
-- newest at 20260528009000. Ordered after 20260702014803.
--
-- Idempotent on production (sjrfecxgysukkwxsowpy): all eight already exist there
-- (2026-08-14 live-drift reported no missing_live for these names, and no
-- unexpected trigger drift), so every statement is a no-op in the production window.

create index if not exists documents_status_idx on public.documents(status);

create index if not exists document_embedding_fields_owner_id_idx
  on public.document_embedding_fields(owner_id);
create index if not exists document_embedding_fields_owner_document_created_idx
  on public.document_embedding_fields(owner_id, document_id, created_at desc);
create index if not exists document_embedding_fields_source_chunk_id_idx
  on public.document_embedding_fields(source_chunk_id);
create index if not exists document_embedding_fields_meta_rag_indexing_version_idx
  on public.document_embedding_fields((metadata->>'rag_indexing_version'));
create index if not exists document_embedding_fields_search_tsv_chunk_gin_idx
  on public.document_embedding_fields using gin(search_tsv)
  where source_chunk_id is not null;

drop trigger if exists documents_updated_at on public.documents;
create trigger documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists ingestion_jobs_updated_at on public.ingestion_jobs;
create trigger ingestion_jobs_updated_at
before update on public.ingestion_jobs
for each row execute function public.set_updated_at();
