create or replace function public.chunk_image_metadata(chunk_image_ids uuid[])
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'page_number', i.page_number,
        'storage_path', i.storage_path,
        'caption', i.caption,
        'bbox', i.bbox,
        'image_type', i.image_type,
        'searchable', i.searchable,
        'clinical_relevance_score', i.clinical_relevance_score,
        'source_kind', i.source_kind,
        'sourceKind', i.source_kind,
        'tableLabel', nullif(i.metadata->>'table_label', ''),
        'tableTitle', nullif(i.metadata->>'table_title', ''),
        'tableRole', nullif(i.metadata->>'table_role', ''),
        'tableTextSnippet', nullif(left(coalesce(i.metadata->>'table_text_snippet', i.metadata->>'table_text', ''), 500), ''),
        'width', i.width,
        'height', i.height,
        'labels', i.labels,
        'metadata', i.metadata
      )
      order by i.page_number nulls last, i.created_at
    ),
    '[]'::jsonb
  )
  from public.document_images i
  where i.id = any(chunk_image_ids)
    and i.searchable = true
    and i.image_type <> 'logo_decorative';
$$;
