-- Force custom plans for the non-inlined retrieval RPCs (scale-readiness F1).
--
-- These functions are LANGUAGE sql/plpgsql with SET search_path, which makes
-- them non-inlinable: their bodies are planned with unknown parameters, and the
-- planner cannot estimate trigram/tsv selectivity for an unknown text value.
-- Once a pooled connection caches the resulting generic plan, every call pays
-- near-seq-scan strategies — match_document_table_facts_text measured 5.3 s per
-- call on live pooled connections, ~1.1 s with a custom plan (≈4.8x), and the
-- answer path fans it out up to 3x in parallel per cold request.
--
-- plan_cache_mode = force_custom_plan is results-identical (it changes only
-- which plan is used, never which rows qualify), so no retrieval eval gate
-- applies. Applied to the live Clinical KB Database on 2026-07-11 with
-- before/after verification (identical row counts, steady-state timings
-- unchanged, generic-plan mode now unreachable); this migration codifies the
-- setting for other environments.
--
-- Deliberately NOT included: statement_timeout on these functions. A
-- function-level SET cannot re-arm the timeout for the statement already in
-- flight, and a role-level timeout would endanger the minutes-long ingestion
-- RPCs that run under the same service role. Client-disconnect cancellation of
-- retrieval RPCs is handled app-side via .abortSignal() (see rag.ts withAbort).

alter function public.match_document_table_facts_text(text, integer, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';

alter function public.match_document_memory_cards_hybrid(vector, text, integer, double precision, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';

alter function public.match_document_index_units_hybrid(vector, text, integer, double precision, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';

alter function public.match_document_embedding_fields_hybrid(vector, text, integer, double precision, uuid[], uuid)
  set plan_cache_mode = 'force_custom_plan';
