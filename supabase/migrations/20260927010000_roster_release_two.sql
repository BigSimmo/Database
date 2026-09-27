-- LOCAL DRAFT: restamp at publication after #3117 merges; never edit the base migration.
-- Merge only inside Josh's approved window: merge applies to the live database.
-- G4 exposes named planned leave to active team roster managers; health-service privacy
-- approval and isolation evidence are prerequisites for real staff use. Members retain counts.
-- Publication uses a single RPC transaction, under the same service/team lock as commands.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.roster_team_settings add column next_cutoff_on date;

-- Remember custom off-code meanings, but never create an off assignment or working hours.
alter table public.roster_shift_codes
  drop constraint roster_shift_codes_kind_check,
  add constraint roster_shift_codes_kind_check check (kind in ('day', 'evening', 'night', 'on_call', 'leave', 'other', 'off')),
  drop constraint roster_shift_codes_times,
  add constraint roster_shift_codes_times check (
    (starts is null) = (ends is null) and (kind <> 'off' or (starts is null and ends is null))
  );


-- An approved change keeps its identity when a full publication replaces assignment IDs.
-- Explicit file overrides are tombstones, so later uploads cannot resurrect that protection.
-- Source FKs preserve the existing swap/open retention and account-deletion cascades.
create table public.roster_publication_protections (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  swap_id uuid unique references public.roster_swaps(id) on delete cascade,
  open_shift_id uuid unique references public.roster_open_shifts(id) on delete cascade,
  give_assignment_id uuid not null references public.roster_assignments(id) on delete cascade,
  take_assignment_id uuid references public.roster_assignments(id) on delete cascade,
  overridden_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  constraint roster_publication_protections_one_source check ((swap_id is null) <> (open_shift_id is null))
);
create index roster_publication_protections_service_idx on public.roster_publication_protections(service_id);
alter table public.roster_publication_protections enable row level security;
revoke all on table public.roster_publication_protections from public, anon, authenticated;
grant all on table public.roster_publication_protections to service_role;


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
                'periodEnd', d.period_end, 'basedOnPublicationId', d.based_on_publication_id, 'updatedAt', d.updated_at)
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
      'assignments', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'userId', a.user_id, 'name', public.roster_person_name(p_service_id, a.user_id, a.roster_name),
          'siteId', a.site_id, 'startsAt', a.starts_at, 'endsAt', a.ends_at, 'shiftCode', a.shift_code,
          'kind', a.kind, 'grade', a.grade) order by a.starts_at, a.id), '[]')
        from public.roster_draft_assignments a where a.draft_id = (p_payload ->> 'draftId')::uuid),
      'changes', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'source', c.source, 'change', c.change,
          'at', c.at, 'actorId', c.actor_id, 'undoneAt', c.undone_at) order by c.id desc), '[]')
        from (select * from public.roster_changes where draft_id = (p_payload ->> 'draftId')::uuid
              order by id desc limit 100) c)
    );
  end if;

  raise exception 'roster_invalid_request';
end $$;

-- A private comparison token, not an authorization capability. Callers still validate the actor.
-- Include all live assignments (also outside the period), request decisions, membership,
-- roles, codes, settings and sites: an approved swap cannot hide behind the same publication ID.
create function public.roster_publish_fingerprint(p_service_id uuid, p_from date, p_to date)
returns text language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select md5(jsonb_build_object(
    'serviceId', p_service_id, 'from', p_from, 'to', p_to,
    'assignments', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]')
      from public.roster_assignments a where a.service_id = p_service_id and a.superseded_at is null),
    'swaps', (select coalesce(jsonb_agg(to_jsonb(w) order by w.id), '[]') from public.roster_swaps w where w.service_id = p_service_id),
    'openShifts', (select coalesce(jsonb_agg(to_jsonb(o) order by o.id), '[]') from public.roster_open_shifts o where o.service_id = p_service_id),
    'members', (select coalesce(jsonb_agg(to_jsonb(m) order by m.user_id), '[]')
      from public.on_call_service_members m where m.service_id = p_service_id),
    'roles', (select coalesce(jsonb_agg(to_jsonb(r) order by r.user_id), '[]') from public.roster_member_roles r where r.service_id = p_service_id),
    'codes', (select coalesce(jsonb_agg(to_jsonb(c) order by c.code), '[]') from public.roster_shift_codes c where c.service_id = p_service_id),
    'settings', (select to_jsonb(t) from public.roster_team_settings t where t.service_id = p_service_id),
    'sites', (select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]') from public.on_call_service_sites s where s.service_id = p_service_id),
    'protections', (select coalesce(jsonb_agg(to_jsonb(p) order by p.id), '[]')
      from public.roster_publication_protections p where p.service_id = p_service_id),
    'latest', (select to_jsonb(p) from public.roster_publications p where p.service_id = p_service_id order by p.version desc limit 1)
  )::text)
