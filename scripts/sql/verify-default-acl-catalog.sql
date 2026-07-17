begin;

create role default_acl_fixture_role nologin;

do $$
declare
  status jsonb;
begin
  status := public.default_privileges_status('default_acl_fixture_role', 'public');
  if coalesce((status->>'safe')::boolean, false) then
    raise exception 'missing pg_default_acl rows hid built-in PUBLIC function execute';
  end if;
end;
$$;

alter default privileges for role default_acl_fixture_role
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role default_acl_fixture_role in schema public
  revoke all privileges on tables from public, anon, authenticated, service_role;
alter default privileges for role default_acl_fixture_role
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role default_acl_fixture_role in schema public
  revoke all privileges on sequences from public, anon, authenticated, service_role;
alter default privileges for role default_acl_fixture_role
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role default_acl_fixture_role in schema public
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role default_acl_fixture_role in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role default_acl_fixture_role in schema public
  grant usage, select on sequences to service_role;
alter default privileges for role default_acl_fixture_role in schema public
  grant execute on functions to service_role;

do $$
declare
  status jsonb;
begin
  status := public.default_privileges_status('default_acl_fixture_role', 'public');
  if not coalesce((status->>'safe')::boolean, false) then
    raise exception 'safe default ACL fixture was rejected: %', status;
  end if;
end;
$$;

alter default privileges for role default_acl_fixture_role in schema public
  grant select on tables to authenticated;

do $$
declare
  status jsonb;
begin
  status := public.default_privileges_status('default_acl_fixture_role', 'public');
  if coalesce((status->>'safe')::boolean, false) then
    raise exception 'unsafe authenticated table default was accepted';
  end if;
end;
$$;

alter default privileges for role default_acl_fixture_role in schema public
  revoke select on tables from authenticated;
alter default privileges for role default_acl_fixture_role in schema public
  grant select on tables to public;

do $$
declare
  status jsonb;
begin
  status := public.default_privileges_status('default_acl_fixture_role', 'public');
  if coalesce((status->>'safe')::boolean, false) then
    raise exception 'unsafe PUBLIC table default was accepted';
  end if;
end;
$$;

alter default privileges for role default_acl_fixture_role in schema public
  revoke select on tables from public;
alter default privileges for role default_acl_fixture_role in schema public
  grant usage on sequences to public;

do $$
declare
  status jsonb;
begin
  status := public.default_privileges_status('default_acl_fixture_role', 'public');
  if coalesce((status->>'safe')::boolean, false) then
    raise exception 'unsafe PUBLIC sequence default was accepted';
  end if;
end;
$$;

rollback;
