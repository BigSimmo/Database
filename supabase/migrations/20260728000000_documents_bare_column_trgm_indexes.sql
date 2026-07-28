-- Serve bare-column ILIKE on documents.title / documents.file_name.
--
-- `documents_title_trgm_idx` indexes the CONCATENATED expression
--   lower(coalesce(title, '') || ' ' || coalesce(file_name, ''))
-- so it can only serve a predicate written against that same expression. Two
-- live call sites instead filter the bare columns:
--
--   src/app/api/documents/route.ts        `title.ilike.%q%,file_name.ilike.%q%`
--   src/lib/rag/rag-candidate-sources.ts  same shape, on the RAG retrieval path
--
-- Neither can use the expression index, so both fall back to a scan of
-- `documents`. These two GIN trigram indexes serve those predicates directly.
--
-- Deliberately additive and semantics-neutral: no query text changes, so the
-- matching behaviour (and therefore retrieval recall) is byte-identical before
-- and after. That is what keeps this out of canary-gated territory.
--
-- OPERATOR NOTE: on the live database create these outside a transaction first,
-- per docs/operator-apply-performance-latency-remediation.md:
--
--   create index concurrently if not exists documents_title_bare_trgm_idx
--     on public.documents using gin (title gin_trgm_ops);
--   create index concurrently if not exists documents_file_name_bare_trgm_idx
--     on public.documents using gin (file_name gin_trgm_ops);
--
-- Once both are valid, the statements below are a no-op. They are written
-- transactionally so local `supabase db reset` replay stays deterministic.
--
-- Deliberately NOT yet mirrored into `supabase/schema.sql`, and NOT yet added to
-- the `required_indexes` list inside `search_schema_health()`. Both describe state
-- that is expected to exist, and neither is true until this migration is applied:
-- the required-index check runs against the live database, and editing schema.sql
-- invalidates `supabase/drift-manifest.json` (regenerating it needs Docker, and
-- `tests/drift-detection.test.ts` pins the pair). Do all three in the same change
-- that applies this migration — see ledger #089 for the ordering.
create index if not exists documents_title_bare_trgm_idx
  on public.documents using gin (title gin_trgm_ops);

create index if not exists documents_file_name_bare_trgm_idx
  on public.documents using gin (file_name gin_trgm_ops);
