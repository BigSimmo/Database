-- Additive, auditable third-party BMJ reference attestation. This migration is
-- prepared for operator review only; applying it to hosted Supabase remains a
-- separate explicitly approved action.
alter table public.source_review_events
  add column if not exists policy_version text,
  add column if not exists reviewer_qualification text;

alter table public.source_review_events
  drop constraint if exists source_review_events_decision_check;
alter table public.source_review_events
  add constraint source_review_events_decision_check
  check (
    decision in (
      'locally_reviewed',
      'approved',
      'third_party_reference_attested',
      'rejected',
      'decommissioned',
      'superseded'
    )
  );

create or replace function public.record_source_review_v2(
  p_document_id uuid,
  p_reviewer_id uuid,
  p_decision text,
  p_reason text,
  p_evidence_references text[] default '{}',
  p_review_date date default null,
  p_replacement_document_id uuid default null,
  p_policy_version text default null,
  p_reviewer_qualification text default null
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
  if p_decision not in (
    'locally_reviewed',
    'approved',
    'third_party_reference_attested',
    'rejected',
    'decommissioned',
    'superseded'
  ) then
    raise exception 'invalid source review decision';
  end if;
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'source review reason is required';
  end if;
  if p_decision in ('locally_reviewed', 'approved')
    and coalesce(cardinality(p_evidence_references), 0) = 0 then
    raise exception 'evidence references are required for source promotion';
  end if;
  if p_decision = 'superseded' and p_replacement_document_id is null then
    raise exception 'replacement document is required for supersession';
  end if;
  select * into v_document
  from public.documents
  where id = p_document_id
    and (owner_id = p_reviewer_id or owner_id is null)
  for update;
  if not found then raise exception 'document not found'; end if;

  if p_replacement_document_id is not null and (
    p_replacement_document_id = p_document_id
    or not exists (
      select 1
      from public.documents replacement
      where replacement.id = p_replacement_document_id
        and (
          (v_document.owner_id is null and replacement.owner_id is null)
          or (
            v_document.owner_id = p_reviewer_id
            and (replacement.owner_id = p_reviewer_id or replacement.owner_id is null)
          )
        )
    )
  ) then
    raise exception 'replacement document not found';
  end if;

  if v_document.owner_id is null
    and p_decision in ('locally_reviewed', 'approved') then
    if p_review_date is null
      or p_review_date > (now() at time zone 'Australia/Perth')::date then
      raise exception 'public source promotion review date is invalid';
    end if;
    if char_length(trim(coalesce(p_reviewer_qualification, ''))) = 0 then
      raise exception 'public source promotion reviewer qualification is required';
    end if;
  end if;

  v_metadata := coalesce(v_document.metadata, '{}'::jsonb);
  v_prior_status := coalesce(v_metadata->>'document_status', 'unknown');
  v_prior_validation := coalesce(v_metadata->>'clinical_validation_status', 'unverified');

  if p_decision = 'third_party_reference_attested' then
    if v_document.status <> 'indexed' then
      raise exception 'BMJ third-party attestation requires an indexed document';
    end if;
    if upper(trim(coalesce(v_metadata->>'publisher_code', ''))) <> 'BMJ'
      or btrim(
        regexp_replace(
          replace(lower(coalesce(v_metadata->>'publisher', '')), '&', ' and '),
          '[^a-z0-9/]+',
          ' ',
          'g'
        )
      ) not in ('bmj best practice', 'bmj publishing group')
      or btrim(
        regexp_replace(
          replace(lower(coalesce(v_metadata->>'jurisdiction', '')), '&', ' and '),
          '[^a-z0-9/]+',
          ' ',
          'g'
        )
      ) not in (
        'international',
        'global',
        'united kingdom',
        'uk'
      ) then
      raise exception 'BMJ third-party attestation requires compatible BMJ authority metadata';
    end if;
    if v_prior_validation <> 'unverified' then
      raise exception 'BMJ third-party attestation preserves unverified validation status';
    end if;
    if coalesce(cardinality(p_evidence_references), 0) = 0
      or exists (
        select 1
        from unnest(coalesce(p_evidence_references, '{}'::text[])) as evidence(reference)
        where char_length(trim(coalesce(evidence.reference, ''))) = 0
      ) then
      raise exception 'BMJ third-party attestation evidence references are required';
    end if;
    if p_review_date is null
      or p_review_date > (now() at time zone 'Australia/Perth')::date then
      raise exception 'BMJ third-party attestation review date is invalid';
    end if;
    if p_policy_version is distinct from 'bmj-third-party-reference-attestation-v1' then
      raise exception 'BMJ third-party attestation policy version is invalid';
    end if;
    if char_length(trim(coalesce(p_reviewer_qualification, ''))) = 0 then
      raise exception 'BMJ third-party attestation reviewer qualification is required';
    end if;

    -- This disposition records provenance review, not local clinical approval.
    -- Deliberately retain document_status and metadata.review_date unchanged so
    -- review-due/outdated sources remain visible as operational debt.
    v_new_status := v_prior_status;
    v_new_validation := 'unverified';
    v_metadata := v_metadata || jsonb_build_object(
      'clinical_validation_status', 'unverified',
      'clinical_validation_evidence', jsonb_build_object(
        'status', 'unverified',
        'basis', 'third_party_reference_attested',
        'evidence_type', 'structured_bmj_third_party_attestation',
        'publisher_code', 'BMJ',
        'policy_version', p_policy_version,
        'reviewer_qualification', trim(p_reviewer_qualification),
        'evidence_references', to_jsonb(p_evidence_references),
        'review_date', to_jsonb(p_review_date),
        'attested_at', now(),
        'attested_by', p_reviewer_id
      ),
      'governance_disposition', 'third_party_reference_attested',
      'governance_updated_at', now(),
      'governance_updated_by', p_reviewer_id
    );
  elsif p_decision in ('rejected', 'decommissioned', 'superseded') then
    v_new_status := 'outdated';
    v_new_validation := case when p_decision = 'rejected' then 'unverified' else v_prior_validation end;
    v_metadata := v_metadata || jsonb_build_object(
      'document_status', v_new_status,
      'clinical_validation_status', v_new_validation,
      'review_date', to_jsonb(p_review_date),
      'provenance_basis', coalesce(v_metadata->>'provenance_basis', 'unknown'),
      'governance_disposition', p_decision,
      'governance_updated_at', now(),
      'governance_updated_by', p_reviewer_id
    );
  else
    v_new_status := case
      when p_review_date is not null and p_review_date < (now() at time zone 'Australia/Perth')::date then 'review_due'
      else 'current'
    end;
    v_new_validation := p_decision;
    v_metadata := v_metadata || jsonb_build_object(
      'document_status', v_new_status,
      'clinical_validation_status', v_new_validation,
      'review_date', to_jsonb(p_review_date),
      'provenance_basis', 'reviewer_verified',
      'governance_disposition', p_decision,
      'governance_updated_at', now(),
      'governance_updated_by', p_reviewer_id
    );
  end if;

  insert into public.source_review_events (
    document_id,
    reviewer_id,
    decision,
    reason,
    evidence_references,
    prior_document_status,
    new_document_status,
    prior_validation_status,
    new_validation_status,
    review_date,
    replacement_document_id,
    policy_version,
    reviewer_qualification
  ) values (
    p_document_id,
    p_reviewer_id,
    p_decision,
    trim(p_reason),
    coalesce(p_evidence_references, '{}'),
    v_prior_status,
    v_new_status,
    v_prior_validation,
    v_new_validation,
    p_review_date,
    p_replacement_document_id,
    case when p_decision = 'third_party_reference_attested' then p_policy_version else null end,
    case
      when p_decision = 'third_party_reference_attested'
        or (v_document.owner_id is null and p_decision in ('locally_reviewed', 'approved'))
      then trim(p_reviewer_qualification)
      else null
    end
  ) returning * into v_event;

  update public.documents
  set metadata = v_metadata, updated_at = now()
  where id = p_document_id;

  return to_jsonb(v_event);
end;
$$;

revoke all on function public.record_source_review_v2(uuid, uuid, text, text, text[], date, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_source_review_v2(uuid, uuid, text, text, text[], date, uuid, text, text)
  to service_role;
