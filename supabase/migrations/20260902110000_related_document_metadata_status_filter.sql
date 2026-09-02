-- Close the one retrieval RPC that serves a quarantined document (#ZBAC9D).
--
-- public.retrieval_owner_matches resolves the public sentinel to `row_owner_id is null`
-- with no check that the row actually carries the publication marker, so its public
-- branch matches ANY ownerless row. Every other retrieval RPC additionally requires
-- d.status = 'indexed', which is what keeps that gap unreachable in practice: the sole
-- writer that produces an ownerless row without the marker is the deleted-owner rollback
-- in 20260826090000_fail_closed_deleted_document_owner_rollback.sql, and it sets
-- status = 'failed' in the same statement.
--
-- get_related_document_metadata is the exception. It has no status filter at all, so a
-- quarantined row whose id reaches it is hydrated with its labels and summary. It is a
-- hydration RPC for ids that arrived from a status-filtering path, which is why the
-- exposure is narrow rather than zero — but "narrow" is not the contract this function
-- should have, and get_related_document_metadata_v2 delegates straight to it.
--
-- Adding the status filter can only REMOVE rows from a result, never widen visibility.
-- The owner-scoped branch (row_owner_id = owner_filter) is untouched, so an owner never
-- loses hydration for their own indexed documents.
--
-- Nothing else about the body changes; the added conjunct is the last line.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.get_related_document_metadata(
  document_ids uuid[],
  owner_filter uuid default null::uuid
)
returns table (document_id uuid, labels jsonb, summary text)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    d.id as document_id,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', l.id,
            'document_id', l.document_id,
            'owner_id', l.owner_id,
            'label', l.label,
            'label_type', l.label_type,
            'source', l.source,
            'confidence', l.confidence,
            'metadata', l.metadata,
            'created_at', l.created_at,
            'updated_at', l.updated_at
          )
          order by l.confidence desc, l.label
        )
        from public.document_labels l
        where l.document_id = d.id
          and (owner_filter is null or l.owner_id = owner_filter)
      ),
      '[]'::jsonb
    ) as labels,
    (
      select s.summary
      from public.document_summaries s
      where s.document_id = d.id
        and (owner_filter is null or s.owner_id = owner_filter)
      order by s.generated_at desc
      limit 1
    ) as summary
  from public.documents d
  where d.id = any(document_ids)
    and d.status = 'indexed'
    and public.retrieval_owner_matches(owner_filter, d.owner_id);
$$;

comment on function public.get_related_document_metadata(uuid[], uuid) is
  'Hydrates labels and summary for already-retrieved document ids. Requires status = ''indexed'' so a quarantined ownerless row (20260826090000) cannot be hydrated through the public sentinel (#ZBAC9D).';
