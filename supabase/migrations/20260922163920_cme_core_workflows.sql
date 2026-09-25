-- Prepared locally only. Requires owner-approved deployment; do not apply from a task.
set search_path = public, pg_catalog, pg_temp;
set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.cme_entries add column formal_peer_review_hours numeric(5,2) not null default 0 check (formal_peer_review_hours >= 0);
alter table public.cme_entries add column request_id uuid;
alter table public.cme_entries add column request_payload jsonb;
create unique index cme_entries_owner_request on public.cme_entries(owner_id, request_id) where request_id is not null;
alter table public.cme_years add constraint cme_years_id_owner_unique unique(id, owner_id);
alter table public.cme_entries add constraint cme_entries_id_owner_unique unique(id, owner_id);
alter table public.cme_routines add constraint cme_routines_id_owner_unique unique(id, owner_id);
alter table public.cme_entries add constraint cme_entries_year_owner_fk foreign key(year_id, owner_id) references public.cme_years(id, owner_id) on delete cascade;
alter table public.cme_requirements add constraint cme_requirements_year_owner_fk foreign key(year_id, owner_id) references public.cme_years(id, owner_id) on delete cascade;
alter table public.cme_allocations add constraint cme_allocations_entry_owner_fk foreign key(entry_id, owner_id) references public.cme_entries(id, owner_id) on delete cascade;
alter table public.cme_entries add constraint cme_entries_routine_owner_fk foreign key(routine_id, owner_id) references public.cme_routines(id, owner_id);

-- Serialise mutations for one owner, including competing confirmation/create requests.
-- Caller identity is derived from the authenticated session by server code. These RPCs
-- are invoker functions with no privileges granted to anon/authenticated/public.
create function public.cme_confirm_year(p_owner_id uuid, p_set jsonb) returns uuid
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_year public.cme_years; v_req jsonb; v_id uuid; v_order integer := 0; v_keep uuid[] := '{}';
begin
  if p_owner_id is null or jsonb_typeof(p_set->'requirements') is distinct from 'array' or jsonb_array_length(p_set->'requirements') not between 1 and 30 then raise exception 'cme_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  select * into v_year from public.cme_years where owner_id=p_owner_id and year=(p_set->>'year')::smallint for update;
  if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;
  insert into public.cme_years(owner_id,year,total_hours,confirmed_on,confirmed_source)
  values(p_owner_id,(p_set->>'year')::smallint,(p_set->>'totalHours')::numeric,(p_set->>'confirmedOn')::date,p_set->>'confirmedSource')
  on conflict(owner_id,year) do update set total_hours=excluded.total_hours,confirmed_on=excluded.confirmed_on,confirmed_source=excluded.confirmed_source
  returning * into v_year;
  for v_req in select value from jsonb_array_elements(p_set->'requirements') loop
    v_id := null;
    -- Only reuse identities already owned by this exact year. Stable client names
    -- and foreign UUIDs are safely translated to new server-generated identities.
    select id into v_id from public.cme_requirements where owner_id=p_owner_id and year_id=v_year.id and id::text=v_req->>'id';
    if v_id is null then v_id:=gen_random_uuid(); end if;
    insert into public.cme_requirements(id,owner_id,year_id,label,source,spec,completed_on,sort_order)
    values(v_id,p_owner_id,v_year.id,v_req->>'label',v_req->>'source',v_req->'spec',(v_req->>'completedOn')::date,v_order)
    on conflict(id) do update set label=excluded.label,source=excluded.source,spec=excluded.spec,completed_on=excluded.completed_on,sort_order=excluded.sort_order;
    v_keep:=array_append(v_keep,v_id); v_order:=v_order+1;
  end loop;
  delete from public.cme_requirements where owner_id=p_owner_id and year_id=v_year.id and not(id=any(v_keep));
  return v_year.id;
end $$;

create function public.cme_save_entry(p_owner_id uuid,p_year_id uuid,p_entry_id uuid,p_entry jsonb,p_create boolean,p_request_id uuid default null) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_year public.cme_years; v_existing public.cme_entries; v_saved public.cme_entries;
  v_routine public.cme_routines; v_alloc jsonb; v_review numeric; v_total numeric; v_count integer;
