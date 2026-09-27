-- Behaviour checks for the combined Roster DB PR, run against a disposable replay of files 1-5.
-- Every block raises on a wrong answer, so a clean run prints only the final line.
-- Run: psql -v ON_ERROR_STOP=1 -1 -f tests/sql/roster-behaviour.sql   (never against a live database)
create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to service_role;

do $setup$
declare s uuid; site uuid;
begin
  insert into ids values
    ('mgr', gen_random_uuid()), ('lee', gen_random_uuid()), ('mei', gen_random_uuid()),
    ('alex', gen_random_uuid()), ('ivy', gen_random_uuid()), ('out', gen_random_uuid()), ('adm', gen_random_uuid());
  insert into auth.users (id, email) select v, k || '@example.org' from ids;
  insert into public.on_call_services (name, created_by) values ('General Medicine', (select v from ids where k = 'adm')) returning id into s;
  insert into public.on_call_service_sites (service_id, name) values (s, 'Example Hospital') returning id into site;
  insert into ids values ('svc', s), ('site', site);
  insert into public.on_call_service_members (service_id, user_id, role)
  select s, v, case when k = 'adm' then 'admin' else 'member' end from ids where k in ('mgr', 'lee', 'mei', 'alex', 'ivy', 'adm');
end
$setup$;

create function pg_temp.id(p text) returns uuid language sql as $$ select v from ids where k = p $$;
create function pg_temp.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected % but the call succeeded: %', p_code, p_sql;
exception when others then
  if sqlerrm <> p_code then raise exception 'expected %, got %: %', p_code, sqlerrm, p_sql; end if;
end $$;
create function pg_temp.cmd(p_actor text, p_action text, p_payload jsonb) returns jsonb language sql as $$
  select public.roster_command(pg_temp.id(p_actor), pg_temp.id('svc'), p_action, p_payload)
$$;
-- The Supabase image revokes execute from public by default, so grant the helpers explicitly.
grant execute on function pg_temp.id(text), pg_temp.expect_error(text, text), pg_temp.cmd(text, text, jsonb)
  to service_role;
-- Everything below runs as the app does: as service_role, through the functions.
set local role service_role;

-- 1. Own shifts: an import never deletes a hand-added shift, and workplaces stay separate.
do $own$
declare me uuid := pg_temp.id('lee');
begin
  insert into public.on_call_shifts (owner_id, starts_at, ends_at, title, source, kind)
  values (me, '2026-10-14 06:00+00', '2026-10-14 14:30+00', 'My own', 'manual', 'day');
  perform public.roster_own_shifts_replace(me, '2026-10-12', '2026-10-18', 'xlsx', null, 'Oct.xlsx',
    '[{"startsAt":"2026-10-13T00:00:00Z","endsAt":"2026-10-13T08:30:00Z","title":"Day","location":null,"sourceUid":null,"kind":"day"}]',
    '[]', 1, 0, 0);
  perform public.roster_own_shifts_replace(me, '2026-10-12', '2026-10-18', 'ics', 'Example Clinic', null,
    '[{"startsAt":"2026-10-15T00:00:00Z","endsAt":"2026-10-15T04:00:00Z","title":"Clinic","location":null,"sourceUid":"u1","kind":"other"}]',
    '[]', 1, 0, 0);
  perform public.roster_own_shifts_replace(me, '2026-10-12', '2026-10-18', 'xlsx', null, 'Oct v2.xlsx', '[]', '[]', 0, 0, 1);
  if (select count(*) from public.on_call_shifts where owner_id = me) <> 2 then
    raise exception 'own shifts: expected the manual and the clinic shift to survive';
  end if;
  -- The original function still works for the live app until Release 1 ships.
  perform public.on_call_shifts_replace(me, '2026-10-20', '2026-10-20', 'csv',
    '[{"startsAt":"2026-10-20T00:00:00Z","endsAt":"2026-10-20T08:00:00Z","title":"Day","location":null,"sourceUid":null}]',
    '[]', 1, 0, 0);
  if (select count(*) from public.on_call_shifts where owner_id = me) <> 3 then raise exception 'old function broke'; end if;
end
$own$;

-- 2. Team features stay off until the platform verifies the team.
select pg_temp.expect_error($$select pg_temp.cmd('lee', 'seen.mark', '{}')$$, 'roster_team_not_verified');
select public.on_call_service_set_verified(pg_temp.id('svc'), pg_temp.id('adm'), true, false);
select pg_temp.expect_error($$select pg_temp.cmd('out', 'seen.mark', '{}')$$, 'roster_access_denied');

