-- Local scratch database only. Run with psql -X -v ON_ERROR_STOP=1 -1.
-- Synthetic fixtures and all writes roll back, including on a failed assertion.
create temp table draft_test_ids (key text primary key, id uuid) on commit drop;
insert into draft_test_ids select key, gen_random_uuid()
from unnest(array['manager', 'second', 'doctor', 'outsider', 'team', 'other_team']) key;
create function pg_temp.draft_id(key text) returns uuid language sql as $$
  select id from draft_test_ids where draft_test_ids.key = $1
$$;
insert into auth.users(id, email)
select id, key || '-draft-test@example.org' from draft_test_ids
where key in ('manager', 'second', 'doctor', 'outsider');
insert into public.on_call_services(id, name, created_by, is_demo)
values (pg_temp.draft_id('team'), 'Synthetic draft team', pg_temp.draft_id('manager'), true),
       (pg_temp.draft_id('other_team'), 'Synthetic other team', pg_temp.draft_id('outsider'), true);
insert into public.on_call_service_members(service_id, user_id, role)
select pg_temp.draft_id('team'), id, 'member' from draft_test_ids
where key in ('manager', 'second', 'doctor');
grant select on draft_test_ids to service_role;
grant execute on function pg_temp.draft_id(text) to service_role;
set local role service_role;
select public.roster_set_manager(pg_temp.draft_id('team'), pg_temp.draft_id('manager'), pg_temp.draft_id('manager'), true);
select public.roster_set_manager(pg_temp.draft_id('team'), pg_temp.draft_id('second'), pg_temp.draft_id('manager'), true);

create function pg_temp.draft_command(actor text, action text, payload jsonb) returns jsonb language sql as $$
  select public.roster_command(pg_temp.draft_id(actor), pg_temp.draft_id('team'), action, payload)
$$;
create function pg_temp.draft_error(command text, expected text) returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected refusal %, but command succeeded', expected;
exception when others then
  if sqlerrm <> expected then raise exception 'Expected %, got %', expected, sqlerrm; end if;
end $$;

do $versioned_drafts$
declare
  opened jsonb;
  changed jsonb;
  draft uuid;
  row_id uuid;
  first_change bigint;
  second_change bigint;
  read_result jsonb;
  foreign_draft uuid;
  foreign_row uuid;
  row_data jsonb := jsonb_build_object(
    'userId', pg_temp.draft_id('doctor'), 'rosterName', 'Example Doctor',
    'startsAt', '2026-11-03T00:00:00Z', 'endsAt', '2026-11-03T08:00:00Z',
    'shiftCode', 'D', 'kind', 'day', 'grade', 'resident');
