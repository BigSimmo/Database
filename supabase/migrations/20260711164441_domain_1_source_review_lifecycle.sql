-- Evidence-bearing, immutable source-review lifecycle. Applying this migration
-- to a live project remains an explicit operator action.
create table if not exists public.source_review_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null,
  reviewer_id uuid not null,
  decision text not null check (decision in ('locally_reviewed', 'approved', 'rejected', 'decommissioned', 'superseded')),
  reason text not null check (char_length(reason) between 3 and 2000),
  evidence_references text[] not null default '{}',
  prior_document_status text not null,
  new_document_status text not null,
  prior_validation_status text not null,
  new_validation_status text not null,
  review_date date,
  replacement_document_id uuid,
  created_at timestamptz not null default now()
);

alter table public.source_review_events enable row level security;
revoke all on table public.source_review_events from anon, authenticated;
grant select, insert on table public.source_review_events to service_role;
drop policy if exists "source review events service role" on public.source_review_events;
create policy "source review events service role"
  on public.source_review_events for all to service_role using (true) with check (true);

create or replace function public.prevent_source_review_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'source_review_events is append-only';
end;
$$;

drop trigger if exists source_review_events_immutable on public.source_review_events;
create trigger source_review_events_immutable
before update or delete on public.source_review_events
for each row execute function public.prevent_source_review_event_mutation();

create or replace function public.record_source_review(
  p_document_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_reason text,
  p_evidence_references text[] default '{}',
  p_review_date date default null,
  p_replacement_document_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_metadata jsonb;
  v_prior_status text;
  v_prior_validation text;
  v_new_status text;
  v_new_validation text;
  v_event public.source_review_events%rowtype;
begin
  if p_decision not in ('locally_reviewed', 'approved', 'rejected', 'decommissioned', 'superseded') then
    raise exception 'invalid source review decision';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'source review reason is required';
  end if;
  if p_decision in ('locally_reviewed', 'approved') and coalesce(cardinality(p_evidence_references), 0) = 0 then
    raise exception 'evidence references are required for source promotion';
  end if;
  if p_decision = 'superseded' and p_replacement_document_id is null then
    raise exception 'replacement document is required for supersession';
  end if;
  if p_replacement_document_id is not null and not exists (
    select 1 from public.documents where id = p_replacement_document_id and owner_id = p_reviewer_id
  ) then
    raise exception 'replacement document not found';
  end if;

  select * into v_document from public.documents
  where id = p_document_id and owner_id = p_reviewer_id
  for update;
  if not found then raise exception 'document not found'; end if;

  v_metadata := coalesce(v_document.metadata, '{}'::jsonb);
  v_prior_status := coalesce(v_metadata->>'document_status', 'unknown');
  v_prior_validation := coalesce(v_metadata->>'clinical_validation_status', 'unverified');

  if p_decision in ('rejected', 'decommissioned', 'superseded') then
    v_new_status := 'outdated';
    v_new_validation := case when p_decision = 'rejected' then 'unverified' else v_prior_validation end;
  else
    v_new_status := case
      when p_review_date is not null and p_review_date < (now() at time zone 'Australia/Perth')::date then 'review_due'
      else 'current'
    end;
    v_new_validation := p_decision;
  end if;

  v_metadata := v_metadata || jsonb_build_object(
    'document_status', v_new_status,
    'clinical_validation_status', v_new_validation,
    'review_date', to_jsonb(p_review_date),
    'provenance_basis', case when p_decision in ('locally_reviewed', 'approved') then 'reviewer_verified' else coalesce(v_metadata->>'provenance_basis', 'unknown') end,
    'governance_disposition', p_decision,
    'governance_updated_at', now(),
    'governance_updated_by', p_reviewer_id
  );

  insert into public.source_review_events (
    document_id, reviewer_id, decision, reason, evidence_references,
    prior_document_status, new_document_status, prior_validation_status,
    new_validation_status, review_date, replacement_document_id
  ) values (
    p_document_id, p_reviewer_id, p_decision, trim(p_reason), coalesce(p_evidence_references, '{}'),
    v_prior_status, v_new_status, v_prior_validation, v_new_validation,
    p_review_date, p_replacement_document_id
  ) returning * into v_event;

  update public.documents set metadata = v_metadata, updated_at = now() where id = p_document_id;
  return to_jsonb(v_event);
end;
$$;

revoke all on function public.record_source_review(uuid, uuid, text, text, text[], date, uuid) from public, anon, authenticated;
grant execute on function public.record_source_review(uuid, uuid, text, text, text[], date, uuid) to service_role;
