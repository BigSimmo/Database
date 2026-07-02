-- P0.3: reconcile the remaining live-only hybrid drift. These experimental variant functions were
-- created live-only (they appear in ZERO committed migrations), are all `language plpgsql` carrying
-- the same output-param/CTE ambiguity as the RPCs fixed in 20260701010000/020000, and are called by
-- nothing — verified 0 references from app source, scripts, migrations, and other live function
-- bodies (the only cross-links were dead-island internal: _rrf→_vector, eval_memory_retrieval_v2_v3→
-- _v3, both callers themselves unreferenced). They are pure confusion-vectors: the corpus already
-- has FOUR real hybrid RPCs plus these six shadow variants, which is exactly what made the drift so
-- hard to spot. Dropping them makes live match the migration-defined set. Dependency order matters
-- (drop callers before callees).

-- eval helper (only live caller of memory_cards_v3), then v3
drop function if exists public.eval_memory_retrieval_v2_v3(query_embedding vector, query_text text, match_count integer, min_similarity double precision, document_filters uuid[], owner_filter uuid);
drop function if exists public.match_document_memory_cards_hybrid_v3(query_embedding vector, query_text text, match_count integer, min_similarity double precision, document_filters uuid[], owner_filter uuid);

-- rrf (only live caller of embedding_fields_vector), then the vector-only variant
drop function if exists public.match_document_embedding_fields_rrf(query_embedding vector, query_text text, match_count integer, candidate_count integer, min_similarity double precision, min_text_rank double precision, rrf_k integer, vector_weight double precision, text_weight double precision, document_filters uuid[], owner_filter uuid);
drop function if exists public.match_document_embedding_fields_vector(query_embedding vector, match_count integer, min_similarity double precision, document_filters uuid[], owner_filter uuid);

-- standalone dead variants (no callers of any kind)
drop function if exists public.match_document_chunks_hybrid_review_v1(query_embedding vector, query_text text, match_count integer, min_similarity double precision, document_filters uuid[], owner_filter uuid, debug_mode boolean);
drop function if exists public.match_document_embedding_fields_hybrid_v2(query_embedding vector, query_text text, match_count integer, min_similarity double precision, document_filters uuid[], owner_filter uuid);
drop function if exists public.match_document_index_units_hybrid_v3(query_embedding vector, query_text text, match_count integer, min_similarity double precision, document_filters uuid[], owner_filter uuid);
