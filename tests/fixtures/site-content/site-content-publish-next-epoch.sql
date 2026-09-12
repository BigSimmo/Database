\set ON_ERROR_STOP on

update public.clinical_registry_records
set title = title || ' __TITLE_SUFFIX__',
  updated_at = updated_at + interval '1 second'
where id = '81000000-0000-4000-8000-000000000010'::uuid;

create temporary table next_epoch_call as
select source.source_version,
  public.site_content_json_sha256(source.record) record_digest,
  public.site_content_projection_digest(source.record, source.render_payload) projection_digest,
  (select change_epoch from public.site_content_sync_state where singleton) expected_epoch
from public.site_content_source_projection(
  'service', '81000000-0000-4000-8000-000000000010'::uuid
) source;
grant select on next_epoch_call to authenticated;

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
declare v_call record; v_result record;
begin
  select * into strict v_call from next_epoch_call;
  select * into strict v_result from public.publish_site_content_record(
    'service','81000000-0000-4000-8000-000000000010'::uuid,
    v_call.source_version,v_call.expected_epoch,null,
    v_call.record_digest,v_call.projection_digest
  );
  if v_result.outcome <> 'applied' or v_result.change_epoch <> v_call.expected_epoch + 1 then
    raise exception 'next_epoch_publish_failed';
  end if;
end;
$$;
reset role;
commit;

\echo 'PASS site-content next-epoch publication'
