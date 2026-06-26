-- Remove the pre-hardening ingestion_job_stages index name after the canonical
-- document/started index was introduced.
drop index if exists public.ingestion_job_stages_doc_idx;
