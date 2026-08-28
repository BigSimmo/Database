\set ON_ERROR_STOP on

begin;

create temporary table task4_health_integrity_results (
  case_name text primary key,
  passed boolean not null,
  evidence jsonb not null
);

with evidence as (select public.read_site_content_health() value)
select
  (value->>'initialized' = 'false'
    and value->>'bootstrapIntegrityState' = 'valid_retained'
    and value->'activePublicSiteRelease'->>'activatedAt' is not null
    and value->'lastActivation' = 'null'::jsonb) as passed,
  value::text as evidence
from evidence
\gset bootstrap_activation_

insert into task4_health_integrity_results(case_name, passed, evidence)
values (
  'retained bootstrap did not preserve its created_at activation fallback',
  :'bootstrap_activation_passed'::boolean,
  :'bootstrap_activation_evidence'::jsonb
);

savepoint task4_bootstrap_dynamic_digest;

update public.site_content_releases
set dynamic_state_digest = case
  when dynamic_state_digest = repeat('f', 64) then repeat('e', 64)
  else repeat('f', 64)
end
where id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid;

with evidence as (select public.read_site_content_health() value)
select
  (value->>'bootstrapIntegrityState' = 'invalid') as passed,
  value::text as evidence
from evidence
\gset bootstrap_dynamic_

rollback to savepoint task4_bootstrap_dynamic_digest;

insert into task4_health_integrity_results(case_name, passed, evidence)
values (
  'retained bootstrap accepted a different valid dynamic-state digest',
  :'bootstrap_dynamic_passed'::boolean,
  :'bootstrap_dynamic_evidence'::jsonb
);

savepoint task4_epoch_zero_dynamic_digest;

update public.site_content_releases
set state = 'superseded'
where id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid;

insert into public.site_content_releases (
  id, state, target_change_epoch, previous_release_id, registry_version,
  static_manifest_digest, dynamic_state_digest, release_digest, generation_id,
  plan_digest, reconciliation_plan_digest, expected_added_count,
  expected_changed_count, expected_unchanged_count, expected_record_count,
  expected_tombstone_count, must_pass_checks, activated_at
) values (
  '60000000-0000-5000-8000-000000000001'::uuid,
  'active',
  1,
  'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid,
  'task4-epoch-zero-dynamic-digest-v1',
  repeat('1', 64),
  repeat('2', 64),
  repeat('3', 64),
  'task4-epoch-zero-dynamic-digest-v1',
  repeat('4', 64),
  null,
  0,
  0,
  0,
  0,
  0,
  true,
  pg_catalog.clock_timestamp()
);

insert into public.site_content_release_receipts (
  receipt_id, release_id, receipt_kind, recovery_readiness_digest, receipt
)
select
  'sha256:' || repeat('6', 64),
  '60000000-0000-5000-8000-000000000001'::uuid,
  'activation',
  repeat('7', 64),
  jsonb_build_object(
    'resource', jsonb_build_object(
      'kind', 'site_release',
      'siteReleaseId', '60000000-0000-5000-8000-000000000001',
      'siteReleaseDigest', repeat('3', 64)
    ),
    'previousResource', jsonb_build_object(
      'siteReleaseId', bootstrap.id::text,
      'siteReleaseDigest', bootstrap.release_digest
    )
  )
from public.site_content_releases bootstrap
where bootstrap.id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid;

update public.site_content_sync_state
set change_epoch = 1,
  served_change_epoch = 1,
  active_release_id = '60000000-0000-5000-8000-000000000001'::uuid,
  active_release_digest = repeat('3', 64),
  initialized = true;

with evidence as (select public.read_site_content_health() value)
select
  ((value->>'rollbackAvailable')::boolean = true) as passed,
  value::text as evidence
from evidence
\gset epoch_zero_rollback_baseline_

update public.site_content_releases
set dynamic_state_digest = case
  when dynamic_state_digest = repeat('f', 64) then repeat('e', 64)
  else repeat('f', 64)
end
where id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid;

with evidence as (select public.read_site_content_health() value)
select
  ((value->>'rollbackAvailable')::boolean = false) as passed,
  value::text as evidence
from evidence
\gset epoch_zero_rollback_dynamic_

rollback to savepoint task4_epoch_zero_dynamic_digest;

