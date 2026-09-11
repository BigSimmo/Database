-- Forward-only authority and bounded-claim correction for the site-content control plane.

begin;

lock table public.site_content_reconciliation_plans in access exclusive mode;

do $$
begin
  if exists (select 1 from public.site_content_reconciliation_plans) then
    raise exception using errcode = '55000',
      message = 'site_content_phase_correction_requires_empty_reconciliation_plans';
  end if;
end;
$$;

alter table public.site_content_reconciliation_plans
  add column administrator_authorized_at timestamptz not null,
  add column administrator_authorization_version text not null,
  add constraint site_content_reconciliation_plans_authorization_version_check
    check (administrator_authorization_version = 'site-content-admin-authorization-v1');

revoke all on function public.record_site_content_reconciliation_plan(jsonb, uuid)
  from public, anon, authenticated, service_role;
drop function public.record_site_content_reconciliation_plan(jsonb, uuid);

create function public.record_site_content_reconciliation_plan(p_plan jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_site_role text;
  v_authorized_at timestamptz;
  v_dispositions jsonb;
  v_trusted jsonb;
  v_counts jsonb;
  v_expected integer;
  v_groups integer;
  v_batch_size integer;
  v_batch_count integer;
  v_item jsonb;
  v_snapshot jsonb;
  source record;
  v_live_count integer;
begin
  v_actor := auth.uid();
  if v_actor is null or auth.jwt()->>'role' is distinct from 'authenticated' then
    raise exception using errcode = '42501', message = 'site_content_administrator_authorization_required';
  end if;
  select u.raw_app_meta_data->>'site_role' into v_site_role
  from auth.users u where u.id = v_actor for share;
  if not found or v_site_role is distinct from 'administrator' then
    raise exception using errcode = '42501', message = 'site_content_administrator_authorization_required';
  end if;
  v_authorized_at := pg_catalog.statement_timestamp();
  perform pg_catalog.pg_advisory_xact_lock(93206431);

  begin
    if p_plan is null or jsonb_typeof(p_plan) is distinct from 'object' then
      raise exception 'invalid plan';
    end if;
    if p_plan - array['version','planDigest','trustedSnapshotDigest','expectedRecordCount','expectedGroupCount',
        'batchSize','batchCount','counts','trustedSnapshots','dispositions'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_plan)) <> 10
      or jsonb_typeof(p_plan->'version') is distinct from 'string'
      or p_plan->>'version' is distinct from 'site-content-reconciliation-plan-v1'
      or jsonb_typeof(p_plan->'planDigest') is distinct from 'string'
      or p_plan->>'planDigest' !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(p_plan->'trustedSnapshotDigest') is distinct from 'string'
      or p_plan->>'trustedSnapshotDigest' !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(p_plan->'expectedRecordCount') is distinct from 'number'
      or jsonb_typeof(p_plan->'expectedGroupCount') is distinct from 'number'
      or jsonb_typeof(p_plan->'batchSize') is distinct from 'number'
      or jsonb_typeof(p_plan->'batchCount') is distinct from 'number'
    then
      raise exception 'invalid plan';
    end if;
    v_dispositions := p_plan->'dispositions';
    v_trusted := p_plan->'trustedSnapshots';
    v_counts := p_plan->'counts';
    if jsonb_typeof(v_dispositions) is distinct from 'array'
      or jsonb_typeof(v_trusted) is distinct from 'array'
      or jsonb_typeof(v_counts) is distinct from 'object'
      or v_counts - array['adopt','retire','identicalDuplicate','total'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(v_counts)) <> 4
      or jsonb_typeof(v_counts->'adopt') is distinct from 'number'
      or jsonb_typeof(v_counts->'retire') is distinct from 'number'
      or jsonb_typeof(v_counts->'identicalDuplicate') is distinct from 'number'
      or jsonb_typeof(v_counts->'total') is distinct from 'number'
    then
      raise exception 'invalid plan';
    end if;
    if (p_plan->>'expectedRecordCount')::numeric <> trunc((p_plan->>'expectedRecordCount')::numeric)
      or (p_plan->>'expectedGroupCount')::numeric <> trunc((p_plan->>'expectedGroupCount')::numeric)
      or (p_plan->>'batchSize')::numeric <> trunc((p_plan->>'batchSize')::numeric)
      or (p_plan->>'batchCount')::numeric <> trunc((p_plan->>'batchCount')::numeric)
      or (v_counts->>'adopt')::numeric <> trunc((v_counts->>'adopt')::numeric)
      or (v_counts->>'retire')::numeric <> trunc((v_counts->>'retire')::numeric)
      or (v_counts->>'identicalDuplicate')::numeric <> trunc((v_counts->>'identicalDuplicate')::numeric)
      or (v_counts->>'total')::numeric <> trunc((v_counts->>'total')::numeric)
      or (p_plan->>'expectedRecordCount')::numeric not between 1 and 5000
      or (p_plan->>'expectedGroupCount')::numeric not between 1 and (p_plan->>'expectedRecordCount')::numeric
      or (p_plan->>'batchSize')::numeric not between 1 and 500
      or (p_plan->>'batchCount')::numeric not between 1 and 5000
    then
      raise exception 'invalid plan';
    end if;
    v_expected := (p_plan->>'expectedRecordCount')::integer;
    v_groups := (p_plan->>'expectedGroupCount')::integer;
    v_batch_size := (p_plan->>'batchSize')::integer;
    v_batch_count := (p_plan->>'batchCount')::integer;
  exception when others then
    raise exception using errcode = '22023', message = 'site_content_reconciliation_unresolved';
  end;
  if exists (
    select 1 from jsonb_array_elements(v_dispositions) item
    where jsonb_typeof(item) is distinct from 'object'
  ) or exists (
    select 1 from jsonb_array_elements(v_trusted) item
    where jsonb_typeof(item) is distinct from 'object'
  ) then
    raise exception using errcode = '22023', message = 'site_content_reconciliation_unresolved';
  end if;
  if jsonb_array_length(v_dispositions) <> v_expected
    or jsonb_array_length(v_trusted) <> v_groups
    or v_batch_count <> ceil(v_expected::numeric / v_batch_size)::integer
    or p_plan->>'planDigest' is distinct from public.site_content_json_sha256(p_plan - 'planDigest')
    or p_plan->>'trustedSnapshotDigest' is distinct from public.site_content_json_sha256(jsonb_build_object(
      'version', 'site-content-trusted-snapshot-v1', 'records', v_trusted))
    or (v_counts->>'total')::numeric <> v_expected
    or (v_counts->>'adopt')::numeric <> (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'adopt')
    or (v_counts->>'retire')::numeric <> (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'retire')
    or (v_counts->>'identicalDuplicate')::numeric <> (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'identical_duplicate')
    or (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'adopt') <> v_groups
    or (select count(distinct item->>'logicalId') from jsonb_array_elements(v_dispositions) item) <> v_groups
    or (select count(distinct item->>'logicalId') from jsonb_array_elements(v_dispositions) item
      where item->>'disposition' = 'adopt') <> v_groups
    or (select count(distinct ((item->>'sourceKind') || ':' || (item->>'sourceRowId')))
      from jsonb_array_elements(v_dispositions) item) <> v_expected
    or v_dispositions is distinct from (select jsonb_agg(item order by item->>'logicalId' collate "C",
      item->>'sourceKind' collate "C", item->>'sourceRowId' collate "C") from jsonb_array_elements(v_dispositions) item)
    or v_trusted is distinct from (select jsonb_agg(item order by item->>'logicalId' collate "C")
      from jsonb_array_elements(v_trusted) item)
    or (select count(distinct item->>'logicalId') from jsonb_array_elements(v_trusted) item) <> v_groups
    then
    raise exception using errcode = '22023', message = 'site_content_reconciliation_unresolved';
  end if;
  for v_snapshot in select value from jsonb_array_elements(v_trusted) loop
    if jsonb_typeof(v_snapshot) is distinct from 'object'
      or v_snapshot - array['logicalId','publicRecordId','route','contentHash','publicationVersion','governanceHash'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(v_snapshot)) <> 6
      or jsonb_typeof(v_snapshot->'logicalId') is distinct from 'string'
      or jsonb_typeof(v_snapshot->'publicRecordId') is distinct from 'string'
      or jsonb_typeof(v_snapshot->'route') is distinct from 'string'
      or jsonb_typeof(v_snapshot->'contentHash') is distinct from 'string'
      or jsonb_typeof(v_snapshot->'publicationVersion') is distinct from 'string'
      or jsonb_typeof(v_snapshot->'governanceHash') is distinct from 'string'
      or v_snapshot->>'logicalId' !~ '^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$'
      or v_snapshot->>'publicRecordId' is distinct from v_snapshot->>'logicalId'
      or v_snapshot->>'route' not like '/%'
      or v_snapshot->>'contentHash' !~ '^[0-9a-f]{64}$'
      or v_snapshot->>'publicationVersion' !~ '^[0-9a-f]{64}$'
      or v_snapshot->>'governanceHash' !~ '^[0-9a-f]{64}$'
      then raise exception using errcode = '22023', message = 'site_content_reconciliation_snapshot_invalid';
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(v_dispositions) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or v_item - array['logicalId','disposition','sourceKind','sourceRowId','sourceVersion','contentHash',
        'publicationVersion','trustedPublicRecordId','trustedRoute','trustedGovernanceHash'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(v_item)) <> 10
      or jsonb_typeof(v_item->'logicalId') is distinct from 'string'
      or jsonb_typeof(v_item->'disposition') is distinct from 'string'
      or jsonb_typeof(v_item->'sourceKind') is distinct from 'string'
      or jsonb_typeof(v_item->'sourceRowId') is distinct from 'string'
      or jsonb_typeof(v_item->'sourceVersion') is distinct from 'string'
      or jsonb_typeof(v_item->'contentHash') is distinct from 'string'
      or jsonb_typeof(v_item->'publicationVersion') is distinct from 'string'
      or jsonb_typeof(v_item->'trustedPublicRecordId') is distinct from 'string'
      or jsonb_typeof(v_item->'trustedRoute') is distinct from 'string'
      or jsonb_typeof(v_item->'trustedGovernanceHash') is distinct from 'string'
      or v_item->>'logicalId' !~ '^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$'
      or v_item->>'disposition' not in ('adopt','retire','identical_duplicate')
      or v_item->>'sourceKind' not in ('service','form','medication','differential','presentation')
      or v_item->>'sourceRowId' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_item->>'sourceVersion' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      or v_item->>'contentHash' !~ '^[0-9a-f]{64}$'
      or v_item->>'publicationVersion' !~ '^[0-9a-f]{64}$'
      or v_item->>'trustedGovernanceHash' !~ '^[0-9a-f]{64}$'
      or v_item->>'trustedRoute' not like '/%'
      then raise exception using errcode = '22023', message = 'site_content_reconciliation_item_invalid';
    end if;
    select * into strict source from public.site_content_source_projection(
      v_item->>'sourceKind', (v_item->>'sourceRowId')::uuid);
    select value into strict v_snapshot from jsonb_array_elements(v_trusted)
      where value->>'logicalId' = v_item->>'logicalId';
    if v_item->>'sourceVersion' is distinct from source.source_version
      or v_item->>'logicalId' is distinct from source.logical_id
      or v_item->>'contentHash' is distinct from source.record->>'contentHash'
      or v_item->>'publicationVersion' is distinct from source.record->>'publicationVersion'
      or v_item->>'trustedPublicRecordId' is distinct from v_snapshot->>'publicRecordId'
      or v_item->>'trustedRoute' is distinct from v_snapshot->>'route'
      or v_item->>'trustedGovernanceHash' is distinct from v_snapshot->>'governanceHash'
      or (v_item->>'disposition' in ('adopt','identical_duplicate') and (
        source.record->>'contentHash' is distinct from v_snapshot->>'contentHash'
        or source.record->>'publicationVersion' is distinct from v_snapshot->>'publicationVersion'
        or source.record->>'route' is distinct from v_snapshot->>'route'
        or public.site_content_record_governance_hash(source.record) is distinct from v_snapshot->>'governanceHash'))
      or (v_item->>'disposition' = 'retire' and
        source.record->>'contentHash' = v_snapshot->>'contentHash'
        and source.record->>'publicationVersion' = v_snapshot->>'publicationVersion'
        and source.record->>'route' = v_snapshot->>'route'
        and public.site_content_record_governance_hash(source.record) = v_snapshot->>'governanceHash')
      then raise exception using errcode = '22023', message = 'site_content_reconciliation_source_evidence_mismatch';
    end if;
  end loop;
  select count(*) into v_live_count from (
    select 'service'::text as source_kind, id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') source_version
      from public.clinical_registry_records where kind = 'service'
    union all select 'form', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      from public.clinical_registry_records where kind = 'form'
    union all select 'medication', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.medication_records
    union all select case kind when 'presentation' then 'presentation' else 'differential' end, id,
      to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.differential_records
  ) live;
  if v_live_count <> v_expected or exists (
    select 1 from (
      select 'service'::text source_kind, id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') source_version
        from public.clinical_registry_records where kind = 'service'
      union all select 'form', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.clinical_registry_records where kind = 'form'
      union all select 'medication', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.medication_records
      union all select case kind when 'presentation' then 'presentation' else 'differential' end, id,
        to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.differential_records
    ) live left join jsonb_array_elements(v_dispositions) item
      on item->>'sourceKind' = live.source_kind and item->>'sourceRowId' = live.id::text
        and item->>'sourceVersion' = live.source_version
    where item is null
  ) then raise exception using errcode = '22023', message = 'site_content_reconciliation_population_mismatch'; end if;
  insert into public.site_content_reconciliation_plans(
    plan_digest, version, trusted_snapshot_digest, trusted_snapshots, dispositions, expected_record_count,
    expected_group_count, batch_size, batch_count, counts, reviewed_by, reviewed_at,
    administrator_authorized_at, administrator_authorization_version
  ) values (
    p_plan->>'planDigest', p_plan->>'version', p_plan->>'trustedSnapshotDigest', v_trusted, v_dispositions,
    v_expected, v_groups, v_batch_size, v_batch_count, v_counts,
    v_actor, v_authorized_at, v_authorized_at, 'site-content-admin-authorization-v1'
  ) on conflict (plan_digest) do nothing;
  return exists (
    select 1 from public.site_content_reconciliation_plans rp
    where rp.plan_digest = p_plan->>'planDigest'
      and rp.version = p_plan->>'version'
      and rp.trusted_snapshot_digest = p_plan->>'trustedSnapshotDigest'
      and rp.trusted_snapshots = v_trusted
      and rp.dispositions = v_dispositions
      and rp.expected_record_count = v_expected
      and rp.expected_group_count = v_groups
      and rp.batch_size = v_batch_size
      and rp.batch_count = v_batch_count
      and rp.counts = v_counts
      and rp.reviewed_by is not null
      and rp.reviewed_at = rp.administrator_authorized_at
      and rp.administrator_authorization_version = 'site-content-admin-authorization-v1'
  );
