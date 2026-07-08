-- Finding #11 (corpus-grounded relevance): deterministic in/out-of-corpus signal for the
-- unsupported-query soft tail. The deterministic query analyzer carries no signal separating
-- in-corpus bare topics ("bipolar disorder") from out-of-corpus or invented ones ("florbizone
-- syndrome management") — only the corpus can tell them apart, and the LLM classifier fallback
-- is nondeterministic. This function reports, per query term and scoped exactly like retrieval
-- (retrieval_owner_matches + status = 'indexed' + committed generation):
--   * has_ts_signal    — whether the term survives to_tsquery stemming/stopwording at all
--                        (a stopword like "the" produces an empty tsquery and must be ignored,
--                        not treated as corpus-absent);
--   * title_doc_count  — how many indexed documents match the term in their title tsvector
--                        (the corpus's own topic vocabulary; served by documents_title_search_idx);
--   * chunk_present    — whether ANY committed chunk matches the term (absence = the corpus has
--                        never seen the term, the refusal signal for invented terms);
--   * total_doc_count  — scoped corpus size, so callers can derive a genericity share
--                        (e.g. "management" titles ~18% of docs = scaffolding, not a topic).
-- Read-only, additive, service_role-only. App-side consumer: src/lib/corpus-grounding.ts.

create or replace function public.corpus_topic_term_stats(
  terms text[],
  owner_filter uuid default null
)
returns table (
  term text,
  has_ts_signal boolean,
  title_doc_count integer,
  chunk_present boolean,
  total_doc_count integer
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with input_terms as (
    select distinct lower(btrim(t.term)) as term
    from unnest(coalesce(terms, array[]::text[])) with ordinality as t(term, ord)
    where btrim(t.term) <> ''
      and t.ord <= 8
  ),
  totals as (
    select count(*)::integer as total_doc_count
    from public.documents d
    where public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
  )
  select
    it.term,
    plainto_tsquery('english', it.term) <> ''::tsquery as has_ts_signal,
    (
      select count(*)::integer
      from public.documents d
      where public.retrieval_owner_matches(owner_filter, d.owner_id)
        and d.status = 'indexed'
        and d.title_search_tsv @@ plainto_tsquery('english', it.term)
    ) as title_doc_count,
    exists (
      select 1
      from public.document_chunks c
      join public.documents d on d.id = c.document_id
      where public.retrieval_owner_matches(owner_filter, d.owner_id)
        and d.status = 'indexed'
        and public.is_committed_document_generation(c.index_generation_id, d.metadata)
        and c.search_tsv @@ plainto_tsquery('english', it.term)
    ) as chunk_present,
    totals.total_doc_count
  from input_terms it
  cross join totals;
$$;

revoke all on function public.corpus_topic_term_stats(text[], uuid) from public;
revoke all on function public.corpus_topic_term_stats(text[], uuid) from anon;
revoke all on function public.corpus_topic_term_stats(text[], uuid) from authenticated;
grant execute on function public.corpus_topic_term_stats(text[], uuid) to service_role;
