-- Forward-only control plane for governed public-source definitions and exact
-- acquired versions. This migration does not publish content: P02 remains the
-- sole owner of document publication approvals and public ownership changes.

create table public.public_source_activation_events (
  id uuid primary key default gen_random_uuid(),
  source_catalogue_key text not null check (char_length(trim(source_catalogue_key)) between 1 and 100),
  policy_version text not null check (policy_version = 'australian-source-policy-v1'),
  policy_digest text not null check (
    policy_digest = '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f'
  ),
  decision text not null check (decision in ('activate', 'quarantine', 'retire')),
  operator_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 3 and 2000),
  evidence_references text[] not null check (cardinality(evidence_references) between 1 and 50),
  manifest_digest text not null unique check (manifest_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index public_source_activation_events_latest_idx
  on public.public_source_activation_events(source_catalogue_key, created_at desc, id desc);

create table public.public_source_versions (
  id uuid primary key default gen_random_uuid(),
  source_catalogue_key text not null check (char_length(trim(source_catalogue_key)) between 1 and 100),
  source_policy_version text not null check (source_policy_version = 'australian-source-policy-v1'),
  source_policy_digest text not null check (
    source_policy_digest = '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f'
  ),
  exact_canonical_url text not null check (exact_canonical_url ~ '^https://'),
  exact_version_url text not null check (exact_version_url ~ '^https://'),
  exact_version text not null check (char_length(trim(exact_version)) between 1 and 200),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  retrieved_at timestamptz not null,
  licence_evidence_digest text not null check (licence_evidence_digest ~ '^[0-9a-f]{64}$'),
  steward_id uuid not null,
  staging_document_id uuid not null unique references public.documents(id) on delete restrict,
  extraction_index_generation_id uuid,
  lifecycle text not null default 'discovered'
    check (lifecycle in ('discovered', 'shadow', 'approved', 'active', 'quarantined', 'tombstoned')),
  supersedes_version_id uuid references public.public_source_versions(id) on delete restrict,
  activation_event_id uuid not null references public.public_source_activation_events(id) on delete restrict,
  review_queued_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_catalogue_key, content_hash),
  check (supersedes_version_id is null or supersedes_version_id <> id),
  check (review_reason is null or char_length(trim(review_reason)) between 3 and 2000)
);

create index public_source_versions_catalogue_lifecycle_idx
  on public.public_source_versions(source_catalogue_key, lifecycle, retrieved_at desc, id desc);

alter table public.public_source_activation_events enable row level security;
alter table public.public_source_versions enable row level security;
revoke all on table public.public_source_activation_events from public, anon, authenticated;
revoke all on table public.public_source_versions from public, anon, authenticated;
grant select on table public.public_source_activation_events to service_role;
grant select on table public.public_source_versions to service_role;

drop policy if exists "public source activation events service role" on public.public_source_activation_events;
create policy "public source activation events service role"
  on public.public_source_activation_events for select to service_role using (true);
drop policy if exists "public source versions service role" on public.public_source_versions;
create policy "public source versions service role"
  on public.public_source_versions for select to service_role using (true);

create or replace function public.prevent_public_source_activation_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'public source activation events are append-only';
end;
$$;

revoke all on function public.prevent_public_source_activation_event_mutation() from public, anon, authenticated;

drop trigger if exists public_source_activation_events_append_only on public.public_source_activation_events;
create trigger public_source_activation_events_append_only
before update or delete on public.public_source_activation_events
for each row execute function public.prevent_public_source_activation_event_mutation();

create or replace function public.guard_public_source_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transition_allowed boolean;
begin
  if old.lifecycle = 'tombstoned' then
    raise exception 'tombstoned public source versions are terminal';
  end if;
  if (
    to_jsonb(new) - array['lifecycle', 'extraction_index_generation_id', 'activation_event_id', 'review_queued_at', 'review_reason', 'updated_at']
  ) is distinct from (
    to_jsonb(old) - array['lifecycle', 'extraction_index_generation_id', 'activation_event_id', 'review_queued_at', 'review_reason', 'updated_at']
  ) then
    raise exception 'public source version immutable fields changed';
  end if;

  v_transition_allowed := (old.lifecycle, new.lifecycle) in (
    ('discovered', 'shadow'),
    ('discovered', 'quarantined'),
    ('discovered', 'tombstoned'),
    ('shadow', 'approved'),
    ('shadow', 'quarantined'),
    ('shadow', 'tombstoned'),
    ('approved', 'active'),
    ('approved', 'quarantined'),
    ('approved', 'tombstoned'),
    ('active', 'quarantined'),
    ('active', 'tombstoned'),
    ('quarantined', 'approved'),
    ('quarantined', 'tombstoned')
  );
  if new.lifecycle is distinct from old.lifecycle and not v_transition_allowed then
    raise exception 'illegal public source version lifecycle transition';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_public_source_version_mutation() from public, anon, authenticated;

