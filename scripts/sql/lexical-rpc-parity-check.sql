-- Lexical RPC parity + plan harness (2026-07-13 audit, finding 1).
--
-- Verifies that the index-friendly rewrite of public.match_document_chunks_text
-- (migration 20260713100000_index_friendly_lexical_retrieval.sql) returns the
-- same rows and scores as the previous OR-across-relations body, and that the
-- candidate search is served by the GIN indexes instead of a sequential scan
-- of document_chunks.
--
-- SCRATCH DATABASES ONLY. The script refuses to run when public.documents has
-- rows. It seeds a synthetic corpus into the real tables, installs the legacy
-- body under public.match_document_chunks_text_legacy_parity, compares both
-- functions across representative queries, and times them.
--
-- Usage (scratch container kept from the drift-manifest replay):
--   npm run drift:manifest -- --keep
--   docker exec -i clinical-kb-drift-manifest psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f - < scripts/sql/lexical-rpc-parity-check.sql
--
-- Corpus size is configurable: -v docs=2500 -v chunks_per_doc=28 (defaults
-- 1000 x 30 = 30k chunks keep the run fast while still large enough for the
-- planner to prefer the pathological plan on the legacy body).
--
-- Tie handling: rows tied on text_rank at a truncation boundary were already
-- planner-order dependent in the legacy body, so id parity is asserted
-- strictly for every row scoring above the visible minimum and by count for
-- the boundary tie group.

\if :{?docs}
\else
\set docs 1000
\endif
\if :{?chunks_per_doc}
\else
\set chunks_per_doc 30
\endif

do $$
begin
  if exists (select 1 from public.documents limit 1) then
    raise exception 'lexical-rpc-parity-check must run on an empty scratch database; public.documents has rows';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- Seed a deterministic synthetic corpus.
-- ---------------------------------------------------------------------------
create temp table parity_docs as
select
  gen_random_uuid() as id,
  i as seq,
  case
    when i % 37 = 0 then 'Clozapine Monitoring Protocol ' || i
    when i % 11 = 0 then 'Lithium Toxicity Guideline ' || i
    when i % 7 = 0  then 'Neutropenia Escalation Pathway ' || i
    else 'General Clinical Document ' || i
  end as title
from generate_series(1, :docs) as s(i);

insert into public.documents (id, owner_id, title, file_name, file_type, file_size, storage_path, status, metadata)
select
  id,
  null,
  title,
  'parity-doc-' || seq || '.pdf',
  'application/pdf',
  1024,
  'parity/doc-' || seq || '.pdf',
  'indexed',
  '{}'::jsonb
from parity_docs;

with zero_vec as (
  select ('[' || repeat('0,', 1535) || '0]')::extensions.vector as v
)
insert into public.document_chunks (document_id, chunk_index, content, embedding)
select
  d.id,
  g.j,
  case
    when (d.seq + g.j) % 23 = 0 then
      'clozapine monitoring neutropenia baseline bloods weekly schedule marker' || ((d.seq * 31 + g.j) % 9973)
    when (d.seq + g.j) % 17 = 0 then
      'lithium level toxicity renal function tremor review marker' || ((d.seq * 29 + g.j) % 9973)
    when (d.seq + g.j) % 5 = 0 then
      'clozapine dose titration myocarditis troponin escalation marker' || ((d.seq * 13 + g.j) % 9973)
    else
      'routine ward round documentation handover note marker' || ((d.seq * 7 + g.j) % 9973)
  end,
  zero_vec.v
from parity_docs d
cross join generate_series(1, :chunks_per_doc) as g(j)
cross join zero_vec;

-- A sprinkling of labels and summaries so the shared doc_labels/doc_summaries
-- CTEs produce non-trivial output in both bodies.
insert into public.document_labels (document_id, label, label_type, source, confidence)
select id, 'parity-label-' || seq, 'topic', 'generated', 0.9
from parity_docs where seq % 19 = 0;

insert into public.document_summaries (document_id, summary)
select id, 'Synthetic summary for parity document ' || seq
from parity_docs where seq % 13 = 0;

analyze public.documents;
analyze public.document_chunks;
analyze public.document_labels;
analyze public.document_summaries;

commit;

