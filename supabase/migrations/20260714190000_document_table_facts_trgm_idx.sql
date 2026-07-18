-- Intentionally a no-op.
--
-- An earlier revision of this migration created
-- public.document_table_facts_text_trgm_idx, but
-- 20260717010000_harden_rag_scalability_patch.sql always drops that index.
-- Keeping a transactional CREATE here forced fresh replays to pay for a write-
-- blocking build that is immediately discarded. Environments that already
-- applied the CREATE still clean up via the harden migration's DROP INDEX IF EXISTS.
select 1;
