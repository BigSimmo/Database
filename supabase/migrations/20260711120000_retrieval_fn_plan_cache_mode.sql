-- Force custom plans for the non-inlined retrieval RPCs (scale-readiness F1).
-- This results-neutral setting is already applied and verified on the live
-- Clinical KB Database; this migration codifies it for replay and history.

alter function public.match_document_table_facts_text(text, integer, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';

alter function public.match_document_memory_cards_hybrid(vector, text, integer, double precision, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';

alter function public.match_document_index_units_hybrid(vector, text, integer, double precision, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';

alter function public.match_document_embedding_fields_hybrid(vector, text, integer, double precision, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';
