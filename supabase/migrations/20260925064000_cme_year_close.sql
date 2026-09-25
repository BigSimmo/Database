-- CME year close: an immutable snapshot, dated amendments with a reason, and a shortfall note.
--
-- Design: docs/cme/design/cme-design-decisions.md section 9 (owner decision 23 September 2026).
-- Closing does not lock the record irreversibly. It freezes a snapshot of the year as it stood,
-- and every later change to one of that year's activities is an explicit, dated amendment that
-- keeps the original beside the revision. `cme_years.closed_at` and `cme_years.shortfall_note`
-- already exist (20260920145148); until now nothing could set them.
--
-- Tenancy is the same as every other CME table: RLS on, no grant to anon/authenticated,
-- service_role only, owner predicate on every statement. Functions are security invoker.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table public.cme_year_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  year_id uuid not null unique,
  closed_at timestamptz not null default now(),
  shortfall_note text check (shortfall_note is null or char_length(btrim(shortfall_note)) between 1 and 2000),
  -- Built by the database from the rows themselves at the moment of closing: the confirmed
  -- targets, every requirement and every active activity with its allocations.
  record jsonb not null,
  -- The application's reading of that record (requirement statuses and summaries), checked
  -- against the database's own total and activity count before it is accepted.
  evaluation jsonb not null,
  total_hours numeric(8, 2) not null,
  target_hours numeric(6, 2) not null,
  -- No direct reference to auth.users: removal follows the year row, so deleting an
  -- account cascades here only after the year itself is gone.
  constraint cme_year_snapshots_year_owner_fk foreign key (year_id, owner_id)
    references public.cme_years (id, owner_id) on delete cascade
);

create table public.cme_year_amendments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  year_id uuid not null,
  entry_id uuid not null,
  amended_at timestamptz not null default now(),
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  before jsonb not null,
  after jsonb not null,
  constraint cme_year_amendments_year_owner_fk foreign key (year_id, owner_id)
    references public.cme_years (id, owner_id) on delete cascade,
  constraint cme_year_amendments_entry_owner_fk foreign key (entry_id, owner_id)
    references public.cme_entries (id, owner_id) on delete cascade
);
create index cme_year_amendments_owner_year_idx on public.cme_year_amendments (owner_id, year_id, amended_at);
create index cme_year_amendments_entry_idx on public.cme_year_amendments (entry_id, owner_id);

do $$
declare
  t text;
begin
  foreach t in array array['cme_year_snapshots', 'cme_year_amendments']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    -- Written once and never edited: no update or delete grant, even to the server.
    execute format('grant select, insert on table public.%I to service_role', t);
    execute format(
      'create policy "%s service role all" on public.%I for all to service_role using (true) with check (true)',
      t, t
    );
  end loop;
end
$$;

-- The snapshot and the amendment history are append-only. A delete is allowed only when the
-- year it belongs to is already gone (an account deletion cascading through cme_years).
create function public.cme_guard_close_record() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if tg_op = 'UPDATE' then raise exception 'cme_record_immutable'; end if;
  if exists(select 1 from public.cme_years where id = old.year_id and owner_id = old.owner_id) then
    raise exception 'cme_record_immutable';
  end if;
  return old;
end $$;
create trigger cme_year_snapshots_immutable before update or delete on public.cme_year_snapshots
  for each row execute function public.cme_guard_close_record();
create trigger cme_year_amendments_immutable before update or delete on public.cme_year_amendments
  for each row execute function public.cme_guard_close_record();

-- A year is closed only through cme_close_year, which writes its snapshot first in the same
-- transaction; once closed, nothing on the row changes and closed_at can never be cleared.
create function public.cme_guard_year() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.closed_at is not null then
    if new.closed_at is distinct from old.closed_at
      or new.shortfall_note is distinct from old.shortfall_note
      or new.total_hours is distinct from old.total_hours
      or new.confirmed_on is distinct from old.confirmed_on
      or new.confirmed_source is distinct from old.confirmed_source
      or new.year is distinct from old.year
      or new.owner_id is distinct from old.owner_id then
      raise exception 'cme_year_closed';
    end if;
    return new;
  end if;
  if new.closed_at is not null and not exists(
    select 1 from public.cme_year_snapshots
    where year_id = new.id and owner_id = new.owner_id and closed_at = new.closed_at
  ) then
    raise exception 'cme_year_close_requires_snapshot';
  end if;
  if new.closed_at is null and new.shortfall_note is not null then raise exception 'cme_invalid_request'; end if;
  return new;
