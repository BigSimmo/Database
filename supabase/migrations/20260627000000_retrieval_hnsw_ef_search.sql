-- A2: raise pgvector HNSW ef_search for the vector retrieval functions.
--
-- The hybrid/vector match functions request up to 128 candidates from their HNSW indexes
-- (limit least(greatest(match_count * 2, 48), 128)), but the pgvector default hnsw.ef_search
-- is 40 — so the index returns at most ~40 quality neighbours, the deeper fetch is wasted,
-- and recall is capped below intent. Pin a higher ef_search per vector function so the index
-- explores enough candidates to fill the requested depth.
--
-- Body-preserving: ALTER FUNCTION ... SET only attaches a per-function GUC; it does not
-- redefine the function body, so this is low-risk relative to recall gains. The function-level
-- SET reliably applies on every invocation regardless of the connection/role (Supabase
-- PostgREST connects as `authenticator` then SET ROLE service_role, so role-level GUCs would
-- not apply — function-level does).
--
-- Tunable range ~80-120; comparison-class queries fetch the full 128 and may warrant raising
-- toward 128 at some latency cost. Validate recall vs latency with
-- `npm run eval:retrieval:quality` and `npm run eval:retrieval:latency` on a Supabase branch
-- (and `npm run profile:retrieval` for EXPLAIN plans) before applying to the live project.

set search_path = public, extensions;

alter function public.match_document_chunks_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
  set hnsw.ef_search = 100;
alter function public.match_document_memory_cards_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
  set hnsw.ef_search = 100;
alter function public.match_document_index_units_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
  set hnsw.ef_search = 100;
alter function public.match_document_embedding_fields_hybrid(extensions.vector, text, integer, double precision, uuid[], uuid)
  set hnsw.ef_search = 100;
alter function public.match_document_chunks(extensions.vector, integer, double precision, uuid, uuid)
  set hnsw.ef_search = 100;
