-- These indexes already have the expected definitions; only their historical
-- names differ. Renaming is metadata-only and preserves planner statistics.
alter index if exists public.clinical_registry_record_sources_document_id_idx
  rename to clinical_registry_record_sources_document_idx;
alter index if exists public.document_chunks_search_tsv_idx
  rename to document_chunks_search_idx;
alter index if exists public.document_labels_document_id_idx
  rename to document_labels_document_idx;
alter index if exists public.document_memory_cards_owner_id_idx
  rename to document_memory_cards_owner_idx;
alter index if exists public.document_memory_cards_section_id_idx
  rename to document_memory_cards_section_idx;
alter index if exists public.document_sections_owner_id_idx
  rename to document_sections_owner_idx;
alter index if exists public.document_table_facts_source_chunk_id_idx
  rename to document_table_facts_chunk_idx;
alter index if exists public.documents_import_batch_id_idx
  rename to documents_import_batch_idx;
alter index if exists public.documents_title_search_tsv_idx
  rename to documents_title_search_idx;
