-- Favourites remain canonical content references only. Sets use a fixed
-- vocabulary so their labels cannot become a patient-note field.
create table if not exists public.user_favourite_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_favourite_sets_name_check
    check (name in ('Clinical review', 'Ward round', 'On call', 'Follow up', 'Teaching', 'Reference')),
  constraint user_favourite_sets_sort_order_check check (sort_order between 0 and 10000),
  constraint user_favourite_sets_user_name_key unique (user_id, name),
  constraint user_favourite_sets_user_id_id_key unique (user_id, id)
);

alter table public.user_favourites
  add column if not exists set_id uuid,
  add column if not exists sort_order integer not null default 0,
  add column if not exists pinned_at timestamptz,
  add column if not exists last_opened_at timestamptz;

alter table public.user_favourites
  drop constraint if exists user_favourites_sort_order_check;
alter table public.user_favourites
  add constraint user_favourites_sort_order_check check (sort_order between 0 and 1000000);

with ranked as (
  select
    user_id,
    content_type,
    content_key,
    row_number() over (
      partition by user_id
      order by created_at, content_type, content_key
    ) * 10 as next_sort_order
  from public.user_favourites
)
update public.user_favourites as favourite
set sort_order = ranked.next_sort_order
from ranked
where favourite.user_id = ranked.user_id
  and favourite.content_type = ranked.content_type
  and favourite.content_key = ranked.content_key;

alter table public.user_favourites
  drop constraint if exists user_favourites_content_key_format_check;
alter table public.user_favourites
  add constraint user_favourites_content_key_format_check
  check (content_key ~ '^[a-z0-9]+([._:/-][a-z0-9]+)*$') not valid;

-- Legacy rows are not destroyed or silently rewritten. New writes are checked,
-- while validation remains an explicit follow-up after invalid keys are audited.

alter table public.user_favourites
  drop constraint if exists user_favourites_owner_set_fkey;
alter table public.user_favourites
  add constraint user_favourites_owner_set_fkey
  foreign key (user_id, set_id)
  references public.user_favourite_sets (user_id, id)
  on delete restrict;

create index if not exists user_favourite_sets_owner_order_idx
  on public.user_favourite_sets (user_id, sort_order, created_at, id);
create index if not exists user_favourites_owner_set_order_idx
  on public.user_favourites (user_id, set_id, sort_order, created_at, content_type, content_key);

create or replace function public.reorder_user_favourite(
  p_user_id uuid,
  p_content_type text,
  p_content_key text,
  p_direction text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_position bigint;
  swap_position bigint;
begin
  if p_direction not in ('up', 'down') then
    raise exception using errcode = '22023', message = 'Invalid favourite reorder direction.';
  end if;

  select position into target_position
  from (
    select content_type, content_key,
      row_number() over (order by sort_order, created_at, content_type, content_key) as position
    from public.user_favourites
    where user_id = p_user_id
  ) ordered
  where content_type = p_content_type and content_key = p_content_key;

  if target_position is null then return false; end if;
  swap_position := target_position + case when p_direction = 'up' then -1 else 1 end;

  with ordered as (
    select content_type, content_key,
      row_number() over (order by sort_order, created_at, content_type, content_key) as position
    from public.user_favourites
    where user_id = p_user_id
  ), final_positions as (
    select content_type, content_key,
      case
        when position = target_position then swap_position
        when position = swap_position then target_position
        else position
      end as position
    from ordered
  )
  update public.user_favourites favourite
  set sort_order = final_positions.position * 10
  from final_positions
  where favourite.user_id = p_user_id
    and favourite.content_type = final_positions.content_type
    and favourite.content_key = final_positions.content_key;

  return true;
end;
$$;

revoke all on function public.reorder_user_favourite(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reorder_user_favourite(uuid, text, text, text) to service_role;

alter table public.user_favourite_sets enable row level security;

revoke all on table public.user_favourite_sets from public, anon, authenticated;
grant select, insert, update, delete on table public.user_favourite_sets to service_role;

create policy "users read own favourite sets" on public.user_favourite_sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "users insert own favourite sets" on public.user_favourite_sets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users update own favourite sets" on public.user_favourite_sets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "users delete own favourite sets" on public.user_favourite_sets
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "users update own favourites" on public.user_favourites
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