begin
  if p_owner_id is null then raise exception 'cme_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));
  if p_create and p_request_id is not null then
    select * into v_existing from public.cme_entries where owner_id=p_owner_id and request_id=p_request_id;
    if found then
      if v_existing.request_payload is distinct from p_entry then raise exception 'cme_retry_conflict'; end if;
      return to_jsonb(v_existing) || jsonb_build_object('cme_allocations',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'hours',hours)),'[]') from public.cme_allocations where owner_id=p_owner_id and entry_id=v_existing.id));
    end if;
  end if;
  select * into v_year from public.cme_years where owner_id=p_owner_id and id=p_year_id for update;
  if not found then raise exception 'cme_year_not_confirmed'; end if;
  if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;
  if extract(year from (p_entry->>'date')::date) <> v_year.year then raise exception 'cme_invalid_request'; end if;
  if not p_create then
    select * into v_existing from public.cme_entries where owner_id=p_owner_id and id=p_entry_id for update;
    if not found then raise exception 'cme_entry_not_found'; end if;
    if exists(select 1 from public.cme_years where owner_id=p_owner_id and id=v_existing.year_id and closed_at is not null) then raise exception 'cme_year_closed'; end if;
  end if;
  if jsonb_typeof(p_entry->'allocations') is distinct from 'array' then raise exception 'cme_invalid_request'; end if;
  select count(*),coalesce(sum((a->>'hours')::numeric),0),coalesce(sum((a->>'hours')::numeric) filter(where a->>'category'='reviewing'),0)
    into v_count,v_total,v_review from jsonb_array_elements(p_entry->'allocations') a;
  if v_count not between 1 and 3 or v_total > 24 or coalesce((p_entry->>'formalPeerReviewHours')::numeric,0) not between 0 and v_review then raise exception 'cme_invalid_request'; end if;
  if p_entry->>'documentId' is not null and not exists(select 1 from public.documents where owner_id=p_owner_id and id=(p_entry->>'documentId')::uuid) then raise exception 'cme_invalid_link'; end if;
  if p_entry->>'routineId' is not null then
    select * into v_routine from public.cme_routines where owner_id=p_owner_id and id=(p_entry->>'routineId')::uuid for update;
    if not found or (p_create and v_routine.archived_at is not null) then raise exception 'cme_invalid_link'; end if;
  end if;
  if p_create then
    insert into public.cme_entries(id,owner_id,year_id,activity_date,title,reflection,cost_cents,routine_id,document_id,buckets,formal_peer_review_hours,request_id,request_payload)
    values(p_entry_id,p_owner_id,p_year_id,(p_entry->>'date')::date,p_entry->>'title',p_entry->>'reflection',(p_entry->>'costCents')::integer,(p_entry->>'routineId')::uuid,(p_entry->>'documentId')::uuid,array(select jsonb_array_elements_text(p_entry->'buckets')),coalesce((p_entry->>'formalPeerReviewHours')::numeric,0),p_request_id,p_entry)
    returning * into v_saved;
  else
    update public.cme_entries set year_id=p_year_id,activity_date=(p_entry->>'date')::date,title=p_entry->>'title',reflection=p_entry->>'reflection',cost_cents=(p_entry->>'costCents')::integer,routine_id=(p_entry->>'routineId')::uuid,document_id=(p_entry->>'documentId')::uuid,buckets=array(select jsonb_array_elements_text(p_entry->'buckets')),formal_peer_review_hours=coalesce((p_entry->>'formalPeerReviewHours')::numeric,0)
    where owner_id=p_owner_id and id=p_entry_id returning * into v_saved;
    delete from public.cme_allocations where owner_id=p_owner_id and entry_id=p_entry_id;
  end if;
  for v_alloc in select value from jsonb_array_elements(p_entry->'allocations') loop
    insert into public.cme_allocations(owner_id,entry_id,category,hours) values(p_owner_id,p_entry_id,v_alloc->>'category',(v_alloc->>'hours')::numeric);
  end loop;
  -- A routine advances only after the complete entry is saved, in this same
  -- transaction. An idempotent retry returns above and never advances twice.
  if p_create and v_routine.id is not null and v_routine.next_due is not null and v_routine.next_due <= (p_entry->>'date')::date then
    update public.cme_routines set next_due=((p_entry->>'date')::date + case v_routine.cadence when 'weekly' then interval '7 days' when 'monthly' then interval '1 month' else interval '3 months' end)::date where owner_id=p_owner_id and id=v_routine.id;
  end if;
  return to_jsonb(v_saved)||jsonb_build_object('cme_allocations',p_entry->'allocations');
end $$;

-- Guard other existing service-role entry mutations (copy stamp/delete), and
-- ensure stored dates remain in their owner-scoped year. Locking the year also
-- makes concurrent closure and entry mutation serial rather than check-then-write.
create function public.cme_guard_entry() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_year public.cme_years;
begin
  if tg_op <> 'INSERT' then
    select * into v_year from public.cme_years where id=old.year_id and owner_id=old.owner_id for update;
    if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  select * into v_year from public.cme_years where id=new.year_id and owner_id=new.owner_id for update;
  if not found or extract(year from new.activity_date)<>v_year.year then raise exception 'cme_invalid_request'; end if;
  if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;
  if new.document_id is not null and not exists(select 1 from public.documents where id=new.document_id and owner_id=new.owner_id) then raise exception 'cme_invalid_link'; end if;
  return new;
end $$;
create trigger cme_guard_entry before insert or update or delete on public.cme_entries for each row execute function public.cme_guard_entry();

-- Deferred because replacing allocations has an intentionally incomplete
-- intermediate state inside a transaction. Commit cannot persist invalid credit.
create function public.cme_check_entry_allocations() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_id uuid; v_entry public.cme_entries; v_total numeric; v_review numeric; v_count integer;
begin
  if tg_table_name='cme_entries' then v_id:=coalesce(new.id,old.id); else v_id:=coalesce(new.entry_id,old.entry_id); end if;
  select * into v_entry from public.cme_entries where id=v_id;
  if not found then return null; end if;
  select count(*),coalesce(sum(hours),0),coalesce(sum(hours) filter(where category='reviewing'),0) into v_count,v_total,v_review from public.cme_allocations where entry_id=v_id and owner_id=v_entry.owner_id;
  if v_count not between 1 and 3 or v_total>24 or v_entry.formal_peer_review_hours>v_review then raise exception 'cme_invalid_allocations'; end if;
  return null;
end $$;
create constraint trigger cme_entry_allocations_valid after insert or update on public.cme_entries deferrable initially deferred for each row execute function public.cme_check_entry_allocations();
create constraint trigger cme_allocations_valid after insert or update or delete on public.cme_allocations deferrable initially deferred for each row execute function public.cme_check_entry_allocations();

revoke all on function public.cme_confirm_year(uuid,jsonb), public.cme_save_entry(uuid,uuid,uuid,jsonb,boolean,uuid), public.cme_guard_entry(), public.cme_check_entry_allocations() from public, anon, authenticated;
grant execute on function public.cme_confirm_year(uuid,jsonb), public.cme_save_entry(uuid,uuid,uuid,jsonb,boolean,uuid), public.cme_guard_entry(), public.cme_check_entry_allocations() to service_role;
