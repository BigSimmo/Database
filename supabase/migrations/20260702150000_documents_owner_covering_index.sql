-- Fix #5: Add covering index for RLS correlated subquery on documents.
--
-- Several tables (document_chunks, document_sections, document_memory_cards,
-- document_index_units, etc.) have RLS policies of the form:
--
--   EXISTS (SELECT 1 FROM documents WHERE id = document_id AND owner_id = auth.uid())
--
-- The existing documents_owner_idx covers (owner_id) only, so PostgreSQL must
-- re-fetch the heap to confirm id = document_id. A composite index on
-- (owner_id, id) allows an index-only scan, eliminating the heap fetch.
-- The index is small (two uuid columns) and benefits every authenticated read
-- on the child tables.
--
-- NOTE: CONCURRENTLY cannot run inside a transaction.
-- If you need a zero-lock creation on a loaded system, run this statement
-- manually outside a transaction:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_owner_id_covering_idx
--     ON public.documents(owner_id, id);

create index if not exists documents_owner_id_covering_idx
  on public.documents(owner_id, id);
