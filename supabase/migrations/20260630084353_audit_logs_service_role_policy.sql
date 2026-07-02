set search_path = public, pg_catalog, pg_temp;

revoke all on public.audit_logs from anon, authenticated;
grant select, insert, update, delete on table public.audit_logs to service_role;

alter table public.audit_logs enable row level security;

drop policy if exists "audit logs service role all" on public.audit_logs;
create policy "audit logs service role all" on public.audit_logs
  for all to service_role
  using (true)
  with check (true);