end $$;
create trigger cme_year_close_guard before insert or update on public.cme_years
  for each row execute function public.cme_guard_year();

-- Requirements of a closed year are frozen. (cme_confirm_year already refuses a closed year;
-- this also covers any other writer.) A cascade from a deleted year finds no year and passes.
create function public.cme_guard_requirement() returns trigger
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
create trigger cme_requirement_closed_year_guard before insert or update or delete on public.cme_requirements
  for each row execute function public.cme_guard_requirement();

-- True only while cme_amend_closed_entry is running for this entry: the amendment row is
-- written first, and now() is the transaction's start time, so a matching row proves the
-- change being made is the one that amendment records.
create function public.cme_entry_amendment_in_progress(p_entry_id uuid, p_owner_id uuid) returns boolean
language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select exists(
    select 1 from public.cme_year_amendments
    where entry_id = p_entry_id and owner_id = p_owner_id and amended_at = now()
  )
$$;

-- Replaces 20260922163920's guard: identical, except that an update recorded as an amendment
-- in the same transaction may change an activity in a closed year. It still may not move the
-- activity to another year, and a closed-year activity still cannot be deleted.
create or replace function public.cme_guard_entry() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_year public.cme_years; v_amending boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_amending := new.year_id = old.year_id and public.cme_entry_amendment_in_progress(old.id, old.owner_id);
  end if;
  if tg_op <> 'INSERT' then
    select * into v_year from public.cme_years where id=old.year_id and owner_id=old.owner_id for update;
    if v_year.closed_at is not null and not v_amending then raise exception 'cme_year_closed'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  select * into v_year from public.cme_years where id=new.year_id and owner_id=new.owner_id for update;
  if not found or extract(year from new.activity_date)<>v_year.year then raise exception 'cme_invalid_request'; end if;
  if v_year.closed_at is not null and not v_amending then raise exception 'cme_year_closed'; end if;
  if new.document_id is not null and not exists(select 1 from public.documents where id=new.document_id and owner_id=new.owner_id) then raise exception 'cme_invalid_link'; end if;
  return new;
end $$;

-- Allocations had no closed-year guard of their own; every writer went through cme_save_entry.
create function public.cme_guard_allocation() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_entry_id uuid; v_owner_id uuid;
begin
  if tg_op = 'DELETE' then v_entry_id := old.entry_id; v_owner_id := old.owner_id;
  else v_entry_id := new.entry_id; v_owner_id := new.owner_id; end if;
  if exists(
    select 1 from public.cme_entries e join public.cme_years y on y.id = e.year_id and y.owner_id = e.owner_id
    where e.id = v_entry_id and e.owner_id = v_owner_id and y.closed_at is not null
  ) and not public.cme_entry_amendment_in_progress(v_entry_id, v_owner_id) then
    raise exception 'cme_year_closed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger cme_allocation_closed_year_guard before insert or update or delete on public.cme_allocations
  for each row execute function public.cme_guard_allocation();

-- Close one CPD year. The record is read from the rows under the owner lock; the caller's
-- evaluation must agree with it on total hours and activity count, or nothing is written.
create function public.cme_close_year(p_owner_id uuid, p_year_id uuid, p_evaluation jsonb, p_shortfall_note text default null)
returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_year public.cme_years; v_snapshot public.cme_year_snapshots; v_record jsonb;
  v_total numeric; v_count integer; v_note text := nullif(btrim(coalesce(p_shortfall_note, '')), '');