$$;

-- This lock/auth helper is service-role-only, never SECURITY DEFINER. The actor is the
-- validated server session. Keep lock order identical to roster_command and roster_set_manager.
create function public.roster_lock_manager(p_actor_id uuid, p_service_id uuid)
returns void language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_service public.on_call_services;
begin
  if p_actor_id is null then raise exception 'roster_auth_required'; end if;
  if p_service_id is null then raise exception 'roster_invalid_request'; end if;
  select * into v_service from public.on_call_services where id = p_service_id for share;
  if not found or not public.service_member_active(p_service_id, p_actor_id) then raise exception 'roster_access_denied'; end if;
  if v_service.verified_at is null and not v_service.is_demo then raise exception 'roster_team_not_verified'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74817));
  if not exists (select 1 from public.roster_member_roles where service_id = p_service_id
    and user_id = p_actor_id and revoked_at is null and role = 'manager') then raise exception 'roster_role_denied'; end if;
end $$;

create function public.roster_set_cutoff(p_actor_id uuid, p_service_id uuid, p_cutoff date)
returns jsonb language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_today date := (now() at time zone 'Australia/Perth')::date;
begin
  perform public.roster_lock_manager(p_actor_id, p_service_id);
  if p_cutoff is not null and (p_cutoff < v_today or p_cutoff > v_today + 180) then raise exception 'roster_invalid_request'; end if;
  insert into public.roster_team_settings (service_id, next_cutoff_on, updated_by)
  values (p_service_id, p_cutoff, p_actor_id)
  on conflict (service_id) do update set next_cutoff_on = excluded.next_cutoff_on, updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'nextCutoffOn', p_cutoff);
end $$;

create function public.roster_publish_preview(p_actor_id uuid, p_service_id uuid, p_from date, p_to date)
returns jsonb language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_from date := p_from;
  v_to date;
  v_part jsonb;
  v_assignments jsonb := '[]';
  v_swaps jsonb := '[]';
  v_open jsonb := '[]';
begin
  perform public.roster_lock_manager(p_actor_id, p_service_id);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 186 then raise exception 'roster_invalid_request'; end if;
  -- Each internal read retains its 62-day privacy window. The lock spans every chunk.
  while v_from <= p_to loop
    v_to := least(v_from + 62, p_to);
    v_assignments := v_assignments || (public.roster_read(p_actor_id, p_service_id, 'assignments',
      jsonb_build_object('from', v_from, 'to', v_to)) -> 'assignments');
    v_part := public.roster_read(p_actor_id, p_service_id, 'changes', jsonb_build_object('from', v_from, 'to', v_to));
    v_swaps := v_swaps || (v_part -> 'swaps');
    v_open := v_open || (v_part -> 'openShifts');
    v_from := v_to + 1;
  end loop;
  -- A two-way swap may have its two assignments in different chunks.
  select coalesce(jsonb_agg(x order by x ->> 'swapId'), '[]') into v_swaps
    from (select distinct value as x from jsonb_array_elements(v_swaps)) dedup;
  return jsonb_build_object(
    'freshnessToken', public.roster_publish_fingerprint(p_service_id, p_from, p_to),
    'assignments', v_assignments, 'changes', jsonb_build_object('swaps', v_swaps, 'openShifts', v_open),
    'people', public.roster_read(p_actor_id, p_service_id, 'people', '{}') -> 'people',
    'codes', public.roster_read(p_actor_id, p_service_id, 'maker', '{}') -> 'codes'
  );