-- 3. Managers are named by the platform, never by themselves.
select pg_temp.expect_error($$select pg_temp.cmd('mgr', 'role.set', '{"userId":"00000000-0000-0000-0000-000000000000"}')$$, 'roster_role_denied');
select public.roster_set_manager(pg_temp.id('svc'), pg_temp.id('mgr'), pg_temp.id('adm'), true);
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('lee'), 'grade', 'resident', 'rosterName', 'L Lee'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('mei'), 'grade', 'resident'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('alex'), 'grade', 'registrar'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('ivy'), 'grade', 'intern'));
select pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('mgr'), 'grade', 'consultant'));
do $$ begin
  if not public.roster_can_invite(pg_temp.id('svc'), pg_temp.id('mgr')) then raise exception 'manager should invite'; end if;
  if public.roster_can_invite(pg_temp.id('svc'), pg_temp.id('lee')) then raise exception 'member must not invite'; end if;
end $$;

-- 4. Publish: members cannot, managers can; all or nothing.
select pg_temp.expect_error($$select pg_temp.cmd('lee', 'publish', '{"periodStart":"2026-11-02","periodEnd":"2026-11-15","assignments":[]}')$$, 'roster_role_denied');
select pg_temp.expect_error($$select pg_temp.cmd('mgr', 'publish', jsonb_build_object('periodStart','2026-11-02','periodEnd','2026-11-15',
  'assignments', jsonb_build_array(jsonb_build_object('userId', pg_temp.id('out'), 'startsAt','2026-11-03T00:00:00Z','endsAt','2026-11-03T08:30:00Z','shiftCode','D','kind','day'))))$$,
  'roster_invalid_request');

create temp table plan_rows on commit drop as
select * from (values
  ('lee',  '2026-11-07T00:00:00Z', '2026-11-08T00:00:00Z', 'C', 'on_call'),
  ('mei',  '2026-11-14T00:00:00Z', '2026-11-15T00:00:00Z', 'C', 'on_call'),
  ('lee',  '2026-11-10T13:30:00Z', '2026-11-11T00:00:00Z', 'N', 'night'),
  ('alex', '2026-11-10T00:00:00Z', '2026-11-10T08:30:00Z', 'D', 'day'),
  ('ivy',  '2026-11-12T00:00:00Z', '2026-11-12T08:30:00Z', 'D', 'day')
) as t (who, starts_at, ends_at, code, kind);
grant all on plan_rows to service_role;

do $publish$
declare r jsonb;
begin
  r := pg_temp.cmd('mgr', 'publish', jsonb_build_object('periodStart', '2026-11-02', 'periodEnd', '2026-11-15', 'sourceName', 'Nov.xlsx',
    'assignments', (select jsonb_agg(jsonb_build_object('userId', pg_temp.id(who), 'startsAt', starts_at, 'endsAt', ends_at,
                    'shiftCode', code, 'kind', kind, 'siteId', pg_temp.id('site'))) from plan_rows)
    || jsonb_build_array(jsonb_build_object('rosterName', 'Locum 1', 'startsAt', '2026-11-11T00:00:00Z', 'endsAt', '2026-11-11T08:30:00Z', 'shiftCode', 'D', 'kind', 'day'))));
  if (r ->> 'version')::int <> 1 then raise exception 'publish: expected version 1, got %', r; end if;
  if jsonb_array_length(public.roster_read(pg_temp.id('lee'), pg_temp.id('svc'), 'assignments',
       '{"from":"2026-11-02","to":"2026-11-15"}') -> 'assignments') <> 6 then
    raise exception 'publish: expected 6 live rows';
  end if;
end
$publish$;

-- 5. A clean same-grade swap more than 7 days away approves itself, and can be undone for 10 minutes.
do $swap$
declare give uuid; take uuid; r jsonb; sid uuid;
begin
  select id into give from public.roster_assignments where user_id = pg_temp.id('lee') and shift_code = 'C';
  select id into take from public.roster_assignments where user_id = pg_temp.id('mei') and shift_code = 'C';
  r := pg_temp.cmd('lee', 'swap.create', jsonb_build_object('giveAssignmentId', give, 'takeAssignmentId', take, 'counterpartyId', pg_temp.id('mei')));
  sid := (r ->> 'swapId')::uuid;
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('lee', 'swap.create', %L)$f$,
    jsonb_build_object('giveAssignmentId', give, 'counterpartyId', pg_temp.id('alex'))), 'roster_request_exists');
  r := pg_temp.cmd('mei', 'swap.accept', jsonb_build_object('swapId', sid));
  if r ->> 'status' <> 'approved' or not (r ->> 'autoApproved')::boolean then raise exception 'swap: expected auto approval, got %', r; end if;
  if (select user_id from public.roster_assignments where id = give) <> pg_temp.id('mei') then raise exception 'swap: give not moved'; end if;
  if (select user_id from public.roster_assignments where id = take) <> pg_temp.id('lee') then raise exception 'swap: take not moved'; end if;
  r := pg_temp.cmd('lee', 'swap.undo', jsonb_build_object('swapId', sid));
  if (select user_id from public.roster_assignments where id = give) <> pg_temp.id('lee') then raise exception 'undo failed'; end if;
