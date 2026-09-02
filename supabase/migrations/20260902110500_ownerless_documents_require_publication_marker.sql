-- Make "ownerless means published" true by construction (#ZBAC9D).
--
-- The application layer already requires TWO signals to treat a document as public:
-- src/lib/documents/is-public-document.ts returns
--   recordedOwnerId(record, metadata) === null && metadata.public_corpus === true
-- and src/lib/public-api-access.ts filters on both. The database layer requires only one:
-- public.retrieval_owner_matches resolves the public sentinel to `row_owner_id is null`,
-- with no marker check, and retrieval_owner_matches_v2 does the same for include_public.
--
-- The ledger entry for #ZBAC9D proposed adding the marker check inside
-- retrieval_owner_matches. That cannot be written: the function receives two uuids and
-- never sees document metadata -- not without changing its signature and every call site,
-- which is the point. Doing it at those call sites -- twelve distinct retrieval functions --
-- would put every retrieval path in the blast radius of a predicate change, and the measured production
-- corpus is 2851 documents of which 2851 are ownerless — so a marker missing from even
-- one row would be a total retrieval outage rather than a degradation.
--
-- This takes the same route 20260901120000 took for the deletion half ("fix the foreign
-- key rather than the predicate"): constrain the WRITE side so the property retrieval
-- already assumes is guaranteed, and leave the retrieval predicates alone.
--
-- The third arm is not a loophole, it is the deliberate quarantine state.
-- 20260826090000_fail_closed_deleted_document_owner_rollback.sql strips the publication
-- marker from a row whose owner was deleted, precisely so an owner-scoped row cannot
-- become a public one, and sets status = 'failed' in the same statement (widened by
-- 20260902110200 to cover every ownerless landing state, not only the deleted-owner one).
-- Without that arm this constraint would break the rollback path it exists to complement.
-- With it, the invariant reads: an ownerless document is either published or quarantined,
-- never silently unmarked and retrievable.
--
-- Two writers produce the forbidden shape, not one. The rollback above is the SQL-side one.
-- The other is src/lib/registry-corpus.ts: registryDocumentRowPreservingOwner deliberately
-- keeps a stored null owner_id while registryDocumentRow rebuilds metadata from scratch
-- with no public_corpus key and a hard-coded status of 'indexed', so a registry sync while
-- the corpus is in public mode strips the marker. That is almost certainly the mechanism
-- behind the unmarked ownerless rows 20260825025032's header describes. It is fixed in the
-- same change; the path is behind the default-off RAG_REGISTRY_CORPUS_EMBEDDING flag.
--
-- The predicate tests the JSON boolean, not its text rendering. `metadata->>'public_corpus'
-- = 'true'` would also accept the STRING "true", which retrieval's public branch would then
-- serve while src/lib/documents/is-public-document.ts (`metadata.public_corpus === true`)
-- refused it -- the same asymmetry as #ZBAC9D, one level down. `metadata->'public_corpus' =
-- 'true'::jsonb` is exactly the application's test.
--
-- Added NOT VALID only, following 20260827100000: the Supabase integration applies each
-- migration in one transaction, and validating here would hold ADD CONSTRAINT's ACCESS
-- EXCLUSIVE lock across the full-table scan. VALIDATE CONSTRAINT runs in
-- 20260902111000, which needs only SHARE UPDATE EXCLUSIVE.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $migration$
declare
  violating_count integer;
begin
  select count(*)::integer
  into violating_count
  from public.documents
  where owner_id is null
    and (metadata->'public_corpus') is distinct from 'true'::jsonb
    and status <> 'failed';

  if violating_count > 0 then
    raise exception
      'documents holds % ownerless row(s) that are neither published (metadata->''public_corpus'' = ''true''::jsonb) nor quarantined (status = ''failed''). Resolve each row before applying this constraint: publish it, restore its owner, or quarantine it. Do not weaken the constraint to fit the data.',
      violating_count;
  end if;

  -- Second scan, for a violation the first cannot see. The rows above are checked in their
  -- CURRENT (public-mode, marked) state; document_corpus_access_snapshots records what they
  -- were BEFORE activation, and set_document_corpus_access_mode('private') restores from it.
  -- A snapshot row that would land ownerless without a true marker makes the rollback abort
  -- against this constraint. 20260902110200 widened the quarantine to cover exactly that, so
  -- this scan should find nothing -- and if it does, that migration did not take effect and
  -- the constraint must not land on top of a broken return-to-private control.
  select count(*)::integer
  into violating_count
  from public.document_corpus_access_snapshots snapshot
  join public.documents d on d.id = snapshot.document_id
  left join auth.users existing_owner on existing_owner.id = snapshot.owner_id
  join public.document_corpus_access_state state
    on state.singleton and state.activation_id = snapshot.activation_id
  where existing_owner.id is null
    and not (
      snapshot.owner_id is null
      and snapshot.public_corpus_present
      and snapshot.public_corpus_value = 'true'::jsonb
    )
    and d.status <> 'failed';

  if violating_count > 0 then
    raise exception
      'the active corpus-access snapshot holds % row(s) that set_document_corpus_access_mode(''private'') would restore as ownerless and unpublished, which this constraint would then reject -- aborting the rollback. Apply 20260902110200 first so those rows are quarantined instead.',
      violating_count;
  end if;
end
$migration$;

alter table public.documents
  drop constraint if exists documents_ownerless_requires_publication_marker;

alter table public.documents
  add constraint documents_ownerless_requires_publication_marker
  check (
    owner_id is not null
    or metadata->'public_corpus' = 'true'::jsonb
    or status = 'failed'
  )
  not valid;

comment on constraint documents_ownerless_requires_publication_marker on public.documents is
  'An ownerless document is either published (metadata->public_corpus is the JSON boolean true) or quarantined (status = failed). Makes the retrieval public sentinel''s owner_id IS NULL test equivalent to the application''s two-signal public test in src/lib/documents/is-public-document.ts (#ZBAC9D).';
