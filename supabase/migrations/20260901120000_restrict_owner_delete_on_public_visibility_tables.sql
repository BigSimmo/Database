-- Close the orphaned-document republication hazard (/issues #ZBAC9D).
--
-- A null `owner_id` independently means "public corpus" to retrieval, and these
-- owner foreign keys were `on delete set null`. Deleting an auth user therefore
-- converted that user's private rows into public ones, silently: the retrieval
-- predicates resolve the public sentinel to `row_owner_id is null` and check no
-- published marker.
--
-- Fix the foreign key rather than the predicate. `public.retrieval_owner_matches`
-- (and `..._v2`) are only unsafe because the FK can manufacture null owners; make
-- that impossible and "null owner = deliberately published" holds by construction.
-- This alters no query result, so there is no retrieval behaviour change and no
-- eval canary is required.
--
-- Scope is exactly the four tables whose OWN `owner_id` is passed to a retrieval
-- owner predicate, i.e. where a null owner means public:
--   public.documents             (25 call sites across retrieval_owner_matches and _v2)
--   public.document_labels       (1)
--   public.document_summaries    (1)
--   public.document_table_facts  (1)
-- Deliberately NOT included: document_sections, document_embedding_fields,
-- document_memory_cards and document_index_units are filtered through their parent
-- document's owner, never their own, so a null owner carries no visibility meaning
-- there. Nor are the retention tables (audit_logs, rag_queries, rag_retrieval_logs,
-- rag_query_misses, rag_answer_feedback, import_batches, storage_cleanup_jobs,
-- rag_visual_eval_cases, document_index_quality): for those, nulling the owner on
-- user deletion is deliberate retention behaviour and must be preserved.
--
-- Operational consequence, intended: deleting an auth user who still owns rows in
-- these tables now FAILS instead of orphaning them. Any account-deletion flow must
-- reassign or delete that user's documents first. Failing closed is the correct
-- posture for a clinical corpus.
--
-- Foreign-key validation only inspects non-null values. A read-only production
-- count on 2026-09-01 recorded 2851 documents with zero non-null `owner_id`, so
-- validation on public.documents is expected to be trivial. The same was not
-- separately measured for the other three tables; each is a child of documents and
-- is expected to be null-owned throughout, and any non-null value that does exist
-- must reference a live auth user for the constraint to be accepted. If validation
-- fails, that itself is a finding: it means a row references a deleted user.
--
-- Runs inside the single transaction the Supabase integration wraps each migration
-- in. `alter table ... drop constraint` / `add constraint` is fully transactional.

set local lock_timeout = '10s';
set local statement_timeout = '120s';

alter table public.documents
  drop constraint documents_owner_id_fkey;
alter table public.documents
  add constraint documents_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.document_labels
  drop constraint document_labels_owner_id_fkey;
alter table public.document_labels
  add constraint document_labels_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.document_summaries
  drop constraint document_summaries_owner_id_fkey;
alter table public.document_summaries
  add constraint document_summaries_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete restrict;

alter table public.document_table_facts
  drop constraint document_table_facts_owner_id_fkey;
alter table public.document_table_facts
  add constraint document_table_facts_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete restrict;

-- Fail fast if any of the four did not take, rather than recording a migration
-- whose statements did not achieve their effect (the #Q5JHBJ failure shape).
do $$
declare
  wrong text[];
begin
  select array_agg(c.conname order by c.conname)
    into wrong
  from pg_catalog.pg_constraint c
  join pg_catalog.pg_class t on t.oid = c.conrelid
  join pg_catalog.pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and c.contype = 'f'
    and c.conname in (
      'documents_owner_id_fkey',
      'document_labels_owner_id_fkey',
      'document_summaries_owner_id_fkey',
      'document_table_facts_owner_id_fkey'
    )
    and c.confdeltype <> 'r'; -- 'r' = RESTRICT

  if wrong is not null then
    raise exception
      'owner foreign keys still not ON DELETE RESTRICT: %', array_to_string(wrong, ', ');
  end if;
end;
$$;
