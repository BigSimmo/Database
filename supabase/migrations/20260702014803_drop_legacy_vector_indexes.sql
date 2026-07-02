-- Reclaim dead / duplicate index storage (~4.8 GB on the live project).
--
-- APPLIED TO LIVE 2026-07-02 with explicit user approval (was held for manual
-- apply). Registered as version 20260702014803. Verified after apply: all seven
-- indexes gone, detect_legacy_ivfflat_indexes() = [], database size 13 GB ->
-- 8.6 GB, search_schema_health() ok. Usage stats were re-checked immediately
-- before the drop: every target was still dead (0-8 lifetime scans, flat since
-- the 2026-07-01 measurement) while the HNSW replacements were actively serving.
-- Every statement is `if exists`, so replaying is safe.
--
-- Note: `drop index` here is non-concurrent (cannot be `concurrently` inside a
-- migration transaction); each drop takes a brief sub-second ACCESS EXCLUSIVE
-- metadata lock.
--
-- WHY each index was dropped (measured live 2026-07-01, 13 GB DB):
--   * document_embedding_fields_embedding_ivfflat_idx  3.66 GB, 8 lifetime scans
--     Legacy ivfflat; the HNSW index on the same column serves ~308 scans. The
--     canonical schema (supabase/schema.sql) is already HNSW-only.
--   * document_chunks_embedding_ivfflat_idx            610 MB, 306 scans
--     Redundant duplicate of the HNSW index (served ~435 scans). Dropping forces
--     the planner onto HNSW for every vector search, matching schema.sql.
--   * document_index_units_embedding_hnsw_idx          640 MB, 0 scans
--     The index_units hybrid RPC is text-candidate-gated, so the vector path
--     never uses this HNSW index. Dropped per decision (keep embeddings + text
--     path; re-add the index later if the vector path is ever wired in).
--   * document_embedding_fields_search_idx (+3 more)   0-scan btrees, ~35 MB.
--
-- FOLLOW-UPS (completed alongside the apply): supabase/schema.sql no longer
-- creates `document_index_units_embedding_hnsw_idx` (or the dropped
-- embedding-fields btrees — their live-kept equivalents `owner_id_idx`,
-- `source_chunk_id_idx`, `search_tsv_chunk_gin_idx`, `owner_document_created_idx`,
-- and `meta_rag_indexing_version_idx` are declared instead), the index was
-- removed from schema.sql's `required_indexes` list in search_schema_health(),
-- and tests/supabase-schema.test.ts asserts the creation is gone.

drop index if exists public.document_embedding_fields_embedding_ivfflat_idx;
drop index if exists public.document_chunks_embedding_ivfflat_idx;
drop index if exists public.document_index_units_embedding_hnsw_idx;

-- Dead (0-scan) support btrees on the 215k-row embedding fields table.
drop index if exists public.document_embedding_fields_search_idx;
drop index if exists public.document_embedding_fields_chunk_idx;
drop index if exists public.document_embedding_fields_meta_rag_memory_version_idx;
drop index if exists public.document_embedding_fields_owner_idx;
