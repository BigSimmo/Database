\set ON_ERROR_STOP on

create temporary table initial_adoption_call as
select input.source_row_id, source.source_version,
  public.site_content_json_sha256(source.record) record_digest,
  public.site_content_projection_digest(source.record, source.render_payload) projection_digest,
  (select plan_digest from public.site_content_reconciliation_plans) reconciliation_plan_digest
from (values
  ('81000000-0000-4000-8000-000000000010'::uuid),
  ('81000000-0000-4000-8000-000000000011'::uuid)
) input(source_row_id)
cross join lateral public.site_content_source_projection('service', input.source_row_id) source;
grant select on initial_adoption_call to authenticated;

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
  v_call record;
  v_result record;
  v_expected_epoch bigint := 0;
begin
  for v_call in select * from initial_adoption_call order by source_row_id loop
    select * into strict v_result from public.publish_site_content_record(
      'service',
      v_call.source_row_id,
      v_call.source_version,
      v_expected_epoch,
      v_call.reconciliation_plan_digest,
      v_call.record_digest,
      v_call.projection_digest
    );
    v_expected_epoch := v_expected_epoch + 1;
    if v_result.outcome <> 'applied' or v_result.change_epoch <> v_expected_epoch then
      raise exception 'initial_adoption_publish_failed';
    end if;
  end loop;
end;
$$;
reset role;
commit;

do $$
declare v_state public.site_content_sync_state%rowtype;
begin
  select * into strict v_state from public.site_content_sync_state where singleton;
  if v_state.initialized or v_state.change_epoch <> 2 or v_state.served_change_epoch <> 0
    or (select count(*) from public.site_content_publications) <> 2
    or (select count(*) from public.site_content_public_records) <> 2
    or (select count(*) from public.site_content_sync_events) <> 2
    or (select min(target_change_epoch) from public.site_content_sync_events) <> 1
    or (select max(target_change_epoch) from public.site_content_sync_events) <> 2 then
    raise exception 'initial_adoption_seed_invalid';
  end if;
end;
$$;

\echo 'PASS site-content initial-adoption seed'
