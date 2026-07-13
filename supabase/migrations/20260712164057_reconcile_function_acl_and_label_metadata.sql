-- Reconcile the service-only function ACL already declared by schema.sql.
revoke insert, update, delete on table public.document_labels from authenticated;

revoke execute on function public.detect_legacy_ivfflat_indexes() from public, anon, authenticated;
grant execute on function public.detect_legacy_ivfflat_indexes() to service_role;

revoke execute on function public.document_summary_text(uuid) from public, anon, authenticated;
grant execute on function public.document_summary_text(uuid) to service_role;

revoke execute on function public.set_document_embedding_field_content_hash() from public, anon, authenticated;
grant execute on function public.set_document_embedding_field_content_hash() to service_role;

-- Codify hidden-label filtering that was already present in schema.sql.
create or replace function public.document_label_metadata(p_document_id uuid)
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    jsonb_agg(
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
    ),
    '[]'::jsonb
  )
  from public.document_labels l
  where l.document_id = p_document_id
    and coalesce(l.metadata->>'review_status', 'new') <> 'hidden'
    and coalesce(l.metadata->>'hidden', 'false') <> 'true';
$$;

revoke execute on function public.document_label_metadata(uuid) from public, anon, authenticated;
grant execute on function public.document_label_metadata(uuid) to service_role;