insert into task4_health_integrity_results(case_name, passed, evidence)
values
  (
    'exact epoch-zero predecessor was not rollback-available before digest mutation',
    :'epoch_zero_rollback_baseline_passed'::boolean,
    :'epoch_zero_rollback_baseline_evidence'::jsonb
  ),
  (
    'epoch-zero predecessor accepted a different valid dynamic-state digest',
    :'epoch_zero_rollback_dynamic_passed'::boolean,
    :'epoch_zero_rollback_dynamic_evidence'::jsonb
  );

do $$
declare
  v_state text;
  v_evidence jsonb;
begin
  foreach v_state in array array['candidate', 'superseded', 'abandoned', 'rolled_back'] loop
    update public.site_content_releases
    set state = v_state
    where id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid;

    v_evidence := public.read_site_content_health();
    if v_evidence->'activePublicSiteRelease' is distinct from 'null'::jsonb
      or v_evidence->>'bootstrapIntegrityState' is distinct from 'invalid'
      or (v_evidence->>'rollbackAvailable')::boolean is distinct from false
    then
      raise exception 'non-active release state % did not fail closed: %', v_state, v_evidence;
    end if;
  end loop;

  update public.site_content_releases
  set state = 'active'
  where id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid;
end;
$$;

savepoint task4_bootstrap_conflict;

insert into public.site_content_publications (
  id, logical_id, kind, slug, source_table, source_row_id, source_owner_id,
  source_version, published_by, record, render_payload, retired,
  administrator_authorized_at, administrator_authorization_version
) values (
  '10000000-0000-5000-8000-000000000001'::uuid,
  'task4:bootstrap-conflict',
  'service',
  'task4-bootstrap-conflict',
  'clinical_registry_records',
  '10000000-0000-4000-8000-000000000002'::uuid,
  '10000000-0000-4000-8000-000000000003'::uuid,
  'task4-bootstrap-conflict-v1',
  '10000000-0000-4000-8000-000000000004'::uuid,
  '{}'::jsonb,
  '{}'::jsonb,
  false,
  pg_catalog.clock_timestamp(),
  'site-content-admin-authorization-v1'
);

insert into public.site_content_public_records (
  logical_id, kind, slug, current_publication_id, head_change_epoch, retired
) values (
  'task4:bootstrap-conflict',
  'service',
  'task4-bootstrap-conflict',
  '10000000-0000-5000-8000-000000000001'::uuid,
  1,
  false
);

with inserted as (
  insert into public.site_content_sync_events (
    logical_id, target_publication_id, target_change_epoch, state
  ) values (
    'task4:bootstrap-conflict',
    '10000000-0000-5000-8000-000000000001'::uuid,
    1,
    'pending'
  )
  returning event_sequence
)
update public.site_content_public_records
set pending_event_sequence = inserted.event_sequence
from inserted
where logical_id = 'task4:bootstrap-conflict';

with evidence as (select public.read_site_content_health() value)
select
  (value->>'bootstrapIntegrityState' = 'invalid'
    and (value->>'pendingCount')::bigint = 1
    and (value->>'outstandingHeadCount')::bigint = 1) as passed,
  value::text as evidence
from evidence
\gset bootstrap_

rollback to savepoint task4_bootstrap_conflict;

insert into task4_health_integrity_results(case_name, passed, evidence)
values (
  'bootstrap retained integrity ignored an extra outstanding head/live event',
  :'bootstrap_passed'::boolean,
  :'bootstrap_evidence'::jsonb
);

savepoint task4_missing_public_head;

insert into public.site_content_publications (
  id, logical_id, kind, slug, source_table, source_row_id, source_owner_id,
  source_version, published_by, record, render_payload, retired,
  administrator_authorized_at, administrator_authorization_version
)
select
  '20000000-0000-5000-8000-000000000001'::uuid,
  rr.logical_id,
  'service',
  'task4-missing-public-head',
  'clinical_registry_records',
  '20000000-0000-4000-8000-000000000002'::uuid,
  '20000000-0000-4000-8000-000000000003'::uuid,
  'task4-missing-public-head-v1',
  '20000000-0000-4000-8000-000000000004'::uuid,
  rr.record,
  rr.render_payload,
  false,
  pg_catalog.clock_timestamp(),
  'site-content-admin-authorization-v1'
from public.site_content_release_records rr
where rr.release_id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid
order by rr.logical_id
limit 1;

update public.site_content_releases
set state = 'superseded'
where id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid;

