-- Reassert the fail-closed default-ACL postcondition after later migrations.
-- Every statement is safe to rerun and is executable by hosted migrations,
-- which create public-schema objects as postgres.

alter default privileges for role postgres
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to service_role;

do $$
declare
  v_status jsonb;
begin
  v_status := public.default_privileges_status('postgres', 'public');
  if not coalesce((v_status->>'safe')::boolean, false) then
    raise exception using
      errcode = '42501',
      message = 'Unsafe postgres default privileges in schema public; reassertion blocked.',
      detail = v_status::text,
      hint = 'Reapply the postgres default-privilege repair and retry the migration.';
  end if;
end;
$$;
