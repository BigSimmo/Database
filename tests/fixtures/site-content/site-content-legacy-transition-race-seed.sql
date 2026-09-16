\set ON_ERROR_STOP on

do $$
declare
  v_mode text := '__RACE_MODE__';
  v_bootstrap public.site_content_releases%rowtype;
  v_r1 public.site_content_releases%rowtype;
  v_r2 public.site_content_releases%rowtype;
  v_fields jsonb;
  v_receipt jsonb;
  v_receipt_id text;
begin
  select * into strict v_bootstrap from public.site_content_releases
  where id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846';
  insert into public.site_content_releases(
    id,state,target_change_epoch,previous_release_id,registry_version,static_manifest_digest,
    dynamic_state_digest,release_digest,generation_id,plan_digest,reconciliation_plan_digest,
    expected_added_count,expected_changed_count,expected_unchanged_count,expected_record_count,
    expected_tombstone_count,must_pass_checks,activated_at
  ) values
    ('84000000-0000-5000-8000-000000000100','superseded',1,v_bootstrap.id,
      'legacy-race-r1',repeat('1',64),repeat('0',64),repeat('0',64),'legacy-race-r1',repeat('2',64),
      null,0,0,0,0,0,true,pg_catalog.statement_timestamp() - interval '2 seconds'),
    ('84000000-0000-5000-8000-000000000200',
      case when v_mode = 'activation' then 'candidate' else 'active' end,2,
      '84000000-0000-5000-8000-000000000100','legacy-race-r2',repeat('3',64),
      repeat('0',64),repeat('0',64),'legacy-race-r2',repeat('4',64),null,0,0,0,0,0,true,
      case when v_mode = 'rollback' then pg_catalog.statement_timestamp() - interval '1 second' else null end);
  update public.site_content_releases r
  set dynamic_state_digest = public.site_content_dynamic_state_digest(r.id)
  where r.id in ('84000000-0000-5000-8000-000000000100','84000000-0000-5000-8000-000000000200');
  update public.site_content_releases r
  set release_digest = public.site_content_release_digest(r.id)
  where r.id in ('84000000-0000-5000-8000-000000000100','84000000-0000-5000-8000-000000000200');
  select * into strict v_r1 from public.site_content_releases
  where id = '84000000-0000-5000-8000-000000000100';
  select * into strict v_r2 from public.site_content_releases
  where id = '84000000-0000-5000-8000-000000000200';

  v_fields := jsonb_build_object(
    'version','activation-receipt-v1','promotionId','site-release:legacy-race-r1',
    'projectRef','legacy-transition-race','operation','site_release',
    'recoveryReadinessDigest',repeat('5',64),'activatedAt',to_char(
      (pg_catalog.statement_timestamp() - interval '2 seconds') at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'resource',jsonb_build_object('kind','site_release','siteReleaseId',v_r1.id::text,
      'siteReleaseDigest',v_r1.release_digest,'previousSiteReleaseId',v_bootstrap.id::text,
      'previousSiteReleaseDigest',v_bootstrap.release_digest));
  v_receipt_id := 'sha256:' || encode(extensions.digest(convert_to(
    'activation-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_fields),
    'UTF8'),'sha256'),'hex');
  v_receipt := v_fields || jsonb_build_object('receiptId',v_receipt_id);
  insert into public.site_content_release_receipts values(
    v_receipt_id,v_r1.id,'activation',repeat('5',64),v_receipt,clock_timestamp());

  if v_mode = 'rollback' then
    v_fields := jsonb_build_object(
      'version','activation-receipt-v1','promotionId','site-release:legacy-race-r2',
      'projectRef','legacy-transition-race','operation','site_release',
      'recoveryReadinessDigest',repeat('6',64),'activatedAt',to_char(
        (pg_catalog.statement_timestamp() - interval '1 second') at time zone 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'resource',jsonb_build_object('kind','site_release','siteReleaseId',v_r2.id::text,
        'siteReleaseDigest',v_r2.release_digest,'previousSiteReleaseId',v_r1.id::text,
        'previousSiteReleaseDigest',v_r1.release_digest));
    v_receipt_id := 'sha256:' || encode(extensions.digest(convert_to(
      'activation-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_fields),
      'UTF8'),'sha256'),'hex');
    v_receipt := v_fields || jsonb_build_object('receiptId',v_receipt_id);
    insert into public.site_content_release_receipts values(
      v_receipt_id,v_r2.id,'activation',repeat('6',64),v_receipt,clock_timestamp());
  end if;

  update public.site_content_releases set state = 'superseded' where id = v_bootstrap.id;
  if v_mode = 'activation' then
    update public.site_content_releases set state = 'active' where id = v_r1.id;
    update public.site_content_sync_state set change_epoch = 2,served_change_epoch = 1,
      active_release_id = v_r1.id,active_release_digest = v_r1.release_digest,initialized = true
    where singleton;
  else
    update public.site_content_sync_state set change_epoch = 2,served_change_epoch = 2,
      active_release_id = v_r2.id,active_release_digest = v_r2.release_digest,initialized = true
    where singleton;
  end if;
end;
$$;

\echo 'PASS site-content legacy transition race seed'
