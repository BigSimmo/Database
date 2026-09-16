-- Durable site-content health evidence and database-derived publication authority.

do $$
begin
  if exists (select 1 from public.site_content_publications) then
    raise exception using errcode = '55000', message = 'site_content_task4_requires_empty_publications';
  end if;
end;
$$;

create table public.site_content_sync_worker_invocations (
  invocation_id uuid primary key,
  worker_id uuid not null,
  started_at timestamptz not null default pg_catalog.clock_timestamp(),
  admission_expires_at timestamptz not null,
  terminal_phase text check (terminal_phase in ('succeeded', 'failed')),
  terminal_at timestamptz,
  outcome_code text check (outcome_code in (
    'idle', 'ready', 'claim_failed', 'event_failed', 'lease_lost', 'worker_failed', 'invocation_expired'
  )),
  check (admission_expires_at = started_at + interval '5 minutes'),
  check ((terminal_phase is null and terminal_at is null and outcome_code is null)
    or (terminal_phase is not null and terminal_at is not null and outcome_code is not null))
);

create index site_content_sync_worker_invocations_started_at_idx
on public.site_content_sync_worker_invocations (started_at desc, invocation_id desc);

create index site_content_sync_worker_invocations_successful_terminal_at_idx
on public.site_content_sync_worker_invocations (terminal_at desc)
where terminal_phase = 'succeeded' and outcome_code in ('idle', 'ready');

create trigger site_content_sync_worker_invocations_identity_immutable
before update of invocation_id, worker_id, started_at, admission_expires_at
on public.site_content_sync_worker_invocations
for each row execute function public.guard_site_content_immutable_row();

create trigger site_content_sync_worker_invocations_delete_immutable
before delete on public.site_content_sync_worker_invocations
for each row execute function public.guard_site_content_immutable_row();

