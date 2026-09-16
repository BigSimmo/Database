do $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_health jsonb;
  v_reader record;
begin
  select * into strict v_state from public.site_content_sync_state where singleton;
  if v_state.initialized or v_state.change_epoch <> 0 or v_state.served_change_epoch <> 0
    or v_state.active_transition_receipt_id is not null then
    raise exception 'control_plane_pristine_bootstrap_invalid';
  end if;
  if public.site_content_current_transition_kind(
    v_state.active_transition_receipt_id, v_state.active_release_id,
    v_state.active_release_digest, v_state.initialized, v_state.served_change_epoch) <> 'bootstrap' then
    raise exception 'control_plane_bootstrap_transition_invalid';
  end if;
  if has_function_privilege('service_role', 'public.record_site_content_reconciliation_plan(jsonb)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.record_site_content_reconciliation_plan(jsonb)', 'EXECUTE') then
    raise exception 'control_plane_reconciliation_grants_invalid';
  end if;
  if to_regprocedure('public.record_site_content_reconciliation_plan(jsonb,uuid)') is not null then
    raise exception 'control_plane_legacy_reconciliation_overload_present';
  end if;
  select public.read_site_content_health() into v_health;
  if v_health->>'publicSiteChangeEpoch' <> '0'
    or v_health->>'initialized' <> 'false'
    or v_health->>'bootstrapIntegrityState' <> 'valid_retained'
    or v_health->'activePublicSiteRelease'->>'activatedAt' is null then
    raise exception 'control_plane_pristine_health_invalid';
  end if;
  select * into strict v_reader from public.read_site_content_public_records('service', null) limit 1;
  if v_reader.initialized or v_reader.record is null
    or v_reader.snapshot->>'state' <> 'unavailable'
    or v_reader.snapshot->>'changeEpoch' <> '0' then
    raise exception 'control_plane_pristine_reader_invalid';
  end if;
end;
$$;

begin;
insert into public.site_content_publications(
  id,logical_id,kind,slug,source_table,source_row_id,source_owner_id,source_version,published_by,
  administrator_authorized_at,administrator_authorization_version,reconciliation_plan_digest,
  record,render_payload,retired,created_at
) values (
  '70000000-0000-5000-8000-000000000090'::uuid,
  'services:null-claim-seed','service','null-claim-seed','clinical_registry_records',
  '70000000-0000-4000-8000-000000000091'::uuid,
  '70000000-0000-4000-8000-000000000092'::uuid,
  '2026-08-30T00:00:00.000Z','70000000-0000-4000-8000-000000000093'::uuid,
  pg_catalog.statement_timestamp(),'site-content-admin-authorization-v1',null,
  '{"logicalId":"services:null-claim-seed"}'::jsonb,'{}'::jsonb,false,
  pg_catalog.statement_timestamp()
);
insert into public.site_content_public_records(
  logical_id,kind,slug,current_publication_id,head_change_epoch,retired,pending_event_sequence
) values (
  'services:null-claim-seed','service','null-claim-seed',
  '70000000-0000-5000-8000-000000000090'::uuid,1,false,null
);
with event as (
  insert into public.site_content_sync_events(
    logical_id,target_publication_id,target_change_epoch,state,attempt_count,
    worker_id,lease_token,lease_generation,lease_expires_at
  ) values (
    'services:null-claim-seed','70000000-0000-5000-8000-000000000090'::uuid,1,
    'processing',5,'70000000-0000-4000-8000-000000000094'::uuid,
    '70000000-0000-4000-8000-000000000095'::uuid,5,
    pg_catalog.clock_timestamp() - interval '1 minute'
  ) returning event_sequence
)
update public.site_content_public_records h set pending_event_sequence = event.event_sequence
from event where h.logical_id = 'services:null-claim-seed';

do $$
declare
  v_before jsonb;
  v_after jsonb;
begin
  select to_jsonb(e) into strict v_before from public.site_content_sync_events e
  where e.logical_id = 'services:null-claim-seed';
  begin
    perform public.claim_site_content_sync_events(null, 1, 10);
    raise exception 'control_plane_null_claim_worker_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'site_content_claim_bounds_invalid' then raise; end if;
  end;
  begin
    perform public.claim_site_content_sync_events(gen_random_uuid(), null, 10);
    raise exception 'control_plane_null_claim_limit_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'site_content_claim_bounds_invalid' then raise; end if;
  end;
  begin
    perform public.claim_site_content_sync_events(gen_random_uuid(), 1, null);
    raise exception 'control_plane_null_claim_lease_accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'site_content_claim_bounds_invalid' then raise; end if;
  end;
  select to_jsonb(e) into strict v_after from public.site_content_sync_events e
  where e.logical_id = 'services:null-claim-seed';
  if v_after is distinct from v_before then
    raise exception 'control_plane_null_claim_mutated_claim_or_quarantine_state';
  end if;
