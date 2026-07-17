-- Bootstrap safe supabase_admin future-object defaults before migrations in
-- fresh local databases. The Supabase CLI reads this file as `postgres`, which
-- cannot alter the reserved supabase_admin role. Local replay therefore applies
-- this file once as supabase_admin before reset; subsequent CLI reads verify the
-- durable catalog postcondition and become no-ops.

do $$
declare
  v_role_oid oid;
  v_namespace_oid oid;
  v_entries text[] := '{}'::text[];
  v_safe boolean := false;
begin
  select oid into v_role_oid from pg_catalog.pg_roles where rolname = 'supabase_admin';
  select oid into v_namespace_oid from pg_catalog.pg_namespace where nspname = 'public';

  if v_role_oid is null or v_namespace_oid is null then
    raise exception 'supabase_admin and public schema are required for default-privilege bootstrap';
  end if;

  begin
    alter default privileges for role supabase_admin
      revoke all privileges on tables from public, anon, authenticated, service_role;
    alter default privileges for role supabase_admin in schema public
      revoke all privileges on tables from public, anon, authenticated, service_role;

    alter default privileges for role supabase_admin
      revoke all privileges on sequences from public, anon, authenticated, service_role;
    alter default privileges for role supabase_admin in schema public
      revoke all privileges on sequences from public, anon, authenticated, service_role;

    alter default privileges for role supabase_admin
      revoke execute on functions from public, anon, authenticated, service_role;
    alter default privileges for role supabase_admin in schema public
      revoke execute on functions from public, anon, authenticated, service_role;

    alter default privileges for role supabase_admin in schema public
      grant select, insert, update, delete on tables to service_role;
    alter default privileges for role supabase_admin in schema public
      grant usage, select on sequences to service_role;
    alter default privileges for role supabase_admin in schema public
      grant execute on functions to service_role;
  exception when insufficient_privilege then
    null;
  end;

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
      lower(privilege.privilege_type) as privilege_type
    from effective_acls ea
    cross join lateral pg_catalog.aclexplode(ea.acl) privilege
    left join pg_catalog.pg_roles grantee on grantee.oid = privilege.grantee
  )
  select coalesce(
    array_agg(format('%s:%s:%s', object_type, grantee, privilege_type)
      order by object_type, grantee, privilege_type),
    '{}'::text[]
  ) into v_entries
  from exploded;

  v_safe :=
    not exists (
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

  if not v_safe then
    raise exception using
      errcode = '42501',
      message = 'Unsafe supabase_admin default privileges; bootstrap must run as supabase_admin.',
      detail = to_jsonb(v_entries)::text;
  end if;
end;
$$;
