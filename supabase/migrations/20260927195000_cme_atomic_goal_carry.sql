-- Append a prior-year plan goal without replacing the next year's plan. Both functions
-- use the same per-owner advisory lock as cme_save_plan_goals. The checked save prevents
-- a stale Plan editor from deleting a goal carried by another tab.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- One source goal can be carried once. A mapping is recorded even when the
-- target already has the same text, so retry stays a no-op after text edits.
create table public.cme_plan_goal_carries (
  owner_id uuid not null,
  source_goal_id uuid not null,
  -- NULL is a tombstone: the owner deleted the carried target. A retry must not restore it.
  target_goal_id uuid,
  created_at timestamptz not null default now(),
  primary key (owner_id, source_goal_id),
  constraint cme_plan_goal_carries_source_owner_fk foreign key (source_goal_id, owner_id)
    references public.cme_plan_goals (id, owner_id) on delete cascade,
  constraint cme_plan_goal_carries_target_owner_fk foreign key (target_goal_id, owner_id)
    references public.cme_plan_goals (id, owner_id) on delete set null (target_goal_id)
);
create index cme_plan_goal_carries_target_idx on public.cme_plan_goal_carries (target_goal_id);
alter table public.cme_plan_goal_carries enable row level security;
revoke all on table public.cme_plan_goal_carries from public, anon, authenticated;
grant select, insert, update, delete on table public.cme_plan_goal_carries to service_role;
create policy "cme_plan_goal_carries service role all" on public.cme_plan_goal_carries
  for all to service_role using (true) with check (true);

create function public.cme_save_plan_goals_checked(
  p_owner_id uuid, p_year_id uuid, p_goals jsonb, p_expected_goals jsonb
) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_current_goals jsonb;
begin
  if p_owner_id is null or p_year_id is null or jsonb_typeof(p_expected_goals) is distinct from 'array'
    or jsonb_array_length(p_expected_goals) > 10 then raise exception 'cme_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  perform 1 from public.cme_years where id = p_year_id and owner_id = p_owner_id for update;
  if not found then raise exception 'cme_year_not_confirmed'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'goal', goal) order by sort_order, id), '[]'::jsonb)
    into v_current_goals
    from public.cme_plan_goals where owner_id = p_owner_id and year_id = p_year_id;
  if v_current_goals is distinct from p_expected_goals then raise exception 'cme_plan_conflict'; end if;
  return public.cme_save_plan_goals(p_owner_id, p_year_id, p_goals);
end $$;
revoke all on function public.cme_save_plan_goals_checked(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.cme_save_plan_goals_checked(uuid, uuid, jsonb, jsonb) to service_role;

create function public.cme_carry_plan_goal(
  p_owner_id uuid, p_source_year integer, p_goal_id uuid
) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_today date := (now() at time zone 'Australia/Perth')::date;
  v_source_id uuid;
  v_target_id uuid;
  v_text text;
  v_existing_id uuid;
  v_already_mapped boolean;
  v_count integer;
  v_carried boolean := false;
begin
  if p_owner_id is null or p_goal_id is null or p_source_year is null
    or p_source_year < 2000 or p_source_year > 2099 then raise exception 'cme_invalid_request'; end if;
  if not ((extract(year from v_today)::integer = p_source_year
      and extract(month from v_today) = 12 and extract(day from v_today) >= 17)
    or (extract(year from v_today)::integer = p_source_year + 1
      and extract(month from v_today) = 1)) then raise exception 'cme_carry_unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  select id into v_source_id from public.cme_years
    where owner_id = p_owner_id and year = p_source_year for update;
  if not found then raise exception 'cme_goal_not_found'; end if;
  select id into v_target_id from public.cme_years
    where owner_id = p_owner_id and year = p_source_year + 1 and closed_at is null for update;
  if not found then raise exception 'cme_year_not_confirmed'; end if;
  select goal into v_text from public.cme_plan_goals
    where id = p_goal_id and owner_id = p_owner_id and year_id = v_source_id;
  if not found then raise exception 'cme_goal_not_found'; end if;

  select target_goal_id into v_existing_id from public.cme_plan_goal_carries
    where owner_id = p_owner_id and source_goal_id = p_goal_id;
  v_already_mapped := found;
  if not v_already_mapped then
    select id into v_existing_id from public.cme_plan_goals
      where owner_id = p_owner_id and year_id = v_target_id
        and lower(btrim(goal)) = lower(btrim(v_text))
      order by sort_order, id limit 1;
    if v_existing_id is null then
      select count(*) into v_count from public.cme_plan_goals
        where owner_id = p_owner_id and year_id = v_target_id;
      if v_count >= 10 then raise exception 'cme_goal_limit'; end if;
      insert into public.cme_plan_goals (owner_id, year_id, goal, sort_order)
      values (p_owner_id, v_target_id, v_text, v_count) returning id into v_existing_id;
      v_carried := true;
    end if;
    insert into public.cme_plan_goal_carries (owner_id, source_goal_id, target_goal_id)
    values (p_owner_id, p_goal_id, v_existing_id);
  end if;
  return jsonb_build_object(
    'carried', v_carried,
    'goals', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'goal', goal, 'sortOrder', sort_order)
        order by sort_order, id)
      from public.cme_plan_goals where owner_id = p_owner_id and year_id = v_target_id
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.cme_carry_plan_goal(uuid, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.cme_carry_plan_goal(uuid, integer, uuid) to service_role;
