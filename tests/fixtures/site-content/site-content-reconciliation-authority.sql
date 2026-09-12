\set ON_ERROR_STOP on

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, created_at, updated_at
) values
  (
    '81000000-0000-4000-8000-000000000001'::uuid,
    'authenticated', 'authenticated', 'site-admin-one@example.invalid', '',
    '{"site_role":"administrator"}'::jsonb, pg_catalog.now(), pg_catalog.now()
  ),
  (
    '81000000-0000-4000-8000-000000000002'::uuid,
    'authenticated', 'authenticated', 'site-admin-two@example.invalid', '',
    '{"site_role":"administrator"}'::jsonb, pg_catalog.now(), pg_catalog.now()
  ),
  (
    '81000000-0000-4000-8000-000000000003'::uuid,
    'authenticated', 'authenticated', 'site-non-admin@example.invalid', '',
    '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
  );

insert into public.clinical_registry_records(id, owner_id, kind, slug, title, updated_at)
values
  (
    '81000000-0000-4000-8000-000000000010'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    'service', 'authority-fixture-one', 'Authority fixture one',
    '2026-08-30 00:00:00+00'::timestamptz
  ),
  (
    '81000000-0000-4000-8000-000000000011'::uuid,
    '81000000-0000-4000-8000-000000000001'::uuid,
    'service', 'authority-fixture-two', 'Authority fixture two',
    '2026-08-30 00:00:01+00'::timestamptz
  );

create temporary table correction_authority_plan(plan jsonb not null);
grant select on correction_authority_plan to authenticated;

do $$
declare
  v_source record;
  v_snapshot jsonb;
  v_disposition jsonb;
  v_trusted jsonb;
  v_dispositions jsonb;
  v_governed jsonb;
begin
  v_trusted := '[]'::jsonb;
  v_dispositions := '[]'::jsonb;
  for v_source in
    select input.source_row_id, projection.*
    from (values
      ('81000000-0000-4000-8000-000000000010'::uuid),
      ('81000000-0000-4000-8000-000000000011'::uuid)
    ) input(source_row_id)
    cross join lateral public.site_content_source_projection('service', input.source_row_id) projection
    order by projection.logical_id
  loop
    v_snapshot := jsonb_build_object(
      'logicalId', v_source.logical_id,
      'publicRecordId', v_source.logical_id,
      'route', v_source.record->>'route',
      'contentHash', v_source.record->>'contentHash',
      'publicationVersion', v_source.record->>'publicationVersion',
      'governanceHash', public.site_content_record_governance_hash(v_source.record)
    );
    v_disposition := jsonb_build_object(
      'logicalId', v_source.logical_id,
      'disposition', 'adopt',
      'sourceKind', 'service',
      'sourceRowId', v_source.source_row_id::text,
      'sourceVersion', v_source.source_version,
      'contentHash', v_source.record->>'contentHash',
      'publicationVersion', v_source.record->>'publicationVersion',
      'trustedPublicRecordId', v_source.logical_id,
      'trustedRoute', v_source.record->>'route',
      'trustedGovernanceHash', public.site_content_record_governance_hash(v_source.record)
    );
    v_trusted := v_trusted || jsonb_build_array(v_snapshot);
    v_dispositions := v_dispositions || jsonb_build_array(v_disposition);
  end loop;
  v_governed := jsonb_build_object(
    'version', 'site-content-reconciliation-plan-v1',
    'trustedSnapshotDigest', public.site_content_json_sha256(jsonb_build_object(
      'version', 'site-content-trusted-snapshot-v1', 'records', v_trusted
    )),
    'expectedRecordCount', 2,
    'expectedGroupCount', 2,
    'batchSize', 2,
    'batchCount', 1,
    'counts', jsonb_build_object(
      'adopt', 2, 'retire', 0, 'identicalDuplicate', 0, 'total', 2
    ),
    'trustedSnapshots', v_trusted,
    'dispositions', v_dispositions
  );
  insert into correction_authority_plan(plan)
  values (v_governed || jsonb_build_object(
    'planDigest', public.site_content_json_sha256(v_governed)
  ));
end;
$$;

begin;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
do $$
begin
  if not public.record_site_content_reconciliation_plan(
    (select plan from correction_authority_plan)
  ) then
    raise exception 'control_plane_authenticated_recorder_rejected_exact_plan';
  end if;
end;
$$;
reset role;
commit;

create temporary table correction_authority_original as
select reviewed_by, reviewed_at, administrator_authorized_at, administrator_authorization_version
from public.site_content_reconciliation_plans;