end $$;

-- A kept approved shift must have exactly one corresponding row after replacement.
-- Ambiguous duplicates or a missing row fail the entire publication, never drop protection.
create function public.roster_publication_replacement(p_service_id uuid, p_assignment_id uuid,
  p_publication_id uuid, p_from date, p_to date)
returns uuid language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_old public.roster_assignments; v_ids uuid[];
begin
  if p_assignment_id is null then return null; end if;
  select * into v_old from public.roster_assignments where id = p_assignment_id and service_id = p_service_id;
  if not found then raise exception 'roster_conflict'; end if;
  if (v_old.starts_at at time zone 'Australia/Perth')::date not between p_from and p_to then
    if v_old.superseded_at is not null then raise exception 'roster_conflict'; end if;
    return v_old.id;
  end if;
  select array_agg(a.id) into v_ids from public.roster_assignments a
    where a.service_id = p_service_id and a.publication_id = p_publication_id and a.superseded_at is null
      and a.user_id is not distinct from v_old.user_id and a.starts_at = v_old.starts_at and a.ends_at = v_old.ends_at
      and a.site_id is not distinct from v_old.site_id and a.shift_code = v_old.shift_code and a.kind = v_old.kind;
  if coalesce(cardinality(v_ids), 0) <> 1 then raise exception 'roster_conflict'; end if;
  return v_ids[1];
end $$;

