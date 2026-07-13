-- Scrub pre-HMAC plaintext query text at rest (2026-07-13 audit, finding 5).
--
-- Since the HMAC rollout every write path stores `redacted-query:<hmac>` (see
-- src/lib/query-privacy.ts) unless RAG_PERSIST_RAW_QUERY_TEXT is deliberately
-- enabled — and scripts/production-readiness.ts fails when that flag is on in
-- a production-like environment. Rows written before the rollout still hold
-- raw clinical query text (audit counted 230 rag_queries rows and 10
-- rag_query_misses rows on live). Their original owner/consent basis cannot be
-- established, so they are replaced, not migrated.
--
-- Placeholder shape: 'redacted-query:legacy:' || md5(random salt || text).
-- The per-row random salt makes the value irreversible and not
-- dictionary-attackable while keeping rows distinct; the text never leaves the
-- database. The historical rag_queries.answer column was already cleared by
-- 20260713010000_clear_historical_rag_query_answers.sql.
--
-- rag_response_cache rows are a cache: legacy raw-keyed entries are deleted
-- outright (worst case is a cache miss) rather than re-keyed.
--
-- Valid redacted token format (from src/lib/query-privacy.ts):
-- - redacted-query:<64-char-hex-hash> (SHA-256/HMAC-SHA256, e.g., redacted-query:a1b2c3...)
-- - redacted-cache:<64-char-hex-hash>
-- Only values matching the complete token shape are preserved; prefix-only matches
-- that don't match the full format are treated as legacy plaintext and scrubbed.

update public.rag_queries
set query = 'redacted-query:legacy:' || md5(gen_random_uuid()::text || query)
where query !~ '^redacted-query:[0-9a-f]{64}$';

update public.rag_query_misses
set
  query = case
    when query ~ '^redacted-query:[0-9a-f]{64}$' then query
    else 'redacted-query:legacy:' || md5(gen_random_uuid()::text || query)
  end,
  normalized_query = case
    when normalized_query ~ '^redacted-query:[0-9a-f]{64}$' then normalized_query
    else 'redacted-query:legacy:' || md5(gen_random_uuid()::text || normalized_query)
  end
where query !~ '^redacted-query:[0-9a-f]{64}$'
   or normalized_query !~ '^redacted-query:[0-9a-f]{64}$';

update public.rag_retrieval_logs
set
  query = case
    when query ~ '^redacted-query:[0-9a-f]{64}$' then query
    else 'redacted-query:legacy:' || md5(gen_random_uuid()::text || query)
  end,
  normalized_query = case
    when normalized_query is null or normalized_query ~ '^redacted-query:[0-9a-f]{64}$' then normalized_query
    else 'redacted-query:legacy:' || md5(gen_random_uuid()::text || normalized_query)
  end
where query !~ '^redacted-query:[0-9a-f]{64}$'
   or (normalized_query is not null and normalized_query !~ '^redacted-query:[0-9a-f]{64}$');

delete from public.rag_response_cache
where normalized_query !~ '^redacted-cache:[0-9a-f]{64}$';

do $$
declare
  bad_queries integer;
  bad_misses integer;
  bad_logs integer;
  bad_cache integer;
begin
  select count(*) into bad_queries
  from public.rag_queries
  where query !~ '^redacted-query:[0-9a-f]{64}$';

  select count(*) into bad_misses
  from public.rag_query_misses
  where query !~ '^redacted-query:[0-9a-f]{64}$'
     or normalized_query !~ '^redacted-query:[0-9a-f]{64}$';

  select count(*) into bad_logs
  from public.rag_retrieval_logs
  where query !~ '^redacted-query:[0-9a-f]{64}$'
     or (normalized_query is not null and normalized_query !~ '^redacted-query:[0-9a-f]{64}$');

  select count(*) into bad_cache
  from public.rag_response_cache
  where normalized_query !~ '^redacted-cache:[0-9a-f]{64}$';

  if bad_queries + bad_misses + bad_logs + bad_cache > 0 then
    raise exception
      'legacy query-text scrub incomplete: rag_queries=%, rag_query_misses=%, rag_retrieval_logs=%, rag_response_cache=%',
      bad_queries, bad_misses, bad_logs, bad_cache;
  end if;
end $$;