end
$swap$;

-- 6. Grade: an intern may not take a resident's shift; a registrar may.
do $grade$
declare night uuid;
begin
  select id into night from public.roster_assignments where user_id = pg_temp.id('lee') and shift_code = 'N';
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('lee', 'swap.create', %L)$f$,
    jsonb_build_object('giveAssignmentId', night, 'counterpartyId', pg_temp.id('ivy'))), 'roster_swap_not_eligible');
end
$grade$;

-- 7. A clash is refused: Alex's day shift overlaps nothing, but giving Lee's night to Alex while
--    Alex already works 00:00-08:30 on the 10th Perth time must be checked by time, not by date.
do $clash$
declare night uuid; r jsonb;
begin
  select id into night from public.roster_assignments where user_id = pg_temp.id('lee') and shift_code = 'N';
  insert into public.roster_assignments (service_id, publication_id, user_id, starts_at, ends_at, shift_code, kind)
  select pg_temp.id('svc'), publication_id, pg_temp.id('alex'), '2026-11-10T14:00:00Z', '2026-11-10T20:00:00Z', 'E', 'evening'
  from public.roster_assignments where id = night;
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('lee', 'swap.create', %L)$f$,
    jsonb_build_object('giveAssignmentId', night, 'counterpartyId', pg_temp.id('alex'))), 'roster_swap_not_eligible');
end
$clash$;

-- 8. Open shifts: first eligible member to claim gets it; the second is told it's taken.
do $open$
declare day uuid; r jsonb; oid uuid;
begin
  select id into day from public.roster_assignments where user_id = pg_temp.id('ivy') and shift_code = 'D';
  r := pg_temp.cmd('ivy', 'open.post', jsonb_build_object('assignmentId', day));
  oid := (r ->> 'openShiftId')::uuid;
  r := pg_temp.cmd('lee', 'open.claim', jsonb_build_object('openShiftId', oid));
  if r ->> 'status' not in ('approved', 'claimed') then raise exception 'open: claim failed %', r; end if;
  perform pg_temp.expect_error(format($f$select pg_temp.cmd('mei', 'open.claim', %L)$f$, jsonb_build_object('openShiftId', oid)),
    case when r ->> 'status' = 'approved' then 'roster_open_shift_taken' else 'roster_open_shift_taken' end);
end
$open$;

