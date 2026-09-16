\set ON_ERROR_STOP on

do $$
declare
  v_source record;
  v_bootstrap public.site_content_releases%rowtype;
  v_activation_fields jsonb;
  v_activation jsonb;
  v_activation_id text;
  v_rollback_fields jsonb;
  v_rollback jsonb;
  v_rollback_id text;
begin
  select * into strict v_bootstrap from public.site_content_releases
  where id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid;

  for v_source in
    select * from (values
      (
        '82000000-0000-5000-8000-000000000001'::uuid, 1::bigint,
        repeat('1',64), repeat('2',64), repeat('3',64), repeat('4',64),
        'site-release:backfill-source-one'::text
      ),
      (
        '82000000-0000-5000-8000-000000000002'::uuid, 2::bigint,
        repeat('5',64), repeat('6',64), repeat('7',64), repeat('8',64),
        'site-release:backfill-source-two'::text
      )
    ) source(id, target_epoch, static_digest, dynamic_digest, release_digest, recovery_digest, promotion_id)
  loop
    insert into public.site_content_releases (
      id,state,target_change_epoch,previous_release_id,registry_version,static_manifest_digest,
      dynamic_state_digest,release_digest,generation_id,plan_digest,reconciliation_plan_digest,
      expected_added_count,expected_changed_count,expected_unchanged_count,expected_record_count,
      expected_tombstone_count,must_pass_checks,activated_at
    ) values (
      v_source.id,'rolled_back',v_source.target_epoch,v_bootstrap.id,
      'transition-backfill-fixture-v1',v_source.static_digest,v_source.dynamic_digest,
      v_source.release_digest,'transition-backfill-fixture-v1',repeat('9',64),null,
      0,0,0,0,0,true,
      ('2026-08-29 00:00:00+00'::timestamptz + make_interval(secs => v_source.target_epoch))
    );

    v_activation_fields := jsonb_build_object(
      'version','activation-receipt-v1','promotionId',v_source.promotion_id,
      'projectRef','transition-backfill-fixture','operation','site_release',
      'recoveryReadinessDigest',v_source.recovery_digest,
      'activatedAt',to_char(
        '2026-08-29 00:00:00+00'::timestamptz + make_interval(secs => v_source.target_epoch),
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'resource',jsonb_build_object(
        'kind','site_release','siteReleaseId',v_source.id::text,
        'siteReleaseDigest',v_source.release_digest,
        'previousSiteReleaseId',v_bootstrap.id::text,
        'previousSiteReleaseDigest',v_bootstrap.release_digest
      )
    );
    v_activation := v_activation_fields || jsonb_build_object(
      'receiptId','sha256:' || encode(extensions.digest(convert_to(
        'activation-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_activation_fields),
        'UTF8'
      ),'sha256'),'hex')
    );
    v_activation_id := public.guard_site_content_receipt_shape(
      v_activation,'activation',v_source.id,v_source.recovery_digest
    );
    insert into public.site_content_release_receipts(
      receipt_id,release_id,receipt_kind,recovery_readiness_digest,receipt
    ) values (
      v_activation_id,v_source.id,'activation',v_source.recovery_digest,v_activation
    );

    v_rollback_fields := jsonb_build_object(
      'version','rollback-receipt-v1','activationReceiptId',v_activation_id,
      'promotionId',v_source.promotion_id,'projectRef','transition-backfill-fixture',
      'operation','site_release',
      'rolledBackAt',to_char(
        '2026-08-29 00:01:00+00'::timestamptz + make_interval(secs => v_source.target_epoch),
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
      ),
      'method','retained_previous','requiresReconstruction',false,'outcome','succeeded',
      'target',jsonb_build_object(
        'kind','site_release','siteReleaseId',v_bootstrap.id::text,
        'siteReleaseDigest',v_bootstrap.release_digest
      )
    );
    v_rollback := v_rollback_fields || jsonb_build_object(
      'receiptId','sha256:' || encode(extensions.digest(convert_to(
        'rollback-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_rollback_fields),
        'UTF8'
      ),'sha256'),'hex')
    );
    v_rollback_id := public.guard_site_content_receipt_shape(
      v_rollback,'rollback',v_bootstrap.id,v_source.recovery_digest
    );
    insert into public.site_content_release_receipts(
      receipt_id,release_id,receipt_kind,recovery_readiness_digest,receipt
    ) values (
      v_rollback_id,v_bootstrap.id,'rollback',v_source.recovery_digest,v_rollback
    );
  end loop;
end;
$$;

insert into public.site_content_publications(
  id,logical_id,kind,slug,source_table,source_row_id,source_owner_id,source_version,published_by,
  administrator_authorized_at,administrator_authorization_version,reconciliation_plan_digest,
  record,render_payload,retired,created_at
) values (
  '82000000-0000-5000-8000-000000000010'::uuid,
  'services:backfill-pending','service','backfill-pending','clinical_registry_records',
  '82000000-0000-4000-8000-000000000011'::uuid,
  '82000000-0000-4000-8000-000000000012'::uuid,
  '2026-08-30T00:00:00.000Z','82000000-0000-4000-8000-000000000013'::uuid,
  pg_catalog.statement_timestamp(),'site-content-admin-authorization-v1',null,
  '{"logicalId":"services:backfill-pending"}'::jsonb,'{}'::jsonb,false,
  pg_catalog.statement_timestamp()
);

insert into public.site_content_public_records(
  logical_id,kind,slug,current_publication_id,head_change_epoch,retired,pending_event_sequence
) values (
  'services:backfill-pending','service','backfill-pending',
  '82000000-0000-5000-8000-000000000010'::uuid,3,false,null
);

with event as (
  insert into public.site_content_sync_events(
    logical_id,target_publication_id,target_change_epoch,state
  ) values (
    'services:backfill-pending','82000000-0000-5000-8000-000000000010'::uuid,3,'pending'
  ) returning event_sequence
)
update public.site_content_public_records
set pending_event_sequence = event.event_sequence
from event where logical_id = 'services:backfill-pending';

update public.site_content_sync_state
set change_epoch = 3, served_change_epoch = 0,
  active_release_id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid,
  active_release_digest = (
    select release_digest from public.site_content_releases
    where id = 'e4a1dd29-14f6-556c-8fb7-f4f947d8b846'::uuid
  ),
  initialized = false
where singleton;

\echo 'PASS site-content transition backfill seed'
