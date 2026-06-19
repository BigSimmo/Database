-- Migration to add dedicated foreign key indexes for public.documents(id) references
-- to optimize document-specific lookup times and prevent API statement timeouts.

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_sections_document_id_idx ON public.document_sections(document_id);
CREATE INDEX IF NOT EXISTS document_memory_cards_document_id_idx ON public.document_memory_cards(document_id);
CREATE INDEX IF NOT EXISTS document_images_document_id_idx ON public.document_images(document_id);
CREATE INDEX IF NOT EXISTS document_labels_document_id_idx ON public.document_labels(document_id);
CREATE INDEX IF NOT EXISTS document_embedding_fields_document_id_idx ON public.document_embedding_fields(document_id);
CREATE INDEX IF NOT EXISTS document_table_facts_document_id_idx ON public.document_table_facts(document_id);
CREATE INDEX IF NOT EXISTS document_index_quality_document_id_idx ON public.document_index_quality(document_id);
