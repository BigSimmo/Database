-- Revoke broad future-object default privileges for supabase_admin
-- (2026-07-13 audit, finding 7).
--
-- 20260528007000_database_hardening_before_import.sql locked down default
-- privileges for objects created by role `postgres` only. Default privileges
-- are keyed to the creating role, so objects created by `supabase_admin`
-- (dashboard SQL editor, platform tooling) still defaulted to broad
-- anon/authenticated access. No such object exists today; this closes the
-- future-object exposure.
--
-- Hosted caveat: migrations run as `postgres`, which may not be a member of
-- `supabase_admin` on the hosted platform. In that case the statements below
-- degrade to a WARNING instead of failing the chain, and an operator must run
-- them once via the Supabase dashboard SQL editor (see
-- docs/process-hardening.md). Local replays (CI `supabase db reset`, the
-- drift-manifest scratch container) run as a superuser, apply the change, and
-- exercise the probe verification at the end of this migration.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    raise warning 'role supabase_admin does not exist; default-privilege hardening skipped';
    return;
  end if;

  begin
    alter default privileges for role supabase_admin in schema public
      revoke all privileges on tables from anon, authenticated;
    alter default privileges for role supabase_admin in schema public
      revoke usage, select on sequences from anon, authenticated;
    alter default privileges for role supabase_admin in schema public
      revoke execute on functions from public, anon, authenticated;
    alter default privileges for role supabase_admin in schema public
      grant select, insert, update, delete on tables to service_role;
    alter default privileges for role supabase_admin in schema public
      grant usage, select on sequences to service_role;
    alter default privileges for role supabase_admin in schema public
      grant execute on functions to service_role;
    raise notice 'supabase_admin future-object default privileges hardened';
  exception
    when insufficient_privilege then
      raise warning 'cannot alter default privileges for supabase_admin as %; '
        'operator follow-up required: run the six ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin '
        'statements from migration 20260713102000 via the Supabase dashboard SQL editor', current_user;
  end;
end $$;

-- Probe verification: create future objects as supabase_admin and assert the
-- client roles receive no automatic access. Runs wherever the current user can
-- assume supabase_admin (CI replay, scratch replay, superuser apply); degrades
-- to a WARNING where it cannot, matching the guarded hardening above.
do $$
declare
  probe_seq text;
begin
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    raise warning 'role supabase_admin does not exist; default-privilege probe skipped';
    return;
  end if;

  begin
    execute 'set local role supabase_admin';
  exception
    when insufficient_privilege then
      raise warning 'cannot assume supabase_admin as %; default-privilege probe skipped', current_user;
      return;
  end;

  create table public._defacl_probe_table (
    id bigint generated always as identity primary key,
    note text
  );
  create function public._defacl_probe_fn() returns integer language sql as 'select 1';
  execute 'reset role';

  probe_seq := pg_get_serial_sequence('public._defacl_probe_table', 'id');

  if has_table_privilege('anon', 'public._defacl_probe_table', 'select')
    or has_table_privilege('authenticated', 'public._defacl_probe_table', 'select, insert, update, delete') then
    raise exception 'future-object default privileges leak: client roles can access a supabase_admin-created table';
  end if;
  if probe_seq is not null
    and (has_sequence_privilege('anon', probe_seq, 'usage, select')
      or has_sequence_privilege('authenticated', probe_seq, 'usage, select')) then
    raise exception 'future-object default privileges leak: client roles can access a supabase_admin-created sequence';
  end if;
  if has_function_privilege('anon', 'public._defacl_probe_fn()', 'execute')
    or has_function_privilege('authenticated', 'public._defacl_probe_fn()', 'execute') then
    raise exception 'future-object default privileges leak: client roles can execute a supabase_admin-created function';
  end if;
  if not has_table_privilege('service_role', 'public._defacl_probe_table', 'select, insert, update, delete') then
    raise exception 'future-object default privileges regression: service_role lost access to a supabase_admin-created table';
  end if;

  execute 'set local role supabase_admin';
  drop function public._defacl_probe_fn();
  drop table public._defacl_probe_table;
  execute 'reset role';

  raise notice 'supabase_admin future-object default privileges verified: no anon/authenticated access, service_role retained';
end $$;