end;
$$;
rollback;

do $$
begin
  begin
    update public.site_content_sync_state set served_change_epoch = 1, change_epoch = 1 where singleton;
    raise exception 'control_plane_transition_pointer_guard_missing';
  exception when sqlstate '55000' then
    if sqlerrm <> 'site_content_transition_pointer_update_required' then raise; end if;
  end;
  if exists (select 1 from public.site_content_sync_state where served_change_epoch <> 0 or change_epoch <> 0) then
    raise exception 'control_plane_transition_pointer_guard_mutated_state';
  end if;
end;
$$;

insert into public.site_content_releases (
  id,state,target_change_epoch,previous_release_id,registry_version,static_manifest_digest,
  dynamic_state_digest,release_digest,generation_id,plan_digest,reconciliation_plan_digest,
  expected_added_count,expected_changed_count,expected_unchanged_count,expected_record_count,
  expected_tombstone_count,must_pass_checks,activated_at
) values (
  '70000000-0000-5000-8000-000000000001'::uuid,'active',1,
  'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid,'control-plane-fixture-v1',repeat('1',64),
  repeat('2',64),repeat('3',64),'control-plane-fixture-v1',repeat('4',64),null,
  0,0,0,0,0,true,pg_catalog.statement_timestamp()
);

insert into public.site_content_release_receipts(receipt_id,release_id,receipt_kind,recovery_readiness_digest,receipt)
with fields as (
  select jsonb_build_object(
    'version','activation-receipt-v1','promotionId','site-release:control-plane-fixture',
    'projectRef','control-plane-fixture','operation','site_release','recoveryReadinessDigest',repeat('5',64),
    'activatedAt',to_char(pg_catalog.statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'resource',jsonb_build_object(
      'kind','site_release','siteReleaseId','70000000-0000-5000-8000-000000000001',
      'siteReleaseDigest',repeat('3',64),
      'previousSiteReleaseId','e4a1dd29-14f6-556c-8fb7-f4f947d8b846',
      'previousSiteReleaseDigest',bootstrap.release_digest)
  ) receipt
  from public.site_content_releases bootstrap
  where bootstrap.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
), complete as (
  select receipt || jsonb_build_object('receiptId','sha256:' || encode(extensions.digest(convert_to(
    'activation-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(receipt),'UTF8'),'sha256'),'hex')) receipt
  from fields
)
select public.guard_site_content_receipt_shape(receipt,'activation','70000000-0000-5000-8000-000000000001'::uuid,repeat('5',64)),
  '70000000-0000-5000-8000-000000000001'::uuid,'activation',repeat('5',64),receipt
from complete;

update public.site_content_releases set state = 'superseded'
where id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid;
update public.site_content_sync_state
set change_epoch = 1, served_change_epoch = 1,
  active_release_id = '70000000-0000-5000-8000-000000000001'::uuid,
  active_release_digest = repeat('3',64), initialized = true,
  active_transition_receipt_id = (
    select receipt_id from public.site_content_release_receipts
    where release_id = '70000000-0000-5000-8000-000000000001'::uuid and receipt_kind = 'activation')
where singleton;

do $$
declare v_state public.site_content_sync_state%rowtype;
begin
  select * into strict v_state from public.site_content_sync_state where singleton;
  if public.site_content_current_transition_kind(v_state.active_transition_receipt_id,
    v_state.active_release_id,v_state.active_release_digest,v_state.initialized,
    v_state.served_change_epoch) <> 'activation' then
    raise exception 'control_plane_activation_transition_invalid';
  end if;
end;
$$;

do $$
declare
  v_receipt jsonb;
begin
  with activation as (
    select * from public.site_content_release_receipts
    where release_id = '70000000-0000-5000-8000-000000000001'::uuid and receipt_kind = 'activation'
  ), fields as (
    select jsonb_build_object(
      'version','rollback-receipt-v1','activationReceiptId',activation.receipt_id,
      'promotionId',activation.receipt->>'promotionId','projectRef',activation.receipt->>'projectRef',
      'operation','site_release',
      'rolledBackAt',to_char(pg_catalog.statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'method','retained_previous','requiresReconstruction',false,'outcome','succeeded',
      'target',jsonb_build_object(
        'kind','site_release','siteReleaseId','e4a1dd29-14f6-556c-8fb7-f4f947d8b846',
        'siteReleaseDigest',bootstrap.release_digest)
    ) receipt
    from activation cross join public.site_content_releases bootstrap
    where bootstrap.id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
  )
  select receipt || jsonb_build_object('receiptId','sha256:' || encode(extensions.digest(convert_to(
    'rollback-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(receipt),'UTF8'),'sha256'),'hex'))
  into strict v_receipt from fields;

  if not public.rollback_site_content_release(
    '70000000-0000-5000-8000-000000000001'::uuid,
    'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid,
    repeat('6',64),
    v_receipt
  ) then
    raise exception 'control_plane_rollback_function_rejected_valid_transition';
  end if;
end;
$$;

do $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_health jsonb;
  v_reader record;
begin
  select * into strict v_state from public.site_content_sync_state where singleton;
  if public.site_content_current_transition_kind(v_state.active_transition_receipt_id,
    v_state.active_release_id,v_state.active_release_digest,v_state.initialized,
    v_state.served_change_epoch) <> 'rollback' then
    raise exception 'control_plane_rollback_transition_invalid';
  end if;
  select public.read_site_content_health() into v_health;
  if v_health->>'publicSiteChangeEpoch' <> '1'
    or v_health->>'rollbackAvailable' <> 'false'
    or v_health->'activePublicSiteRelease'->>'releaseId' <> 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846' then
    raise exception 'control_plane_rollback_health_invalid';
  end if;
  select * into strict v_reader from public.read_site_content_public_records('service', null) limit 1;
  if not v_reader.initialized or v_reader.record is null
    or v_reader.snapshot->>'state' <> 'unavailable'
    or v_reader.snapshot->>'changeEpoch' <> '1' then
    raise exception 'control_plane_rollback_bootstrap_reader_invalid';
  end if;
end;
$$;

with source as (
  select rr.* from public.site_content_release_records rr
  where rr.release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
    and rr.logical_id like 'services:%'
  order by rr.logical_id limit 1
), publication as (
  insert into public.site_content_publications(
    id,logical_id,kind,slug,source_table,source_row_id,source_owner_id,source_version,published_by,
    administrator_authorized_at,administrator_authorization_version,reconciliation_plan_digest,
    record,render_payload,retired,created_at)
  select '70000000-0000-4000-8000-000000000010'::uuid,logical_id,'service',
    substr(logical_id,length('services:')+1),'clinical_registry_records',
    '70000000-0000-4000-8000-000000000011'::uuid,'70000000-0000-4000-8000-000000000012'::uuid,
    '2026-08-30T00:00:00.000Z','70000000-0000-4000-8000-000000000013'::uuid,
    pg_catalog.statement_timestamp(),'site-content-admin-authorization-v1',null,
    record,render_payload,false,pg_catalog.statement_timestamp()
  from source returning *
), head as (
  insert into public.site_content_public_records(
    logical_id,kind,slug,current_publication_id,head_change_epoch,retired,pending_event_sequence)
  select logical_id,kind,slug,id,2,false,null from publication returning *
), event as (
  insert into public.site_content_sync_events(logical_id,target_publication_id,target_change_epoch)
  select logical_id,current_publication_id,2 from head returning *
)
update public.site_content_public_records h set pending_event_sequence = e.event_sequence
from event e where h.logical_id = e.logical_id;
update public.site_content_sync_state set change_epoch = 2 where singleton;

do $$
declare
  v_affected_slug text;
  v_unbounded_count integer;
  v_affected_count integer;
  v_health jsonb;
begin
  select slug into strict v_affected_slug from public.site_content_public_records
  where head_change_epoch = 2 and kind = 'service';
  select count(*) filter (where record is not null) into v_unbounded_count
    from public.read_site_content_public_records('service', null);
  select count(*) filter (where record is not null) into v_affected_count
    from public.read_site_content_public_records('service', v_affected_slug);
  if v_unbounded_count <> 0 or v_affected_count <> 0 then
    raise exception 'control_plane_pending_reader_not_fail_closed';
  end if;
  update public.site_content_public_records set pending_event_sequence = null;
  select count(*) filter (where record is not null) into v_affected_count
    from public.read_site_content_public_records('service', v_affected_slug);
  select public.read_site_content_health() into v_health;
  if v_affected_count <> 0 or v_health->>'publicSiteChangeEpoch' <> '2'
    or v_health->>'pendingSetExact' <> 'false' then
    raise exception 'control_plane_missing_pending_pointer_not_fail_closed';
  end if;
end;
$$;

\echo 'PASS site-content control-plane correction fixture'
