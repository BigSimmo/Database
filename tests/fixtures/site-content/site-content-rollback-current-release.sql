\set ON_ERROR_STOP on

do $$
declare
  v_expected_active uuid := '__ACTIVE_RELEASE_ID__'::uuid;
  v_target uuid := '__TARGET_RELEASE_ID__'::uuid;
  v_expect boolean := __EXPECT_RESULT__;
  v_state public.site_content_sync_state%rowtype;
  v_activation public.site_content_release_receipts%rowtype;
  v_target_release public.site_content_releases%rowtype;
  v_fields jsonb;
  v_receipt jsonb;
  v_before jsonb;
  v_after jsonb;
  v_result boolean;
  v_health jsonb;
  v_reader record;
begin
  select * into strict v_state from public.site_content_sync_state where singleton;
  select * into strict v_activation from public.site_content_release_receipts
  where receipt_id = v_state.active_transition_receipt_id;
  select * into strict v_target_release from public.site_content_releases where id = v_target;
  select jsonb_build_object(
    'state',(select to_jsonb(s) from public.site_content_sync_state s where singleton),
    'releases',(select jsonb_agg(to_jsonb(r) order by r.id) from public.site_content_releases r),
    'receipts',(select jsonb_agg(to_jsonb(rr) order by rr.receipt_id) from public.site_content_release_receipts rr),
    'heads',(select jsonb_agg(to_jsonb(h) order by h.logical_id) from public.site_content_public_records h),
    'events',(select jsonb_agg(to_jsonb(e) order by e.event_sequence) from public.site_content_sync_events e)
  ) into v_before;
  v_fields := jsonb_build_object(
    'version','rollback-receipt-v1','activationReceiptId',v_activation.receipt_id,
    'promotionId',v_activation.receipt->>'promotionId',
    'projectRef',v_activation.receipt->>'projectRef','operation','site_release',
    'rolledBackAt',to_char(pg_catalog.statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'method','retained_previous','requiresReconstruction',false,'outcome','succeeded',
    'target',jsonb_build_object('kind','site_release','siteReleaseId',v_target::text,
      'siteReleaseDigest',v_target_release.release_digest)
  );
  v_receipt := v_fields || jsonb_build_object(
    'receiptId','sha256:' || encode(extensions.digest(convert_to(
      'rollback-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_fields),
      'UTF8'),'sha256'),'hex')
  );
  __RECEIPT_MUTATION__
  v_result := public.rollback_site_content_release(
    v_expected_active,v_target,repeat('d',64),v_receipt
  );
  if v_result is distinct from v_expect then
    raise exception 'rollback_result_mismatch_expected_%_actual_%',v_expect,v_result;
  end if;
  if not v_expect then
    select jsonb_build_object(
      'state',(select to_jsonb(s) from public.site_content_sync_state s where singleton),
      'releases',(select jsonb_agg(to_jsonb(r) order by r.id) from public.site_content_releases r),
      'receipts',(select jsonb_agg(to_jsonb(rr) order by rr.receipt_id) from public.site_content_release_receipts rr),
      'heads',(select jsonb_agg(to_jsonb(h) order by h.logical_id) from public.site_content_public_records h),
      'events',(select jsonb_agg(to_jsonb(e) order by e.event_sequence) from public.site_content_sync_events e)
    ) into v_after;
    if v_after is distinct from v_before then raise exception 'rollback_false_mutated_state'; end if;
  else
    select * into strict v_state from public.site_content_sync_state where singleton;
    if v_state.active_release_id <> v_target or v_state.served_change_epoch <> v_state.change_epoch
      or public.site_content_current_transition_kind(
        v_state.active_transition_receipt_id,v_state.active_release_id,
        v_state.active_release_digest,v_state.initialized,v_state.served_change_epoch) <> 'rollback'
    then raise exception 'rollback_success_transition_invalid'; end if;
    select public.read_site_content_health() into v_health;
    select * into strict v_reader
    from public.read_site_content_public_records('service',null) limit 1;
    if v_health->>'publicSiteChangeEpoch' <> v_state.change_epoch::text
      or v_health->>'populationComplete' <> 'true'
      or v_health->>'rollbackAvailable' <> 'false'
      or v_reader.snapshot->>'state' <> 'current'
      or v_reader.snapshot->>'changeEpoch' <> v_state.change_epoch::text
      or v_reader.record is null
    then raise exception 'rollback_success_projection_invalid'; end if;
  end if;
end;
$$;

\echo 'PASS site-content rollback current release'
