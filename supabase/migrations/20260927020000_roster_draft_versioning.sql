-- Draft-only concurrency. Merge only inside the approved production window.
-- Existing duties, publication and agreement policy are unchanged.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.roster_drafts add column version bigint not null default 1
  check (version between 1 and 9007199254740991);

create or replace function public.roster_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}')
returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role public.roster_member_roles;
  v_is_manager boolean;
  v_settings public.roster_team_settings;
  v_min_break numeric;
  v_pub public.roster_publications;
  v_swap public.roster_swaps;
  v_open public.roster_open_shifts;
  v_give public.roster_assignments;
  v_take public.roster_assignments;
  v_draft public.roster_drafts;
  v_assignment public.roster_draft_assignments;
  v_before jsonb;
  v_after jsonb;
  v_current jsonb;
  v_row jsonb;
  v_id uuid;
  v_change_id bigint;
  v_count integer;
  v_ids uuid[];
  v_problem text;
  v_reason text;
  v_giver_rank integer;
  v_taker_rank integer;
  v_result jsonb;
  v_from date;
  v_to date;
begin
  if p_actor_id is null then raise exception 'roster_auth_required'; end if;
  if p_service_id is null or p_action is null then raise exception 'roster_invalid_request'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'roster_invalid_request'; end if;

  -- Removing a member changes membership, so it takes the service row FOR UPDATE, as On Call
  -- does; every other action takes it FOR SHARE. Never upgrade a lock mid-call.
  if p_action = 'member.remove' then
    select * into v_service from public.on_call_services where id = p_service_id for update;
  else
    select * into v_service from public.on_call_services where id = p_service_id for share;
  end if;
  if not found or not public.service_member_active(p_service_id, p_actor_id) then
    raise exception 'roster_access_denied';
  end if;
  if v_service.verified_at is null and not v_service.is_demo then raise exception 'roster_team_not_verified'; end if;

  -- Seen receipts are a check-in: the share lock is enough, and they never wait on other writes.
  if p_action = 'seen.mark' then
    select * into v_pub from public.roster_publications
     where service_id = p_service_id and id = (p_payload ->> 'publicationId')::uuid;
    if not found then raise exception 'roster_not_found'; end if;
    insert into public.roster_publication_seen (publication_id, user_id) values (v_pub.id, p_actor_id)
      on conflict do nothing;
    return jsonb_build_object('ok', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74817));

  select * into v_role from public.roster_member_roles
   where service_id = p_service_id and user_id = p_actor_id and revoked_at is null;
  v_is_manager := found and v_role.role = 'manager';
  select * into v_settings from public.roster_team_settings where service_id = p_service_id;
  v_min_break := nullif(v_settings.rules ->> 'minBreakHours', '')::numeric;

  -- ---------------------------------------------------------------- people and settings
  if p_action = 'role.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_id := (p_payload ->> 'userId')::uuid;
    if v_id is null or not public.service_member_active(p_service_id, v_id) then raise exception 'roster_not_found'; end if;
    if p_payload ? 'grade' and p_payload ->> 'grade' is not null
       and p_payload ->> 'grade' not in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other') then
      raise exception 'roster_invalid_request';
    end if;
    insert into public.roster_member_roles (service_id, user_id, role, grade, roster_name, rotation_ends_on, granted_by)
    values (p_service_id, v_id, 'member', p_payload ->> 'grade', nullif(btrim(p_payload ->> 'rosterName'), ''),
            (p_payload ->> 'rotationEndsOn')::date, p_actor_id)
    on conflict (service_id, user_id) do update set
      grade = case when p_payload ? 'grade' then excluded.grade else public.roster_member_roles.grade end,
      roster_name = case when p_payload ? 'rosterName' then excluded.roster_name else public.roster_member_roles.roster_name end,
      rotation_ends_on = case when p_payload ? 'rotationEndsOn' then excluded.rotation_ends_on else public.roster_member_roles.rotation_ends_on end,
      role = case when public.roster_member_roles.revoked_at is null then public.roster_member_roles.role else 'member' end,
      revoked_at = null;
    return jsonb_build_object('ok', true);

  elsif p_action = 'member.remove' then
    -- Someone who leaves the team. Only ordinary service members; editors and admins are
    -- removed in On Call by a service admin. Revoking fires every mode's cascade trigger.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_id := (p_payload ->> 'userId')::uuid;
    if v_id is null or v_id = p_actor_id then raise exception 'roster_invalid_request'; end if;
    update public.on_call_service_members set revoked_at = now(), clinical_reviewer = false
     where service_id = p_service_id and user_id = v_id and revoked_at is null and role = 'member';
    if not found then raise exception 'roster_not_found'; end if;
    insert into public.on_call_service_member_events (service_id, user_id, event, mode, actor_id)
    values (p_service_id, v_id, 'revoked', null, p_actor_id);
    return jsonb_build_object('ok', true);

  elsif p_action = 'settings.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    insert into public.roster_team_settings (service_id, swap_approval, rules, rules_source, pay_fortnight_anchor, updated_by)
    values (p_service_id,
            coalesce(p_payload ->> 'swapApproval', 'auto_same_grade'),
            coalesce(p_payload -> 'rules', '{}'::jsonb),
            nullif(btrim(p_payload ->> 'rulesSource'), ''),
            (p_payload ->> 'payFortnightAnchor')::date,
            p_actor_id)
    on conflict (service_id) do update set
      swap_approval = excluded.swap_approval, rules = excluded.rules, rules_source = excluded.rules_source,
      pay_fortnight_anchor = excluded.pay_fortnight_anchor, updated_by = excluded.updated_by;
    return jsonb_build_object('ok', true);

  elsif p_action = 'unavailability.set' then
    -- payload {set: [{date, kind}], clear: [date]} for the actor only, future dates only.
    delete from public.roster_unavailability
     where service_id = p_service_id and user_id = p_actor_id
       and on_date in (select (value #>> '{}')::date from jsonb_array_elements(coalesce(p_payload -> 'clear', '[]')));
    insert into public.roster_unavailability (service_id, user_id, on_date, kind)
    select p_service_id, p_actor_id, (value ->> 'date')::date, value ->> 'kind'
    from jsonb_array_elements(coalesce(p_payload -> 'set', '[]'))
    where (value ->> 'date')::date > (now() at time zone 'Australia/Perth')::date
    on conflict (service_id, user_id, on_date) do update set kind = excluded.kind;
    if (select count(*) from public.roster_unavailability where service_id = p_service_id and user_id = p_actor_id) > 120 then
      raise exception 'roster_limit';
    end if;
    return jsonb_build_object('ok', true);

  -- ---------------------------------------------------------------- publishing
  elsif p_action = 'publish' then
    -- payload {kind, periodStart, periodEnd, sourceName?, replaceAssignmentIds?[], assignments[], draftId?}
    -- The app has already settled rows it couldn't match and approved swaps the file would undo;
    -- this step is all or nothing.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_from := (p_payload ->> 'periodStart')::date;
    v_to := (p_payload ->> 'periodEnd')::date;
    if v_from is null or v_to is null or jsonb_typeof(p_payload -> 'assignments') is distinct from 'array'
       or jsonb_array_length(p_payload -> 'assignments') > 5000
       or coalesce(p_payload ->> 'kind', 'full') not in ('full', 'single_change') then
      raise exception 'roster_invalid_request';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where (x ->> 'userId') is not null
        and not public.service_member_active(p_service_id, (x ->> 'userId')::uuid)
    ) or exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where (x ->> 'userId') is null and nullif(btrim(x ->> 'rosterName'), '') is null
    ) or exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where ((x ->> 'startsAt')::timestamptz at time zone 'Australia/Perth')::date not between v_from and v_to
    ) then
      raise exception 'roster_invalid_request';
    end if;

    insert into public.roster_publications (service_id, version, kind, period_start, period_end, source_name, published_by)
    values (p_service_id,
            coalesce((select max(version) from public.roster_publications where service_id = p_service_id), 0) + 1,
            coalesce(p_payload ->> 'kind', 'full'), v_from, v_to, nullif(btrim(p_payload ->> 'sourceName'), ''), p_actor_id)
    returning * into v_pub;

    if v_pub.kind = 'full' then
      with replaced as (
        update public.roster_assignments set superseded_at = now()
         where service_id = p_service_id and superseded_at is null
           and (starts_at at time zone 'Australia/Perth')::date between v_from and v_to
        returning id
      )
      select coalesce(array_agg(id), '{}') into v_ids from replaced;
    else
      select coalesce(array_agg((value #>> '{}')::uuid), '{}') into v_ids
        from jsonb_array_elements(coalesce(p_payload -> 'replaceAssignmentIds', '[]'));
      update public.roster_assignments set superseded_at = now()
       where service_id = p_service_id and superseded_at is null and id = any (v_ids);
      get diagnostics v_count = row_count;
      if v_count <> coalesce(array_length(v_ids, 1), 0) then raise exception 'roster_conflict'; end if;
    end if;

    insert into public.roster_assignments (service_id, publication_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
    select p_service_id, v_pub.id, (x ->> 'userId')::uuid, nullif(btrim(x ->> 'rosterName'), ''), (x ->> 'siteId')::uuid,
           (x ->> 'startsAt')::timestamptz, (x ->> 'endsAt')::timestamptz, btrim(x ->> 'shiftCode'), x ->> 'kind', x ->> 'grade'
    from jsonb_array_elements(p_payload -> 'assignments') x;

    -- Pending requests on replaced shifts cancel themselves and say why.
    with cancelled as (
      update public.roster_swaps set status = 'cancelled', cancel_reason = 'roster_changed', decided_at = now()
       where service_id = p_service_id and status in ('requested', 'accepted')
         and (give_assignment_id = any (v_ids) or take_assignment_id = any (v_ids))
      returning id, requester_id, counterparty_id
    )
    select jsonb_build_object('swapsCancelled', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'requesterId', requester_id, 'counterpartyId', counterparty_id)), '[]')) into v_result from cancelled;
    update public.roster_open_shifts set status = 'cancelled', decided_at = now()
     where service_id = p_service_id and status in ('reported', 'open', 'claimed') and assignment_id = any (v_ids);

    insert into public.roster_changes (service_id, target, source, change, actor_id)
    values (p_service_id, 'live', 'publish',
            jsonb_build_object('kind', 'publish', 'publicationId', v_pub.id, 'version', v_pub.version,
                               'replaced', coalesce(array_length(v_ids, 1), 0),
                               'rows', jsonb_array_length(p_payload -> 'assignments')),
            p_actor_id);
    -- The manager has seen their own roster.
    insert into public.roster_publication_seen (publication_id, user_id) values (v_pub.id, p_actor_id);
    if p_payload ? 'draftId' then
      delete from public.roster_drafts where id = (p_payload ->> 'draftId')::uuid and service_id = p_service_id;
    end if;
    return v_result || jsonb_build_object('publicationId', v_pub.id, 'version', v_pub.version);

  -- ---------------------------------------------------------------- swaps
  elsif p_action in ('swap.create', 'swap.accept', 'swap.approve') then
    if p_action = 'swap.create' then
      select * into v_give from public.roster_assignments
       where id = (p_payload ->> 'giveAssignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
      if not found or v_give.user_id is distinct from p_actor_id or v_give.starts_at <= now() or v_give.kind = 'leave' then
        raise exception 'roster_not_found';
      end if;
      v_id := (p_payload ->> 'counterpartyId')::uuid;
      if v_id is null or v_id = p_actor_id or not public.service_member_active(p_service_id, v_id) then
        raise exception 'roster_not_found';
      end if;
      if p_payload ->> 'takeAssignmentId' is not null then
        select * into v_take from public.roster_assignments
         where id = (p_payload ->> 'takeAssignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
        if not found or v_take.user_id is distinct from v_id or v_take.starts_at <= now() or v_take.kind = 'leave' then
          raise exception 'roster_not_found';
        end if;
      end if;
      if exists (select 1 from public.roster_swaps w where w.status in ('requested', 'accepted')
                 and (w.give_assignment_id in (v_give.id, v_take.id) or w.take_assignment_id in (v_give.id, v_take.id)))
         or exists (select 1 from public.roster_open_shifts o where o.status in ('reported', 'open', 'claimed')
                 and o.assignment_id in (v_give.id, v_take.id)) then
        raise exception 'roster_request_exists';
      end if;
      insert into public.roster_swaps (service_id, requester_id, counterparty_id, give_assignment_id, take_assignment_id, expires_at)
      values (p_service_id, p_actor_id, v_id, v_give.id, v_take.id,
              least(v_give.starts_at, coalesce(v_take.starts_at, v_give.starts_at), now() + interval '7 days'))
      returning * into v_swap;
    else
      select * into v_swap from public.roster_swaps
       where id = (p_payload ->> 'swapId')::uuid and service_id = p_service_id for update;
      if not found then raise exception 'roster_not_found'; end if;
      if p_action = 'swap.accept' and (v_swap.counterparty_id <> p_actor_id or v_swap.status <> 'requested') then
        raise exception 'roster_not_found';
      end if;
      if p_action = 'swap.approve' and (not v_is_manager or v_swap.status <> 'accepted') then
        raise exception 'roster_role_denied';
      end if;
      -- A manager never approves a swap they are part of.
      if p_action = 'swap.approve' and p_actor_id in (v_swap.requester_id, v_swap.counterparty_id) then
        raise exception 'roster_role_denied';
      end if;
      if v_swap.expires_at <= now() then
        update public.roster_swaps set status = 'expired', decided_at = now() where id = v_swap.id;
        return jsonb_build_object('swapId', v_swap.id, 'status', 'expired');
      end if;
      select * into v_give from public.roster_assignments where id = v_swap.give_assignment_id for update;
      select * into v_take from public.roster_assignments where id = v_swap.take_assignment_id for update;
    end if;

    -- Recheck at every step: still live, still theirs, still eligible, still fits.
    v_reason := null;
    if v_give.superseded_at is not null or v_give.user_id is distinct from v_swap.requester_id
       or (v_swap.take_assignment_id is not null
           and (v_take.superseded_at is not null or v_take.user_id is distinct from v_swap.counterparty_id)) then
      v_reason := 'roster_changed';
    else
      v_giver_rank := public.roster_grade_rank(coalesce(v_give.grade,
        (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null)));
      v_taker_rank := public.roster_grade_rank(
        (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.counterparty_id and revoked_at is null));
      if v_giver_rank is null or v_taker_rank is null or v_taker_rank < v_giver_rank then
        v_reason := 'no_longer_fits';
      elsif v_swap.take_assignment_id is not null and (
          public.roster_grade_rank(coalesce(v_take.grade,
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.counterparty_id and revoked_at is null)))
          > public.roster_grade_rank(
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null))
          or public.roster_grade_rank(
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null)) is null) then
        v_reason := 'no_longer_fits';
      elsif public.roster_placement_problem(p_service_id, v_swap.counterparty_id, v_give.starts_at, v_give.ends_at,
              array[v_take.id], null) = 'clash'
         or (v_swap.take_assignment_id is not null and public.roster_placement_problem(p_service_id, v_swap.requester_id,
              v_take.starts_at, v_take.ends_at, array[v_give.id], null) = 'clash') then
        v_reason := 'no_longer_fits';
      end if;
    end if;
    if v_reason is not null then
      if p_action = 'swap.create' then raise exception 'roster_swap_not_eligible'; end if;
      update public.roster_swaps set status = 'cancelled', cancel_reason = v_reason, decided_at = now() where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'cancelled', 'cancelReason', v_reason);
    end if;
    if p_action = 'swap.create' then
      return jsonb_build_object('swapId', v_swap.id, 'status', 'requested');
    end if;

    if p_action = 'swap.accept' then
      -- Does it need the manager? Team setting, then within 7 days, then grade, then team rule.
      v_reason := case
        when coalesce(v_settings.swap_approval, 'auto_same_grade') = 'manager' then 'team_setting'
        when least(v_give.starts_at, coalesce(v_take.starts_at, v_give.starts_at)) < now() + interval '7 days' then 'within_7_days'
        when v_taker_rank <> v_giver_rank then 'different_grade'
        when public.roster_placement_problem(p_service_id, v_swap.counterparty_id, v_give.starts_at, v_give.ends_at, array[v_take.id], v_min_break) is not null
          or (v_swap.take_assignment_id is not null and public.roster_placement_problem(p_service_id, v_swap.requester_id,
                v_take.starts_at, v_take.ends_at, array[v_give.id], v_min_break) is not null) then 'team_rule'
        else null end;
      if v_reason is not null then
        update public.roster_swaps set status = 'accepted', accepted_at = now(), needs_manager_because = v_reason
         where id = v_swap.id;
        return jsonb_build_object('swapId', v_swap.id, 'status', 'accepted', 'needsManagerBecause', v_reason);
      end if;
    end if;

    -- Apply: both shifts change hands together, with the undo saved in the same step.
    update public.roster_assignments set user_id = v_swap.counterparty_id, roster_name = null where id = v_give.id;
    if v_swap.take_assignment_id is not null then
      update public.roster_assignments set user_id = v_swap.requester_id, roster_name = null where id = v_take.id;
    end if;
    update public.roster_swaps
       set status = 'approved', auto_approved = (p_action = 'swap.accept'),
           accepted_at = coalesce(accepted_at, now()), decided_at = now(),
           decided_by = case when p_action = 'swap.approve' then p_actor_id else null end
     where id = v_swap.id;
    insert into public.roster_changes (service_id, target, source, change, undo, actor_id)
    values (p_service_id, 'live', 'swap',
            jsonb_build_object('kind', 'swap', 'swapId', v_swap.id),
            jsonb_build_object('assignments', jsonb_build_array(
              jsonb_build_object('id', v_give.id, 'userId', v_give.user_id, 'rosterName', v_give.roster_name))
              || case when v_take.id is null then '[]'::jsonb else jsonb_build_array(
              jsonb_build_object('id', v_take.id, 'userId', v_take.user_id, 'rosterName', v_take.roster_name)) end),
            p_actor_id);
    -- Any other request that relied on these shifts no longer fits.
    update public.roster_swaps set status = 'cancelled', cancel_reason = 'roster_changed', decided_at = now()
     where service_id = p_service_id and id <> v_swap.id and status in ('requested', 'accepted')
       and (give_assignment_id in (v_give.id, v_take.id) or take_assignment_id in (v_give.id, v_take.id));
    return jsonb_build_object('swapId', v_swap.id, 'status', 'approved', 'autoApproved', p_action = 'swap.accept');

  elsif p_action in ('swap.decline', 'swap.cancel', 'swap.undo') then
    select * into v_swap from public.roster_swaps
     where id = (p_payload ->> 'swapId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;
    if p_action = 'swap.decline' then
      if not ((v_swap.status = 'requested' and v_swap.counterparty_id = p_actor_id)
              or (v_swap.status = 'accepted' and v_is_manager and p_actor_id not in (v_swap.requester_id, v_swap.counterparty_id))) then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_swaps set status = 'declined', decided_at = now(),
             decided_by = case when v_swap.status = 'accepted' then p_actor_id else null end
       where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'declined');
    elsif p_action = 'swap.cancel' then
      if v_swap.requester_id <> p_actor_id or v_swap.status not in ('requested', 'accepted') then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_swaps set status = 'cancelled', cancel_reason = 'withdrawn', decided_at = now() where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'cancelled');
    else
      -- "Undo for 10 min" after a swap approved itself, by either doctor, if nothing moved since.
      if not v_swap.auto_approved or v_swap.status <> 'approved' or v_swap.decided_at < now() - interval '10 minutes'
         or p_actor_id not in (v_swap.requester_id, v_swap.counterparty_id) then
        raise exception 'roster_role_denied';
      end if;
      select * into v_give from public.roster_assignments where id = v_swap.give_assignment_id for update;
      select * into v_take from public.roster_assignments where id = v_swap.take_assignment_id for update;
      if v_give.superseded_at is not null or v_give.user_id is distinct from v_swap.counterparty_id
         or (v_take.id is not null and (v_take.superseded_at is not null or v_take.user_id is distinct from v_swap.requester_id)) then
        raise exception 'roster_conflict';
      end if;
      update public.roster_assignments set user_id = v_swap.requester_id where id = v_give.id;
      if v_take.id is not null then
        update public.roster_assignments set user_id = v_swap.counterparty_id where id = v_take.id;
      end if;
      update public.roster_swaps set status = 'undone', decided_at = now() where id = v_swap.id;
      update public.roster_changes set undone_at = now(), undone_by = p_actor_id
       where service_id = p_service_id and source = 'swap' and change ->> 'swapId' = v_swap.id::text and undone_at is null;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'undone');
    end if;

  -- ---------------------------------------------------------------- open shifts
  elsif p_action in ('open.post', 'open.report') then
    -- open.post: a member gives away their own shift, or a manager posts any live shift or a gap.
    -- open.report: "I can't make my shift": waits as 'reported' for the manager to release it.
    if p_payload ->> 'assignmentId' is not null then
      select * into v_give from public.roster_assignments
       where id = (p_payload ->> 'assignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
      if not found or v_give.ends_at <= now() or v_give.kind = 'leave'
         or (not v_is_manager and v_give.user_id is distinct from p_actor_id) then
        raise exception 'roster_not_found';
      end if;
      if exists (select 1 from public.roster_swaps w where w.status in ('requested', 'accepted')
                 and (w.give_assignment_id = v_give.id or w.take_assignment_id = v_give.id)) then
        raise exception 'roster_request_exists';
      end if;
      insert into public.roster_open_shifts (service_id, assignment_id, starts_at, ends_at, shift_code, kind, site_id,
                                             min_grade, urgent, status, posted_by)
      values (p_service_id, v_give.id, v_give.starts_at, v_give.ends_at, v_give.shift_code, v_give.kind, v_give.site_id,
              coalesce(nullif(v_give.grade, 'other'),
                       nullif((select grade from public.roster_member_roles where service_id = p_service_id
                               and user_id = v_give.user_id and revoked_at is null), 'other')),
              case when p_action = 'open.report' then true else coalesce((p_payload ->> 'urgent')::boolean, false) and v_is_manager end,
              case when p_action = 'open.report' then 'reported' else 'open' end, p_actor_id)
      returning * into v_open;
    else
      if p_action = 'open.report' or not v_is_manager then raise exception 'roster_role_denied'; end if;
      insert into public.roster_open_shifts (service_id, starts_at, ends_at, shift_code, kind, site_id, min_grade, urgent, posted_by)
      values (p_service_id, (p_payload ->> 'startsAt')::timestamptz, (p_payload ->> 'endsAt')::timestamptz,
              btrim(p_payload ->> 'shiftCode'), p_payload ->> 'kind', (p_payload ->> 'siteId')::uuid,
              p_payload ->> 'minGrade', coalesce((p_payload ->> 'urgent')::boolean, false), p_actor_id)
      returning * into v_open;
      if v_open.starts_at <= now() then raise exception 'roster_invalid_request'; end if;
    end if;
    if (select count(*) from public.roster_open_shifts where service_id = p_service_id and status in ('reported', 'open', 'claimed')) > 1000 then
      raise exception 'roster_limit';
    end if;
    return jsonb_build_object('openShiftId', v_open.id, 'status', v_open.status);

  elsif p_action in ('open.claim', 'open.approve', 'open.decline', 'open.cancel', 'open.release') then
    select * into v_open from public.roster_open_shifts
     where id = (p_payload ->> 'openShiftId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;

    if p_action = 'open.release' then
      if not v_is_manager or v_open.status <> 'reported' then raise exception 'roster_role_denied'; end if;
      update public.roster_open_shifts set status = 'open', urgent = coalesce((p_payload ->> 'urgent')::boolean, true)
       where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'open');
    elsif p_action = 'open.cancel' then
      if v_open.status not in ('reported', 'open', 'claimed') or not (v_is_manager or v_open.posted_by = p_actor_id) then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_open_shifts set status = 'cancelled', decided_at = now(), decided_by = p_actor_id where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'cancelled');
    elsif p_action = 'open.decline' then
      if not v_is_manager or v_open.status <> 'claimed' or v_open.claimed_by = p_actor_id then raise exception 'roster_role_denied'; end if;
      update public.roster_open_shifts set status = 'open', claimed_by = null, claimed_at = null where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'open');
    end if;

    if p_action = 'open.claim' then
      if v_open.status <> 'open' then raise exception 'roster_open_shift_taken'; end if;
      if v_open.starts_at <= now() or v_open.posted_by = p_actor_id then raise exception 'roster_not_found'; end if;
      v_id := p_actor_id;
    else
      if not v_is_manager or v_open.status <> 'claimed' or v_open.claimed_by = p_actor_id then raise exception 'roster_role_denied'; end if;
      v_id := v_open.claimed_by;
    end if;
    v_taker_rank := public.roster_grade_rank(
      (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_id and revoked_at is null));
    if v_taker_rank is null or (v_open.min_grade is not null and v_taker_rank < public.roster_grade_rank(v_open.min_grade))
       or public.roster_placement_problem(p_service_id, v_id, v_open.starts_at, v_open.ends_at,
            array[v_open.assignment_id], null) is not null then
      raise exception 'roster_swap_not_eligible';
    end if;
    if p_action = 'open.claim' and (
         coalesce(v_settings.swap_approval, 'auto_same_grade') = 'manager'
         or v_open.starts_at < now() + interval '7 days'
         or v_open.min_grade is null or v_taker_rank <> public.roster_grade_rank(v_open.min_grade)
         or public.roster_placement_problem(p_service_id, v_id, v_open.starts_at, v_open.ends_at,
              array[v_open.assignment_id], v_min_break) is not null) then
      update public.roster_open_shifts set status = 'claimed', claimed_by = v_id, claimed_at = now() where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'claimed');
    end if;

    -- Apply: the shift moves to the taker (or a gap becomes their shift), with its undo.
    if v_open.assignment_id is not null then
      select * into v_give from public.roster_assignments where id = v_open.assignment_id for update;
      if v_give.superseded_at is not null then raise exception 'roster_conflict'; end if;
      update public.roster_assignments set user_id = v_id, roster_name = null where id = v_give.id;
      v_row := jsonb_build_object('id', v_give.id, 'userId', v_give.user_id, 'rosterName', v_give.roster_name);
    else
      select * into v_pub from public.roster_publications where service_id = p_service_id order by version desc limit 1;
      if not found then raise exception 'roster_conflict'; end if;
      insert into public.roster_assignments (service_id, publication_id, user_id, site_id, starts_at, ends_at, shift_code, kind, grade)
      values (p_service_id, v_pub.id, v_id, v_open.site_id, v_open.starts_at, v_open.ends_at, v_open.shift_code, v_open.kind, v_open.min_grade)
      returning * into v_give;
      v_row := jsonb_build_object('id', v_give.id, 'delete', true);
    end if;
    update public.roster_open_shifts
       set status = 'approved', claimed_by = v_id, claimed_at = coalesce(claimed_at, now()), decided_at = now(),
           decided_by = case when p_action = 'open.approve' then p_actor_id else null end
     where id = v_open.id;
    insert into public.roster_changes (service_id, target, source, change, undo, actor_id)
    values (p_service_id, 'live', 'open_shift', jsonb_build_object('kind', 'open_shift', 'openShiftId', v_open.id),
            jsonb_build_object('assignments', jsonb_build_array(v_row)), p_actor_id);
    return jsonb_build_object('openShiftId', v_open.id, 'status', 'approved', 'assignmentId', v_give.id);

  -- ---------------------------------------------------------------- roster maker (Release 3)
  elsif p_action = 'codes.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    delete from public.roster_shift_codes where service_id = p_service_id;
    insert into public.roster_shift_codes (service_id, code, kind, starts, ends, label)
    select p_service_id, btrim(x ->> 'code'), x ->> 'kind', (x ->> 'starts')::time, (x ->> 'ends')::time, nullif(btrim(x ->> 'label'), '')
    from jsonb_array_elements(coalesce(p_payload -> 'codes', '[]')) x;
    if (select count(*) from public.roster_shift_codes where service_id = p_service_id) > 100 then raise exception 'roster_limit'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'needs.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    delete from public.roster_staffing_needs where service_id = p_service_id;
    insert into public.roster_staffing_needs (service_id, weekday, on_date, kind, grade, site_id, needed)
    select p_service_id, (x ->> 'weekday')::smallint, (x ->> 'date')::date, x ->> 'kind', x ->> 'grade',
           (x ->> 'siteId')::uuid, (x ->> 'needed')::smallint
    from jsonb_array_elements(coalesce(p_payload -> 'needs', '[]')) x;
    if (select count(*) from public.roster_staffing_needs where service_id = p_service_id) > 2000 then raise exception 'roster_limit'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'draft.open' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_from := (p_payload ->> 'periodStart')::date;
    v_to := (p_payload ->> 'periodEnd')::date;
    if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 186 then
      raise exception 'roster_invalid_request';
    end if;
    select * into v_draft from public.roster_drafts
     where service_id = p_service_id and period_start = v_from and period_end = v_to for update;
    if found then return jsonb_build_object('draftId', v_draft.id, 'created', false, 'version', v_draft.version); end if;
    if (select count(*) from public.roster_drafts where service_id = p_service_id) >= 12 then raise exception 'roster_limit'; end if;
    insert into public.roster_drafts (service_id, period_start, period_end, based_on_publication_id, created_by)
    values (p_service_id, v_from, v_to,
            (select id from public.roster_publications where service_id = p_service_id order by version desc limit 1), p_actor_id)
    returning * into v_draft;
    insert into public.roster_draft_assignments (draft_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
    select v_draft.id, a.user_id, a.roster_name, a.site_id, a.starts_at, a.ends_at, a.shift_code, a.kind, a.grade
    from public.roster_assignments a
    where a.service_id = p_service_id and a.superseded_at is null
      and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to;
    if (select count(*) from public.roster_draft_assignments where draft_id = v_draft.id) > 5000 then raise exception 'roster_limit'; end if;
    return jsonb_build_object('draftId', v_draft.id, 'created', true, 'version', v_draft.version);

  elsif p_action in ('draft.change', 'draft.undo') then
    -- The service SHARE and team advisory locks above serialize edits and role removal.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    if jsonb_typeof(p_payload -> 'expectedVersion') is distinct from 'number'
       or (p_payload ->> 'expectedVersion') !~ '^[1-9][0-9]{0,15}$'
       or (p_payload ->> 'expectedVersion')::numeric > 9007199254740991 then
      raise exception 'roster_invalid_request';
    end if;
    select * into v_draft from public.roster_drafts
     where id = (p_payload ->> 'draftId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;
    if v_draft.version <> (p_payload ->> 'expectedVersion')::bigint then raise exception 'roster_conflict'; end if;

    if p_action = 'draft.change' then
      if coalesce(p_payload ->> 'source', '') not in ('typed', 'grid', 'upload')
         or jsonb_typeof(p_payload -> 'ops') is distinct from 'array' then
        raise exception 'roster_invalid_request';
      end if;
      if jsonb_array_length(p_payload -> 'ops') not between 1 and 500 then raise exception 'roster_invalid_request'; end if;
      for v_row in select value from jsonb_array_elements(p_payload -> 'ops') loop
        if jsonb_typeof(v_row) <> 'object' or coalesce(v_row ->> 'op', '') not in ('add', 'update', 'remove') then
          raise exception 'roster_invalid_request';
        end if;
        v_before := null;
        v_after := null;
        if v_row ->> 'op' = 'add' then
          v_assignment := null;
          v_assignment.id := gen_random_uuid();
          v_assignment.draft_id := v_draft.id;
        else
          select * into v_assignment from public.roster_draft_assignments
           where id = (v_row ->> 'id')::uuid and draft_id = v_draft.id for update;
          if not found then raise exception 'roster_conflict'; end if;
          v_before := to_jsonb(v_assignment) - 'draft_id';
        end if;
        v_id := v_assignment.id;
        if v_row ->> 'op' = 'remove' then
          delete from public.roster_draft_assignments where id = v_id and draft_id = v_draft.id;
        else
          if jsonb_typeof(v_row -> 'row') is distinct from 'object' then raise exception 'roster_invalid_request'; end if;
          -- Only structured, normalized fields enter history; never the submitted text.
          if v_row -> 'row' ? 'userId' then v_assignment.user_id := (v_row #>> '{row,userId}')::uuid; end if;
          if v_row -> 'row' ? 'rosterName' then v_assignment.roster_name := nullif(btrim(v_row #>> '{row,rosterName}'), ''); end if;
          if v_row -> 'row' ? 'siteId' then v_assignment.site_id := (v_row #>> '{row,siteId}')::uuid; end if;
          if v_row -> 'row' ? 'startsAt' then v_assignment.starts_at := (v_row #>> '{row,startsAt}')::timestamptz; end if;
          if v_row -> 'row' ? 'endsAt' then v_assignment.ends_at := (v_row #>> '{row,endsAt}')::timestamptz; end if;
          if v_row -> 'row' ? 'shiftCode' then v_assignment.shift_code := btrim(v_row #>> '{row,shiftCode}'); end if;
          if v_row -> 'row' ? 'kind' then v_assignment.kind := v_row #>> '{row,kind}'; end if;
          if v_row -> 'row' ? 'grade' then v_assignment.grade := v_row #>> '{row,grade}'; end if;
          if v_assignment.starts_at is null or v_assignment.ends_at is null
           or not isfinite(v_assignment.starts_at) or not isfinite(v_assignment.ends_at)
           or v_assignment.ends_at <= v_assignment.starts_at
           or v_assignment.ends_at - v_assignment.starts_at > interval '36 hours'
           or (v_assignment.starts_at at time zone 'Australia/Perth')::date not between v_draft.period_start and v_draft.period_end
           or v_assignment.shift_code is null or char_length(v_assignment.shift_code) not between 1 and 12
           or v_assignment.kind is null or v_assignment.kind not in ('day', 'evening', 'night', 'on_call', 'leave', 'other')
           or (v_assignment.grade is not null and v_assignment.grade not in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other'))
           or char_length(v_assignment.roster_name) > 80
           or (v_assignment.user_id is not null and not public.service_member_active(p_service_id, v_assignment.user_id))
           or (v_assignment.site_id is not null and not exists (
             select 1 from public.on_call_service_sites s where s.id = v_assignment.site_id and s.service_id = p_service_id)) then
          raise exception 'roster_invalid_request';
        end if;
          if v_row ->> 'op' = 'add' then
            insert into public.roster_draft_assignments select v_assignment.*;
          else
            update public.roster_draft_assignments set
              user_id = v_assignment.user_id, roster_name = v_assignment.roster_name, site_id = v_assignment.site_id,
              starts_at = v_assignment.starts_at, ends_at = v_assignment.ends_at, shift_code = v_assignment.shift_code,
              kind = v_assignment.kind, grade = v_assignment.grade
            where id = v_id and draft_id = v_draft.id;
          end if;
          v_after := to_jsonb(v_assignment) - 'draft_id';
        end if;
        insert into public.roster_changes (service_id, draft_id, target, source, change, undo, actor_id)
        values (p_service_id, v_draft.id, 'draft', p_payload ->> 'source',
                jsonb_build_object('op', v_row ->> 'op', 'id', v_id, 'before', v_before, 'after', v_after),
                jsonb_build_object('op', 'restore', 'id', v_id, 'row', v_before), p_actor_id)
        returning id into v_change_id;
      end loop;
    else
      select c.change into v_row from public.roster_changes c
       where c.id = (p_payload ->> 'changeId')::bigint and c.service_id = p_service_id
         and c.draft_id = v_draft.id and c.target = 'draft' and c.undone_at is null for update;
      if not found then raise exception 'roster_not_found'; end if;
      -- Historical changes without exact after-images cannot be undone safely.
      if not (v_row ? 'before' and v_row ? 'after' and v_row ? 'id') then raise exception 'roster_conflict'; end if;
      v_id := (v_row ->> 'id')::uuid;
      select to_jsonb(a) - 'draft_id' into v_current from public.roster_draft_assignments a
       where a.id = v_id and a.draft_id = v_draft.id for update;
      v_current := coalesce(v_current, 'null'::jsonb);
      if v_current is distinct from v_row -> 'after' then raise exception 'roster_conflict'; end if;
      if v_row -> 'before' = 'null'::jsonb then
        delete from public.roster_draft_assignments where id = v_id and draft_id = v_draft.id;
      else
        v_assignment := jsonb_populate_record(null::public.roster_draft_assignments,
          (v_row -> 'before') || jsonb_build_object('draft_id', v_draft.id));
        if v_assignment.starts_at is null or v_assignment.ends_at is null
           or not isfinite(v_assignment.starts_at) or not isfinite(v_assignment.ends_at)
           or v_assignment.ends_at <= v_assignment.starts_at
           or v_assignment.ends_at - v_assignment.starts_at > interval '36 hours'
           or (v_assignment.starts_at at time zone 'Australia/Perth')::date not between v_draft.period_start and v_draft.period_end
           or v_assignment.shift_code is null or char_length(v_assignment.shift_code) not between 1 and 12
           or v_assignment.kind is null or v_assignment.kind not in ('day', 'evening', 'night', 'on_call', 'leave', 'other')
           or (v_assignment.grade is not null and v_assignment.grade not in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other'))
           or char_length(v_assignment.roster_name) > 80
           or (v_assignment.user_id is not null and not public.service_member_active(p_service_id, v_assignment.user_id))
           or (v_assignment.site_id is not null and not exists (
             select 1 from public.on_call_service_sites s where s.id = v_assignment.site_id and s.service_id = p_service_id)) then
          raise exception 'roster_invalid_request';
        end if;
        if v_row -> 'after' = 'null'::jsonb then
          insert into public.roster_draft_assignments select v_assignment.*;
        else
          update public.roster_draft_assignments set
            user_id = v_assignment.user_id, roster_name = v_assignment.roster_name, site_id = v_assignment.site_id,
            starts_at = v_assignment.starts_at, ends_at = v_assignment.ends_at, shift_code = v_assignment.shift_code,
            kind = v_assignment.kind, grade = v_assignment.grade
          where id = v_id and draft_id = v_draft.id;
        end if;
      end if;
      update public.roster_changes set undone_at = now(), undone_by = p_actor_id
       where id = (p_payload ->> 'changeId')::bigint and service_id = p_service_id and draft_id = v_draft.id;
    end if;
    if (select count(*) from public.roster_draft_assignments where draft_id = v_draft.id) > 5000 then raise exception 'roster_limit'; end if;
    update public.roster_drafts set version = version + 1, updated_at = now()
     where id = v_draft.id returning version into v_draft.version;
    return jsonb_build_object('ok', true, 'draftId', v_draft.id, 'version', v_draft.version, 'lastChangeId', v_change_id::text);

  elsif p_action = 'agreement.record' then
    if not exists (select 1 from public.roster_changes c where c.id = (p_payload ->> 'changeId')::bigint
                   and c.service_id = p_service_id and c.agreement_required and c.undone_at is null) then
      raise exception 'roster_not_found';
    end if;
    insert into public.roster_change_agreements (change_id, user_id) values ((p_payload ->> 'changeId')::bigint, p_actor_id)
      on conflict do nothing;
    return jsonb_build_object('ok', true);
  end if;

  raise exception 'roster_invalid_request';
end $$;

-- STABLE preserves one statement snapshot across metadata, assignments and history.
create or replace function public.roster_read(p_actor_id uuid, p_service_id uuid, p_what text, p_payload jsonb default '{}')
returns jsonb
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role public.roster_member_roles;
  v_is_manager boolean;
  v_from date;
  v_to date;
  v_latest public.roster_publications;
  v_result jsonb;
begin
  if p_actor_id is null then raise exception 'roster_auth_required'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'roster_invalid_request'; end if;

  if p_what = 'teams' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'serviceId', s.id, 'name', s.name,
      'enabled', (s.verified_at is not null or s.is_demo),
      'role', coalesce(r.role, 'member'), 'grade', r.grade
    ) order by s.name), '[]') into v_result
    from public.on_call_services s
    join public.on_call_service_members m on m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null
    left join public.roster_member_roles r on r.service_id = s.id and r.user_id = p_actor_id and r.revoked_at is null;
    return jsonb_build_object('teams', v_result);
  end if;

  select * into v_service from public.on_call_services where id = p_service_id;
  if not found or not public.service_member_active(p_service_id, p_actor_id) then
    raise exception 'roster_access_denied';
  end if;
  if v_service.verified_at is null and not v_service.is_demo then raise exception 'roster_team_not_verified'; end if;
  select * into v_role from public.roster_member_roles
   where service_id = p_service_id and user_id = p_actor_id and revoked_at is null;
  v_is_manager := found and v_role.role = 'manager';
  select * into v_latest from public.roster_publications
   where service_id = p_service_id order by version desc limit 1;

  if p_what in ('assignments', 'unavailability', 'leave_overlap', 'changes', 'team_leave') then
    begin
      v_from := (p_payload ->> 'from')::date;
      v_to := (p_payload ->> 'to')::date;
    exception when others then raise exception 'roster_invalid_request';
    end;
    if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 62 then
      raise exception 'roster_invalid_request';
    end if;
  end if;

  if p_what = 'overview' then
    return jsonb_build_object(
      'service', jsonb_build_object('id', v_service.id, 'name', v_service.name),
      'me', jsonb_build_object('role', coalesce(v_role.role, 'member'), 'grade', v_role.grade,
                               'rotationEndsOn', v_role.rotation_ends_on),
      'latestPublication', case when v_latest.id is null then null else jsonb_build_object(
        'id', v_latest.id, 'version', v_latest.version, 'publishedAt', v_latest.published_at,
        'periodStart', v_latest.period_start, 'periodEnd', v_latest.period_end) end,
      'seenLatest', v_latest.id is not null and exists (
        select 1 from public.roster_publication_seen where publication_id = v_latest.id and user_id = p_actor_id),
      'settings', coalesce((select jsonb_build_object('swapApproval', t.swap_approval, 'rules', t.rules,
        'rulesSource', t.rules_source, 'payFortnightAnchor', t.pay_fortnight_anchor)
        from public.roster_team_settings t where t.service_id = p_service_id),
        jsonb_build_object('swapApproval', 'auto_same_grade', 'rules', '{}'::jsonb, 'rulesSource', null, 'payFortnightAnchor', null)),
      'nextCutoffOn', (select t.next_cutoff_on from public.roster_team_settings t where t.service_id = p_service_id),
      'managers', (select coalesce(jsonb_agg(jsonb_build_object('userId', m.user_id,
        'name', public.roster_person_name(p_service_id, m.user_id, null)) order by m.user_id), '[]')
        from public.roster_member_roles m where m.service_id = p_service_id and m.role = 'manager'
          and m.revoked_at is null and public.service_member_active(p_service_id, m.user_id)),
      'sites', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name), '[]')
                from public.on_call_service_sites s where s.service_id = p_service_id)
    );

  elsif p_what = 'assignments' then
    select coalesce(jsonb_agg(public.roster_assignment_json(a) order by a.starts_at, a.id), '[]') into v_result
    from public.roster_assignments a
    where a.service_id = p_service_id and a.superseded_at is null
      and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to;
    return jsonb_build_object('assignments', v_result);

  elsif p_what = 'requests' then
    return jsonb_build_object(
      'swaps', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id, 'status', w.status, 'autoApproved', w.auto_approved,
          'needsManagerBecause', w.needs_manager_because, 'cancelReason', w.cancel_reason,
          'requesterId', w.requester_id, 'counterpartyId', w.counterparty_id,
          'requesterName', public.roster_person_name(p_service_id, w.requester_id, null),
          'counterpartyName', public.roster_person_name(p_service_id, w.counterparty_id, null),
          'give', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.give_assignment_id),
          'take', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.take_assignment_id),
          'expiresAt', w.expires_at, 'createdAt', w.created_at, 'decidedAt', w.decided_at
        ) order by w.created_at desc), '[]')
        from public.roster_swaps w
        where w.service_id = p_service_id and (w.requester_id = p_actor_id or w.counterparty_id = p_actor_id)
          and w.created_at > now() - interval '60 days'),
      'openShifts', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', o.id, 'status', o.status, 'urgent', o.urgent, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
          'shiftCode', o.shift_code, 'kind', o.kind, 'minGrade', o.min_grade, 'siteId', o.site_id,
          'mine', o.posted_by = p_actor_id, 'claimedByMe', o.claimed_by = p_actor_id
        ) order by o.starts_at), '[]')
        from public.roster_open_shifts o
        where o.service_id = p_service_id and o.ends_at > now()
          and (o.posted_by = p_actor_id or o.claimed_by = p_actor_id
               or (o.status = 'open' and (o.min_grade is null
                   or public.roster_grade_rank(v_role.grade) >= public.roster_grade_rank(o.min_grade)))))
    );

  elsif p_what = 'unavailability' then
    select coalesce(jsonb_agg(jsonb_build_object('userId', u.user_id, 'date', u.on_date, 'kind', u.kind)
           order by u.on_date, u.user_id), '[]') into v_result
    from public.roster_unavailability u
    where u.service_id = p_service_id and u.on_date between v_from and v_to
      and (v_is_manager or u.user_id = p_actor_id);
    return jsonb_build_object('unavailability', v_result);

  elsif p_what = 'leave_overlap' then
    -- A number only, never names.
    return jsonb_build_object('alreadyOff', (
      select count(distinct l.owner_id) from public.roster_leave l
      where l.service_id = p_service_id and l.owner_id <> p_actor_id
        and public.service_member_active(p_service_id, l.owner_id)
        and l.starts_on <= v_to and l.ends_on >= v_from));

  elsif p_what = 'changes' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    return jsonb_build_object(
      'swaps', (select coalesce(jsonb_agg(jsonb_build_object(
        'swapId', w.id, 'giveAssignmentId', coalesce(p.give_assignment_id, w.give_assignment_id),
        'takeAssignmentId', case when p.id is null then w.take_assignment_id else p.take_assignment_id end,
        'requesterId', w.requester_id, 'counterpartyId', w.counterparty_id,
        'decidedAt', w.decided_at, 'autoApproved', w.auto_approved) order by w.id), '[]')
        from public.roster_swaps w left join public.roster_publication_protections p
          on p.swap_id = w.id and p.service_id = w.service_id
        where w.service_id = p_service_id and w.status = 'approved' and p.overridden_at is null
          and exists (select 1 from public.roster_assignments a where a.service_id = p_service_id
            and a.id in (coalesce(p.give_assignment_id, w.give_assignment_id),
              case when p.id is null then w.take_assignment_id else p.take_assignment_id end) and a.superseded_at is null
            and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to)),
      'openShifts', (select coalesce(jsonb_agg(jsonb_build_object(
        'openShiftId', o.id, 'assignmentId', a.id, 'claimedBy', o.claimed_by,
        'decidedAt', o.decided_at) order by o.id), '[]')
        from public.roster_open_shifts o left join public.roster_publication_protections p
          on p.open_shift_id = o.id and p.service_id = o.service_id
        join public.roster_assignments a on a.id = coalesce(p.give_assignment_id, o.assignment_id,
          (select (c.undo #>> '{assignments,0,id}')::uuid from public.roster_changes c
            where c.service_id = p_service_id and c.source = 'open_shift' and c.target = 'live'
              and c.change ->> 'openShiftId' = o.id::text and c.undone_at is null order by c.id desc limit 1))
        where o.service_id = p_service_id and a.service_id = p_service_id and o.status = 'approved'
          and p.overridden_at is null and a.superseded_at is null and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to)
    );

  elsif p_what = 'my_changes' then
    return jsonb_build_object(
      'before', (select coalesce(jsonb_agg(public.roster_assignment_json(a) order by a.starts_at, a.id), '[]')
        from public.roster_assignments a where a.service_id = p_service_id and a.user_id = p_actor_id
          and a.superseded_at = v_latest.published_at),
      'after', (select coalesce(jsonb_agg(public.roster_assignment_json(a) order by a.starts_at, a.id), '[]')
        from public.roster_assignments a where a.service_id = p_service_id and a.user_id = p_actor_id
          and a.publication_id = v_latest.id and a.superseded_at is null)
    );

  elsif p_what = 'team_leave' then
    -- Named leave is a privacy expansion: approval is required before real staff use.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    return jsonb_build_object('leave', (select coalesce(jsonb_agg(jsonb_build_object(
      'userId', l.owner_id, 'name', public.roster_person_name(p_service_id, l.owner_id, null),
      'kind', l.kind, 'startsOn', l.starts_on, 'endsOn', l.ends_on, 'status', l.status)
      order by l.starts_on, l.owner_id, l.id), '[]') from public.roster_leave l
      where l.service_id = p_service_id and public.service_member_active(p_service_id, l.owner_id)
        and l.starts_on <= v_to and l.ends_on >= v_from));

  elsif p_what = 'manage' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    return jsonb_build_object(
      'swaps', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', w.id, 'status', w.status, 'autoApproved', w.auto_approved,
          'needsManagerBecause', w.needs_manager_because,
          'requesterId', w.requester_id, 'counterpartyId', w.counterparty_id,
          'give', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.give_assignment_id),
          'take', (select public.roster_assignment_json(a) from public.roster_assignments a where a.id = w.take_assignment_id),
          'decidedAt', w.decided_at
        ) order by w.created_at), '[]')
        from public.roster_swaps w
        where w.service_id = p_service_id
          and (w.status = 'accepted' or (w.auto_approved and w.decided_at > now() - interval '14 days'))),
      'openShifts', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', o.id, 'status', o.status, 'urgent', o.urgent, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
          'shiftCode', o.shift_code, 'kind', o.kind, 'minGrade', o.min_grade, 'siteId', o.site_id,
          'postedBy', o.posted_by, 'claimedBy', o.claimed_by, 'claimedAt', o.claimed_at
        ) order by o.starts_at), '[]')
        from public.roster_open_shifts o
        where o.service_id = p_service_id and o.status in ('reported', 'open', 'claimed') and o.ends_at > now()),
      'seen', case when v_latest.id is null then null else jsonb_build_object(
          'publicationId', v_latest.id, 'version', v_latest.version,
          'seen', (select count(*) from public.roster_publication_seen x
                   where x.publication_id = v_latest.id and public.service_member_active(p_service_id, x.user_id)),
          'members', (select count(*) from public.on_call_service_members m
                      where m.service_id = p_service_id and m.revoked_at is null),
          'notSeen', (select coalesce(jsonb_agg(m.user_id), '[]') from public.on_call_service_members m
                      where m.service_id = p_service_id and m.revoked_at is null
                        and not exists (select 1 from public.roster_publication_seen x
                                        where x.publication_id = v_latest.id and x.user_id = m.user_id))) end
    );

  elsif p_what = 'people' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', m.user_id, 'displayName', m.display_name, 'joinedAt', m.joined_at, 'serviceRole', m.role,
      'role', coalesce(r.role, 'member'), 'grade', r.grade, 'rosterName', r.roster_name,
      'rotationEndsOn', r.rotation_ends_on
    ) order by coalesce(m.display_name, r.roster_name), m.joined_at), '[]') into v_result
    from public.on_call_service_members m
    left join public.roster_member_roles r on r.service_id = m.service_id and r.user_id = m.user_id and r.revoked_at is null
    where m.service_id = p_service_id and m.revoked_at is null;
    return jsonb_build_object('people', v_result);

  elsif p_what = 'publications' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'version', p.version, 'kind', p.kind, 'periodStart', p.period_start, 'periodEnd', p.period_end,
      'sourceName', p.source_name, 'publishedAt', p.published_at
    ) order by p.version desc), '[]') into v_result
    from (select * from public.roster_publications where service_id = p_service_id order by version desc limit 50) p;
    return jsonb_build_object('publications', v_result);

  elsif p_what = 'maker' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    return jsonb_build_object(
      'codes', (select coalesce(jsonb_agg(jsonb_build_object('code', c.code, 'kind', c.kind, 'starts', c.starts,
                'ends', c.ends, 'label', c.label) order by c.code), '[]')
                from public.roster_shift_codes c where c.service_id = p_service_id),
      'needs', (select coalesce(jsonb_agg(jsonb_build_object('id', n.id, 'weekday', n.weekday, 'date', n.on_date,
                'kind', n.kind, 'grade', n.grade, 'siteId', n.site_id, 'needed', n.needed)), '[]')
                from public.roster_staffing_needs n where n.service_id = p_service_id),
      'drafts', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'periodStart', d.period_start,
                'periodEnd', d.period_end, 'basedOnPublicationId', d.based_on_publication_id, 'updatedAt', d.updated_at, 'version', d.version)
                order by d.period_start), '[]')
                from public.roster_drafts d where d.service_id = p_service_id)
    );

  elsif p_what = 'draft' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    if not exists (select 1 from public.roster_drafts d
                   where d.id = (p_payload ->> 'draftId')::uuid and d.service_id = p_service_id) then
      raise exception 'roster_not_found';
    end if;
    return jsonb_build_object(
      'draft', (select jsonb_build_object('id', d.id, 'periodStart', d.period_start, 'periodEnd', d.period_end,
        'basedOnPublicationId', d.based_on_publication_id, 'version', d.version)
        from public.roster_drafts d where d.id = (p_payload ->> 'draftId')::uuid and d.service_id = p_service_id),
      'assignments', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'userId', a.user_id, 'rosterName', a.roster_name, 'name', public.roster_person_name(p_service_id, a.user_id, a.roster_name),
          'siteId', a.site_id, 'startsAt', a.starts_at, 'endsAt', a.ends_at, 'shiftCode', a.shift_code,
          'kind', a.kind, 'grade', a.grade) order by a.starts_at, a.id), '[]')
        from public.roster_draft_assignments a where a.draft_id = (p_payload ->> 'draftId')::uuid),
      'changes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id::text, 'source', c.source, 'change', c.change,
          'at', c.at, 'actorId', c.actor_id, 'undoneAt', c.undone_at,
          'canUndo', c.undone_at is null and c.change ? 'before' and c.change ? 'after'
            and (c.change -> 'before' = 'null'::jsonb or (
              (c.change #>> '{before,user_id}' is null or public.service_member_active(p_service_id, (c.change #>> '{before,user_id}')::uuid))
              and (c.change #>> '{before,site_id}' is null or exists (select 1 from public.on_call_service_sites s
                where s.id = (c.change #>> '{before,site_id}')::uuid and s.service_id = p_service_id))))
            and coalesce((select to_jsonb(a) - 'draft_id' from public.roster_draft_assignments a
              where a.draft_id = c.draft_id and a.id = (c.change ->> 'id')::uuid), 'null'::jsonb) = c.change -> 'after') order by c.id desc), '[]')
        from (select * from public.roster_changes where draft_id = (p_payload ->> 'draftId')::uuid and service_id = p_service_id
              order by id desc limit 100) c)
    );
  end if;

  raise exception 'roster_invalid_request';
end $$;