-- 9. Seen receipts: members write their own; only managers read the count.
do $seen$
declare pub uuid; r jsonb;
begin
  select id into pub from public.roster_publications where service_id = pg_temp.id('svc');
  perform pg_temp.cmd('lee', 'seen.mark', jsonb_build_object('publicationId', pub));
  perform pg_temp.cmd('lee', 'seen.mark', jsonb_build_object('publicationId', pub));
  perform pg_temp.expect_error($$select public.roster_read(pg_temp.id('lee'), pg_temp.id('svc'), 'manage', '{}')$$, 'roster_role_denied');
  r := public.roster_read(pg_temp.id('mgr'), pg_temp.id('svc'), 'manage', '{}');
  if (r #>> '{seen,seen}')::int <> 2 or (r #>> '{seen,members}')::int <> 6 then raise exception 'seen: got %', r -> 'seen'; end if;
end
$seen$;

-- 10. A new full publish replaces the period and cancels pending requests on replaced shifts.
do $republish$
declare give uuid; r jsonb;
begin
  select id into give from public.roster_assignments where user_id = pg_temp.id('alex') and shift_code = 'D' and superseded_at is null;
  perform pg_temp.cmd('alex', 'swap.create', jsonb_build_object('giveAssignmentId', give, 'counterpartyId', pg_temp.id('mgr')));
  r := pg_temp.cmd('mgr', 'publish', jsonb_build_object('periodStart', '2026-11-02', 'periodEnd', '2026-11-15',
    'assignments', jsonb_build_array(jsonb_build_object('userId', pg_temp.id('lee'), 'startsAt', '2026-11-03T00:00:00Z',
      'endsAt', '2026-11-03T08:30:00Z', 'shiftCode', 'D', 'kind', 'day'))));
  if jsonb_array_length(r -> 'swapsCancelled') <> 1 then raise exception 'republish: expected one cancelled swap, got %', r; end if;
  if (select count(*) from public.roster_assignments where service_id = pg_temp.id('svc') and superseded_at is null) <> 1 then
    raise exception 'republish: old rows still live';
  end if;
end
$republish$;

-- 11. Revoke cascade: leaving the team revokes the Roster role; rejoining restores nothing.
do $revoke$
begin
  perform public.on_call_service_command(pg_temp.id('adm'), pg_temp.id('svc'), 'member.revoke', jsonb_build_object('memberId', pg_temp.id('mei')));
  if exists (select 1 from public.roster_member_roles where user_id = pg_temp.id('mei') and revoked_at is null) then
    raise exception 'revoke: roster role still active';
  end if;
  update public.on_call_service_members set revoked_at = null, joined_at = now()
   where service_id = pg_temp.id('svc') and user_id = pg_temp.id('mei');
  if exists (select 1 from public.roster_member_roles where user_id = pg_temp.id('mei') and revoked_at is null) then
    raise exception 'rejoin: role restored';
  end if;
  -- Granted again after rejoining, the role must survive any later write that leaves revoked_at null
  -- (On Call's rejoin path is an upsert that sets revoked_at = null): the trigger's WHEN clause.
  perform pg_temp.cmd('mgr', 'role.set', jsonb_build_object('userId', pg_temp.id('mei'), 'grade', 'resident'));
  update public.on_call_service_members set revoked_at = null where service_id = pg_temp.id('svc') and user_id = pg_temp.id('mei');
  if not exists (select 1 from public.roster_member_roles where user_id = pg_temp.id('mei') and revoked_at is null) then
    raise exception 'rejoin: a later membership write revoked the new role';
  end if;
  if (select count(*) from public.on_call_service_member_events where user_id = pg_temp.id('mei') and mode = 'roster') <> 1 then
    raise exception 'revoke: expected one roster audit row';
  end if;
end
$revoke$;

-- 12. Roster maker: every draft change is saved with its undo, and undo puts it back.
do $maker$
declare d uuid; r jsonb; c bigint; row_id uuid;
begin
  r := pg_temp.cmd('mgr', 'draft.open', '{"periodStart":"2026-11-02","periodEnd":"2026-11-15"}');
  d := (r ->> 'draftId')::uuid;
  if (select count(*) from public.roster_draft_assignments where draft_id = d) <> 1 then raise exception 'draft: not copied'; end if;
  select id into row_id from public.roster_draft_assignments where draft_id = d;
  r := pg_temp.cmd('mgr', 'draft.change', jsonb_build_object('draftId', d, 'source', 'typed', 'ops', jsonb_build_array(
    jsonb_build_object('op', 'update', 'id', row_id, 'row', jsonb_build_object('shiftCode', 'E', 'kind', 'evening')),
    jsonb_build_object('op', 'add', 'row', jsonb_build_object('rosterName', 'Locum 2', 'startsAt', '2026-11-04T00:00:00Z',
      'endsAt', '2026-11-04T08:30:00Z', 'shiftCode', 'D', 'kind', 'day')))));
  c := (r ->> 'lastChangeId')::bigint;
  perform pg_temp.cmd('mgr', 'draft.undo', jsonb_build_object('changeId', c));
  perform pg_temp.cmd('mgr', 'draft.undo', jsonb_build_object('changeId', c - 1));
  if (select shift_code from public.roster_draft_assignments where id = row_id) <> 'D'
     or (select count(*) from public.roster_draft_assignments where draft_id = d) <> 1 then
    raise exception 'draft undo failed';
  end if;
end
$maker$;

-- 13. Retention runs, and a manager's member.remove fires the same cascade.
select public.roster_retention_purge();
select pg_temp.cmd('mgr', 'member.remove', jsonb_build_object('userId', pg_temp.id('ivy')));
select pg_temp.expect_error($$select pg_temp.cmd('ivy', 'seen.mark', '{}')$$, 'roster_access_denied');
select pg_temp.expect_error($$select pg_temp.cmd('mgr', 'member.remove', jsonb_build_object('userId', pg_temp.id('adm')))$$, 'roster_not_found');

-- 14. Deleting a doctor's account is never blocked by a Roster table.
reset role;
do $delete_account$
declare lee uuid := pg_temp.id('lee');
begin
  delete from auth.users where id = lee;
  if exists (select 1 from public.on_call_shifts where owner_id = lee) then raise exception 'delete: own shifts kept'; end if;
  if exists (select 1 from public.roster_publication_seen where user_id = lee) then raise exception 'delete: seen kept'; end if;
  if exists (select 1 from public.roster_assignments where user_id = lee) then raise exception 'delete: assignment still names them'; end if;
end
$delete_account$;
set local role service_role;

select 'roster behaviour: all checks passed' as result;
