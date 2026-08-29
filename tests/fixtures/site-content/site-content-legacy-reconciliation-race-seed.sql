\set ON_ERROR_STOP on

insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,created_at,updated_at)
values ('85000000-0000-4000-8000-000000000001','authenticated','authenticated',
  'legacy-recorder-race@example.invalid','', '{}'::jsonb,pg_catalog.now(),pg_catalog.now());

insert into public.clinical_registry_records(id,owner_id,kind,slug,title,updated_at)
values ('85000000-0000-4000-8000-000000000010','85000000-0000-4000-8000-000000000001',
  'service','legacy-recorder-race','Legacy recorder race','2026-08-30T00:00:00Z');

create table public.site_content_legacy_race_plan(plan jsonb not null);

do $$
declare
  s record;
  snapshot jsonb;
  disposition jsonb;
  trusted jsonb;
  plan jsonb;
begin
  select * into strict s from public.site_content_source_projection(
    'service','85000000-0000-4000-8000-000000000010');
  snapshot := jsonb_build_object(
    'logicalId',s.logical_id,'publicRecordId',s.logical_id,'route',s.record->>'route',
    'contentHash',s.record->>'contentHash','publicationVersion',s.record->>'publicationVersion',
    'governanceHash',public.site_content_record_governance_hash(s.record));
  disposition := jsonb_build_object(
    'logicalId',s.logical_id,'disposition','adopt','sourceKind','service',
    'sourceRowId','85000000-0000-4000-8000-000000000010','sourceVersion',s.source_version,
    'contentHash',s.record->>'contentHash','publicationVersion',s.record->>'publicationVersion',
    'trustedPublicRecordId',s.logical_id,'trustedRoute',s.record->>'route',
    'trustedGovernanceHash',public.site_content_record_governance_hash(s.record));
  trusted := jsonb_build_array(snapshot);
  plan := jsonb_build_object(
    'version','site-content-reconciliation-plan-v1',
    'trustedSnapshotDigest',public.site_content_json_sha256(jsonb_build_object(
      'version','site-content-trusted-snapshot-v1','records',trusted)),
    'expectedRecordCount',1,'expectedGroupCount',1,'batchSize',1,'batchCount',1,
    'counts',jsonb_build_object('adopt',1,'retire',0,'identicalDuplicate',0,'total',1),
    'trustedSnapshots',trusted,'dispositions',jsonb_build_array(disposition));
  insert into public.site_content_legacy_race_plan values(
    plan || jsonb_build_object('planDigest',public.site_content_json_sha256(plan)));
end;
$$;

\echo 'PASS site-content legacy reconciliation race seed'
