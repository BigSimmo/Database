-- My shifts: a doctor's own roster, private to them.
--
-- Two new tables and one function; nothing existing changes. On Call entries are shared
-- between accounts unless marked personal, so a roster must not live there: these rows are
-- only ever read or written for their owner. Only the parsed fields of an imported roster
-- are kept (start, end, title, location, the calendar's own ID); the file itself is never
-- uploaded.
--
-- Same tenancy as the CME and calendar-feed tables: RLS on, no grant to anon/authenticated,
-- service_role only. Every API query filters by owner_id.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.on_call_shifts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  title text not null check (btrim(title) <> '' and char_length(title) <= 200),
  location text check (location is null or char_length(location) <= 200),
  source_uid text check (source_uid is null or char_length(source_uid) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint on_call_shifts_ends_after_start check (ends_at > starts_at),
  constraint on_call_shifts_max_length check (ends_at - starts_at <= interval '36 hours')
);

create index on_call_shifts_owner_starts_idx on public.on_call_shifts (owner_id, starts_at);

create trigger on_call_shifts_updated_at
  before update on public.on_call_shifts
  for each row execute function public.set_updated_at();

alter table public.on_call_shifts enable row level security;
revoke all on table public.on_call_shifts from public, anon, authenticated;
grant select, insert, update, delete on table public.on_call_shifts to service_role;
create policy "on call shifts service role all" on public.on_call_shifts
  for all to service_role using (true) with check (true);

-- One row per roster import: what the file covered and what it changed, so the owner can
-- see "2 added, 1 moved, 1 removed" until they dismiss it.
create table public.on_call_shift_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  imported_at timestamptz not null default now(),
  format text not null check (format in ('ics', 'csv')),
  window_start date not null,
  window_end date not null,
  added integer not null default 0 check (added >= 0),
  changed integer not null default 0 check (changed >= 0),
  removed integer not null default 0 check (removed >= 0),
  changes jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) <= 200),
  seen_at timestamptz,
  constraint on_call_shift_imports_window check (window_end >= window_start)
);

create index on_call_shift_imports_owner_imported_idx on public.on_call_shift_imports (owner_id, imported_at desc);

alter table public.on_call_shift_imports enable row level security;
revoke all on table public.on_call_shift_imports from public, anon, authenticated;
grant select, insert, update, delete on table public.on_call_shift_imports to service_role;
create policy "on call shift imports service role all" on public.on_call_shift_imports
  for all to service_role using (true) with check (true);

-- Replace the owner's shifts inside the imported window and record the import, in one
-- transaction, so a failed save never leaves half a roster. Shifts outside the window stay.
-- Keeps the ten most recent imports per owner.
create function public.on_call_shifts_replace(
  p_owner_id uuid,
  p_window_start date,
  p_window_end date,
  p_format text,
  p_shifts jsonb,
  p_changes jsonb,
  p_added integer,
  p_changed integer,
  p_removed integer
) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_import uuid;
begin
  if p_owner_id is null or p_window_start is null or p_window_end is null
    or p_window_end < p_window_start
    or p_shifts is null or jsonb_typeof(p_shifts) <> 'array' or jsonb_array_length(p_shifts) > 1000
    or p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception 'on_call_shifts_invalid_request';
  end if;

  delete from public.on_call_shifts
  where owner_id = p_owner_id
    and (starts_at at time zone 'Australia/Perth')::date between p_window_start and p_window_end;

  insert into public.on_call_shifts (owner_id, starts_at, ends_at, title, location, source_uid)
  select p_owner_id,
         (shift ->> 'startsAt')::timestamptz,
         (shift ->> 'endsAt')::timestamptz,
         shift ->> 'title',
         nullif(shift ->> 'location', ''),
         nullif(shift ->> 'sourceUid', '')
  from jsonb_array_elements(p_shifts) as shift;

  if (select count(*) from public.on_call_shifts where owner_id = p_owner_id) > 2000 then
    raise exception 'on_call_shifts_limit';
  end if;

  insert into public.on_call_shift_imports
    (owner_id, format, window_start, window_end, added, changed, removed, changes)
  values
    (p_owner_id, p_format, p_window_start, p_window_end, p_added, p_changed, p_removed, p_changes)
  returning id into v_import;

  delete from public.on_call_shift_imports
  where owner_id = p_owner_id
    and id not in (
      select id from public.on_call_shift_imports
      where owner_id = p_owner_id
      order by imported_at desc, id desc
      limit 10
    );

  return v_import;
end $$;
revoke all on function public.on_call_shifts_replace(uuid, date, date, text, jsonb, jsonb, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.on_call_shifts_replace(uuid, date, date, text, jsonb, jsonb, integer, integer, integer)
  to service_role;
