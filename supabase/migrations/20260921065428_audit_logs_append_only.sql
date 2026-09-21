set search_path = public, pg_catalog, pg_temp;

-- Append-only audit_logs: service_role may SELECT/INSERT only. UPDATE/DELETE are
-- denied by table grants, narrowed RLS (no FOR ALL), and a BEFORE trigger.
-- Applied on Clinical KB Staging as 20260921065428; this codifies the same DDL
-- for prod and the migration chain. No indexing-v3-agent / ingestion-worker /
-- FORCE RLS changes.

revoke update, delete on table public.audit_logs from service_role;
revoke all on table public.audit_logs from anon, authenticated;
grant select, insert on table public.audit_logs to service_role;

drop policy if exists "audit logs service role all" on public.audit_logs;
drop policy if exists "audit logs service role select" on public.audit_logs;
drop policy if exists "audit logs service role insert" on public.audit_logs;

create policy "audit logs service role select" on public.audit_logs
  for select to service_role
  using (true);

create policy "audit logs service role insert" on public.audit_logs
  for insert to service_role
  with check (true);

create or replace function public.audit_logs_prevent_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'audit_logs is append-only: % not allowed', tg_op
    using errcode = '42501';
  return null;
end;
$$;

drop trigger if exists audit_logs_append_only on public.audit_logs;
create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row
  execute function public.audit_logs_prevent_mutation();

revoke all on function public.audit_logs_prevent_mutation()
  from public, anon, authenticated;
grant execute on function public.audit_logs_prevent_mutation() to service_role;
alter function public.audit_logs_prevent_mutation() owner to postgres;
