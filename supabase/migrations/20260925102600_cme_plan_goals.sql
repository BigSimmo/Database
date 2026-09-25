-- CME development-plan goals, and which goal each activity served.
--
-- Two new tables, nothing changed in an existing one: `cme_entries` and `cme_save_entry` are
-- untouched, so every existing write path and guard behaves exactly as before. The link from an
-- activity to a goal lives in its own table and is set by its own function.
--
-- Same tenancy as every other CME table: RLS on, no grant to anon/authenticated, service_role
-- only, owner predicate in application code. Both are frozen with the year once it is closed.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.cme_plan_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  year_id uuid not null,
  goal text not null check (char_length(btrim(goal)) between 3 and 300),
  sort_order smallint not null default 0 check (sort_order between 0 and 9),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cme_plan_goals_id_owner_key unique (id, owner_id),
  constraint cme_plan_goals_year_owner_fk foreign key (year_id, owner_id)
    references public.cme_years (id, owner_id) on delete cascade
);
create index cme_plan_goals_owner_year_idx on public.cme_plan_goals (owner_id, year_id, sort_order);

create table public.cme_entry_goals (
  entry_id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  created_at timestamptz not null default now(),
  constraint cme_entry_goals_entry_owner_fk foreign key (entry_id, owner_id)
    references public.cme_entries (id, owner_id) on delete cascade,
  constraint cme_entry_goals_goal_owner_fk foreign key (goal_id, owner_id)
    references public.cme_plan_goals (id, owner_id) on delete cascade
);
create index cme_entry_goals_goal_idx on public.cme_entry_goals (goal_id);
create index cme_entry_goals_owner_idx on public.cme_entry_goals (owner_id);

create trigger cme_plan_goals_updated_at before update on public.cme_plan_goals
  for each row execute function public.set_updated_at();

do $$
declare
  t text;
begin
  foreach t in array array['cme_plan_goals', 'cme_entry_goals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
    execute format(
      'create policy "%s service role all" on public.%I for all to service_role using (true) with check (true)',
      t, t
    );
  end loop;
end
$$;

-- Goals of a closed year are frozen, like its requirements. A cascade from a deleted year
-- finds no year and passes.
create function public.cme_guard_plan_goal() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if tg_op <> 'INSERT' and exists(
    select 1 from public.cme_years where id = old.year_id and owner_id = old.owner_id and closed_at is not null
  ) then raise exception 'cme_year_closed'; end if;
  if tg_op <> 'DELETE' and exists(
    select 1 from public.cme_years where id = new.year_id and owner_id = new.owner_id and closed_at is not null
  ) then raise exception 'cme_year_closed'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function public.cme_guard_plan_goal() from public, anon, authenticated;
grant execute on function public.cme_guard_plan_goal() to service_role;
create trigger cme_plan_goal_closed_year_guard before insert or update or delete on public.cme_plan_goals
  for each row execute function public.cme_guard_plan_goal();

-- An activity's goal link is frozen with the activity's year, and the goal must belong to the
-- same owner and the same year as the activity.
create function public.cme_guard_entry_goal() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_entry_id uuid; v_owner_id uuid;
begin
  if tg_op = 'DELETE' then v_entry_id := old.entry_id; v_owner_id := old.owner_id;
  else v_entry_id := new.entry_id; v_owner_id := new.owner_id; end if;
  if exists(
    select 1 from public.cme_entries e join public.cme_years y on y.id = e.year_id and y.owner_id = e.owner_id
    where e.id = v_entry_id and e.owner_id = v_owner_id and y.closed_at is not null
  ) then raise exception 'cme_year_closed'; end if;
  if tg_op = 'DELETE' then return old; end if;
  if not exists(
    select 1 from public.cme_entries e join public.cme_plan_goals g on g.year_id = e.year_id and g.owner_id = e.owner_id
    where e.id = new.entry_id and e.owner_id = new.owner_id and g.id = new.goal_id
  ) then raise exception 'cme_invalid_link'; end if;
  return new;
end $$;
revoke all on function public.cme_guard_entry_goal() from public, anon, authenticated;
grant execute on function public.cme_guard_entry_goal() to service_role;
create trigger cme_entry_goal_guard before insert or update or delete on public.cme_entry_goals
  for each row execute function public.cme_guard_entry_goal();

-- Replace one year's goals in one step. Goals sent with an id are kept (their links survive);
-- goals sent without one are added; goals not sent are removed, and with them their links.
create function public.cme_save_plan_goals(p_owner_id uuid, p_year_id uuid, p_goals jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_year public.cme_years; v_goal jsonb; v_index integer := 0; v_keep uuid[] := '{}'; v_id uuid;
begin
  if p_owner_id is null or p_year_id is null or jsonb_typeof(p_goals) is distinct from 'array'
    or jsonb_array_length(p_goals) > 10 then raise exception 'cme_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  select * into v_year from public.cme_years where owner_id = p_owner_id and id = p_year_id for update;
  if not found then raise exception 'cme_year_not_confirmed'; end if;
  if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;
  for v_goal in select value from jsonb_array_elements(p_goals) loop
    if jsonb_typeof(v_goal->'goal') is distinct from 'string' then raise exception 'cme_invalid_request'; end if;
    if v_goal ? 'id' and v_goal->>'id' is not null then
      update public.cme_plan_goals set goal = btrim(v_goal->>'goal'), sort_order = v_index
      where owner_id = p_owner_id and year_id = p_year_id and id = (v_goal->>'id')::uuid
      returning id into v_id;
      if not found then raise exception 'cme_invalid_request'; end if;
    else
      insert into public.cme_plan_goals (owner_id, year_id, goal, sort_order)
      values (p_owner_id, p_year_id, btrim(v_goal->>'goal'), v_index) returning id into v_id;
    end if;
    v_keep := v_keep || v_id;
    v_index := v_index + 1;
  end loop;
  delete from public.cme_plan_goals where owner_id = p_owner_id and year_id = p_year_id and not (id = any(v_keep));
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'goal', goal, 'sortOrder', sort_order) order by sort_order)
    from public.cme_plan_goals where owner_id = p_owner_id and year_id = p_year_id
  ), '[]'::jsonb);
end $$;
revoke all on function public.cme_save_plan_goals(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.cme_save_plan_goals(uuid, uuid, jsonb) to service_role;

-- Set, change or clear which goal one activity served.
create function public.cme_set_entry_goal(p_owner_id uuid, p_entry_id uuid, p_goal_id uuid) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if p_owner_id is null or p_entry_id is null then raise exception 'cme_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  if not exists(select 1 from public.cme_entries where owner_id = p_owner_id and id = p_entry_id) then
    raise exception 'cme_entry_not_found';
  end if;
  delete from public.cme_entry_goals where owner_id = p_owner_id and entry_id = p_entry_id;
  if p_goal_id is not null then
    insert into public.cme_entry_goals (entry_id, owner_id, goal_id) values (p_entry_id, p_owner_id, p_goal_id);
  end if;
  return jsonb_build_object('entryId', p_entry_id, 'goalId', p_goal_id);
end $$;
revoke all on function public.cme_set_entry_goal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.cme_set_entry_goal(uuid, uuid, uuid) to service_role;