end;
$$;

create or replace function public.claim_site_content_sync_events(
  p_worker_id uuid,
  p_limit integer,
  p_lease_seconds integer
)
returns setof public.site_content_sync_events
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null or p_limit is null or p_lease_seconds is null
    or p_limit < 1 or p_limit > 50 or p_lease_seconds < 10 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'site_content_claim_bounds_invalid';
  end if;
  update public.site_content_sync_events e set state = 'quarantined', worker_id = null, lease_token = null,
    lease_expires_at = null, terminal_at = pg_catalog.clock_timestamp(), last_error_code = 'lease_expired',
    updated_at = pg_catalog.clock_timestamp()
  where e.state = 'processing' and e.lease_expires_at <= pg_catalog.clock_timestamp()
    and e.attempt_count >= 5;
  return query
  with claimable as (
    select e.event_sequence
    from public.site_content_sync_events e
    where ((e.state in ('pending', 'retry_pending') and e.next_attempt_at <= pg_catalog.clock_timestamp())
      or (e.state = 'processing' and e.lease_expires_at <= pg_catalog.clock_timestamp()
        and e.attempt_count < 5))
      and exists (
        select 1 from public.site_content_sync_event_plans ep
        where ep.event_sequence = e.event_sequence
          and ep.target_change_epoch = e.target_change_epoch
      )
    order by e.event_sequence
    for update skip locked
    limit p_limit
  )
  update public.site_content_sync_events e set
    state = 'processing',
    attempt_count = e.attempt_count + 1,
    worker_id = p_worker_id,
    lease_token = gen_random_uuid(),
    lease_generation = e.lease_generation + 1,
    lease_expires_at = pg_catalog.clock_timestamp() + make_interval(secs => p_lease_seconds),
    updated_at = pg_catalog.clock_timestamp()
  from claimable c
  where e.event_sequence = c.event_sequence
  returning e.*;
end;
$$;

revoke all on function public.record_site_content_reconciliation_plan(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.record_site_content_reconciliation_plan(jsonb) to authenticated;
revoke all on function public.claim_site_content_sync_events(uuid, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_site_content_sync_events(uuid, integer, integer) to service_role;
alter function public.record_site_content_reconciliation_plan(jsonb) owner to postgres;
alter function public.claim_site_content_sync_events(uuid, integer, integer) owner to postgres;

commit;