create temporary table correction_authority_rows_before_malformed as
select to_jsonb(plan) as row_bytes
from public.site_content_reconciliation_plans plan;

create temporary table correction_authority_malformed(case_name text not null, plan jsonb not null);
grant select on correction_authority_malformed to authenticated;

do $$
declare
  v_base jsonb := (select plan from correction_authority_plan);
  v_candidate jsonb;
  v_case text;
begin
  foreach v_case in array array[
    'extra_counts_key',
    'string_count',
    'string_numeric',
    'extra_item_key',
    'null_disposition'
  ] loop
    v_candidate := case v_case
      when 'extra_counts_key' then jsonb_set(
        v_base, '{counts}', (v_base->'counts') || '{"extra":0}'::jsonb
      )
      when 'string_count' then jsonb_set(v_base, '{counts,total}', '"2"'::jsonb)
      when 'string_numeric' then jsonb_set(v_base, '{expectedRecordCount}', '"2"'::jsonb)
      when 'extra_item_key' then jsonb_set(
        v_base, '{dispositions,0}', (v_base#>'{dispositions,0}') || '{"extra":true}'::jsonb
      )
      when 'null_disposition' then jsonb_set(v_base, '{dispositions,0,disposition}', 'null'::jsonb)
    end;
    v_candidate := (v_candidate - 'planDigest') || jsonb_build_object(
      'planDigest', public.site_content_json_sha256(v_candidate - 'planDigest')
    );
    insert into correction_authority_malformed(case_name, plan) values (v_case, v_candidate);
  end loop;
end;
$$;

begin;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
do $$
declare
  v_candidate jsonb;
  v_case text;
begin
  for v_case, v_candidate in
    select malformed.case_name, malformed.plan
    from correction_authority_malformed malformed
    order by malformed.case_name
  loop
    begin
      if public.record_site_content_reconciliation_plan(v_candidate) then
        raise exception 'control_plane_malformed_reconciliation_plan_accepted_%', v_case;
      end if;
    exception when sqlstate '22023' then
      null;
    end;
  end loop;
end;
$$;
reset role;
commit;

do $$
begin
  if (select count(*) from public.site_content_reconciliation_plans) <> 1
    or exists (
      select to_jsonb(plan) from public.site_content_reconciliation_plans plan
      except
      select row_bytes from correction_authority_rows_before_malformed
    )
    or exists (
      select row_bytes from correction_authority_rows_before_malformed
      except
      select to_jsonb(plan) from public.site_content_reconciliation_plans plan
    )
  then
    raise exception 'control_plane_malformed_reconciliation_plan_mutated_rows';
  end if;
end;
$$;

begin;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000002', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
do $$
begin
  if not public.record_site_content_reconciliation_plan(
    (select plan from correction_authority_plan)
  ) then
    raise exception 'control_plane_cross_admin_idempotent_replay_failed';
  end if;
end;
$$;
reset role;
commit;

do $$
begin
  if exists (
    select 1
    from public.site_content_reconciliation_plans current
    cross join correction_authority_original original
    where current.reviewed_by is distinct from original.reviewed_by
      or current.reviewed_at is distinct from original.reviewed_at
      or current.administrator_authorized_at is distinct from original.administrator_authorized_at
      or current.administrator_authorization_version is distinct from original.administrator_authorization_version
      or current.reviewed_at is distinct from current.administrator_authorized_at
      or current.administrator_authorization_version <> 'site-content-admin-authorization-v1'
  ) then
    raise exception 'control_plane_idempotent_review_authority_rewritten';
  end if;
end;
$$;

\! psql -U postgres -d __DATABASE__ -v ON_ERROR_STOP=1 -q -c "begin; select pg_catalog.pg_advisory_xact_lock(93206431); select pg_catalog.pg_sleep(3); commit;" >/tmp/site-content-authority-lock.log 2>&1 &

select pg_catalog.pg_sleep(0.25);
begin;
set local statement_timeout = '1s';
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claim.sub', '81000000-0000-4000-8000-000000000003', true
);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
do $$
begin
  begin
    perform public.record_site_content_reconciliation_plan(null);
    raise exception 'control_plane_non_admin_malformed_plan_accepted';
  exception when sqlstate '42501' then
    if sqlerrm <> 'site_content_administrator_authorization_required' then raise; end if;
  end;
end;
$$;
reset role;
commit;

do $$
begin
  if (select count(*) from public.site_content_reconciliation_plans) <> 1 then
    raise exception 'control_plane_authority_fixture_mutated_plan_count';
  end if;
end;
$$;

\echo 'PASS site-content reconciliation authority fixture'