drop trigger if exists public_source_versions_guard_mutation on public.public_source_versions;
create trigger public_source_versions_guard_mutation
before update or delete on public.public_source_versions
for each row execute function public.guard_public_source_version_mutation();

create or replace function public.record_public_source_activation(p_manifest jsonb)
returns public.public_source_activation_events
language plpgsql
security definer set search_path = ''
as $$
declare
  p_source_catalogue_key text := trim(coalesce(p_manifest->>'catalogueKey', ''));
  v_event public.public_source_activation_events%rowtype;
  v_manifest_digest text;
  v_evidence text[];
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
    or p_manifest->>'version' is distinct from '1'
    or p_manifest->>'sourcePolicyVersion' is distinct from 'australian-source-policy-v1'
    or p_manifest->>'sourcePolicyDigest' is distinct from '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f'
    or coalesce(p_manifest->>'decision', '') not in ('activate', 'quarantine', 'retire')
    or char_length(p_source_catalogue_key) not between 1 and 100 then
    raise exception 'public source activation manifest is invalid';
  end if;
  if nullif(p_manifest->>'operatorId', '')::uuid is null
    or char_length(trim(coalesce(p_manifest->>'reason', ''))) not between 3 and 2000
    or jsonb_typeof(p_manifest->'evidenceReferences') is distinct from 'array' then
    raise exception 'public source activation evidence is invalid';
  end if;
  select array_agg(value order by ordinality) into v_evidence
  from jsonb_array_elements_text(p_manifest->'evidenceReferences') with ordinality evidence(value, ordinality);
  if cardinality(v_evidence) not between 1 and 50
    or exists (select 1 from unnest(v_evidence) value where char_length(trim(value)) not between 1 and 500) then
    raise exception 'public source activation evidence is invalid';
  end if;

  v_manifest_digest := encode(extensions.digest(convert_to(p_manifest::text, 'UTF8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_catalogue_key, 0));
  select * into v_event
  from public.public_source_activation_events
  where source_catalogue_key = p_source_catalogue_key
  order by created_at desc, id desc
  limit 1
  for update;

  select * into v_event from public.public_source_activation_events where manifest_digest = v_manifest_digest;
  if found then return v_event; end if;

  insert into public.public_source_activation_events (
    source_catalogue_key, policy_version, policy_digest, decision,
    operator_id, reason, evidence_references, manifest_digest
  ) values (
    p_source_catalogue_key,
    p_manifest->>'sourcePolicyVersion',
    p_manifest->>'sourcePolicyDigest',
    p_manifest->>'decision',
    (p_manifest->>'operatorId')::uuid,
    trim(p_manifest->>'reason'),
    v_evidence,
    v_manifest_digest
  ) returning * into v_event;
  return v_event;
end;
$$;

revoke all on function public.record_public_source_activation(jsonb) from public, anon, authenticated;
grant execute on function public.record_public_source_activation(jsonb) to service_role;

create or replace function public.stage_public_source_version(p_manifest jsonb)
returns public.public_source_versions
language plpgsql
security definer set search_path = ''
as $$
declare
  p_source_catalogue_key text := trim(coalesce(p_manifest->>'catalogueKey', ''));
  v_active_event public.public_source_activation_events%rowtype;
  v_document public.documents%rowtype;
  v_version public.public_source_versions%rowtype;
  v_document_id uuid;
  v_steward_id uuid;
begin
  begin
    v_document_id := nullif(p_manifest->>'stagingDocumentId', '')::uuid;
    v_steward_id := nullif(p_manifest->>'stewardId', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'public source version identity is invalid';
  end;
  if v_document_id is null or v_steward_id is null
    or coalesce(p_manifest->>'sourcePolicyDigest', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_manifest->>'contentHash', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_manifest->>'licenceEvidenceDigest', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_manifest->>'exactCanonicalUrl', '') !~ '^https://'
    or coalesce(p_manifest->>'exactVersionUrl', '') !~ '^https://' then
    raise exception 'public source version manifest is invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_catalogue_key, 0));
  select * into v_active_event
  from public.public_source_activation_events
  where source_catalogue_key = p_source_catalogue_key
  order by created_at desc, id desc
  limit 1
  for update;
  if not found or v_active_event.decision is distinct from 'activate' then
    raise exception 'source definition is not active for controlled acquisition';
  end if;
  if v_active_event.id is distinct from nullif(p_manifest->>'activationEventId', '')::uuid
    or v_active_event.policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_active_event.policy_digest is distinct from p_manifest->>'sourcePolicyDigest' then
    raise exception 'source policy digest does not match the active definition';
  end if;

  select * into v_document from public.documents where id = v_document_id for update;
  if not found or v_document.owner_id is distinct from v_steward_id then
    raise exception 'public source staging document requires its non-null steward';
  end if;
  if v_document.metadata->>'source_catalogue_key' is distinct from p_source_catalogue_key
    or v_document.metadata->>'source_policy_version' is distinct from v_active_event.policy_version
    or v_document.metadata->>'public_source_activation_event_id' is distinct from v_active_event.id::text
    or v_document.metadata->>'public_source_steward_id' is distinct from v_steward_id::text
    or v_document.metadata->>'content_mode' is distinct from 'indexed_content'
    or v_document.metadata->>'licence_policy' is distinct from 'public_index_permitted' then
    raise exception 'public source staging metadata does not match active governance';
  end if;

  select * into v_version
  from public.public_source_versions
  where source_catalogue_key = p_source_catalogue_key and content_hash = p_manifest->>'contentHash'
  for update;
  if found then
    if v_version.staging_document_id is distinct from v_document_id then
      raise exception 'public source content version already staged';
    end if;
    update public.documents
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('public_source_version_id', v_version.id),
        updated_at = now()
    where id = v_document_id and owner_id = v_steward_id;
    return v_version;
  end if;

  insert into public.public_source_versions (
    source_catalogue_key, source_policy_version, source_policy_digest,
    exact_canonical_url, exact_version_url, exact_version, content_hash,
    retrieved_at, licence_evidence_digest, steward_id, staging_document_id,
    lifecycle, activation_event_id
  ) values (
    p_source_catalogue_key, v_active_event.policy_version, v_active_event.policy_digest,
    p_manifest->>'exactCanonicalUrl', p_manifest->>'exactVersionUrl', p_manifest->>'exactVersion',
    p_manifest->>'contentHash', (p_manifest->>'retrievedAt')::timestamptz,
    p_manifest->>'licenceEvidenceDigest', v_steward_id, v_document_id,
    'discovered', v_active_event.id
  ) returning * into v_version;

  update public.public_source_versions
  set lifecycle = 'shadow'
  where id = v_version.id
  returning * into v_version;
  update public.documents
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('public_source_version_id', v_version.id),
      updated_at = now()
  where id = v_document_id and owner_id = v_steward_id;
  return v_version;
end;
$$;

revoke all on function public.stage_public_source_version(jsonb) from public, anon, authenticated;
grant execute on function public.stage_public_source_version(jsonb) to service_role;

create or replace function public.assert_public_source_document_governance(p_document_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_document public.documents%rowtype;
  v_version public.public_source_versions%rowtype;
  v_active_event public.public_source_activation_events%rowtype;
begin
  select * into v_document from public.documents where id = p_document_id for update;
  if not found then raise exception 'governed public source document was not found'; end if;
  if v_document.metadata->>'corpus_scope' is distinct from 'australian_public' then return; end if;
  if v_document.metadata->>'public_source_version_id' is null then
    raise exception 'governed public source document has no bound version';
  end if;
  if v_document.owner_id is null
    or v_document.owner_id::text is distinct from v_document.metadata->>'public_source_steward_id' then
    raise exception 'governed public source document lost steward ownership';
  end if;
  select * into v_version
  from public.public_source_versions
  where id = (v_document.metadata->>'public_source_version_id')::uuid
    and staging_document_id = v_document.id
  for update;
  if not found or v_version.steward_id is distinct from v_document.owner_id
    or v_version.lifecycle not in ('shadow', 'approved')
    or v_document.metadata->>'source_catalogue_key' is distinct from v_version.source_catalogue_key
    or v_document.metadata->>'source_policy_version' is distinct from v_version.source_policy_version
    or v_document.metadata->>'content_mode' is distinct from 'indexed_content'
    or v_document.metadata->>'licence_policy' is distinct from 'public_index_permitted' then
    raise exception 'governed public source document metadata is invalid';
  end if;
  select * into v_active_event
  from public.public_source_activation_events
  where source_catalogue_key = v_version.source_catalogue_key
  order by created_at desc, id desc
  limit 1
  for update;
  if not found or v_active_event.decision is distinct from 'activate'
    or v_active_event.id is distinct from v_version.activation_event_id
    or v_active_event.policy_digest is distinct from v_version.source_policy_digest then
    raise exception 'governed public source is no longer active';
  end if;
end;
$$;

revoke all on function public.assert_public_source_document_governance(uuid) from public, anon, authenticated;
grant execute on function public.assert_public_source_document_governance(uuid) to service_role;

create or replace function public.transition_public_source_version(
  p_version_id uuid,
  p_target_lifecycle text,
  p_activation_event_id uuid
)
returns public.public_source_versions
language plpgsql
security definer set search_path = ''
as $$
declare
  v_version public.public_source_versions%rowtype;
  v_document public.documents%rowtype;
  v_approval public.document_publication_approvals%rowtype;
  v_event public.public_source_activation_events%rowtype;
begin
  select * into v_version from public.public_source_versions where id = p_version_id for update;
  if not found then raise exception 'public source version was not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_version.source_catalogue_key, 0));
  select * into v_event
  from public.public_source_activation_events
  where source_catalogue_key = v_version.source_catalogue_key
  order by created_at desc, id desc
  limit 1
  for update;
  if not found or v_event.id is distinct from p_activation_event_id
    or v_event.decision is distinct from 'activate'
    or v_event.policy_digest is distinct from v_version.source_policy_digest then
    raise exception 'public source lifecycle transition lacks active definition evidence';
  end if;
  select * into v_document from public.documents where id = v_version.staging_document_id for update;
  if not found then raise exception 'public source staging document was not found'; end if;

  if p_target_lifecycle = 'approved' then
    if v_document.owner_id is null or v_document.owner_id is distinct from v_version.steward_id
      or v_document.status is distinct from 'indexed'
      or v_document.index_generation_id is null then
      raise exception 'public source approval requires an indexed steward-owned document';
    end if;
    select * into v_approval
    from public.document_publication_approvals approval
    where approval.document_id = v_document.id
      and approval.expected_prior_owner_id = v_version.steward_id
      and approval.decision = 'approved'
      and approval.source_catalogue_key = v_version.source_catalogue_key
      and approval.source_policy_version = v_version.source_policy_version
      and approval.reviewed_index_generation_id = v_document.index_generation_id
    order by approval.approved_at desc, approval.id desc
    limit 1
    for update;
    if not found then raise exception 'public source version lacks matching P02 approval'; end if;
  elsif p_target_lifecycle = 'active' then
    if v_document.owner_id is not null
      or v_document.metadata->'public_corpus' is distinct from 'true'::jsonb
      or v_document.metadata->>'publication_approval_id' is null
      or v_document.metadata->>'publication_source_policy_version' is distinct from v_version.source_policy_version
      or v_document.metadata->>'publication_reviewed_index_generation_id' is distinct from v_document.index_generation_id::text then
      raise exception 'public source activation requires matching P02 public receipt facts';
    end if;
    select * into v_approval
    from public.document_publication_approvals approval
    where approval.id = (v_document.metadata->>'publication_approval_id')::uuid
      and approval.document_id = v_document.id
      and approval.decision = 'approved'
      and approval.source_catalogue_key = v_version.source_catalogue_key
      and approval.source_policy_version = v_version.source_policy_version
      and approval.reviewed_index_generation_id = v_document.index_generation_id
    for update;
    if not found then raise exception 'public source activation lacks matching P02 approval history'; end if;
  end if;

  update public.public_source_versions
  set lifecycle = p_target_lifecycle,
      extraction_index_generation_id = coalesce(extraction_index_generation_id, v_document.index_generation_id),
      activation_event_id = p_activation_event_id
  where id = p_version_id
  returning * into v_version;
  return v_version;
end;
$$;

revoke all on function public.transition_public_source_version(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_public_source_version(uuid, text, uuid) to service_role;

create or replace function public.withdraw_public_source_version(
  p_version_id uuid,
  p_operator_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_version public.public_source_versions%rowtype;
  v_document public.documents%rowtype;
  v_cache_rows integer;
begin
  if p_operator_id is null or char_length(trim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'public source withdrawal evidence is invalid';
  end if;
  select * into v_version from public.public_source_versions where id = p_version_id for update;
  if not found then raise exception 'public source version was not found'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_version.source_catalogue_key, 0));
  select * into v_document from public.documents where id = v_version.staging_document_id for update;
  if not found then raise exception 'public source staging document was not found'; end if;

  update public.public_source_versions
  set lifecycle = 'tombstoned', review_queued_at = now(), review_reason = trim(p_reason)
  where id = v_version.id;

  update public.document_labels set owner_id = v_version.steward_id, updated_at = now() where document_id = v_document.id;
  update public.document_summaries set owner_id = v_version.steward_id, updated_at = now() where document_id = v_document.id;
  update public.document_sections set owner_id = v_version.steward_id, updated_at = now() where document_id = v_document.id;
  update public.document_memory_cards set owner_id = v_version.steward_id, updated_at = now() where document_id = v_document.id;
  update public.document_table_facts set owner_id = v_version.steward_id where document_id = v_document.id;
  update public.document_embedding_fields set owner_id = v_version.steward_id where document_id = v_document.id;
  update public.document_index_quality set owner_id = v_version.steward_id, updated_at = now() where document_id = v_document.id;
  update public.document_index_units set owner_id = v_version.steward_id, updated_at = now() where document_id = v_document.id;
  update public.documents
  set owner_id = v_version.steward_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'change_state', 'withdrawn',
        'public_corpus', false,
        'public_source_withdrawal_operator_id', p_operator_id,
        'public_source_withdrawal_reason', trim(p_reason),
        'public_source_withdrawn_at', now()
      ),
      updated_at = now()
  where id = v_document.id;

  delete from public.rag_response_cache
  where owner_id is null and cache_kind in ('search', 'answer');
  get diagnostics v_cache_rows = row_count;

  return jsonb_build_object(
    'version_id', v_version.id,
    'lifecycle', 'tombstoned',
    'retrieval_removed', true,
    'queue_human_review', true,
    'anonymous_cache_rows_removed', v_cache_rows
  );
end;
$$;

revoke all on function public.withdraw_public_source_version(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.withdraw_public_source_version(uuid, uuid, text) to service_role;

-- Rebuild the claim primitive so an activation retired/quarantined after queue
-- creation cannot be claimed. Non-governed ingestion retains its prior path.
create or replace function public.claim_ingestion_jobs(
  p_worker_id text,
  p_claim_limit integer default 1,
  p_stale_after_minutes integer default 45
)
returns table (
  id uuid, document_id uuid, batch_id uuid, status text, stage text,
  progress integer, error_message text, attempt_count integer, max_attempts integer,
  locked_at timestamptz, locked_by text, documents jsonb
)
language plpgsql
set search_path = ''
as $$
begin
  return query
  with eligible as (
    select j.id, row_number() over (partition by j.document_id order by j.created_at asc, j.id asc) as document_rank
    from public.ingestion_jobs j
    where j.attempt_count < j.max_attempts
      and ((j.status = 'pending' and coalesce(j.next_run_at, now()) <= now())
        or (j.status = 'processing' and j.locked_at is not null
          and j.locked_at < now() - pg_catalog.make_interval(mins => p_stale_after_minutes)))
      and not exists (
        select 1 from public.ingestion_jobs active
        where active.document_id = j.document_id and active.id <> j.id
          and active.status = 'processing' and active.locked_at is not null
          and active.locked_at >= now() - pg_catalog.make_interval(mins => p_stale_after_minutes)
      )
  ), candidates as (
    select j.id
    from eligible e
    join public.ingestion_jobs j on j.id = e.id
    join public.documents d on d.id = j.document_id
    where e.document_rank = 1
      and (
        d.metadata->>'corpus_scope' is distinct from 'australian_public'
        or (
          d.owner_id is not null
          and d.owner_id::text = d.metadata->>'public_source_steward_id'
          and d.metadata->>'content_mode' = 'indexed_content'
          and d.metadata->>'licence_policy' = 'public_index_permitted'
          and exists (
            select 1
            from public.public_source_versions version
            join lateral (
              select event.id, event.decision, event.policy_digest
              from public.public_source_activation_events event
              where event.source_catalogue_key = version.source_catalogue_key
              order by created_at desc, id desc limit 1
            ) latest on true
            where version.id = (d.metadata->>'public_source_version_id')::uuid
              and version.staging_document_id = d.id
              and version.steward_id = d.owner_id
              and version.lifecycle in ('shadow', 'approved')
              and latest.id = version.activation_event_id
              and latest.decision = 'activate'
              and latest.policy_digest = version.source_policy_digest
          )
        )
      )
    order by j.created_at asc, j.id asc
    limit greatest(p_claim_limit, 1)
    for update of j, d skip locked
  ), claimed as (
    update public.ingestion_jobs j
    set status = 'processing',
        stage = case when j.status = 'processing' then 'reclaimed stale job'
          when j.stage in ('queued', 'failed') then 'claimed' else j.stage end,
        locked_at = now(), locked_by = p_worker_id, started_at = coalesce(j.started_at, now()),
        attempt_count = j.attempt_count + 1, error_message = null
    from candidates c where j.id = c.id returning j.*
  )
  select c.id, c.document_id, c.batch_id, c.status, c.stage, c.progress,
    c.error_message, c.attempt_count, c.max_attempts, c.locked_at, c.locked_by,
    to_jsonb(d.*) as documents
  from claimed c join public.documents d on d.id = c.document_id;
end;
$$;

revoke all on function public.claim_ingestion_jobs(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_ingestion_jobs(text, integer, integer) to service_role;

-- Fence the worker commit immediately before artifact mutation. The legacy
-- overload remains non-executable by service_role and is reached only here.
create or replace function public.commit_document_index_generation(
  p_job_id uuid,
  p_worker_id text,
  p_document_id uuid,
  p_index_generation_id uuid,
  p_status text default 'indexed',
  p_page_count integer default 0,
  p_chunk_count integer default 0,
  p_image_count integer default 0,
  p_metadata jsonb default '{}'::jsonb,
  p_pages jsonb default null,
  p_quality jsonb default null
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.ingestion_jobs%rowtype;
  v_document public.documents%rowtype;
begin
  select * into v_job from public.ingestion_jobs where id = p_job_id for update;
  if not found or v_job.document_id is distinct from p_document_id
    or v_job.status is distinct from 'processing' or v_job.locked_by is distinct from p_worker_id then
    raise exception using errcode = 'P0001', message = 'ingestion_lease_lost';
  end if;
  perform public.assert_public_source_document_governance(p_document_id);
  select * into v_document from public.documents where id = p_document_id for update;
  if v_document.metadata->>'public_source_version_id' is not null and (
    coalesce(p_metadata->>'source_catalogue_key', v_document.metadata->>'source_catalogue_key')
      is distinct from v_document.metadata->>'source_catalogue_key'
    or coalesce(p_metadata->>'source_policy_version', v_document.metadata->>'source_policy_version')
      is distinct from v_document.metadata->>'source_policy_version'
    or coalesce(p_metadata->>'public_source_activation_event_id', v_document.metadata->>'public_source_activation_event_id')
      is distinct from v_document.metadata->>'public_source_activation_event_id'
    or coalesce(p_metadata->>'public_source_version_id', v_document.metadata->>'public_source_version_id')
      is distinct from v_document.metadata->>'public_source_version_id'
    or coalesce(p_metadata->>'public_source_steward_id', v_document.metadata->>'public_source_steward_id')
      is distinct from v_document.metadata->>'public_source_steward_id'
    or coalesce(p_metadata->>'content_mode', v_document.metadata->>'content_mode') is distinct from 'indexed_content'
    or coalesce(p_metadata->>'licence_policy', v_document.metadata->>'licence_policy') is distinct from 'public_index_permitted'
  ) then
    raise exception 'governed public source artifact commit changed policy identity';
  end if;
  return public.commit_document_index_generation(
    p_document_id, p_index_generation_id, p_status, p_page_count, p_chunk_count,
    p_image_count, p_metadata, p_pages, p_quality
  );
end;
$$;

revoke all on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) to service_role;
