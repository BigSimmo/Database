-- Restore canonical RAG support indexes found missing on the live project even
-- though the original reconciliation migration is recorded as applied.
-- The definitions already exist in schema.sql and drift-manifest.json; this
-- idempotent forward migration repairs hosted drift without changing RPCs.

set search_path = public, extensions, pg_catalog;
set lock_timeout = '5s';
set statement_timeout = '15min';

create index if not exists document_labels_label_trgm_idx
  on public.document_labels using gin (lower(label) gin_trgm_ops);

create index if not exists document_summaries_summary_trgm_idx
  on public.document_summaries using gin (lower(summary) gin_trgm_ops);

create index if not exists document_index_units_owner_chunk_type_idx
  on public.document_index_units(owner_id, source_chunk_id, unit_type)
  where source_chunk_id is not null;

create index if not exists rag_retrieval_logs_miss_idx
  on public.rag_retrieval_logs(is_miss, created_at desc)
  where is_miss = true;
