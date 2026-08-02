-- Forward-only hosted repair for secure future-object defaults. This migration
-- is intentionally self-contained because the earlier assertion failed before
-- its function or ACL changes could commit in production.

create or replace function public.default_privileges_status(
  p_role_name text default 'postgres',
  p_schema_name text default 'public'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role_oid oid;
  v_namespace_oid oid;
  v_entries text[] := '{}'::text[];
  v_safe boolean := false;
  v_has_unexpected_grantee boolean := false;
  v_has_grantable boolean := false;
begin
  select oid into v_role_oid from pg_catalog.pg_roles where rolname = p_role_name;
  select oid into v_namespace_oid from pg_catalog.pg_namespace where nspname = p_schema_name;

  if v_role_oid is null or v_namespace_oid is null then
    return jsonb_build_object(
      'role_exists', v_role_oid is not null,
      'schema_exists', v_namespace_oid is not null,
      'safe', false,
      'entries', '[]'::jsonb
    );
  end if;

  with object_types(object_type, object_code) as (
    values ('table'::text, 'r'::"char"), ('sequence'::text, 'S'::"char"), ('function'::text, 'f'::"char")
  ), effective_acls as (
    select
      ot.object_type,
      coalesce(global_acl.defaclacl, pg_catalog.acldefault(ot.object_code, v_role_oid))
        || coalesce(schema_acl.defaclacl, '{}'::aclitem[]) as acl
    from object_types ot
    left join pg_catalog.pg_default_acl global_acl
      on global_acl.defaclrole = v_role_oid
     and global_acl.defaclnamespace = 0
     and global_acl.defaclobjtype = ot.object_code
    left join pg_catalog.pg_default_acl schema_acl
      on schema_acl.defaclrole = v_role_oid
     and schema_acl.defaclnamespace = v_namespace_oid
     and schema_acl.defaclobjtype = ot.object_code
  ), exploded as (
    select distinct
      ea.object_type,
      case when privilege.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
      lower(privilege.privilege_type) as privilege_type,
      privilege.is_grantable
    from effective_acls ea
    cross join lateral pg_catalog.aclexplode(ea.acl) privilege
    left join pg_catalog.pg_roles grantee on grantee.oid = privilege.grantee
  )
  select
    coalesce(
      array_agg(format('%s:%s:%s', object_type, grantee, privilege_type)
                order by object_type, grantee, privilege_type),
      '{}'::text[]
    ),
    coalesce(bool_or(grantee not in (p_role_name, 'service_role')), false),
    coalesce(bool_or(is_grantable), false)
  into v_entries, v_has_unexpected_grantee, v_has_grantable
  from exploded;

  v_safe :=
    not v_has_unexpected_grantee
    and not v_has_grantable
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'table:PUBLIC:%'
          or entry like 'table:anon:%'
          or entry like 'table:authenticated:%'
          or entry like 'sequence:PUBLIC:%'
          or entry like 'sequence:anon:%'
          or entry like 'sequence:authenticated:%'
          or entry = 'function:PUBLIC:execute'
          or entry like 'function:anon:%'
          or entry like 'function:authenticated:%'
    )
    and 'table:service_role:select' = any(v_entries)
    and 'table:service_role:insert' = any(v_entries)
    and 'table:service_role:update' = any(v_entries)
    and 'table:service_role:delete' = any(v_entries)
    and 'sequence:service_role:usage' = any(v_entries)
    and 'sequence:service_role:select' = any(v_entries)
    and 'function:service_role:execute' = any(v_entries)
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'table:service_role:%'
         and entry <> all(array[
           'table:service_role:select', 'table:service_role:insert',
           'table:service_role:update', 'table:service_role:delete'
         ])
    )
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'sequence:service_role:%'
         and entry <> all(array['sequence:service_role:usage', 'sequence:service_role:select'])
    )
    and not exists (
      select 1 from unnest(v_entries) entry
       where entry like 'function:service_role:%'
         and entry <> 'function:service_role:execute'
    );

  return jsonb_build_object(
    'role_exists', true,
    'schema_exists', true,
    'safe', v_safe,
    'entries', to_jsonb(v_entries)
  );
end;
$$;
revoke all on function public.default_privileges_status(text, text)
  from public, anon, authenticated;
grant execute on function public.default_privileges_status(text, text)
  to service_role;

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
      message = 'Unsafe postgres default privileges in schema public; repair blocked.',
      detail = v_status::text,
      hint = 'Rerun this idempotent repair after correcting postgres default privileges.';
  end if;
end;
$$;
