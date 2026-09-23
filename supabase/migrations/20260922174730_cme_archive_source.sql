-- Reversible CME archives and learning source links. No evidence or record deletion.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.cme_entries add column archived_at timestamptz, add column source_url text;
alter table public.cme_entries add constraint cme_entries_source_url_length check (source_url is null or char_length(source_url) between 1 and 2000);
comment on column public.cme_entries.source_url is 'Learning source reference only; not evidence of participation.';

create function public.cme_set_entry_archived(p_owner_id uuid,p_entry_id uuid,p_archived boolean) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_entry public.cme_entries; v_year public.cme_years;
begin
  if p_owner_id is null or p_archived is null then raise exception 'cme_invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text,23092026));
  select * into v_entry from public.cme_entries where owner_id=p_owner_id and id=p_entry_id for update;
  if not found then raise exception 'cme_entry_not_found'; end if;
  select * into v_year from public.cme_years where owner_id=p_owner_id and id=v_entry.year_id for update;
  if not found then raise exception 'cme_year_not_confirmed'; end if;
  if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;
  if (v_entry.archived_at is not null) is distinct from p_archived then
    update public.cme_entries set archived_at=case when p_archived then now() else null end
    where owner_id=p_owner_id and id=p_entry_id returning * into v_entry;
  end if;
  return to_jsonb(v_entry)||jsonb_build_object('cme_allocations',(select coalesce(jsonb_agg(jsonb_build_object('category',category,'hours',hours)),'[]') from public.cme_allocations where owner_id=p_owner_id and entry_id=p_entry_id));
end $$;
revoke all on function public.cme_set_entry_archived(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.cme_set_entry_archived(uuid,uuid,boolean) to service_role;

create function public.cme_guard_archived_entry() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if old.archived_at is not null and new.archived_at is not null then raise exception 'cme_entry_archived'; end if;
  return new;
end $$;
revoke all on function public.cme_guard_archived_entry() from public,anon,authenticated;
grant execute on function public.cme_guard_archived_entry() to service_role;
create trigger cme_archived_entry_guard before update on public.cme_entries for each row execute function public.cme_guard_archived_entry();

create or replace function public.cme_save_entry(p_owner_id uuid,p_year_id uuid,p_entry_id uuid,p_entry jsonb,p_create boolean,p_request_id uuid default null) returns jsonb
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
    if v_existing.archived_at is not null then raise exception 'cme_entry_archived'; end if;
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
    insert into public.cme_entries(id,owner_id,year_id,activity_date,title,reflection,cost_cents,routine_id,document_id,buckets,formal_peer_review_hours,request_id,request_payload,source_url)
    values(p_entry_id,p_owner_id,p_year_id,(p_entry->>'date')::date,p_entry->>'title',p_entry->>'reflection',(p_entry->>'costCents')::integer,(p_entry->>'routineId')::uuid,(p_entry->>'documentId')::uuid,array(select jsonb_array_elements_text(p_entry->'buckets')),coalesce((p_entry->>'formalPeerReviewHours')::numeric,0),p_request_id,p_entry,p_entry->>'sourceUrl')
    returning * into v_saved;
  else
    update public.cme_entries set year_id=p_year_id,activity_date=(p_entry->>'date')::date,title=p_entry->>'title',reflection=p_entry->>'reflection',cost_cents=(p_entry->>'costCents')::integer,routine_id=(p_entry->>'routineId')::uuid,document_id=(p_entry->>'documentId')::uuid,buckets=array(select jsonb_array_elements_text(p_entry->'buckets')),formal_peer_review_hours=coalesce((p_entry->>'formalPeerReviewHours')::numeric,0),source_url=p_entry->>'sourceUrl'
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
