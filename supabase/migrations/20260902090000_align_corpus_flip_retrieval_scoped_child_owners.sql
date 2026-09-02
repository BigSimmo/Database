-- Publish the three derived tables whose OWN owner_id is a retrieval visibility
-- decision, in the same transaction as the documents they belong to.
--
-- The 20260825025717 header said mutating derived artifact owners is
-- "unnecessary for document visibility" because "the server authorizes a
-- document before loading its derived records". That rationale is correct for
-- the artifacts filtered through their parent document's owner, and wrong for
-- exactly three tables. public.get_related_document_metadata passes
-- document_labels.owner_id and document_summaries.owner_id to
-- public.retrieval_owner_matches, and public.match_document_table_facts_text
-- passes document_table_facts.owner_id, so for those rows a non-null owner is
-- itself the visibility answer. 20260901120000 names the same three tables
-- beside public.documents for the same reason.
--
-- Consequence before this migration: flipping a corpus that actually contains
-- owned documents published the documents and their chunks while the labels,
-- summaries and table facts of those documents stayed owner-scoped, so the
-- public sentinel ('00000000-0000-0000-0000-000000000000' -> row_owner_id is
-- null) matched none of them. Answer context silently lost that evidence. The
-- degradation fails closed, and no live row is affected today (every document
-- currently has owner_id null), but it lands the first time the switch is used
-- for its purpose.
--
-- Scope and reversibility:
--   * The publish updates are bounded to child rows whose owner still equals
--     the snapshotted document owner, which is the ownership invariant
--     public.publish_approved_documents enforces before it nulls the same
--     columns. A child row that disagrees with its document is left alone
--     rather than published on a guess.
--   * The private branch restores those rows from the same snapshot, joined to
--     auth.users so a deleted owner is never re-attached. Those columns are
--     `on delete restrict` (20260901120000), so the stale uuid cannot be
--     written back; the rows stay ownerless beside the document that the
--     20260826090000 rollback already quarantines with status = 'failed'.
--   * Only these three tables are touched. document_sections,
--     document_memory_cards, document_embedding_fields, document_index_quality,
--     document_index_units, chunks, pages and images are filtered through their
--     parent document's owner and are still never rewritten by the switch.
--   * statement_timeout is pinned on the function so the added scans keep the
--     switch a bounded synchronous operational call; exceeding it rolls the
--     whole flip back rather than leaving a half-published corpus.
--
-- Retrieval predicates, ranking, ordering and selection are unchanged: this
-- migration only moves rows to the side of the existing public predicate where
-- their parent document already sits.
--
-- Replaces the function through a new version because every earlier version was
-- already recorded by the hosted migration operation.

