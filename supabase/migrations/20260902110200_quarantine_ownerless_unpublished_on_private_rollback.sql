-- Widen the deleted-owner quarantine so returning to private mode cannot produce an
-- ownerless, unpublished, indexed document (#ZBAC9D).
--
-- 20260826090000 quarantines a row whose owner was deleted: it strips the publication
-- marker, precisely so an owner-scoped row cannot become a public one, and sets
-- status = 'failed' in the same statement. Its condition is
-- `snapshot.owner_id is not null and existing_owner.id is null` -- it fires only when there
-- WAS an owner and that owner is gone.
--
-- That misses the row which was already ownerless and unmarked when public mode was
-- activated. 20260825025032 documents exactly this population in its own header: "the
-- production corpus predates publication approvals: many deliberately public rows are
-- ownerless but do not carry metadata.public_corpus=true". For such a row the rollback
-- falls through to `else coalesce(d.metadata, '{}') - 'public_corpus'`, leaves status
-- untouched, and restores it as ownerless + unmarked + indexed.
--
-- Before documents_ownerless_requires_publication_marker that was silent -- the very
-- divergence #ZBAC9D is about. After it, the CHECK rejects the write and the whole
-- set_document_corpus_access_mode('private') call rolls back, so the operator loses the
-- documented return-to-private control at the moment they need it. The preflight in
-- 20260902110500 cannot catch it either: it scans public.documents in its current (marked)
-- state, not document_corpus_access_snapshots, so the breakage would be latent.
--
-- The new condition keys off the state the row LANDS in rather than the state it came from:
-- quarantine whenever it ends ownerless and its restored marker is not the JSON boolean
-- true. The deleted-owner case still satisfies it, so that behaviour is unchanged. Nothing
-- else in the function is modified.
--
-- Ordered before 20260902110500 so the rollback is safe before the constraint exists,
-- not after.

set local search_path = public, extensions, pg_catalog;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create or replace function public.set_document_corpus_access_mode(p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '15s'
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
      -- Quarantine whenever the row LANDS ownerless without a true publication marker,
      -- not only when its owner was deleted (#ZBAC9D). The original condition
      -- (`snapshot.owner_id is not null and existing_owner.id is null`) missed the row that
      -- was ALREADY ownerless and unmarked when public mode was activated -- the shape
      -- 20260825025032 names in its own header: "the production corpus predates publication
      -- approvals: many deliberately public rows are ownerless but do not carry
      -- metadata.public_corpus=true". Restoring such a row to ownerless-unmarked-indexed
      -- is exactly what documents_ownerless_requires_publication_marker forbids, so without
      -- this widening the constraint would abort the whole return-to-private call.
      status = case
        when existing_owner.id is null
          and not (
            snapshot.owner_id is null
            and snapshot.public_corpus_present
            and snapshot.public_corpus_value = 'true'::jsonb
          )
        then 'failed'
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
revoke all on function public.set_document_corpus_access_mode(text)
  from public, anon, authenticated;
grant execute on function public.set_document_corpus_access_mode(text) to service_role;
