-- Public clinical content remains available through the server's public-read
-- routes. These tables contain only account-owned data and are never readable
-- by anonymous callers.
create table if not exists public.user_favourites (
  user_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null,
  content_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, content_type, content_key),
  constraint user_favourites_content_type_check
    check (content_type in ('service', 'form', 'differential')),
  constraint user_favourites_content_key_check
    check (content_key = btrim(content_key) and char_length(content_key) between 1 and 180)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_preferences_object_check check (jsonb_typeof(preferences) = 'object'),
  constraint user_preferences_size_check check (pg_column_size(preferences) <= 16384)
);

alter table public.user_favourites enable row level security;
alter table public.user_preferences enable row level security;

revoke all on table public.user_favourites from public, anon, authenticated;
revoke all on table public.user_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.user_favourites to service_role;
grant select, insert, update, delete on table public.user_preferences to service_role;

create policy "users read own favourites" on public.user_favourites
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users insert own favourites" on public.user_favourites
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users delete own favourites" on public.user_favourites
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "users read own preferences" on public.user_preferences
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "users insert own preferences" on public.user_preferences
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "users update own preferences" on public.user_preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users delete own preferences" on public.user_preferences
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Uploads are accepted only by the server route after it validates the
-- administrator claim. Remove direct Data/Storage API write capability from
-- both public roles as a second enforcement layer.
revoke insert, update, delete on table storage.objects from anon, authenticated;