create function public.roster_publish(p_actor_id uuid, p_service_id uuid, p_expected_token text, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_publication jsonb;
  v_from date;
  v_to date;
  v_row jsonb;
  v_before jsonb;
  v_result jsonb;
  v_changed jsonb;
  v_snapshot jsonb;
  v_protections jsonb;
  v_protection jsonb;
  v_overrides jsonb := coalesce(p_payload -> 'overrideChanges', '[]');
  v_open_rows jsonb := coalesce(p_payload -> 'openShifts', '[]');
  v_open_ids uuid[] := '{}';
  v_open_id uuid;
  v_give uuid;
  v_take uuid;
  v_overridden boolean;
begin
  perform public.roster_lock_manager(p_actor_id, p_service_id);
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or (p_payload - array['roles', 'codes', 'publication', 'openShifts', 'overrideChanges']) <> '{}'
    or jsonb_typeof(p_payload -> 'roles') is distinct from 'array'
    or jsonb_typeof(p_payload -> 'codes') is distinct from 'array'
    or jsonb_typeof(p_payload -> 'publication') is distinct from 'object'
    or jsonb_typeof(v_open_rows) is distinct from 'array'
    or jsonb_typeof(v_overrides) is distinct from 'array' then raise exception 'roster_invalid_request'; end if;
  if jsonb_array_length(p_payload -> 'roles') > 5000 or jsonb_array_length(p_payload -> 'codes') > 100
    or jsonb_array_length(v_open_rows) > 1000 or jsonb_array_length(v_overrides) > 10000 then raise exception 'roster_limit'; end if;
  v_publication := p_payload -> 'publication';
  if (v_publication - array['kind', 'periodStart', 'periodEnd', 'sourceName', 'assignments']) <> '{}'
    or v_publication ->> 'kind' is distinct from 'full'
    or jsonb_typeof(v_publication -> 'assignments') is distinct from 'array' then raise exception 'roster_invalid_request'; end if;
  if jsonb_array_length(v_publication -> 'assignments') + jsonb_array_length(v_open_rows) > 5000 then raise exception 'roster_limit'; end if;
  begin
    v_from := (v_publication ->> 'periodStart')::date;
    v_to := (v_publication ->> 'periodEnd')::date;
  exception when others then raise exception 'roster_invalid_request'; end;
  if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 186 then raise exception 'roster_invalid_request'; end if;
  if p_expected_token is null or p_expected_token is distinct from public.roster_publish_fingerprint(p_service_id, v_from, v_to) then
    raise exception 'roster_conflict';
  end if;
  v_snapshot := public.roster_publish_preview(p_actor_id, p_service_id, v_from, v_to);
  select coalesce(jsonb_agg(x), '[]') into v_protections from (
    select jsonb_build_object('kind', 'swap', 'id', x -> 'swapId',
      'give', x -> 'giveAssignmentId', 'take', x -> 'takeAssignmentId') x
    from jsonb_array_elements(v_snapshot #> '{changes,swaps}') x
    union all
    select jsonb_build_object('kind', 'open', 'id', x -> 'openShiftId', 'give', x -> 'assignmentId', 'take', null)
    from jsonb_array_elements(v_snapshot #> '{changes,openShifts}') x
  ) protections;
  for v_row in select value from jsonb_array_elements(v_overrides) loop
    if jsonb_typeof(v_row) <> 'object' or (v_row - array['kind', 'id']) <> '{}'
      or v_row ->> 'kind' not in ('swap', 'open') or jsonb_typeof(v_row -> 'id') is distinct from 'string'
      or not exists (select 1 from jsonb_array_elements(v_protections) p
        where p ->> 'kind' = v_row ->> 'kind' and p ->> 'id' = v_row ->> 'id') then
      raise exception 'roster_invalid_request'; end if;
  end loop;
  if (select count(*) from jsonb_array_elements(v_overrides)) <>
    (select count(distinct x) from jsonb_array_elements(v_overrides) x) then raise exception 'roster_invalid_request'; end if;
  for v_row in select value from jsonb_array_elements(v_open_rows) loop
    if jsonb_typeof(v_row) <> 'object'
      or (v_row - array['startsAt', 'endsAt', 'shiftCode', 'kind', 'siteId', 'minGrade', 'urgent']) <> '{}'
      or jsonb_typeof(v_row -> 'startsAt') is distinct from 'string'
      or jsonb_typeof(v_row -> 'endsAt') is distinct from 'string'
      or jsonb_typeof(v_row -> 'shiftCode') is distinct from 'string'
      or coalesce(v_row ->> 'kind', '') not in ('day', 'evening', 'night', 'on_call', 'other')
      or char_length(btrim(v_row ->> 'shiftCode')) not between 1 and 12
      or (v_row ->> 'minGrade' is not null and v_row ->> 'minGrade' not in ('intern', 'resident', 'registrar', 'fellow', 'consultant'))
      or (v_row ? 'urgent' and jsonb_typeof(v_row -> 'urgent') <> 'boolean') then raise exception 'roster_invalid_request'; end if;
    begin
      if ((v_row ->> 'startsAt')::timestamptz at time zone 'Australia/Perth')::date not between v_from and v_to
        or (v_row ->> 'startsAt')::timestamptz <= now()
        or (v_row ->> 'endsAt')::timestamptz <= (v_row ->> 'startsAt')::timestamptz
        or (v_row ->> 'endsAt')::timestamptz - (v_row ->> 'startsAt')::timestamptz > interval '36 hours'
        then raise exception 'roster_invalid_request'; end if;
    exception when others then raise exception 'roster_invalid_request'; end;
  end loop;
  -- Reject any actor/action or other undeclared field even from a miswired server caller.
  for v_row in select value from jsonb_array_elements(p_payload -> 'roles') loop
    if jsonb_typeof(v_row) <> 'object' or (v_row - array['userId', 'rosterName']) <> '{}'
      or jsonb_typeof(v_row -> 'userId') is distinct from 'string'
      or jsonb_typeof(v_row -> 'rosterName') is distinct from 'string'
      or char_length(btrim(v_row ->> 'rosterName')) not between 1 and 80 then raise exception 'roster_invalid_request'; end if;
  end loop;
  for v_row in select value from jsonb_array_elements(p_payload -> 'codes') loop
    if jsonb_typeof(v_row) <> 'object' or (v_row - array['code', 'kind', 'starts', 'ends', 'label']) <> '{}'
      or coalesce(v_row ->> 'kind', '') not in ('day', 'evening', 'night', 'on_call', 'leave', 'other', 'off')
      or (v_row ->> 'kind' = 'off' and (v_row ->> 'starts' is not null or v_row ->> 'ends' is not null)) then
      raise exception 'roster_invalid_request'; end if;
  end loop;
  for v_row in select value from jsonb_array_elements(v_publication -> 'assignments') loop
    if jsonb_typeof(v_row) <> 'object' or (v_row - array['userId', 'rosterName', 'siteId', 'startsAt', 'endsAt', 'shiftCode', 'kind', 'grade']) <> '{}'
      or coalesce(v_row ->> 'kind', '') not in ('day', 'evening', 'night', 'on_call', 'leave', 'other') then
      raise exception 'roster_invalid_request'; end if;
  end loop;
  -- Compare meaningful shift fields as multisets per user (duplicates count); generated IDs
  -- and publication IDs must not make an unchanged re-upload look like a changed roster.
  select coalesce(jsonb_agg(to_jsonb(a)), '[]') into v_before from public.roster_assignments a
    where a.service_id = p_service_id and a.superseded_at is null
      and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to;
  for v_row in select value from jsonb_array_elements(p_payload -> 'roles') loop
    perform public.roster_command(p_actor_id, p_service_id, 'role.set', v_row);
  end loop;
  perform public.roster_command(p_actor_id, p_service_id, 'codes.set', jsonb_build_object('codes', p_payload -> 'codes'));
  v_result := public.roster_command(p_actor_id, p_service_id, 'publish', v_publication);
  -- Carry each source's protection forward independently. An explicit override retires
  -- only that source; another approved change on the same shift must still be preserved.
  for v_protection in select value from jsonb_array_elements(v_protections) loop
    v_overridden := exists (select 1 from jsonb_array_elements(v_overrides) o
      where o ->> 'kind' = v_protection ->> 'kind' and o ->> 'id' = v_protection ->> 'id');
    v_give := (v_protection ->> 'give')::uuid;
    v_take := (v_protection ->> 'take')::uuid;
    if not v_overridden then
      v_give := public.roster_publication_replacement(p_service_id, v_give, (v_result ->> 'publicationId')::uuid, v_from, v_to);
      v_take := public.roster_publication_replacement(p_service_id, v_take, (v_result ->> 'publicationId')::uuid, v_from, v_to);
    end if;
    if v_protection ->> 'kind' = 'swap' then
      insert into public.roster_publication_protections(service_id, swap_id, give_assignment_id, take_assignment_id, overridden_at, updated_by)
      values (p_service_id, (v_protection ->> 'id')::uuid, v_give, v_take, case when v_overridden then now() end, p_actor_id)
      on conflict (swap_id) do update set give_assignment_id = excluded.give_assignment_id,
        take_assignment_id = excluded.take_assignment_id, overridden_at = excluded.overridden_at, updated_by = excluded.updated_by;
    else
      insert into public.roster_publication_protections(service_id, open_shift_id, give_assignment_id, overridden_at, updated_by)
      values (p_service_id, (v_protection ->> 'id')::uuid, v_give, case when v_overridden then now() end, p_actor_id)
      on conflict (open_shift_id) do update set give_assignment_id = excluded.give_assignment_id,
        overridden_at = excluded.overridden_at, updated_by = excluded.updated_by;
    end if;
  end loop;
  -- Reuse unchanged open gaps on re-upload, counting repeated identical vacancies separately.
  -- A metadata change is not new capacity: incompatible same-slot vacancies conflict.
  -- An active claim/report cannot be duplicated even with different grade/urgency.
  for v_row in select value from jsonb_array_elements(v_open_rows) loop
    if exists (select 1 from public.roster_open_shifts o where o.service_id = p_service_id
      and o.assignment_id is null and o.status in ('claimed', 'reported')
      and o.starts_at = (v_row ->> 'startsAt')::timestamptz and o.ends_at = (v_row ->> 'endsAt')::timestamptz
      and o.site_id is not distinct from (v_row ->> 'siteId')::uuid
      and o.kind = v_row ->> 'kind' and o.shift_code = btrim(v_row ->> 'shiftCode')) then raise exception 'roster_conflict'; end if;
    if exists (select 1 from public.roster_open_shifts o where o.service_id = p_service_id
      and o.assignment_id is null and o.status = 'open'
      and o.starts_at = (v_row ->> 'startsAt')::timestamptz and o.ends_at = (v_row ->> 'endsAt')::timestamptz
      and o.site_id is not distinct from (v_row ->> 'siteId')::uuid
      and o.kind = v_row ->> 'kind' and o.shift_code = btrim(v_row ->> 'shiftCode')
      and (o.min_grade is distinct from v_row ->> 'minGrade'
        or o.urgent <> coalesce((v_row ->> 'urgent')::boolean, false))) then raise exception 'roster_conflict'; end if;
    select o.id into v_open_id from public.roster_open_shifts o where o.service_id = p_service_id
      and o.assignment_id is null and o.status = 'open' and not (o.id = any(v_open_ids))
      and o.starts_at = (v_row ->> 'startsAt')::timestamptz and o.ends_at = (v_row ->> 'endsAt')::timestamptz
      and o.site_id is not distinct from (v_row ->> 'siteId')::uuid
      and o.kind = v_row ->> 'kind' and o.shift_code = btrim(v_row ->> 'shiftCode')
      and o.min_grade is not distinct from v_row ->> 'minGrade'
      and o.urgent = coalesce((v_row ->> 'urgent')::boolean, false) order by o.id limit 1;
    if v_open_id is null then
      v_open_id := (public.roster_command(p_actor_id, p_service_id, 'open.post', v_row) ->> 'openShiftId')::uuid;
    end if;
    v_open_ids := array_append(v_open_ids, v_open_id);
  end loop;
  with old_rows as (
    select (x ->> 'user_id')::uuid as user_id,
      jsonb_build_array(x -> 'starts_at', x -> 'ends_at', x -> 'shift_code', x -> 'kind', x -> 'site_id', x -> 'grade') as row_value
    from jsonb_array_elements(v_before) x where x ->> 'user_id' is not null
  ), new_rows as (
    select a.user_id, jsonb_build_array(to_jsonb(a.starts_at), to_jsonb(a.ends_at), to_jsonb(a.shift_code),
      to_jsonb(a.kind), to_jsonb(a.site_id), to_jsonb(a.grade)) as row_value
    from public.roster_assignments a where a.publication_id = (v_result ->> 'publicationId')::uuid and a.user_id is not null
  ), differences as (
    (select * from old_rows except all select * from new_rows)
    union all
    (select * from new_rows except all select * from old_rows)
  )
  select coalesce(jsonb_agg(user_id order by user_id), '[]') into v_changed from (select distinct user_id from differences) changed;
  return v_result || jsonb_build_object('changedUserIds', v_changed, 'openShiftIds', to_jsonb(v_open_ids),
    'overridesRecorded', v_overrides);
end $$;

revoke all on function public.roster_publish_fingerprint(uuid, date, date) from public, anon, authenticated;
grant execute on function public.roster_publish_fingerprint(uuid, date, date) to service_role;
revoke all on function public.roster_lock_manager(uuid, uuid) from public, anon, authenticated;
grant execute on function public.roster_lock_manager(uuid, uuid) to service_role;
revoke all on function public.roster_set_cutoff(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.roster_set_cutoff(uuid, uuid, date) to service_role;
revoke all on function public.roster_publish_preview(uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.roster_publish_preview(uuid, uuid, date, date) to service_role;
revoke all on function public.roster_publish(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.roster_publish(uuid, uuid, text, jsonb) to service_role;

revoke all on function public.roster_publication_replacement(uuid, uuid, uuid, date, date) from public, anon, authenticated;
grant execute on function public.roster_publication_replacement(uuid, uuid, uuid, date, date) to service_role;
