-- Record the already-completed RAG index repair without rebuilding indexes in a
-- transactional migration. Production creation and validation happened before
-- this version was marked applied; fresh replays receive the same definitions
-- from 20260705180000_reconcile_search_health_indexes.sql and schema.sql.
--
-- Plain CREATE INDEX here would hold write-blocking locks for the duration of
-- each build. A drifted hosted target must instead prebuild every missing index
-- with CREATE INDEX CONCURRENTLY outside a transaction, validate pg_index
-- indisvalid/indisready plus the canonical definition, and only then mark this
-- migration applied. This guard fails fast if that operator step was skipped.

set search_path = public, extensions, pg_catalog;
set lock_timeout = '5s';
set statement_timeout = '30s';

do $migration$
declare
  missing_indexes text[];
begin
  select array_agg(index_name order by index_name)
  into missing_indexes
  from unnest(
    array[
      'document_labels_label_trgm_idx',
      'document_summaries_summary_trgm_idx',
      'document_index_units_owner_chunk_type_idx',
      'rag_retrieval_logs_miss_idx'
    ]::text[]
  ) as required(index_name)
  where to_regclass(format('public.%I', index_name)) is null;

  if missing_indexes is not null then
    raise exception
      'RAG index repair was not prebuilt; create missing indexes concurrently outside the migration transaction, validate them, then mark this version applied. Missing: %',
      array_to_string(missing_indexes, ', ');
  end if;
end
$migration$;
