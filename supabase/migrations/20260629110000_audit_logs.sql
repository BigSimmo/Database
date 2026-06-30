set search_path = public, pg_catalog, pg_temp;

-- Append-only audit trail for sensitive operations (uploads, deletes, renames,
-- label changes). Required for clinical governance and multi-user accountability.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_nonempty check (btrim(action) <> '')
);

create index if not exists audit_logs_owner_created_idx on public.audit_logs(owner_id, created_at desc);
create index if not exists audit_logs_action_created_idx on public.audit_logs(action, created_at desc);

-- audit_logs is written and read only via the service role (server-side). RLS is
-- enabled with an explicit service-role-only policy and no authenticated/anon
-- grants, so the table is not client-readable and not discoverable in the
-- GraphQL schema. This keeps the trail internal and tamper-resistant from
-- clients while keeping Supabase advisor checks explicit.
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select, insert, update, delete on table public.audit_logs to service_role;

drop policy if exists "audit logs service role all" on public.audit_logs;
create policy "audit logs service role all" on public.audit_logs
  for all to service_role
  using (true)
  with check (true);
