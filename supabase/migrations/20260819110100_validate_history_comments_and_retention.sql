-- Phase 6.2 history guard (plan section 6.2; forensics section 1.1 / 3.7 / '6.2 completion'):
-- validate the catalog comments and the retention cron job that two hand-applied, mark-applied
-- versions left behind. Ledger anchor #Q5JHBJ (#316 umbrella).
--
--   20260702100000 add_claim_ingestion_jobs_comment -> COMMENT ON FUNCTION public.claim_ingestion_jobs(text,
--       integer, integer) documenting the dual-lock FOR UPDATE OF j, d SKIP LOCKED pattern. A comment
--       survives CREATE OR REPLACE, so later bodies do not clear it. This is a pg_description write, not
--       an empty file, which is why the version is not a `no_ddl` allowlist class.
--   20260702120000 rag_retrieval_logs_retention      -> COMMENT ON TABLE public.audit_logs (kept
--       indefinitely), COMMENT ON TABLE public.rag_retrieval_logs (90-day purge), and the pg_cron job
--       purge-rag-retrieval-logs. The job is validated only where the cron schema exists: production has
--       pg_cron; staging and the bare scratch image do not, and the original migration itself returns
--       early there, so absence of the schema is the recorded no-op path rather than a failure.
--
-- Like 20260804110240 this migration VALIDATES and never writes: it reads obj_description() and cron.job
-- (dynamically, so it parses on databases without the schema) and raises once, naming every failure.
-- Timeouts use SET LOCAL so they do not leak into later migrations on the same CLI session connection.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  missing_objects text[] := array[]::text[];
  mismatched_objects text[] := array[]::text[];
  function_oid regprocedure;
  comment_text text;
  cron_job_present boolean;
begin
  -- 20260702100000: claim_ingestion_jobs function comment
  function_oid := to_regprocedure('public.claim_ingestion_jobs(text,integer,integer)');
  if function_oid is null then
    missing_objects := array_append(missing_objects, 'claim_ingestion_jobs(text,integer,integer)');
  else
    comment_text := obj_description(function_oid::oid, 'pg_proc');
    if comment_text is null then
      missing_objects := array_append(missing_objects, 'comment on function claim_ingestion_jobs');
    elsif position('FOR UPDATE OF j, d SKIP LOCKED' in comment_text) = 0 then
      mismatched_objects := array_append(mismatched_objects, 'comment on function claim_ingestion_jobs');
    end if;
  end if;

  -- 20260702120000: audit_logs table comment
  if to_regclass('public.audit_logs') is null then
    missing_objects := array_append(missing_objects, 'audit_logs');
  else
    comment_text := obj_description(to_regclass('public.audit_logs')::oid, 'pg_class');
    if comment_text is null then
      missing_objects := array_append(missing_objects, 'comment on table audit_logs');
    elsif position('retained indefinitely' in comment_text) = 0 then
      mismatched_objects := array_append(mismatched_objects, 'comment on table audit_logs');
    end if;
  end if;

  -- 20260702120000: rag_retrieval_logs table comment
  if to_regclass('public.rag_retrieval_logs') is null then
    missing_objects := array_append(missing_objects, 'rag_retrieval_logs');
  else
    comment_text := obj_description(to_regclass('public.rag_retrieval_logs')::oid, 'pg_class');
    if comment_text is null then
      missing_objects := array_append(missing_objects, 'comment on table rag_retrieval_logs');
    elsif position('purge-rag-retrieval-logs' in comment_text) = 0 then
      mismatched_objects := array_append(mismatched_objects, 'comment on table rag_retrieval_logs');
    end if;
  end if;

  -- 20260702120000: the nightly purge job, only where pg_cron is installed
  if to_regnamespace('cron') is not null then
    execute 'select exists (select 1 from cron.job where jobname = $1)'
      into cron_job_present
      using 'purge-rag-retrieval-logs';
    if not coalesce(cron_job_present, false) then
      missing_objects := array_append(missing_objects, 'cron job purge-rag-retrieval-logs');
    end if;
  end if;

  if cardinality(missing_objects) > 0 or cardinality(mismatched_objects) > 0 then
    raise exception
      'History guard 20260819110100: the catalog comments / retention cron job that 20260702100000 and 20260702120000 recorded are not in place; re-apply those two files out of band (COMMENT ON and cron.schedule are idempotent), then apply this version. Missing: %; Invalid: (none); Mismatched: %',
      coalesce(nullif(array_to_string(missing_objects, ', '), ''), '(none)'),
      coalesce(nullif(array_to_string(mismatched_objects, ', '), ''), '(none)');
  end if;
end
$migration$;