begin
  if p_owner_id is null or p_year_id is null or jsonb_typeof(p_evaluation) is distinct from 'object' then
    raise exception 'cme_invalid_request';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then raise exception 'cme_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  select * into v_year from public.cme_years where owner_id=p_owner_id and id=p_year_id for update;
  if not found then raise exception 'cme_year_not_confirmed'; end if;
  if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;

  select count(*), coalesce(sum(a.hours), 0) into v_count, v_total
  from public.cme_entries e
  left join lateral (
    select sum(hours) as hours from public.cme_allocations where owner_id=p_owner_id and entry_id=e.id
  ) a on true
  where e.owner_id=p_owner_id and e.year_id=p_year_id and e.archived_at is null;
  if round(v_total, 2) is distinct from round((p_evaluation->>'totalHours')::numeric, 2)
    or v_count is distinct from (p_evaluation->>'entryCount')::integer then
    raise exception 'cme_close_conflict';
  end if;

  v_record := jsonb_build_object(
    'year', v_year.year,
    'totalHours', v_year.total_hours,
    'confirmedOn', v_year.confirmed_on,
    'confirmedSource', v_year.confirmed_source,
    'requirements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'label', r.label, 'source', r.source, 'spec', r.spec, 'completedOn', r.completed_on
      ) order by r.sort_order, r.id), '[]'::jsonb)
      from public.cme_requirements r where r.owner_id=p_owner_id and r.year_id=p_year_id
    ),
    'entries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id, 'date', e.activity_date, 'title', e.title, 'reflection', e.reflection,
        'costCents', e.cost_cents, 'routineId', e.routine_id, 'documentId', e.document_id,
        'sourceUrl', e.source_url, 'buckets', to_jsonb(e.buckets),
        'formalPeerReviewHours', e.formal_peer_review_hours,
        'allocations', (
          select coalesce(jsonb_agg(jsonb_build_object('category', a.category, 'hours', a.hours) order by a.category), '[]'::jsonb)
          from public.cme_allocations a where a.owner_id=p_owner_id and a.entry_id=e.id
        )
      ) order by e.activity_date, e.id), '[]'::jsonb)
      from public.cme_entries e where e.owner_id=p_owner_id and e.year_id=p_year_id and e.archived_at is null
    )
  );

  insert into public.cme_year_snapshots(owner_id, year_id, shortfall_note, record, evaluation, total_hours, target_hours)
  values (p_owner_id, p_year_id, v_note, v_record, p_evaluation, round(v_total, 2), v_year.total_hours)
  returning * into v_snapshot;
  update public.cme_years set closed_at = v_snapshot.closed_at, shortfall_note = v_note
  where owner_id=p_owner_id and id=p_year_id;
  return to_jsonb(v_snapshot);
end $$;