-- ---------------------------------------------------------------------------
-- Install the legacy body (verbatim candidate search from migration
-- 20260713062107_restore_text_fallback_lexical_score.sql) under a parity name.
-- ---------------------------------------------------------------------------
create or replace function public.match_document_chunks_text_legacy_parity(
  query_text text,
  match_count integer default 12,
  document_filters uuid[] default null,
  owner_filter uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  title text,
  file_name text,
  page_number integer,
  chunk_index integer,
  section_heading text,
  content text,
  retrieval_synopsis text,
  image_ids uuid[],
  source_metadata jsonb,
  document_labels jsonb,
  document_summary text,
  similarity double precision,
  text_rank double precision,
  hybrid_score double precision,
  lexical_score double precision,
  images jsonb
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with query as (
    select websearch_to_tsquery('english', coalesce(query_text, '')) as tsq
  ),
  ranked as (
    select
      c.id,
      c.document_id,
      d.title,
      d.file_name,
      c.page_number,
      c.chunk_index,
      c.section_heading,
      c.content,
      c.retrieval_synopsis,
      c.image_ids,
      d.metadata as source_metadata,
      (
        ts_rank_cd(c.search_tsv, query.tsq) +
        (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
      )::double precision as text_rank
    from public.document_chunks c
    join public.documents d on d.id = c.document_id
    cross join query
    where (document_filters is null or c.document_id = any(document_filters))
      and public.retrieval_owner_matches(owner_filter, d.owner_id)
      and d.status = 'indexed'
      and public.is_committed_document_generation(c.index_generation_id, d.metadata)
      and (c.search_tsv @@ query.tsq or d.title_search_tsv @@ query.tsq)
    order by (
      ts_rank_cd(c.search_tsv, query.tsq) +
      (ts_rank_cd(d.title_search_tsv, query.tsq) * 3.0)
    ) desc
    limit least(greatest(match_count * 2, 24), 96)
  ),
  doc_labels as (
    select
      l.document_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id',          l.id,
            'document_id', l.document_id,
            'owner_id',    l.owner_id,
            'label',       l.label,
            'label_type',  l.label_type,
            'source',      l.source,
            'confidence',  l.confidence,
            'metadata',    l.metadata,
            'created_at',  l.created_at,
            'updated_at',  l.updated_at
          )
          order by l.confidence desc, l.label
        ),
        '[]'::jsonb
      ) as labels
    from public.document_labels l
    where l.document_id in (select distinct ranked.document_id from ranked)
      and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
      and coalesce(l.metadata->>'hidden', 'false') <> 'true'
    group by l.document_id
  ),
  doc_summaries as (
    select distinct on (s.document_id)
      s.document_id,
      s.summary
    from public.document_summaries s
    where s.document_id in (select distinct ranked.document_id from ranked)
    order by s.document_id
  )
  select
    ranked.id,
    ranked.document_id,
    ranked.title,
    ranked.file_name,
    ranked.page_number,
    ranked.chunk_index,
    ranked.section_heading,
    ranked.content,
    ranked.retrieval_synopsis,
    ranked.image_ids,
    ranked.source_metadata,
    coalesce(doc_labels.labels,   '[]'::jsonb) as document_labels,
    doc_summaries.summary                       as document_summary,
    0::double precision                                                              as similarity,
    ranked.text_rank,
    least(0.5,  0.18 + (least(ranked.text_rank, 1) * 0.3))::double precision       as hybrid_score,
    least(0.99, 0.4  + (least(ranked.text_rank, 1) * 0.59))::double precision      as lexical_score,
    public.chunk_image_metadata(ranked.image_ids)                                   as images
  from ranked
  left join doc_labels    on doc_labels.document_id    = ranked.document_id
  left join doc_summaries on doc_summaries.document_id = ranked.document_id
  order by lexical_score desc, text_rank desc
  limit match_count;
$$;

-- ---------------------------------------------------------------------------
-- Parity assertion helper.
-- ---------------------------------------------------------------------------
-- The owner gate is fail-closed: a null owner_filter matches nothing, and the
-- seeded corpus is public (owner_id null), which only the zero-UUID public
-- sentinel matches — so the sentinel is the default here. A null-owner case
-- below still asserts the fail-closed behaviour is identical in both bodies.
create or replace function pg_temp.assert_lexical_parity(
  p_label text,
  p_query text,
  p_match_count integer default 12,
  p_filters uuid[] default null,
  p_owner uuid default '00000000-0000-0000-0000-000000000000'::uuid
)
returns void
language plpgsql
as $fn$
declare
  n_new integer;
  n_old integer;
  score_mismatches integer;
  id_mismatches integer;
  boundary_rank numeric;
