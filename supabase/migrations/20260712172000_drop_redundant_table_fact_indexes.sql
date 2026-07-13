-- These left-prefix indexes are covered by the existing canonical composites:
--   document_table_facts_document_idx (document_id, page_number)
--   document_table_facts_owner_document_page_idx (owner_id, document_id, page_number)
drop index if exists public.document_table_facts_document_id_idx;
drop index if exists public.document_table_facts_owner_idx;