insert into public.site_content_releases (
  id, state, target_change_epoch, previous_release_id, registry_version,
  static_manifest_digest, dynamic_state_digest, release_digest, generation_id,
  plan_digest, reconciliation_plan_digest, expected_added_count,
  expected_changed_count, expected_unchanged_count, expected_record_count,
  expected_tombstone_count, must_pass_checks, activated_at
) values (
  '20000000-0000-5000-8000-000000000005'::uuid,
  'active',
  1,
  'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid,
  'task4-missing-public-head-v1',
  repeat('1', 64),
  repeat('2', 64),
  repeat('3', 64),
  'task4-missing-public-head-v1',
  repeat('4', 64),
  null,
  1,
  0,
  0,
  1,
  0,
  true,
  pg_catalog.clock_timestamp()
);

insert into public.site_content_release_records (
  release_id, logical_id, target_publication_id, logical_document_id,
  logical_chunk_id, normalized_text, content_hash, publication_fingerprint,
  governance_fingerprint, lineage_fingerprint, public_metadata_fingerprint,
  embedding_model, embedding_dimensions, embedding_fingerprint,
  embedding_value_digest, embedding, record, render_payload, tombstone, public_visible
)
select
  '20000000-0000-5000-8000-000000000005'::uuid,
  rr.logical_id,
  '20000000-0000-5000-8000-000000000001'::uuid,
  '20000000-0000-5000-8000-000000000006'::uuid,
  '20000000-0000-5000-8000-000000000007'::uuid,
  rr.normalized_text,
  rr.content_hash,
  rr.publication_fingerprint,
  rr.governance_fingerprint,
  rr.lineage_fingerprint,
  rr.public_metadata_fingerprint,
  rr.embedding_model,
  rr.embedding_dimensions,
  rr.embedding_fingerprint,
  rr.embedding_value_digest,
  rr.embedding,
  rr.record,
  rr.render_payload,
  false,
  true
from public.site_content_release_records rr
where rr.release_id = 'c0f6c316-b6f8-5c55-87ce-6b486032af03'::uuid
order by rr.logical_id
limit 1;

update public.site_content_sync_state
set change_epoch = 1,
  served_change_epoch = 1,
  active_release_id = '20000000-0000-5000-8000-000000000005'::uuid,
  active_release_digest = repeat('3', 64),
  initialized = true;

with evidence as (select public.read_site_content_health() value)
select
  ((value->>'populationComplete')::boolean = false) as passed,
  value::text as evidence
from evidence
\gset missing_

update public.site_content_releases
set activated_at = null
where id = '20000000-0000-5000-8000-000000000005'::uuid;

with evidence as (select public.read_site_content_health() value)
select
  (value->'activePublicSiteRelease' = 'null'::jsonb
    and value->'lastActivation' = 'null'::jsonb
    and (value->>'timeIntegrityValid')::boolean = false) as passed,
  value::text as evidence
from evidence
\gset missing_activation_

update public.site_content_releases
set activated_at = pg_catalog.statement_timestamp() + interval '1 minute'
where id = '20000000-0000-5000-8000-000000000005'::uuid;

with evidence as (select public.read_site_content_health() value)
select
  (value->'activePublicSiteRelease' = 'null'::jsonb
    and value->'lastActivation' <> 'null'::jsonb
    and (value->>'timeIntegrityValid')::boolean = false) as passed,
  value::text as evidence
from evidence
\gset future_activation_

rollback to savepoint task4_missing_public_head;

insert into task4_health_integrity_results(case_name, passed, evidence)
values (
  'missing public head did not make populationComplete false',
  :'missing_passed'::boolean,
  :'missing_evidence'::jsonb
);

insert into task4_health_integrity_results(case_name, passed, evidence)
values
  (
    'initialized active release accepted a missing activation timestamp',
    :'missing_activation_passed'::boolean,
    :'missing_activation_evidence'::jsonb
  ),
  (
    'initialized active release accepted a future activation timestamp',
    :'future_activation_passed'::boolean,
    :'future_activation_evidence'::jsonb
  );

do $$
begin
  if exists (select 1 from task4_health_integrity_results where not passed) then
    raise exception 'site-content health integrity regressions failed: %',
      (select jsonb_object_agg(case_name, evidence order by case_name)
       from task4_health_integrity_results where not passed);
  end if;
end;
$$;

rollback;

\echo 'PASS site-content health state-machine fixture'