begin
  drop table if exists _parity_new;
  drop table if exists _parity_old;

  create temp table _parity_new as
    select row_number() over () as pos,
           r.id,
           round(r.text_rank::numeric, 9) as text_rank,
           round(r.hybrid_score::numeric, 9) as hybrid_score,
           round(r.lexical_score::numeric, 9) as lexical_score,
           r.similarity,
           md5(coalesce(r.document_labels::text, '') || '|' || coalesce(r.document_summary, '')) as meta_hash
    from public.match_document_chunks_text(p_query, p_match_count, p_filters, p_owner) r;

  create temp table _parity_old as
    select row_number() over () as pos,
           r.id,
           round(r.text_rank::numeric, 9) as text_rank,
           round(r.hybrid_score::numeric, 9) as hybrid_score,
           round(r.lexical_score::numeric, 9) as lexical_score,
           r.similarity,
           md5(coalesce(r.document_labels::text, '') || '|' || coalesce(r.document_summary, '')) as meta_hash
    from public.match_document_chunks_text_legacy_parity(p_query, p_match_count, p_filters, p_owner) r;

  select count(*) into n_new from _parity_new;
  select count(*) into n_old from _parity_old;
  if n_new <> n_old then
    raise exception '[%] row-count mismatch: rewritten=% legacy=%', p_label, n_new, n_old;
  end if;

  select count(*) into score_mismatches
  from _parity_new n
  join _parity_old o using (pos)
  where (n.text_rank, n.hybrid_score, n.lexical_score, n.similarity)
    is distinct from (o.text_rank, o.hybrid_score, o.lexical_score, o.similarity);
  if score_mismatches > 0 then
    raise exception '[%] % positional score mismatches between rewritten and legacy results', p_label, score_mismatches;
  end if;

  -- Strict id + metadata parity for every row above the visible minimum rank;
  -- the boundary tie group is truncation-order dependent in both bodies.
  select min(text_rank) into boundary_rank from _parity_new;
  select count(*) into id_mismatches
  from (
    select id, meta_hash from _parity_new where text_rank > coalesce(boundary_rank, 0)
  ) n
  full outer join (
    select id, meta_hash from _parity_old where text_rank > coalesce(boundary_rank, 0)
  ) o using (id, meta_hash)
  where n.id is null or o.id is null;
  if id_mismatches > 0 then
    raise exception '[%] % non-boundary id/metadata mismatches between rewritten and legacy results', p_label, id_mismatches;
  end if;

  raise notice '[%] parity OK (% rows)', p_label, n_new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- Run parity across representative query shapes.
-- ---------------------------------------------------------------------------
do $$
declare
  filter_docs uuid[];
begin
  select array_agg(id) into filter_docs
  from (select id from public.documents order by title limit 5) f;

  perform pg_temp.assert_lexical_parity('chunk+title OR query', 'clozapine monitoring');
  perform pg_temp.assert_lexical_parity('and query', 'clozapine neutropenia');
  perform pg_temp.assert_lexical_parity('title-only query', 'escalation pathway');
  perform pg_temp.assert_lexical_parity('chunk-only query', 'troponin');
  perform pg_temp.assert_lexical_parity('lithium query', 'lithium toxicity');
  perform pg_temp.assert_lexical_parity('no-hit query', 'zzzznonexistenttermzzzz');
  perform pg_temp.assert_lexical_parity('empty query', '');
  perform pg_temp.assert_lexical_parity('document-filtered query', 'clozapine monitoring', 12, filter_docs);
  perform pg_temp.assert_lexical_parity('large match_count', 'clozapine monitoring', 64);
  perform pg_temp.assert_lexical_parity('null owner (fail-closed)', 'clozapine monitoring', 12, null, null);

  -- The seeded corpus is public, so the sentinel must find rows and the
  -- fail-closed null owner must find none — in both bodies.
  if (select count(*) from public.match_document_chunks_text('clozapine monitoring', 12, null,
        '00000000-0000-0000-0000-000000000000'::uuid)) = 0 then
    raise exception 'sentinel-owner query unexpectedly returned no rows; the parity run exercised nothing';
  end if;
  if (select count(*) from public.match_document_chunks_text('clozapine monitoring', 12, null, null)) <> 0 then
    raise exception 'null owner_filter must remain fail-closed';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Plan assertion: the candidate search must be index-driven. EXPLAIN cannot
