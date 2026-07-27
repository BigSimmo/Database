set search_path = public, extensions, pg_temp;

-- Hybrid RPCs
ALTER FUNCTION public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_memory_cards_hybrid_v2(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid) SET work_mem = '64MB';

-- Lexical RPCs
ALTER FUNCTION public.match_document_chunks_text(text, integer, uuid[], uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_lookup_chunks_text(text, uuid[], integer, uuid) SET work_mem = '64MB';
ALTER FUNCTION public.match_document_table_facts_text(text, integer, uuid[], uuid) SET work_mem = '64MB';