-- Amend one activity in a closed year. The previous version and the reason are recorded
-- first; the snapshot is never touched. Same validation as cme_save_entry, and the activity
-- stays in its year.
create function public.cme_amend_closed_entry(p_owner_id uuid, p_entry_id uuid, p_entry jsonb, p_reason text)
returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_year public.cme_years; v_existing public.cme_entries; v_saved public.cme_entries; v_routine public.cme_routines;
  v_alloc jsonb; v_review numeric; v_total numeric; v_count integer; v_before jsonb;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if p_owner_id is null or p_entry_id is null or jsonb_typeof(p_entry) is distinct from 'object' then
    raise exception 'cme_invalid_request';
  end if;
  if char_length(v_reason) not between 3 and 1000 then raise exception 'cme_amendment_reason_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  select * into v_existing from public.cme_entries where owner_id=p_owner_id and id=p_entry_id for update;
  if not found then raise exception 'cme_entry_not_found'; end if;
  if v_existing.archived_at is not null then raise exception 'cme_entry_archived'; end if;
  select * into v_year from public.cme_years where owner_id=p_owner_id and id=v_existing.year_id for update;
  if not found then raise exception 'cme_year_not_confirmed'; end if;
  if v_year.closed_at is null then raise exception 'cme_year_open'; end if;
  if extract(year from (p_entry->>'date')::date) <> v_year.year then raise exception 'cme_invalid_request'; end if;
  if jsonb_typeof(p_entry->'allocations') is distinct from 'array' then raise exception 'cme_invalid_request'; end if;
  select count(*),coalesce(sum((a->>'hours')::numeric),0),coalesce(sum((a->>'hours')::numeric) filter(where a->>'category'='reviewing'),0)
    into v_count,v_total,v_review from jsonb_array_elements(p_entry->'allocations') a;
  if v_count not between 1 and 3 or v_total > 24 or coalesce((p_entry->>'formalPeerReviewHours')::numeric,0) not between 0 and v_review then raise exception 'cme_invalid_request'; end if;
  if p_entry->>'documentId' is not null and not exists(select 1 from public.documents where owner_id=p_owner_id and id=(p_entry->>'documentId')::uuid) then raise exception 'cme_invalid_link'; end if;
  if p_entry->>'routineId' is not null then
    select * into v_routine from public.cme_routines where owner_id=p_owner_id and id=(p_entry->>'routineId')::uuid;
    if not found then raise exception 'cme_invalid_link'; end if;
  end if;

  v_before := jsonb_build_object(
    'date', v_existing.activity_date, 'title', v_existing.title, 'reflection', v_existing.reflection,
    'costCents', v_existing.cost_cents, 'routineId', v_existing.routine_id, 'documentId', v_existing.document_id,
    'sourceUrl', v_existing.source_url, 'buckets', to_jsonb(v_existing.buckets),
    'formalPeerReviewHours', v_existing.formal_peer_review_hours,
    'allocations', (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'hours', hours) order by category), '[]'::jsonb)
      from public.cme_allocations where owner_id=p_owner_id and entry_id=p_entry_id
    )
  );
  insert into public.cme_year_amendments(owner_id, year_id, entry_id, reason, before, after)
  values (
    p_owner_id, v_year.id, p_entry_id, v_reason, v_before,
    jsonb_build_object(
      'date', p_entry->'date', 'title', p_entry->'title', 'reflection', p_entry->'reflection',
      'costCents', p_entry->'costCents', 'routineId', p_entry->'routineId', 'documentId', p_entry->'documentId',
      'sourceUrl', p_entry->'sourceUrl', 'buckets', p_entry->'buckets',
      'formalPeerReviewHours', coalesce(p_entry->'formalPeerReviewHours', '0'::jsonb),
      'allocations', p_entry->'allocations'
    )
  );

  update public.cme_entries set activity_date=(p_entry->>'date')::date,title=p_entry->>'title',reflection=p_entry->>'reflection',cost_cents=(p_entry->>'costCents')::integer,routine_id=(p_entry->>'routineId')::uuid,document_id=(p_entry->>'documentId')::uuid,buckets=array(select jsonb_array_elements_text(p_entry->'buckets')),formal_peer_review_hours=coalesce((p_entry->>'formalPeerReviewHours')::numeric,0),source_url=p_entry->>'sourceUrl'
  where owner_id=p_owner_id and id=p_entry_id returning * into v_saved;
  delete from public.cme_allocations where owner_id=p_owner_id and entry_id=p_entry_id;
  for v_alloc in select value from jsonb_array_elements(p_entry->'allocations') loop
    insert into public.cme_allocations(owner_id,entry_id,category,hours) values(p_owner_id,p_entry_id,v_alloc->>'category',(v_alloc->>'hours')::numeric);
  end loop;
  return to_jsonb(v_saved)||jsonb_build_object('cme_allocations',p_entry->'allocations');
end $$;

revoke all on function
  public.cme_guard_close_record(), public.cme_guard_year(), public.cme_guard_requirement(),
  public.cme_entry_amendment_in_progress(uuid, uuid), public.cme_guard_allocation(),
  public.cme_close_year(uuid, uuid, jsonb, text), public.cme_amend_closed_entry(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function
  public.cme_guard_close_record(), public.cme_guard_year(), public.cme_guard_requirement(),
  public.cme_entry_amendment_in_progress(uuid, uuid), public.cme_guard_allocation(),
  public.cme_close_year(uuid, uuid, jsonb, text), public.cme_amend_closed_entry(uuid, uuid, jsonb, text)
  to service_role;