-- see inside a non-inlined SQL function, so this mirrors the rewritten
-- candidate CTEs (keep in sync with the migration) and asserts the plan shape.
-- ---------------------------------------------------------------------------
do $$
declare
  plan jsonb;
begin
  execute $q$
    explain (format json)
    with query as (
      select websearch_to_tsquery('english', 'clozapine monitoring') as tsq
    ),
    chunk_hits as (
      select c.id
      from public.document_chunks c
      cross join query
      where c.search_tsv @@ query.tsq
    ),
    title_chunk_hits as (
      select c.id
      from public.documents d
      cross join query
      join public.document_chunks c on c.document_id = d.id
      where d.title_search_tsv @@ query.tsq
    ),
    lexical_candidates as (
      select chunk_hits.id from chunk_hits
      union
      select title_chunk_hits.id from title_chunk_hits
    )
    select count(*) from lexical_candidates
  $q$ into plan;

  -- The audited defect was the full sequential scan of document_chunks; that
  -- must never come back, and chunk candidates must come from the GIN index.
  if jsonb_path_exists(plan, '$.** ? (@."Node Type" == "Seq Scan" && @."Relation Name" == "document_chunks")') then
    raise exception 'plan check failed: candidate search sequential-scans document_chunks: %', plan;
  end if;
  if not jsonb_path_exists(plan, '$.** ? (@."Index Name" == "document_chunks_search_idx")') then
    raise exception 'plan check failed: document_chunks_search_idx unused: %', plan;
  end if;
  -- The documents table is orders of magnitude smaller; on small corpora the
  -- planner may legitimately prefer scanning it over its GIN index. Informational.
  if not jsonb_path_exists(plan, '$.** ? (@."Index Name" == "documents_title_search_idx")') then
    raise warning 'documents_title_search_idx unused on this corpus size (planner cost choice; documents scan is bounded by the documents table, not chunks)';
  else
    raise notice 'documents_title_search_idx in use for the title branch';
  end if;
  raise notice 'plan OK: chunk candidates come from document_chunks_search_idx, no document_chunks seq scan';
end $$;

-- ---------------------------------------------------------------------------
-- Timing comparison (informational; warns if the rewrite is not faster).
-- ---------------------------------------------------------------------------
do $$
declare
  sentinel constant uuid := '00000000-0000-0000-0000-000000000000';
  t0 timestamptz;
  legacy_ms numeric;
  rewritten_ms numeric;
begin
  perform count(*) from public.match_document_chunks_text_legacy_parity('clozapine monitoring', 12, null, sentinel);
  t0 := clock_timestamp();
  for i in 1..3 loop
    perform count(*) from public.match_document_chunks_text_legacy_parity('clozapine monitoring', 12, null, sentinel);
  end loop;
  legacy_ms := round((extract(epoch from clock_timestamp() - t0) * 1000 / 3)::numeric, 1);

  perform count(*) from public.match_document_chunks_text('clozapine monitoring', 12, null, sentinel);
  t0 := clock_timestamp();
  for i in 1..3 loop
    perform count(*) from public.match_document_chunks_text('clozapine monitoring', 12, null, sentinel);
  end loop;
  rewritten_ms := round((extract(epoch from clock_timestamp() - t0) * 1000 / 3)::numeric, 1);

  raise notice 'warm avg over 3 runs: legacy % ms, rewritten % ms', legacy_ms, rewritten_ms;
  if rewritten_ms > legacy_ms then
    raise warning 'rewritten lexical RPC was not faster on this corpus (legacy % ms vs rewritten % ms)',
      legacy_ms, rewritten_ms;
  end if;
end $$;

drop function public.match_document_chunks_text_legacy_parity(text, integer, uuid[], uuid);

\echo 'lexical-rpc-parity-check complete'
