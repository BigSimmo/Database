alter table public.document_embedding_fields
  drop constraint if exists document_embedding_fields_field_type_check;

alter table public.document_embedding_fields
  add constraint document_embedding_fields_field_type_check
  check (
    field_type in (
      'document_title',
      'document_summary',
      'section_context',
      'memory_card',
      'chunk_high_yield',
      'table_row',
      'image_caption',
      'clinical_action',
      'threshold_fact'
    )
  );