begin
  opened := pg_temp.draft_command('manager', 'draft.open', '{"periodStart":"2026-11-02","periodEnd":"2026-11-08"}');
  draft := (opened->>'draftId')::uuid;
  if (opened->>'version')::bigint is distinct from 1 then
    raise exception 'A new draft must return version 1; got %', opened;
  end if;
  insert into public.roster_drafts(service_id,period_start,period_end)
  values(pg_temp.draft_id('other_team'),'2026-11-02','2026-11-08') returning id into foreign_draft;
  insert into public.roster_draft_assignments(draft_id,starts_at,ends_at,shift_code,kind)
  values(foreign_draft,'2026-11-03T00:00:00Z','2026-11-03T08:00:00Z','D','day') returning id into foreign_row;
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager', 'draft.change', jsonb_build_object('draftId',draft,'source','grid','ops','[]'::jsonb)), 'roster_invalid_request');
  changed := pg_temp.draft_command('manager','draft.change',jsonb_build_object(
    'draftId',draft,'expectedVersion',1,'source','grid',
    'ops',jsonb_build_array(jsonb_build_object('op','add','row',row_data))));
  first_change := (changed->>'lastChangeId')::bigint;
  if (changed->>'version')::bigint is distinct from 2 then raise exception 'Draft change must increment version'; end if;
  select id into strict row_id from public.roster_draft_assignments where draft_id=draft;

  -- A second manager cannot overwrite with a preview of the old version.
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'second','draft.change',jsonb_build_object('draftId',draft,'expectedVersion',1,'source','grid',
      'ops',jsonb_build_array(jsonb_build_object('op','remove','id',row_id)))), 'roster_conflict');
  changed := pg_temp.draft_command('second','draft.change',jsonb_build_object(
    'draftId',draft,'expectedVersion',2,'source','grid',
    'ops',jsonb_build_array(jsonb_build_object('op','update','id',row_id,'row',jsonb_build_object('shiftCode','E')))));
  second_change := (changed->>'lastChangeId')::bigint;
  read_result := public.roster_read(pg_temp.draft_id('manager'),pg_temp.draft_id('team'),'draft',jsonb_build_object('draftId',draft));
  if (read_result#>>'{changes,0,canUndo}')::boolean is distinct from true
     or (read_result#>>'{changes,1,canUndo}')::boolean is distinct from false then
    raise exception 'Read must distinguish eligible undo from stale after-image';
  end if;
  -- Even with the latest draft version, undoing the earlier addition must not erase a later edit.
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.undo',jsonb_build_object('draftId',draft,'changeId',first_change,'expectedVersion',3)), 'roster_conflict');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.undo',jsonb_build_object('draftId',draft,'changeId',second_change,'expectedVersion',2)), 'roster_conflict');
  changed := pg_temp.draft_command('manager','draft.undo',jsonb_build_object(
    'draftId',draft,'changeId',second_change,'expectedVersion',3));
  if (changed->>'version')::bigint is distinct from 4 then raise exception 'Undo must increment version'; end if;
  read_result := public.roster_read(pg_temp.draft_id('manager'),pg_temp.draft_id('team'),'draft',jsonb_build_object('draftId',draft));
  if (read_result#>>'{draft,version}')::bigint is distinct from 4 or not (read_result#>'{assignments,0}' ? 'rosterName') then
    raise exception 'Draft read must expose coherent metadata and camel-case rows';
  end if;
  if (select shift_code from public.roster_draft_assignments where id=row_id) <> 'D' then
    raise exception 'Undo must restore exactly the prior row';
  end if;

  -- A bad later operation must roll back the valid earlier operation in the same batch.
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.change',jsonb_build_object('draftId',draft,'expectedVersion',4,'source','grid',
      'ops',jsonb_build_array(jsonb_build_object('op','remove','id',row_id),
                            jsonb_build_object('op','remove','id',gen_random_uuid())))), 'roster_conflict');
  if not exists(select 1 from public.roster_draft_assignments where id=row_id) then raise exception 'Batch was not atomic'; end if;
  if exists(select 1 from public.roster_assignments where service_id=pg_temp.draft_id('team')) then
    raise exception 'Draft changes must not publish duties';
  end if;
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'doctor','draft.undo',jsonb_build_object('draftId',draft,'changeId',first_change,'expectedVersion',4)), 'roster_role_denied');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'outsider','draft.open',jsonb_build_object('periodStart','2026-11-02','periodEnd','2026-11-08')), 'roster_access_denied');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.change',jsonb_build_object('draftId',draft,'expectedVersion',4,'source','grid',
      'ops',jsonb_build_array(jsonb_build_object('op','update','id',row_id,'row',jsonb_build_object('siteId',gen_random_uuid()))))), 'roster_invalid_request');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.change',jsonb_build_object('draftId',draft,'expectedVersion',4,'source','grid',
      'ops',jsonb_build_array(jsonb_build_object('op','update','id',row_id,'row',jsonb_build_object('userId',pg_temp.draft_id('outsider')))))), 'roster_invalid_request');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.change',jsonb_build_object('draftId',draft,'expectedVersion',4,'source','grid',
      'ops',jsonb_build_array(jsonb_build_object('op','update','id',row_id,'row',jsonb_build_object('startsAt','2026-11-10T00:00:00Z','endsAt','2026-11-10T08:00:00Z'))))), 'roster_invalid_request');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.undo',jsonb_build_object('draftId',gen_random_uuid(),'changeId',first_change,'expectedVersion',4)), 'roster_not_found');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.change',jsonb_build_object('draftId',foreign_draft,'expectedVersion',1,'source','grid',
      'ops',jsonb_build_array(jsonb_build_object('op','remove','id',foreign_row)))), 'roster_not_found');
  perform pg_temp.draft_error(format('select pg_temp.draft_command(%L,%L,%L)',
    'manager','draft.change',jsonb_build_object('draftId',draft,'expectedVersion',4,'source','grid',
      'ops',jsonb_build_array(jsonb_build_object('op','remove','id',foreign_row)))), 'roster_conflict');
  if (select version from public.roster_drafts where id=draft) <> 4 then raise exception 'Refusals changed the version'; end if;

  -- A removed duty remains understandable from trusted history after its row disappears.
  changed := pg_temp.draft_command('manager','draft.change',jsonb_build_object(
    'draftId',draft,'expectedVersion',4,'source','grid',
    'ops',jsonb_build_array(jsonb_build_object('op','remove','id',row_id))));
  read_result := public.roster_read(pg_temp.draft_id('manager'),pg_temp.draft_id('team'),'draft',jsonb_build_object('draftId',draft));
  if read_result -> 'assignments' is distinct from '[]'::jsonb
     or read_result #>> '{changes,0,change,op}' is distinct from 'remove'
     or read_result #>> '{changes,0,change,before,id}' is distinct from row_id::text
     or read_result #>> '{changes,0,change,before,user_id}' is distinct from pg_temp.draft_id('doctor')::text
     or read_result #>> '{changes,0,change,before,roster_name}' is distinct from 'Example Doctor'
     or read_result #>> '{changes,0,change,before,shift_code}' is distinct from 'D'
     or (read_result #>> '{changes,0,change,before,starts_at}')::timestamptz is distinct from '2026-11-03T00:00:00Z'::timestamptz
     or read_result #> '{changes,0,change,after}' is distinct from 'null'::jsonb then
    raise exception 'Removed duty history must retain its trusted before-image without a current row';
  end if;
  perform pg_temp.draft_command('manager','draft.undo',jsonb_build_object(
    'draftId',draft,'expectedVersion',5,'changeId',changed->>'lastChangeId'));
  read_result := public.roster_read(pg_temp.draft_id('manager'),pg_temp.draft_id('team'),'draft',jsonb_build_object('draftId',draft));
  if read_result #>> '{changes,0,undoneAt}' is null
     or (read_result #>> '{changes,0,canUndo}')::boolean is distinct from false
     or read_result #>> '{changes,0,change,before,shift_code}' is distinct from 'D' then
    raise exception 'Undo must preserve the original duty history and mark it undone';
  end if;

  insert into public.roster_changes(service_id,draft_id,target,source,change,actor_id)
  values(pg_temp.draft_id('team'),draft,'draft','grid',jsonb_build_object('op','remove','id',gen_random_uuid()),pg_temp.draft_id('manager'));
  read_result := public.roster_read(pg_temp.draft_id('manager'),pg_temp.draft_id('team'),'draft',jsonb_build_object('draftId',draft));
  if (read_result #> '{changes,0,change}') ? 'before'
     or (read_result #> '{changes,0,change}') ? 'after'
     or (read_result #>> '{changes,0,canUndo}')::boolean is distinct from false then
    raise exception 'Legacy history must not invent snapshots or claim safe undo';
  end if;
end
$versioned_drafts$;
reset role;
set local role authenticated;
do $privileges$
begin
  begin
    perform public.roster_command(null,null,'draft.open','{}');
    raise exception 'Authenticated caller executed roster_command';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.roster_drafts;
    raise exception 'Authenticated caller read drafts directly';
  exception when insufficient_privilege then null;
  end;
end $privileges$;
rollback;
\echo Roster draft versioning: stale edits and unsafe undo refused; batch rollback and live-duty isolation passed.
