-- Migration to add GIN trigram index on document_table_facts text fields for performance optimization
create index if not exists document_table_facts_text_trgm_idx
  on public.document_table_facts using gin (
    lower(
      coalesce(table_title, '') || ' ' ||
      coalesce(row_label, '') || ' ' ||
      coalesce(clinical_parameter, '') || ' ' ||
      coalesce(threshold_value, '') || ' ' ||
      coalesce(action, '')
    ) extensions.gin_trgm_ops
  );
