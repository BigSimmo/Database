\set ON_ERROR_STOP on

begin;

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

rollback;

\echo 'PASS site-content health state-machine fixture'
