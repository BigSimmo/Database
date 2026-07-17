-- Catalog-level, fail-closed verification for future objects created by
-- supabase_admin. A missing pg_default_acl row must be interpreted through
-- acldefault(), including PostgreSQL's built-in PUBLIC EXECUTE on functions.

create or replace function public.default_privileges_status(
  p_role_name text default 'supabase_admin',
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

do $$
declare
  v_status jsonb;
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_admin') then
    raise notice 'role supabase_admin does not exist; default-privilege assertion is not applicable';
    return;
  end if;

  begin
    -- Local/Superuser-capable environments can assume the target role even
    -- when the migration role cannot use ALTER DEFAULT PRIVILEGES FOR ROLE
    -- directly. Hosted environments that cannot assume it fall through to the
    -- catalog assertion and block with operator instructions.
    execute 'set local role supabase_admin';
    -- Revokes must be global: per-schema ACLs cannot subtract privileges from
    -- built-in or previously granted global defaults.
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
    execute 'reset role';
  exception when insufficient_privilege then
    begin execute 'reset role'; exception when others then null; end;
    raise notice 'current role % cannot remediate supabase_admin default privileges; asserting the catalog postcondition', current_user;
  end;

  v_status := public.default_privileges_status('supabase_admin', 'public');
  if not coalesce((v_status->>'safe')::boolean, false) then
    raise exception using
      errcode = '42501',
      message = 'Unsafe supabase_admin default privileges; migration blocked.',
      detail = v_status::text,
      hint = E'Run these six statements as supabase_admin, then retry the migration:\n'
        'DO $remediate$ BEGIN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role; ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated, service_role; END $remediate$;\n'
        'DO $remediate$ BEGIN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role; ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role; END $remediate$;\n'
        'DO $remediate$ BEGIN ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role; ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role; END $remediate$;\n'
        'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;\n'
        'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;\n'
        'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;';
  end if;
end;
$$;
