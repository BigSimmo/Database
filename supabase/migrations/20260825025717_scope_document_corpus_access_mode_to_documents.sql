-- Keep the reversible corpus switch on the authoritative document access row.
-- The filename matches the version recorded by the hosted migration operation.
--
-- The initial implementation also aligned high-volume derived artifact owner
-- columns. Production contains hundreds of thousands of those rows, while the
-- server authorizes a document before loading its derived records. Mutating
-- them is unnecessary for document visibility, makes the switch too slow for a
-- synchronous operational call, and expands the rollback surface. Preserve
-- those derived owners exactly as they are and change only documents.

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
    -- Snapshots keep a bare owner UUID. Reattach it only when auth.users still
    -- has that row so a deleted owner cannot abort the private-mode restore.
    update public.documents d
    set
      owner_id = existing_owner.id,
      metadata = case
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

comment on function public.set_document_corpus_access_mode(text) is
  'Service-role-only reversible switch for corpus-wide document visibility. Public mode snapshots and publishes document access rows; private mode restores them without rewriting derived artifacts.';

revoke all on function public.set_document_corpus_access_mode(text) from public, anon, authenticated;
grant execute on function public.set_document_corpus_access_mode(text) to service_role;
