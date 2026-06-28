-- Deliberately deferred.
--
-- The intended optimization was to attach `hnsw.ef_search = 100` as a
-- function-level GUC on the vector retrieval RPCs. Supabase hosted migrations
-- currently reject that operation for this project with:
--
--   ERROR: permission denied to set parameter "hnsw.ef_search" (SQLSTATE 42501)
--
-- Keep this version in migration history as an explicit no-op so later schema
-- repairs can apply in order. Revisit the tuning only if Supabase exposes a
-- supported way to set pgvector HNSW search depth for hosted RPC execution, or
-- after validating an equivalent function-body/session-local approach on a
-- branch database.

do $$
begin
  raise notice '20260627000000 deferred: hosted migrations cannot set hnsw.ef_search for functions';
end $$;
