\set ON_ERROR_STOP on

do $$
declare
  v_release_id uuid := '__RELEASE_ID__'::uuid;
  v_generation text := '__GENERATION__';
  v_reconciliation_digest text := case
    when '__RECONCILIATION_DIGEST__' = 'recorded'
      then (select plan_digest from public.site_content_reconciliation_plans)
    else null
  end;
  v_event public.site_content_sync_events%rowtype;
  v_previous public.site_content_releases%rowtype;
  v_record_count integer;
  v_plan jsonb;
  v_plan_digest text;
  v_dynamic_digest text;
  v_release_digest text;
  v_recovery_digest text := repeat('__RECOVERY_HEX__', 64);
  v_receipt_fields jsonb;
  v_receipt jsonb;
  v_expected_result boolean := __EXPECT_RESULT__;
  v_before jsonb;
  v_after jsonb;
  v_result boolean;
begin
  select * into strict v_event from public.site_content_sync_events
  where target_change_epoch = (select change_epoch from public.site_content_sync_state where singleton)
  order by event_sequence desc limit 1;
  select count(*) into strict v_record_count from public.site_content_public_records;
  select r.* into strict v_previous from public.site_content_releases r
  join public.site_content_sync_state s on s.active_release_id = r.id where s.singleton;

  v_plan := jsonb_build_object(
    'version','site-content-sync-plan-v1',
    'releaseId',v_release_id::text,
    'releaseDigest',repeat('0',64),
    'targetChangeEpoch',v_event.target_change_epoch::text,
    'generationId',v_generation,
    'registryVersion','control-plane-lifecycle-v1',
    'staticManifestDigest',repeat('a',64),
    'dynamicStateDigest',repeat('0',64),
    'reconciliationPlanDigest',coalesce(v_reconciliation_digest,''),
    'counts',jsonb_build_object(
      'added',0,'changed',v_record_count,'unchanged',0,'tombstones',0,'total',v_record_count),
    'added','[]'::jsonb,
    'changed',(select jsonb_agg(jsonb_build_object('logicalId',h.logical_id) order by h.logical_id)
      from public.site_content_public_records h),
    'unchanged','[]'::jsonb,
    'tombstones','[]'::jsonb
  );
  v_plan_digest := public.site_content_json_sha256(v_plan);
  v_plan := v_plan || jsonb_build_object('planDigest',v_plan_digest);

  insert into public.site_content_sync_event_plans(
    event_sequence,plan_digest,target_change_epoch,plan,release_id
  ) values (
    v_event.event_sequence,v_plan_digest,v_event.target_change_epoch,v_plan,v_release_id
  );

  insert into public.site_content_releases(
    id,state,target_change_epoch,previous_release_id,registry_version,static_manifest_digest,
    dynamic_state_digest,release_digest,generation_id,plan_digest,reconciliation_plan_digest,
    expected_added_count,expected_changed_count,expected_unchanged_count,expected_record_count,
    expected_tombstone_count,must_pass_checks
  ) values (
    v_release_id,'candidate',v_event.target_change_epoch,v_previous.id,
    'control-plane-lifecycle-v1',repeat('a',64),repeat('0',64),repeat('0',64),
    v_generation,v_plan_digest,v_reconciliation_digest,0,v_record_count,0,v_record_count,0,true
  );

  insert into public.site_content_release_records(
    release_id,logical_id,target_publication_id,logical_document_id,logical_chunk_id,
    normalized_text,content_hash,publication_fingerprint,governance_fingerprint,
    lineage_fingerprint,public_metadata_fingerprint,embedding_model,embedding_dimensions,
    embedding_fingerprint,embedding_value_digest,embedding,record,render_payload,tombstone,public_visible
  )
  select
    v_release_id,h.logical_id,p.id,
    gen_random_uuid(),gen_random_uuid(),
    p.record->>'body',p.record->>'contentHash',
    p.record->>'publicationVersion',
    public.site_content_json_sha256(jsonb_build_object(
      'access',p.record->>'access',
      'validationStatus',p.record->>'validationStatus',
      'sourceStatus',p.record->>'sourceStatus')),
    public.site_content_json_sha256(p.record->'sourceLineage'),
    public.site_content_json_sha256(jsonb_build_object(
      'route',p.record->>'route','title',p.record->>'title',
      'sourceRole',p.record->>'sourceRole')),
    'control-plane-embedding-v1',1536,'control-plane-embedding-fingerprint-v1',
    encode(extensions.digest(convert_to(
      (array_fill(0::real,array[1536])::extensions.vector)::text,'UTF8'),'sha256'),'hex'),
    array_fill(0::real,array[1536])::extensions.vector,
    p.record,p.render_payload,false,true
  from public.site_content_public_records h
  join public.site_content_publications p on p.id = h.current_publication_id
  order by h.logical_id;

  v_dynamic_digest := public.site_content_dynamic_state_digest(v_release_id);
  update public.site_content_releases set dynamic_state_digest = v_dynamic_digest
  where id = v_release_id;
  v_release_digest := public.site_content_release_digest(v_release_id);
  update public.site_content_releases set release_digest = v_release_digest
  where id = v_release_id;
  update public.site_content_sync_events set state = 'ready' where event_sequence = v_event.event_sequence;

  v_receipt_fields := jsonb_build_object(
    'version','activation-receipt-v1','promotionId','site-release:' || v_generation,
    'projectRef','control-plane-lifecycle','operation','site_release',
    'recoveryReadinessDigest',v_recovery_digest,
    'activatedAt',to_char(pg_catalog.statement_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'resource',jsonb_build_object(
      'kind','site_release','siteReleaseId',v_release_id::text,
      'siteReleaseDigest',v_release_digest,
      'previousSiteReleaseId',v_previous.id::text,
      'previousSiteReleaseDigest',v_previous.release_digest)
  );
  v_receipt := v_receipt_fields || jsonb_build_object(
    'receiptId','sha256:' || encode(extensions.digest(convert_to(
      'activation-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_receipt_fields),
      'UTF8'),'sha256'),'hex')
  );
  __RECEIPT_MUTATION__
  select jsonb_build_object(
    'state',(select to_jsonb(s) from public.site_content_sync_state s where singleton),
    'releases',(select jsonb_agg(to_jsonb(r) order by r.id) from public.site_content_releases r),
    'receipts',(select jsonb_agg(to_jsonb(rr) order by rr.receipt_id) from public.site_content_release_receipts rr),
    'heads',(select jsonb_agg(to_jsonb(h) order by h.logical_id) from public.site_content_public_records h),
    'events',(select jsonb_agg(to_jsonb(e) order by e.event_sequence) from public.site_content_sync_events e)
  ) into v_before;
  v_result := public.activate_site_content_release(
    v_release_id,v_release_digest,v_event.target_change_epoch,v_recovery_digest,v_receipt
  );
  if v_result is distinct from v_expected_result then
    raise exception 'lifecycle_activation_result_mismatch_%_expected_%_actual_%',
      v_generation,v_expected_result,v_result;
  end if;
  if not v_expected_result then
    select jsonb_build_object(
      'state',(select to_jsonb(s) from public.site_content_sync_state s where singleton),
      'releases',(select jsonb_agg(to_jsonb(r) order by r.id) from public.site_content_releases r),
      'receipts',(select jsonb_agg(to_jsonb(rr) order by rr.receipt_id) from public.site_content_release_receipts rr),
      'heads',(select jsonb_agg(to_jsonb(h) order by h.logical_id) from public.site_content_public_records h),
      'events',(select jsonb_agg(to_jsonb(e) order by e.event_sequence) from public.site_content_sync_events e)
    ) into v_after;
    if v_after is distinct from v_before then raise exception 'activation_false_mutated_state'; end if;
  end if;
end;
$$;

\echo 'PASS site-content current-head activation'
