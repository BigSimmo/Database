-- Shared team system hardening: file 1 of the combined Roster DB PR (shared-db-contract.md v6).
--
-- MERGING THIS PR APPLIES IT TO THE LIVE CLINICAL DATABASE WITHIN SECONDS. Josh merges it himself.
--
-- What this file does, and nothing else:
--   1. on_call_services gains verified_at / verified_by / is_demo. Only a platform path sets them
--      (on_call_service_set_verified below, service_role only). The command RPC never does.
--   2. on_call_service_invitations gains invited_email, stored lower-case and trimmed.
--   3. on_call_service_members gains display_name, shared by every mode.
--   4. on_call_service_member_events: one audit row per join, revoke, rejoin and role change.
--   5. service_member_active(): the one permission helper every mode's command RPC calls first.
-- It never touches on_call_service_command: On Call's file (position 2) is its only replacement,
-- and it adds issued_via_mode. Nothing here reads auth.users.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- 1. Verified and demo flags. Health-service features switch on only when
--    verified_at is not null or is_demo.
alter table public.on_call_services
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users (id) on delete set null,
  add column is_demo boolean not null default false;

-- 2. Invitations are tied to the invited email. Rows made before this file stay null and
--    expire within 7 days anyway; On Call's command requires the email on every new invite.
alter table public.on_call_service_invitations
  add column invited_email text,
  add constraint on_call_service_invitations_invited_email_normalised check (
    invited_email is null
    or (invited_email = lower(btrim(invited_email)) and char_length(invited_email) between 3 and 320)
  );

-- 3. The name colleagues see, set by the member or a service admin.
alter table public.on_call_service_members
  add column display_name text,
  add constraint on_call_service_members_display_name_length check (
    display_name is null or char_length(btrim(display_name)) between 1 and 80
  );

-- 4. Membership audit. Ids set null on account deletion so "delete my data" still works.
--    Rows older than 12 months are purged by roster_retention_purge() (file 3).
create table public.on_call_service_member_events (
  id bigint generated always as identity primary key,
  service_id uuid not null references public.on_call_services (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  event text not null check (event in ('joined', 'revoked', 'rejoined', 'role_changed')),
  mode text check (mode is null or mode in ('roster', 'teaching', 'admin')),
  actor_id uuid references auth.users (id) on delete set null,
  at timestamptz not null default now()
);
create index on_call_service_member_events_service_at_idx on public.on_call_service_member_events (service_id, at desc);
create index on_call_service_member_events_user_idx on public.on_call_service_member_events (user_id) where user_id is not null;
create index on_call_service_member_events_at_idx on public.on_call_service_member_events (at);

alter table public.on_call_service_member_events enable row level security;
revoke all on table public.on_call_service_member_events from public, anon, authenticated;
grant select, insert, update, delete on table public.on_call_service_member_events to service_role;

-- 5. The shared permission helper. Each mode's command RPC calls it first, then checks its
--    own role table with revoked_at is null.
create function public.service_member_active(p_service_id uuid, p_user_id uuid)
returns boolean
language sql stable security invoker
set search_path = public, pg_catalog, pg_temp as $$
  select exists (
    select 1 from public.on_call_service_members
    where service_id = p_service_id and user_id = p_user_id and revoked_at is null
  )
$$;
revoke all on function public.service_member_active(uuid, uuid) from public, anon, authenticated;
grant execute on function public.service_member_active(uuid, uuid) to service_role;

-- The platform path for the verified and demo flags: Josh's owner panel button, service_role only.
-- Takes the service row lock so it orders with every command that reads the flags.
create function public.on_call_service_set_verified(
  p_service_id uuid,
  p_actor_id uuid,
  p_verified boolean,
  p_is_demo boolean
) returns jsonb
language plpgsql security invoker
set search_path = public, pg_catalog, pg_temp as $$
declare v_service public.on_call_services%rowtype;
begin
  if p_service_id is null or p_actor_id is null or p_verified is null or p_is_demo is null then
    raise exception 'service_invalid_request';
  end if;
  select * into v_service from public.on_call_services where id = p_service_id for update;
  if not found then raise exception 'service_not_found'; end if;
  update public.on_call_services
     set verified_at = case when p_verified then coalesce(v_service.verified_at, now()) else null end,
         verified_by = case when p_verified then coalesce(v_service.verified_by, p_actor_id) else null end,
         is_demo = p_is_demo
   where id = p_service_id
  returning * into v_service;
  return jsonb_build_object('serviceId', v_service.id, 'verifiedAt', v_service.verified_at, 'isDemo', v_service.is_demo);
end $$;
revoke all on function public.on_call_service_set_verified(uuid, uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.on_call_service_set_verified(uuid, uuid, boolean, boolean) to service_role;