create or replace function public.record_site_content_sync_worker_invocation(
  p_worker_id uuid, p_invocation_id uuid, p_phase text, p_outcome_code text default null
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz;
  v_row public.site_content_sync_worker_invocations%rowtype;
  v_active public.site_content_sync_worker_invocations%rowtype;
begin
  if p_worker_id is null or p_invocation_id is null or p_phase is null
    or p_phase not in ('started', 'succeeded', 'failed') then
    return false;
  end if;
  if (p_phase = 'started' and p_outcome_code is not null)
    or (p_phase = 'succeeded' and (p_outcome_code is null or p_outcome_code not in ('idle', 'ready')))
    or (p_phase = 'failed' and (p_outcome_code is null
      or p_outcome_code not in ('claim_failed', 'event_failed', 'lease_lost', 'worker_failed'))) then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(93206432);
  v_now := pg_catalog.clock_timestamp();
  select * into v_row from public.site_content_sync_worker_invocations
  where invocation_id = p_invocation_id for update;
  if p_phase = 'started' then
    if found then
      if v_row.worker_id is distinct from p_worker_id or v_row.terminal_phase is not null then return false; end if;
      if v_row.admission_expires_at <= v_now then
        update public.site_content_sync_worker_invocations
        set terminal_phase = 'failed', terminal_at = v_now, outcome_code = 'invocation_expired'
        where invocation_id = p_invocation_id and terminal_phase is null;
        return false;
      end if;
      return true;
    end if;
    select * into v_active from public.site_content_sync_worker_invocations
    where terminal_phase is null order by started_at, invocation_id limit 1 for update;
    if found and v_active.admission_expires_at > v_now then return false; end if;
    if found then
      update public.site_content_sync_worker_invocations
      set terminal_phase = 'failed', terminal_at = v_now, outcome_code = 'invocation_expired'
      where invocation_id = v_active.invocation_id and terminal_phase is null;
    end if;
    insert into public.site_content_sync_worker_invocations(
      invocation_id, worker_id, started_at, admission_expires_at
    ) values (p_invocation_id, p_worker_id, v_now, v_now + interval '5 minutes');
    return true;
  end if;
  if not found or v_row.worker_id is distinct from p_worker_id then return false; end if;
  if v_row.terminal_phase is not null then
    return v_row.terminal_phase = p_phase and v_row.outcome_code = p_outcome_code;
  end if;
  if v_row.admission_expires_at <= v_now then
    update public.site_content_sync_worker_invocations
    set terminal_phase = 'failed', terminal_at = v_now, outcome_code = 'invocation_expired'
    where invocation_id = p_invocation_id and terminal_phase is null;
    return false;
  end if;
  update public.site_content_sync_worker_invocations
  set terminal_phase = p_phase, terminal_at = v_now, outcome_code = p_outcome_code
  where invocation_id = p_invocation_id and worker_id = p_worker_id and terminal_phase is null;
  return found;
end;
$$;

alter table public.site_content_publications
  add column administrator_authorized_at timestamptz not null,
  add column administrator_authorization_version text not null
    check (administrator_authorization_version = 'site-content-admin-authorization-v1');

drop function if exists public.publish_site_content_record(text, uuid, text, bigint, text, text, text, uuid);
drop function if exists public.retire_site_content_record(text, uuid, text, bigint, text, text, text, uuid);

create or replace function public.publish_site_content_record(
  p_kind text, p_source_row_id uuid, p_expected_source_version text,
  p_expected_change_epoch bigint, p_reconciliation_plan_digest text,
  p_expected_record_digest text, p_expected_projection_digest text
)
returns table (outcome text, conflict_code text, logical_id text, publication_id uuid, event_sequence bigint, change_epoch bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_source record;
  v_existing public.site_content_public_records%rowtype;
  v_publication_id uuid := gen_random_uuid();
  v_event_sequence bigint;
  v_actor uuid := auth.uid();
  v_authorized_at timestamptz;
begin
  if v_actor is null or auth.jwt()->>'role' is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'site_content_administrator_required';
  end if;
  perform 1 from auth.users u
  where u.id = v_actor and u.raw_app_meta_data->>'site_role' is not distinct from 'administrator'
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'site_content_administrator_required';
  end if;
  v_authorized_at := pg_catalog.clock_timestamp();
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  if v_state.change_epoch is distinct from p_expected_change_epoch then
    outcome := 'conflict'; conflict_code := 'stale_change_epoch'; return next; return;
  end if;
  select * into strict v_source from public.site_content_source_projection(p_kind, p_source_row_id);
  if v_source.source_version is distinct from p_expected_source_version then
    outcome := 'conflict'; conflict_code := 'stale_source_version'; return next; return;
  end if;
  if p_expected_record_digest is null or p_expected_record_digest !~ '^[0-9a-f]{64}$'
    or public.site_content_json_sha256(v_source.record) is distinct from p_expected_record_digest then
    outcome := 'conflict'; conflict_code := 'record_digest_mismatch'; return next; return;
  end if;
  if p_expected_projection_digest is null or p_expected_projection_digest !~ '^[0-9a-f]{64}$'
    or public.site_content_projection_digest(v_source.record, v_source.render_payload)
      is distinct from p_expected_projection_digest then
    outcome := 'conflict'; conflict_code := 'projection_digest_mismatch'; return next; return;
  end if;
  select * into v_existing from public.site_content_public_records h
  where h.logical_id = v_source.logical_id for update;
  if v_existing.logical_id is not null and not v_existing.retired and exists (
    select 1 from public.site_content_publications p
    where p.id = v_existing.current_publication_id and p.source_row_id = p_source_row_id
      and p.source_version = v_source.source_version
  ) then outcome := 'conflict'; conflict_code := 'already_published'; return next; return; end if;
  if v_existing.logical_id is null and not v_state.initialized then
    if p_reconciliation_plan_digest is null or not exists (
      select 1 from public.site_content_reconciliation_plans p
      where p.plan_digest = p_reconciliation_plan_digest and exists (
        select 1 from jsonb_array_elements(p.dispositions) item
        where item->>'logicalId' = v_source.logical_id and item->>'disposition' = 'adopt'
          and item->>'sourceKind' = p_kind and item->>'sourceRowId' = p_source_row_id::text
          and item->>'sourceVersion' = v_source.source_version
          and item->>'contentHash' = v_source.record->>'contentHash'
          and item->>'publicationVersion' = v_source.record->>'publicationVersion'
          and item->>'trustedPublicRecordId' = v_source.logical_id
          and item->>'trustedRoute' = v_source.record->>'route'
          and item->>'trustedGovernanceHash' = public.site_content_record_governance_hash(v_source.record)
      )
    ) then raise exception using errcode = '55000', message = 'site_content_reconciliation_required'; end if;
  end if;
  insert into public.site_content_publications(
    id, logical_id, kind, slug, source_table, source_row_id, source_owner_id, source_version,
    published_by, administrator_authorized_at, administrator_authorization_version,
    reconciliation_plan_digest, record, render_payload, retired
  ) values (
    v_publication_id, v_source.logical_id, p_kind, v_source.slug, v_source.source_table,
    p_source_row_id, v_source.source_owner_id, v_source.source_version, v_actor, v_authorized_at,
    'site-content-admin-authorization-v1', p_reconciliation_plan_digest,
    v_source.record, v_source.render_payload, false
  );
  change_epoch := v_state.change_epoch + 1;
  insert into public.site_content_public_records(logical_id, kind, slug, current_publication_id, head_change_epoch, retired)
  values (v_source.logical_id, p_kind, v_source.slug, v_publication_id, change_epoch, false)
  on conflict on constraint site_content_public_records_pkey do update set
    current_publication_id = excluded.current_publication_id, kind = excluded.kind, slug = excluded.slug,
    head_change_epoch = excluded.head_change_epoch, retired = false, updated_at = pg_catalog.clock_timestamp();
  insert into public.site_content_sync_events(logical_id, target_publication_id, target_change_epoch)
  values (v_source.logical_id, v_publication_id, change_epoch)
  returning site_content_sync_events.event_sequence into v_event_sequence;
  update public.site_content_sync_events e set state = 'superseded', worker_id = null, lease_token = null,
    lease_expires_at = null, superseded_by_event_sequence = v_event_sequence,
    terminal_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where e.event_sequence <> v_event_sequence and e.target_change_epoch < change_epoch
    and e.state in ('pending', 'retry_pending', 'processing', 'ready');
  update public.site_content_releases set state = 'abandoned'
  where state = 'candidate' and target_change_epoch < change_epoch;
  update public.site_content_public_records set pending_event_sequence = v_event_sequence,
    updated_at = pg_catalog.clock_timestamp()
  where site_content_public_records.logical_id = v_source.logical_id;
  update public.site_content_sync_state set change_epoch = v_state.change_epoch + 1,
    updated_at = pg_catalog.clock_timestamp() where singleton;
  logical_id := v_source.logical_id; publication_id := v_publication_id;
  event_sequence := v_event_sequence; outcome := 'applied'; conflict_code := null; return next;
end;
$$;

create or replace function public.retire_site_content_record(
  p_kind text, p_source_row_id uuid, p_expected_source_version text,
  p_expected_change_epoch bigint, p_reconciliation_plan_digest text,
  p_expected_record_digest text, p_expected_projection_digest text
)
returns table (outcome text, conflict_code text, logical_id text, publication_id uuid, event_sequence bigint, change_epoch bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_source record;
  v_head public.site_content_public_records%rowtype;
  v_publication_id uuid := gen_random_uuid();
  v_event_sequence bigint;
  v_actor uuid := auth.uid();
  v_authorized_at timestamptz;
begin
  if v_actor is null or auth.jwt()->>'role' is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'site_content_administrator_required';
  end if;
  perform 1 from auth.users u
  where u.id = v_actor and u.raw_app_meta_data->>'site_role' is not distinct from 'administrator'
  for share;
  if not found then raise exception using errcode = '42501', message = 'site_content_administrator_required'; end if;
  v_authorized_at := pg_catalog.clock_timestamp();
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  if v_state.change_epoch is distinct from p_expected_change_epoch then
    outcome := 'conflict'; conflict_code := 'stale_change_epoch'; return next; return;
  end if;
  select * into strict v_source from public.site_content_source_projection(p_kind, p_source_row_id);
  if v_source.source_version is distinct from p_expected_source_version then
    outcome := 'conflict'; conflict_code := 'stale_source_version'; return next; return;
  end if;
  if p_expected_record_digest is null or p_expected_record_digest !~ '^[0-9a-f]{64}$'
    or public.site_content_json_sha256(v_source.record) is distinct from p_expected_record_digest then
    outcome := 'conflict'; conflict_code := 'record_digest_mismatch'; return next; return;
  end if;
  if p_expected_projection_digest is null or p_expected_projection_digest !~ '^[0-9a-f]{64}$'
    or public.site_content_projection_digest(v_source.record, v_source.render_payload)
      is distinct from p_expected_projection_digest then
    outcome := 'conflict'; conflict_code := 'projection_digest_mismatch'; return next; return;
  end if;
  select * into v_head from public.site_content_public_records
  where site_content_public_records.logical_id = v_source.logical_id for update;
  if not found then outcome := 'conflict'; conflict_code := 'missing_publication'; return next; return; end if;
  if v_head.retired then outcome := 'conflict'; conflict_code := 'already_retired'; return next; return; end if;
  insert into public.site_content_publications(
    id, logical_id, kind, slug, source_table, source_row_id, source_owner_id, source_version,
    published_by, administrator_authorized_at, administrator_authorization_version,
    reconciliation_plan_digest, record, render_payload, retired
  ) values (
    v_publication_id, v_source.logical_id, p_kind, v_source.slug, v_source.source_table,
    p_source_row_id, v_source.source_owner_id, v_source.source_version, v_actor, v_authorized_at,
    'site-content-admin-authorization-v1', null, v_source.record, v_source.render_payload, true
  );
  change_epoch := v_state.change_epoch + 1;
  update public.site_content_public_records set current_publication_id = v_publication_id, retired = true,
    head_change_epoch = change_epoch, updated_at = pg_catalog.clock_timestamp()
  where site_content_public_records.logical_id = v_source.logical_id;
  insert into public.site_content_sync_events(logical_id, target_publication_id, target_change_epoch)
  values (v_source.logical_id, v_publication_id, change_epoch)
  returning site_content_sync_events.event_sequence into v_event_sequence;
  update public.site_content_sync_events e set state = 'superseded', worker_id = null, lease_token = null,
    lease_expires_at = null, superseded_by_event_sequence = v_event_sequence,
    terminal_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where e.event_sequence <> v_event_sequence and e.target_change_epoch < change_epoch
    and e.state in ('pending', 'retry_pending', 'processing', 'ready');
  update public.site_content_releases set state = 'abandoned'
  where state = 'candidate' and target_change_epoch < change_epoch;
  update public.site_content_public_records set pending_event_sequence = v_event_sequence
  where site_content_public_records.logical_id = v_source.logical_id;
  update public.site_content_sync_state set change_epoch = v_state.change_epoch + 1,
    updated_at = pg_catalog.clock_timestamp() where singleton;
  logical_id := v_source.logical_id; publication_id := v_publication_id;
  event_sequence := v_event_sequence; outcome := 'applied'; conflict_code := null; return next;
end;
$$;



create or replace function public.read_site_content_health()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with recursive
  db_clock as (select statement_timestamp() as now),
  sync_state as (select s.* from public.site_content_sync_state s where s.singleton),
  active_release as (
    select r.* from public.site_content_releases r join sync_state s on s.active_release_id = r.id
    where r.state = 'active'
  ),
  active_records as (select rr.* from public.site_content_release_records rr join active_release r on r.id = rr.release_id),
  outstanding_heads as (
    select h.* from public.site_content_public_records h cross join sync_state s
    where h.head_change_epoch > s.served_change_epoch
  ),
  chains as (
    select h.logical_id head_logical_id, h.pending_event_sequence origin_sequence,
      e.event_sequence, e.logical_id event_logical_id, e.target_publication_id,
      e.target_change_epoch, e.state, e.superseded_by_event_sequence, array[e.event_sequence] path
    from outstanding_heads h left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
    union all
    select c.head_logical_id, c.origin_sequence, e.event_sequence, e.logical_id,
      e.target_publication_id, e.target_change_epoch, e.state,
      e.superseded_by_event_sequence, c.path || e.event_sequence
    from chains c join public.site_content_sync_events e on e.event_sequence = c.superseded_by_event_sequence
    where c.event_sequence is not null and e.event_sequence > c.event_sequence
      and not e.event_sequence = any(c.path)
  ),
  terminals as (
    select distinct on (head_logical_id) * from chains order by head_logical_id, cardinality(path) desc
  ),
  terminal_current_events as (
    select distinct e.event_sequence, e.state, e.lease_expires_at
    from terminals t
    join public.site_content_sync_events e on e.event_sequence = t.event_sequence
  ),
  live_events as (
    select e.* from public.site_content_sync_events e where e.state in ('pending','retry_pending','processing','ready')
  ),
  queue as (
    select count(*) filter (where state = 'pending')::bigint pending_count,
      count(*) filter (where state = 'retry_pending')::bigint retry_pending_count,
      count(*) filter (where state = 'processing')::bigint processing_count,
      count(*) filter (where state = 'ready')::bigint ready_count,
      count(*) filter (where state = 'quarantined')::bigint quarantined_count,
      count(*) filter (where state = 'processing'
        and (lease_expires_at is null or lease_expires_at <= db_clock.now))::bigint expired_lease_count
    from terminal_current_events cross join db_clock
  ),
  invocation_latest as (
    select i.* from public.site_content_sync_worker_invocations i
    order by i.started_at desc, i.invocation_id desc limit 1
  ),
  invocation_summary as (
    select exists(select 1 from public.site_content_sync_worker_invocations) synchronizer_seen,
      (select started_at from invocation_latest) last_invocation_at,
      (select max(terminal_at) from public.site_content_sync_worker_invocations
        where terminal_phase = 'succeeded' and outcome_code in ('idle','ready')) last_successful_invocation_at,
      coalesce((select terminal_phase = 'succeeded' and outcome_code in ('idle','ready') from invocation_latest), false)
        latest_invocation_succeeded
  ),
  bootstrap as (
    select case
      when not s.initialized and r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
        and r.target_change_epoch = 0 and s.change_epoch = 0 and s.served_change_epoch = 0
        and r.registry_version = 'site-content-bootstrap-public-release-v1' and r.generation_id = 'bootstrap-v1'
        and r.previous_release_id is null and r.static_manifest_digest = repeat('0', 64)
        and r.id = public.site_content_release_id(r.release_digest, 0, 'bootstrap-v1')
        and r.state = 'active' and s.active_release_digest = r.release_digest
        and r.expected_record_count = 843 and r.expected_tombstone_count = 0
        and (select count(*) from active_records) = 843
        and r.release_digest = public.site_content_bootstrap_digest(r.id)
        and r.dynamic_state_digest = public.site_content_bootstrap_digest(r.id)
        and not exists (select 1 from active_records rr where rr.target_publication_id is not null
          or rr.record is null or rr.render_payload is null or rr.record->>'logicalId' is distinct from rr.logical_id
          or rr.record->>'body' is distinct from rr.normalized_text
          or rr.record->>'contentHash' is distinct from rr.content_hash
          or rr.record->>'publicationVersion' is distinct from rr.publication_fingerprint
          or rr.embedding_model is distinct from 'bootstrap-no-embedding'
          or rr.embedding_dimensions <> 1536
          or rr.embedding_fingerprint is distinct from 'bootstrap-no-embedding-1536-v1'
          or rr.embedding is not null or rr.embedding_value_digest is not null or rr.tombstone or not rr.public_visible)
        and not exists (select 1 from outstanding_heads)
        and not exists (select 1 from live_events)
        and (select quarantined_count = 0 and expired_lease_count = 0 from queue)
        then 'valid_retained'
      when not s.initialized or r.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid or r.target_change_epoch = 0
        then 'invalid'
      else 'not_applicable'
    end state
    from sync_state s left join active_release r on true
  ),
  integrity as (
    select coalesce(r.target_change_epoch = s.served_change_epoch, false)
        and coalesce(r.expected_record_count = (select count(*) from active_records), false)
        and coalesce(r.expected_tombstone_count = (select count(*) from active_records where tombstone), false)
        and not exists (select 1 from active_records where record is null or render_payload is null)
        and not exists (select 1 from active_records rr
          left join public.site_content_publications p on p.id = rr.target_publication_id
          where s.initialized and (rr.target_publication_id is null or p.id is null
            or p.logical_id is distinct from rr.logical_id or p.record is distinct from rr.record
            or p.render_payload is distinct from rr.render_payload or p.retired is distinct from rr.tombstone))
        and not exists (select 1 from public.site_content_public_records h
          left join active_records rr on rr.target_publication_id = h.current_publication_id
          where h.head_change_epoch <= s.served_change_epoch
            and (rr.logical_id is null or h.retired is distinct from rr.tombstone))
        -- A newer outstanding head may legitimately name a later publication,
        -- but every served active record must remain tracked by logical identity.
        and not exists (select 1 from active_records rr
          left join public.site_content_public_records h on h.logical_id = rr.logical_id
          where s.initialized and rr.target_publication_id is not null and (
            h.logical_id is null
            or (h.head_change_epoch <= s.served_change_epoch and (
              h.current_publication_id is distinct from rr.target_publication_id
              or h.retired is distinct from rr.tombstone))))
        and not exists (select 1 from outstanding_heads h
          left join public.site_content_publications p on p.id = h.current_publication_id
          where p.id is null or p.logical_id is distinct from h.logical_id or p.retired is distinct from h.retired)
        as population_complete,
      coalesce(r.release_digest = public.site_content_release_digest(r.id)
        and s.active_release_digest = r.release_digest
        and public.site_content_provider_free_checks_pass(r.id), false) release_digest_valid,
      coalesce(r.dynamic_state_digest = public.site_content_dynamic_state_digest(r.id), false) dynamic_digest_valid,
      not exists (select 1 from active_records rr left join public.site_content_publications p on p.id = rr.target_publication_id
        where rr.target_publication_id is not null and (p.id is null or p.published_by is null
          or not exists (select 1 from auth.users u where u.id = p.published_by)
          or p.administrator_authorized_at > p.created_at
          or p.administrator_authorization_version <> 'site-content-admin-authorization-v1')) administrator_attestation_valid,
      not exists (select 1 from active_records rr where not rr.tombstone and rr.public_visible and (
        rr.record->>'sourceStatus' is null or rr.record->>'sourceStatus' not in ('current','review_due')
        or rr.record->>'validationStatus' is null
        or rr.record->>'validationStatus' not in ('locally_reviewed','approved'))) governance_valid,
      not exists (select 1 from public.site_content_public_records h cross join sync_state st
        where h.head_change_epoch <= st.served_change_epoch and h.pending_event_sequence is not null)
      and not exists (select 1 from outstanding_heads h
        left join public.site_content_sync_events origin on origin.event_sequence = h.pending_event_sequence
        left join terminals t on t.head_logical_id = h.logical_id
        where h.pending_event_sequence is null or origin.event_sequence is null
          or origin.logical_id is distinct from h.logical_id
          or origin.target_publication_id is distinct from h.current_publication_id
          or origin.target_change_epoch is distinct from h.head_change_epoch
          or t.event_sequence is null or t.state not in ('pending','retry_pending','processing','ready')
          or t.superseded_by_event_sequence is not null
          or t.target_change_epoch is distinct from (select max(target_change_epoch) from live_events))
      and not exists (select 1 from live_events e where not exists (
        select 1 from terminals t where t.event_sequence = e.event_sequence)) pending_set_exact,
      (select count(*) from outstanding_heads) = (select count(*) from terminals) outstanding_count_agrees
    from sync_state s left join active_release r on true
  ),
  oldest as (
    select case when count(*) = 0 then null
      else floor(extract(epoch from (max(db_clock.now) - min(e.created_at))) * 1000)::bigint end age_ms
    from outstanding_heads h left join public.site_content_sync_events e on e.event_sequence = h.pending_event_sequence
    cross join db_clock
  ),
  rollback as (
    select coalesce(r.previous_release_id is not null and p.state = 'superseded'
      and receipt.receipt#>>'{resource,kind}' = 'site_release'
      and receipt.receipt#>>'{resource,siteReleaseId}' = r.id::text
      and receipt.receipt#>>'{resource,siteReleaseDigest}' = r.release_digest
      and receipt.receipt#>>'{resource,previousSiteReleaseId}' = p.id::text
      and receipt.receipt#>>'{resource,previousSiteReleaseDigest}' = p.release_digest
      and (
        (p.target_change_epoch <> 0 and p.id <> 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid)
        or (p.target_change_epoch = 0
          and p.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
          and p.registry_version = 'site-content-bootstrap-public-release-v1'
          and p.generation_id = 'bootstrap-v1' and p.previous_release_id is null
          and p.static_manifest_digest = repeat('0', 64)
          and p.id = public.site_content_release_id(p.release_digest, 0, 'bootstrap-v1')
          and p.expected_record_count = 843 and p.expected_tombstone_count = 0
          and (select count(*) from public.site_content_release_records rr where rr.release_id = p.id) = 843
          and p.release_digest = public.site_content_bootstrap_digest(p.id)
          and p.dynamic_state_digest = public.site_content_bootstrap_digest(p.id)
          and not exists (select 1 from public.site_content_release_records rr
            where rr.release_id = p.id and (rr.target_publication_id is not null
              or rr.record is null or rr.render_payload is null
              or rr.record->>'logicalId' is distinct from rr.logical_id
              or rr.record->>'body' is distinct from rr.normalized_text
              or rr.record->>'contentHash' is distinct from rr.content_hash
              or rr.record->>'publicationVersion' is distinct from rr.publication_fingerprint
              or rr.embedding_model is distinct from 'bootstrap-no-embedding'
              or rr.embedding_dimensions <> 1536
              or rr.embedding_fingerprint is distinct from 'bootstrap-no-embedding-1536-v1'
              or rr.embedding is not null or rr.embedding_value_digest is not null
              or rr.tombstone or not rr.public_visible)))
      ), false) available
    from sync_state s left join active_release r on true
    left join public.site_content_releases p on p.id = r.previous_release_id
    left join lateral (select rr.* from public.site_content_release_receipts rr
      where rr.release_id = r.id and rr.receipt_kind = 'activation' order by rr.created_at desc limit 1) receipt on true
  ),
  activation_evidence as (
    select case
        when not s.initialized and b.state = 'valid_retained' then coalesce(r.activated_at, r.created_at)
        else r.activated_at
      end projected_at,
      case
        when not s.initialized and b.state = 'valid_retained' then true
        when s.initialized and r.activated_at is not null and r.activated_at <= db_clock.now then true
        else false
      end valid
    from sync_state s left join active_release r on true cross join bootstrap b cross join db_clock
  )
  select jsonb_build_object(
    'initialized', s.initialized, 'bootstrapIntegrityState', b.state,
    'activePublicSiteRelease', case when r.id is null or not a.valid then null else jsonb_build_object(
      'version','clinical-kb-site-release-v1','releaseId',r.id::text,'registryVersion',r.registry_version,
      'staticManifestDigest',r.static_manifest_digest,'dynamicStateDigest',r.dynamic_state_digest,
      'releaseDigest',r.release_digest,'state',r.state,'activatedAt',a.projected_at) end,
    'publicSiteChangeEpoch', s.served_change_epoch::text,
    'outstandingHeadCount', (select count(*) from outstanding_heads),
    'populationComplete',i.population_complete,'releaseDigestValid',i.release_digest_valid,
    'dynamicDigestValid',i.dynamic_digest_valid,'administratorAttestationValid',i.administrator_attestation_valid,
    'governanceValid',i.governance_valid,'pendingSetExact',i.pending_set_exact,
    'outstandingHeadCountAgrees',i.outstanding_count_agrees,
    'pendingCount',q.pending_count,'retryPendingCount',q.retry_pending_count,
    'processingCount',q.processing_count,'readyCount',q.ready_count,'quarantinedCount',q.quarantined_count,
    'oldestOutstandingOriginAgeMs',o.age_ms,
    'countOverflow',greatest(q.pending_count,q.retry_pending_count,q.processing_count,q.ready_count,
      q.quarantined_count,(select count(*) from outstanding_heads)) > 1000000,
    'timeIntegrityValid',(o.age_ms is null or o.age_ms >= 0) and a.valid,
    'expiredProcessingLeaseCount',q.expired_lease_count,'synchronizerSeen',inv.synchronizer_seen,
    'lastInvocationAt',inv.last_invocation_at,'lastSuccessfulInvocationAt',inv.last_successful_invocation_at,
    'latestInvocationSucceeded',inv.latest_invocation_succeeded,'lastActivation',r.activated_at,
    'rollbackAvailable',rb.available)
  from sync_state s left join active_release r on true cross join bootstrap b cross join integrity i
  cross join queue q cross join oldest o cross join invocation_summary inv cross join rollback rb
  cross join activation_evidence a;
$$;

alter table public.site_content_sync_worker_invocations enable row level security;
alter table public.site_content_sync_worker_invocations force row level security;
revoke all on table public.site_content_sync_worker_invocations from public, anon, authenticated, service_role;
revoke all on function public.publish_site_content_record(text, uuid, text, bigint, text, text, text) from public, anon, service_role;
grant execute on function public.publish_site_content_record(text, uuid, text, bigint, text, text, text) to authenticated;
revoke all on function public.retire_site_content_record(text, uuid, text, bigint, text, text, text) from public, anon, service_role;
grant execute on function public.retire_site_content_record(text, uuid, text, bigint, text, text, text) to authenticated;
revoke all on function public.record_site_content_sync_worker_invocation(uuid, uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.record_site_content_sync_worker_invocation(uuid, uuid, text, text) to service_role;
revoke all on function public.read_site_content_health() from public, anon, authenticated, service_role;
grant execute on function public.read_site_content_health() to service_role;
alter table public.site_content_sync_worker_invocations owner to postgres;
alter function public.publish_site_content_record(text, uuid, text, bigint, text, text, text) owner to postgres;
alter function public.retire_site_content_record(text, uuid, text, bigint, text, text, text) owner to postgres;
alter function public.record_site_content_sync_worker_invocation(uuid, uuid, text, text) owner to postgres;
alter function public.read_site_content_health() owner to postgres;
