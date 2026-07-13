-- Validate the three content-quality CHECK constraints (2026-07-13 audit,
-- finding 12). They were observed live as NOT VALID and codified as such in
-- 20260707000000_codify_live_observed_drift.sql; the audit's live inspection
-- found zero violating rows in all three tables. VALIDATE CONSTRAINT takes
-- only a SHARE UPDATE EXCLUSIVE lock (reads and writes continue) and turns
-- the guards into enforced invariants for existing rows too.

alter table public.document_chunks
  validate constraint document_chunks_content_not_blank;
alter table public.document_embedding_fields
  validate constraint document_embedding_fields_content_not_blank;
alter table public.document_index_units
  validate constraint document_index_units_content_not_blank;
