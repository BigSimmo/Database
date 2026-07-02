-- Drop indexes confirmed dead via live pg_stat_user_indexes (0 scans across
-- 13+ days of uptime) and cross-checked against search_schema_health()'s
-- required_indexes invariant list (supabase/schema.sql) to make sure nothing
-- here is a load-bearing fallback path.

-- section_path is only ever SELECTed in the codebase, never filtered with an
-- array operator anywhere, so the GIN index on it has no query to serve.
drop index if exists public.document_chunks_section_path_gin_idx;

-- Full btree on source_chunk_id is a strict duplicate of the required
-- partial index document_table_facts_chunk_idx (WHERE source_chunk_id IS
-- NOT NULL), which already covers every query the full index would.
drop index if exists public.document_table_facts_source_chunk_id_idx;

-- Same story for source_image_id: duplicate of the required partial index
-- document_table_facts_source_image_idx.
drop index if exists public.document_table_facts_source_image_id_idx;

-- Single-column (owner_id) index strictly dominated by the required
-- composite document_table_facts_owner_document_page_idx
-- (owner_id, document_id, page_number).
drop index if exists public.document_table_facts_owner_id_idx;
