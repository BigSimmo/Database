-- Private calendar subscription links (CME deadlines and routines, On Call teaching).
--
-- One new table and three functions; nothing existing changes. A link is a long random
-- token held only by its owner: this table stores a SHA-256 of it, never the token, so a
-- database reader cannot rebuild anyone's link. One live link per owner; making a new one
-- replaces the old, and deleting the row turns the link off at once.
--
-- Same tenancy as the CME tables: RLS on, no grant to anon/authenticated, service_role only.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.calendar_feed_tokens (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint calendar_feed_tokens_token_hash_key unique (token_hash)
);

alter table public.calendar_feed_tokens enable row level security;
revoke all on table public.calendar_feed_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.calendar_feed_tokens to service_role;
create policy "calendar_feed_tokens service role all" on public.calendar_feed_tokens
  for all to service_role using (true) with check (true);

-- Make (or replace) the owner's one link. The caller passes only the hash.
create function public.calendar_feed_rotate(p_owner_id uuid, p_token_hash text) returns void
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if p_owner_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'calendar_feed_invalid_request';
  end if;
  insert into public.calendar_feed_tokens (owner_id, token_hash)
  values (p_owner_id, p_token_hash)
  on conflict (owner_id) do update
    set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
end $$;
revoke all on function public.calendar_feed_rotate(uuid, text) from public, anon, authenticated;
grant execute on function public.calendar_feed_rotate(uuid, text) to service_role;

-- Turn the owner's link off.
create function public.calendar_feed_revoke(p_owner_id uuid) returns void
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if p_owner_id is null then raise exception 'calendar_feed_invalid_request'; end if;
  delete from public.calendar_feed_tokens where owner_id = p_owner_id;
end $$;
revoke all on function public.calendar_feed_revoke(uuid) from public, anon, authenticated;
grant execute on function public.calendar_feed_revoke(uuid) to service_role;

-- Resolve a presented link to its owner, recording when it was last read. Returns null for
-- an unknown or turned-off link, so the two are indistinguishable to the caller.
create function public.calendar_feed_owner(p_token_hash text) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_owner uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  update public.calendar_feed_tokens set last_used_at = now()
  where token_hash = p_token_hash
  returning owner_id into v_owner;
  return v_owner;
end $$;
revoke all on function public.calendar_feed_owner(text) from public, anon, authenticated;
grant execute on function public.calendar_feed_owner(text) to service_role;
