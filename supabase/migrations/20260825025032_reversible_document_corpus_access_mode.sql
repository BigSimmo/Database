-- Provide an explicit, reversible corpus-wide visibility switch. The filename
-- matches the version recorded by the hosted migration operation.
--
-- The production corpus predates publication approvals: many deliberately
-- public rows are ownerless but do not carry metadata.public_corpus=true.
-- The application now requires both signals, so those rows fail closed in the
-- document viewer even though legacy retrieval still returns them.
--
-- This migration only installs the switch. Enabling public mode remains a
-- separate, explicit service-role operation:
--   select public.set_document_corpus_access_mode('public');
-- Restore the exact captured owner/public-marker state with:
--   select public.set_document_corpus_access_mode('private');

create table if not exists public.document_corpus_access_state (
  singleton boolean primary key default true check (singleton),
  mode text not null check (mode in ('private', 'public')),
  activation_id uuid,
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((mode = 'public') = (activation_id is not null))
);

create table if not exists public.document_corpus_access_snapshots (
  activation_id uuid not null,
  document_id uuid not null references public.documents(id) on delete cascade,
  owner_id uuid,
  public_corpus_present boolean not null,
  public_corpus_value jsonb,
  captured_at timestamptz not null default now(),
  primary key (activation_id, document_id),
  check (public_corpus_present or public_corpus_value is null)
);

alter table public.document_corpus_access_state enable row level security;
alter table public.document_corpus_access_snapshots enable row level security;

revoke all on table public.document_corpus_access_state from public, anon, authenticated, service_role;
revoke all on table public.document_corpus_access_snapshots from public, anon, authenticated, service_role;
grant select on table public.document_corpus_access_state to service_role;
grant select on table public.document_corpus_access_snapshots to service_role;

insert into public.document_corpus_access_state (singleton, mode)
values (true, 'private')
on conflict (singleton) do nothing;

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

  -- Serialize access-mode changes and keep the publication-guard trigger's
  -- short disable window inside this transaction's ACCESS EXCLUSIVE lock.
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

    -- Keep retrieval artifacts in the same ownership scope as their document,
    -- matching the governed publication function's existing table set.
    update public.document_labels row
    set owner_id = null, updated_at = now()
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );
    update public.document_summaries row
    set owner_id = null, updated_at = now()
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );
    update public.document_sections row
    set owner_id = null, updated_at = now()
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );
    update public.document_memory_cards row
    set owner_id = null, updated_at = now()
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );
    update public.document_table_facts row
    set owner_id = null
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );
    update public.document_embedding_fields row
    set owner_id = null
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );
    update public.document_index_quality row
    set owner_id = null, updated_at = now()
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );
    update public.document_index_units row
    set owner_id = null, updated_at = now()
    where row.owner_id is not null
      and exists (
        select 1 from public.document_corpus_access_snapshots snapshot
        where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id
      );

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
        or not coalesce((d.metadata->>'public_corpus')::boolean, false)
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

    update public.document_labels row
    set owner_id = snapshot.owner_id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;
    update public.document_summaries row
    set owner_id = snapshot.owner_id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;
    update public.document_sections row
    set owner_id = snapshot.owner_id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;
    update public.document_memory_cards row
    set owner_id = snapshot.owner_id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;
    update public.document_table_facts row
    set owner_id = snapshot.owner_id
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;
    update public.document_embedding_fields row
    set owner_id = snapshot.owner_id
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;
    update public.document_index_quality row
    set owner_id = snapshot.owner_id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;
    update public.document_index_units row
    set owner_id = snapshot.owner_id, updated_at = now()
    from public.document_corpus_access_snapshots snapshot
    where snapshot.activation_id = v_activation_id and snapshot.document_id = row.document_id;

    execute 'alter table public.documents disable trigger documents_require_publication_approval';
    update public.documents d
    set
      owner_id = snapshot.owner_id,
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
      where owner_id is null and coalesce((metadata->>'public_corpus')::boolean, false)
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
  'Service-role-only reversible switch for corpus-wide document visibility. Public mode snapshots owner/public-marker state; private mode restores it.';

revoke all on function public.set_document_corpus_access_mode(text) from public, anon, authenticated;
grant execute on function public.set_document_corpus_access_mode(text) to service_role;