create or replace function public.set_document_corpus_access_mode(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '15s'
set statement_timeout = '120s'
as $$
declare
  v_state public.document_corpus_access_state%rowtype;
  v_activation_id uuid;
  v_snapshot_count integer;
  v_document_count integer;
  v_public_count integer;
begin
  if p_mode not in ('private', 'public') then
    raise exception 'document corpus access mode must be private or public'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('document-corpus-access-mode', 0));

  select *
  into v_state
  from public.document_corpus_access_state
  where singleton
  for update;

  if not found then
    raise exception 'document corpus access state is missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_trigger
    where tgrelid = 'public.documents'::regclass
      and tgname = 'documents_require_publication_approval'
      and not tgisinternal
  ) then
    raise exception 'documents publication guard trigger is missing';
  end if;

  if p_mode = 'public' then
    v_activation_id := case
      when v_state.mode = 'public' then v_state.activation_id
      else extensions.gen_random_uuid()
    end;

    insert into public.document_corpus_access_snapshots (
      activation_id,
      document_id,
      owner_id,
      public_corpus_present,
      public_corpus_value
    )
    select
      v_activation_id,
      d.id,
      d.owner_id,
      coalesce(d.metadata, '{}'::jsonb) ? 'public_corpus',
      coalesce(d.metadata, '{}'::jsonb)->'public_corpus'
    from public.documents d
    on conflict (activation_id, document_id) do nothing;

    -- ALTER TABLE takes an ACCESS EXCLUSIVE lock. The trigger bypass is
    -- therefore invisible to concurrent sessions and rolls back on failure.
    execute 'alter table public.documents disable trigger documents_require_publication_approval';
    update public.documents d
    set
      owner_id = null,
      metadata = pg_catalog.jsonb_set(coalesce(d.metadata, '{}'::jsonb), '{public_corpus}', 'true'::jsonb, true),
      updated_at = now()
    where exists (
      select 1 from public.document_corpus_access_snapshots snapshot
      where snapshot.activation_id = v_activation_id and snapshot.document_id = d.id
    )
      and (
        d.owner_id is not null
        or coalesce(d.metadata, '{}'::jsonb)->'public_corpus' is distinct from 'true'::jsonb
      );
    execute 'alter table public.documents enable trigger documents_require_publication_approval';

    -- The three derived tables whose own owner_id reaches a retrieval owner
    -- predicate. Bounded to rows that still carry the snapshotted document
    -- owner, so the private branch restores exactly this set.
    update public.document_labels l
    set owner_id = null, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id
      and snapshot.document_id = l.document_id
      and l.owner_id = snapshot.owner_id;

    update public.document_summaries s
    set owner_id = null, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id
      and snapshot.document_id = s.document_id
      and s.owner_id = snapshot.owner_id;

    update public.document_table_facts f
    set owner_id = null
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id
      and snapshot.document_id = f.document_id
      and f.owner_id = snapshot.owner_id;

    update public.document_corpus_access_state
    set
      mode = 'public',
      activation_id = v_activation_id,
      activated_at = coalesce(activated_at, now()),
      updated_at = now()
    where singleton;
  else
    if v_state.mode = 'private' then
      select count(*)::integer into v_document_count from public.documents;
      return pg_catalog.jsonb_build_object(
        'mode', 'private',
        'changed', false,
        'document_count', v_document_count
      );
    end if;

    v_activation_id := v_state.activation_id;

    execute 'alter table public.documents disable trigger documents_require_publication_approval';
    update public.documents d
    set
      owner_id = existing_owner.id,
      status = case
        when snapshot.owner_id is not null and existing_owner.id is null then 'failed'
        else d.status
      end,
      metadata = case
        -- Restoring a public marker without its former owner would turn an
        -- owner-scoped row into a public row. Remove the marker instead.
        when snapshot.owner_id is not null and existing_owner.id is null then
          coalesce(d.metadata, '{}'::jsonb) - 'public_corpus'
        when snapshot.public_corpus_present then
          pg_catalog.jsonb_set(
            coalesce(d.metadata, '{}'::jsonb),
            '{public_corpus}',
            snapshot.public_corpus_value,
            true
          )
        else coalesce(d.metadata, '{}'::jsonb) - 'public_corpus'
      end,
      updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    left join auth.users existing_owner on existing_owner.id = snapshot.owner_id
    where snapshot.activation_id = v_activation_id and snapshot.document_id = d.id;
    execute 'alter table public.documents enable trigger documents_require_publication_approval';

    -- Restore the derived owners this activation published. The inner join to
    -- auth.users keeps a deleted owner unrestorable rather than reattaching a
    -- stale uuid that the owner foreign key would reject anyway; those rows
    -- stay ownerless beside their quarantined document.
    update public.document_labels l
    set owner_id = existing_owner.id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    join auth.users existing_owner on existing_owner.id = snapshot.owner_id
    where snapshot.activation_id = v_activation_id
      and snapshot.document_id = l.document_id
      and l.owner_id is null;

    update public.document_summaries s
    set owner_id = existing_owner.id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    join auth.users existing_owner on existing_owner.id = snapshot.owner_id
    where snapshot.activation_id = v_activation_id
      and snapshot.document_id = s.document_id
      and s.owner_id is null;

    update public.document_table_facts f
    set owner_id = existing_owner.id
    from public.document_corpus_access_snapshots snapshot
    join auth.users existing_owner on existing_owner.id = snapshot.owner_id
    where snapshot.activation_id = v_activation_id
      and snapshot.document_id = f.document_id
      and f.owner_id is null;

    update public.document_corpus_access_state
    set mode = 'private', activation_id = null, activated_at = null, updated_at = now()
    where singleton;
  end if;

  select count(*)::integer
  into v_snapshot_count
  from public.document_corpus_access_snapshots
  where activation_id = v_activation_id;

  select
    count(*)::integer,
    count(*) filter (
      where owner_id is null and coalesce(metadata, '{}'::jsonb)->'public_corpus' = 'true'::jsonb
    )::integer
  into v_document_count, v_public_count
  from public.documents;

  return pg_catalog.jsonb_build_object(
    'mode', p_mode,
    'changed', true,
    'activation_id', v_activation_id,
    'snapshot_count', v_snapshot_count,
    'document_count', v_document_count,
    'public_document_count', v_public_count
  );
end;
$$;

comment on function public.set_document_corpus_access_mode(text) is
  'Service-role-only reversible switch for corpus-wide document visibility. Public mode snapshots and publishes document access rows together with the three derived owner columns that are themselves retrieval visibility decisions (document_labels, document_summaries, document_table_facts); private mode restores surviving owners and quarantines deleted-owner rows from document and retrieval reads. Derived artifacts filtered through their parent document owner are never rewritten.';

revoke all on function public.set_document_corpus_access_mode(text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_document_corpus_access_mode(text) to service_role;
