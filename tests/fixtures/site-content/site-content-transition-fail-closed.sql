\set ON_ERROR_STOP on

do $$
declare
  v_health jsonb;
  v_record_count integer;
  v_snapshot_state text;
begin
  select count(*) filter (where record is not null), min(snapshot->>'state')
  into v_record_count,v_snapshot_state
  from public.read_site_content_public_records('service',null);
  select public.read_site_content_health() into v_health;
  if v_record_count <> 0 or v_snapshot_state <> 'unavailable'
    or v_health->'activePublicSiteRelease' <> 'null'::jsonb
    or v_health->>'populationComplete' <> 'false'
    or v_health->>'rollbackAvailable' <> 'false'
  then raise exception 'invalid_transition_did_not_fail_closed'; end if;
end;
$$;

\echo 'PASS site-content invalid transition fail-closed'
