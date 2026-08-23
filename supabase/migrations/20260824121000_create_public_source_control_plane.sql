-- Forward-only control plane for governed public-source definitions and exact
-- acquired versions. P02 remains the sole owner of publication approvals and
-- performs public ownership transitions only inside the controlled activation RPC.

create table public.public_source_policy_entries (
  source_catalogue_key text primary key,
  canonical_url text not null,
  canonical_host text not null,
  policy_version text not null check (policy_version = 'australian-source-policy-v1'),
  policy_digest text not null check (
    policy_digest = '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f'
  ),
  lifecycle text not null check (lifecycle = 'active'),
  content_mode text not null check (content_mode = 'indexed_content'),
  exact_document_licence text not null check (exact_document_licence = 'public_index_permitted'),
  created_at timestamptz not null default now(),
  check (canonical_url ~ '^https://'),
  check (canonical_host ~ '^[a-z0-9.-]+$')
);

insert into public.public_source_policy_entries (
  source_catalogue_key, canonical_url, canonical_host, policy_version, policy_digest,
  lifecycle, content_mode, exact_document_licence
) values
  ('wa-health', 'https://www.health.wa.gov.au/About-us/Policy-frameworks', 'www.health.wa.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('wa-chief-psychiatrist', 'https://www.chiefpsychiatrist.wa.gov.au/laws-and-rights/standards-and-guidelines/', 'www.chiefpsychiatrist.wa.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('wa-legislation', 'https://www.legislation.wa.gov.au/', 'www.legislation.wa.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('tga', 'https://www.tga.gov.au/', 'www.tga.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('acsqhc', 'https://www.safetyandquality.gov.au/', 'www.safetyandquality.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('australian-health-disability-ageing', 'https://www.health.gov.au/', 'www.health.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('nhmrc', 'https://www.nhmrc.gov.au/guidelines', 'www.nhmrc.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('ranzcp', 'https://www.ranzcp.org/clinical-guidelines-publications', 'www.ranzcp.org', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('racgp', 'https://www.racgp.org.au/clinical-resources/clinical-guidelines', 'www.racgp.org.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('pbs', 'https://www.pbs.gov.au/', 'www.pbs.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('australian-prescriber', 'https://australianprescriber.tg.org.au/', 'australianprescriber.tg.org.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('nsw-health', 'https://www.health.nsw.gov.au/', 'www.health.nsw.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('queensland-health', 'https://www.health.qld.gov.au/', 'www.health.qld.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('sa-health', 'https://www.sahealth.sa.gov.au/', 'www.sahealth.sa.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('victoria-health', 'https://www.health.vic.gov.au/', 'www.health.vic.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('tasmania-health', 'https://www.health.tas.gov.au/', 'www.health.tas.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('nt-health', 'https://health.nt.gov.au/', 'health.nt.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted'),
  ('act-health', 'https://www.health.act.gov.au/', 'www.health.act.gov.au', 'australian-source-policy-v1', '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f', 'active', 'indexed_content', 'public_index_permitted');

create table public.public_source_activation_events (
  id uuid primary key default gen_random_uuid(),
  activation_sequence bigint generated always as identity unique,
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
  on public.public_source_activation_events(source_catalogue_key, activation_sequence desc);

create table public.public_source_versions (
  id uuid primary key,
  reservation_key text not null check (reservation_key ~ '^[0-9a-f]{64}$'),
  source_catalogue_key text not null references public.public_source_policy_entries(source_catalogue_key),
  source_policy_version text not null check (source_policy_version = 'australian-source-policy-v1'),
  source_policy_digest text not null check (
    source_policy_digest = '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f'
  ),
  exact_canonical_url text not null check (exact_canonical_url ~ '^https://'),
  exact_version_url text not null check (exact_version_url ~ '^https://'),
  exact_version text not null check (char_length(trim(exact_version)) between 1 and 200),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  raw_response_hash text not null check (raw_response_hash ~ '^[0-9a-f]{64}$'),
  raw_response_byte_count bigint not null check (raw_response_byte_count >= 0),
  retrieved_at timestamptz not null,
  licence_evidence_digest text not null check (licence_evidence_digest ~ '^[0-9a-f]{64}$'),
  steward_id uuid not null references auth.users(id) on delete restrict,
  reserved_document_id uuid not null unique,
  reserved_storage_path text not null unique,
  storage_bucket text not null check (storage_bucket ~ '^[a-z0-9][a-z0-9._-]{0,62}$'),
  upload_lease_token uuid not null,
  upload_lease_expires_at timestamptz not null,
  upload_state text not null default 'reserved'
    check (upload_state in ('reserved', 'uploading', 'finalized', 'cleanup_pending')),
  staging_document_id uuid unique references public.documents(id) on delete restrict,
  intended_disposition text not null check (intended_disposition in ('shadow', 'quarantined')),
  extraction_index_generation_id uuid,
  lifecycle text not null default 'discovered'
    check (lifecycle in ('discovered', 'shadow', 'approved', 'active', 'quarantined', 'tombstoned', 'abandoned')),
  supersedes_version_id uuid references public.public_source_versions(id) on delete restrict,
  activation_event_id uuid not null references public.public_source_activation_events(id) on delete restrict,
  activation_sequence bigint not null,
  review_queued_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (supersedes_version_id is null or supersedes_version_id <> id),
  check (review_reason is null or char_length(trim(review_reason)) between 3 and 2000),
  check (staging_document_id is null or staging_document_id = reserved_document_id)
);

create index public_source_versions_catalogue_lifecycle_idx
  on public.public_source_versions(source_catalogue_key, lifecycle, retrieved_at desc, id desc);
create unique index public_source_versions_reservation_key_live_idx
  on public.public_source_versions(reservation_key)
  where lifecycle <> 'abandoned';
create unique index public_source_versions_catalogue_hash_live_idx
  on public.public_source_versions(source_catalogue_key, content_hash)
  where lifecycle <> 'abandoned';
create unique index public_source_versions_one_active_per_catalogue_idx
  on public.public_source_versions(source_catalogue_key)
  where lifecycle = 'active';

create table public.public_source_upload_attempts (
  id uuid primary key,
  version_id uuid not null references public.public_source_versions(id) on delete restrict,
  claim_token uuid not null unique,
  claim_expires_at timestamptz not null,
  storage_bucket text not null check (storage_bucket ~ '^[a-z0-9][a-z0-9._-]{0,62}$'),
  storage_path text not null check (char_length(storage_path) between 1 and 1024),
  signed_authority_digest text check (signed_authority_digest ~ '^[0-9a-f]{64}$'),
  signed_authority_expires_at timestamptz,
  cleanup_not_before timestamptz not null,
  state text not null check (state in ('authorized', 'bound', 'cleanup_pending', 'finalized', 'cleaned')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (storage_bucket, storage_path),
  check ((signed_authority_digest is null) = (signed_authority_expires_at is null)),
  check (signed_authority_expires_at is null or cleanup_not_before = signed_authority_expires_at + interval '60 seconds' + interval '5 minutes')
);

alter table public.public_source_versions
  add column current_upload_attempt_id uuid references public.public_source_upload_attempts(id) on delete restrict,
  add column finalized_upload_attempt_id uuid references public.public_source_upload_attempts(id) on delete restrict;

create index public_source_upload_attempts_version_state_idx
  on public.public_source_upload_attempts(version_id, state, created_at desc);

alter table public.storage_cleanup_jobs
  add column public_source_reservation_id uuid references public.public_source_versions(id) on delete restrict,
  add column public_source_upload_attempt_id uuid references public.public_source_upload_attempts(id) on delete restrict,
  add column public_source_storage_bucket text,
  add column public_source_storage_path text,
  add column public_source_cleanup_not_before timestamptz,
  add column public_source_claim_token uuid,
  add column public_source_claim_expires_at timestamptz,
  add constraint storage_cleanup_jobs_public_source_attempt_unique unique (public_source_upload_attempt_id),
  add constraint storage_cleanup_jobs_public_source_identity_check check (
    (public_source_reservation_id is null and public_source_upload_attempt_id is null and public_source_storage_bucket is null
      and public_source_storage_path is null and public_source_cleanup_not_before is null)
    or
    (public_source_reservation_id is not null and public_source_upload_attempt_id is not null
      and public_source_storage_bucket ~ '^[a-z0-9][a-z0-9._-]{0,62}$'
      and char_length(public_source_storage_path) between 1 and 1024
      and public_source_cleanup_not_before is not null)
  );

alter table public.storage_cleanup_jobs
  drop constraint storage_cleanup_jobs_status_check,
  add constraint storage_cleanup_jobs_status_check
    check (status in ('pending', 'processing', 'completed', 'failed'));

create unique index public_source_cleanup_bucket_path_idx
  on public.storage_cleanup_jobs(public_source_storage_bucket, public_source_storage_path)
  where public_source_reservation_id is not null;

create table public.public_source_cleanup_mutation_guards (
  token uuid primary key,
  public_source_reservation_id uuid not null references public.public_source_versions(id) on delete cascade,
  public_source_upload_attempt_id uuid not null references public.public_source_upload_attempts(id) on delete cascade,
  operation text not null check (operation in ('upsert', 'claim', 'complete', 'release')),
  transaction_id bigint not null,
  backend_pid integer not null,
  created_at timestamptz not null default now()
);

alter table public.public_source_cleanup_mutation_guards enable row level security;
revoke all on table public.public_source_cleanup_mutation_guards from public, anon, authenticated, service_role;

create or replace function public.guard_public_source_cleanup_job_identity()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_guard_token uuid;
  v_operation text;
begin
  if tg_op = 'DELETE' and old.public_source_reservation_id is not null then
    raise exception 'public source cleanup history is immutable';
  end if;
  if tg_op = 'UPDATE' and old.public_source_reservation_id is not null and (
    new.public_source_reservation_id is distinct from old.public_source_reservation_id
    or new.public_source_upload_attempt_id is distinct from old.public_source_upload_attempt_id
    or new.public_source_storage_bucket is distinct from old.public_source_storage_bucket
    or new.public_source_storage_path is distinct from old.public_source_storage_path
    or new.document_bucket is distinct from old.document_bucket
    or new.document_paths is distinct from old.document_paths
  ) then
    raise exception 'public source cleanup identity is immutable';
  end if;
  if tg_op <> 'DELETE' and new.public_source_reservation_id is not null then
    begin
      v_guard_token := nullif(pg_catalog.current_setting('app.public_source_cleanup_mutation', true), '')::uuid;
    exception when invalid_text_representation then
      v_guard_token := null;
    end;
    select operation into v_operation
    from public.public_source_cleanup_mutation_guards
    where token = v_guard_token
      and public_source_reservation_id = new.public_source_reservation_id
      and public_source_upload_attempt_id = new.public_source_upload_attempt_id
      and transaction_id = pg_catalog.txid_current()
      and backend_pid = pg_catalog.pg_backend_pid();
    if v_operation is null then
      raise exception 'public source cleanup mutation guard is missing';
    end if;
    select * into v_version from public.public_source_versions
    where id = new.public_source_reservation_id;
    select * into v_attempt from public.public_source_upload_attempts
    where id = new.public_source_upload_attempt_id;
    if not found or v_version.id is null
      or v_attempt.version_id is distinct from v_version.id
      or v_attempt.state is distinct from 'cleanup_pending'
      or new.public_source_upload_attempt_id is distinct from v_attempt.id
      or new.public_source_storage_bucket is distinct from v_attempt.storage_bucket
      or new.public_source_storage_path is distinct from v_attempt.storage_path
      or new.document_bucket is distinct from new.public_source_storage_bucket
      or new.document_paths is distinct from array[new.public_source_storage_path]
      or new.document_id is not null
      or new.image_paths is distinct from '{}'::text[]
      or new.public_source_cleanup_not_before is distinct from v_attempt.cleanup_not_before then
      raise exception 'public source cleanup identity does not match its reservation';
    end if;
    if (new.status = 'processing') is distinct from
        (new.public_source_claim_token is not null and new.public_source_claim_expires_at is not null)
      or (new.status <> 'processing' and
        (new.public_source_claim_token is not null or new.public_source_claim_expires_at is not null)) then
      raise exception 'public source cleanup claim state is invalid';
    end if;
    if (v_operation = 'upsert' and new.status not in ('pending', 'processing'))
      or (v_operation = 'claim' and new.status is distinct from 'processing')
      or (v_operation = 'complete' and new.status is distinct from 'completed')
      or (v_operation = 'release' and new.status is distinct from 'failed') then
      raise exception 'public source cleanup mutation is not authorized for this state';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.guard_public_source_cleanup_job_identity() from public, anon, authenticated, service_role;
create trigger storage_cleanup_jobs_guard_public_source_identity
before insert or update or delete on public.storage_cleanup_jobs
for each row execute function public.guard_public_source_cleanup_job_identity();

create table public.public_source_activation_guards (
  token uuid primary key,
  version_id uuid not null references public.public_source_versions(id) on delete cascade,
  transaction_id bigint not null,
  backend_pid integer not null,
  created_at timestamptz not null default now()
);

alter table public.public_source_policy_entries enable row level security;
alter table public.public_source_activation_events enable row level security;
alter table public.public_source_versions enable row level security;
alter table public.public_source_upload_attempts enable row level security;
alter table public.public_source_activation_guards enable row level security;
revoke all on table public.public_source_policy_entries from public, anon, authenticated, service_role;
revoke all on table public.public_source_activation_events from public, anon, authenticated, service_role;
revoke all on table public.public_source_versions from public, anon, authenticated, service_role;
revoke all on table public.public_source_upload_attempts from public, anon, authenticated, service_role;
revoke all on table public.public_source_activation_guards from public, anon, authenticated, service_role;
grant select on table public.public_source_policy_entries to service_role;
grant select on table public.public_source_activation_events to service_role;
grant select on table public.public_source_versions to service_role;
grant select on table public.public_source_upload_attempts to service_role;

create policy "public source policy entries service role"
  on public.public_source_policy_entries for select to service_role using (true);
create policy "public source activation events service role"
  on public.public_source_activation_events for select to service_role using (true);
create policy "public source versions service role"
  on public.public_source_versions for select to service_role using (true);
create policy "public source upload attempts service role"
  on public.public_source_upload_attempts for select to service_role using (true);

create or replace function public.prevent_public_source_control_plane_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'public_source_policy_entries' then
    raise exception 'public source policy entries are immutable';
  end if;
  raise exception 'public source activation events are append-only';
end;
$$;

revoke all on function public.prevent_public_source_control_plane_mutation() from public, anon, authenticated;

create trigger public_source_policy_entries_immutable
before update or delete on public.public_source_policy_entries
for each row execute function public.prevent_public_source_control_plane_mutation();
create trigger public_source_activation_events_append_only
before update or delete on public.public_source_activation_events
for each row execute function public.prevent_public_source_control_plane_mutation();

create or replace function public.guard_public_source_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_transition_allowed boolean;
begin
  if tg_op = 'DELETE' or old.lifecycle = 'tombstoned' or old.lifecycle = 'abandoned' then
    raise exception 'terminal public source versions are immutable';
  end if;
  if (
    to_jsonb(new) - array['lifecycle', 'staging_document_id', 'reserved_storage_path', 'upload_state', 'upload_lease_token', 'upload_lease_expires_at', 'current_upload_attempt_id', 'finalized_upload_attempt_id', 'extraction_index_generation_id', 'review_queued_at', 'review_reason', 'updated_at']
  ) is distinct from (
    to_jsonb(old) - array['lifecycle', 'staging_document_id', 'reserved_storage_path', 'upload_state', 'upload_lease_token', 'upload_lease_expires_at', 'current_upload_attempt_id', 'finalized_upload_attempt_id', 'extraction_index_generation_id', 'review_queued_at', 'review_reason', 'updated_at']
  ) then
    raise exception 'public source version immutable fields changed';
  end if;
  if old.staging_document_id is not null and new.staging_document_id is distinct from old.staging_document_id then
    raise exception 'public source staging document binding is immutable';
  end if;
  if old.staging_document_id is null and new.staging_document_id is not null
    and new.staging_document_id is distinct from old.reserved_document_id then
    raise exception 'public source staging document does not match its reservation';
  end if;
  if old.finalized_upload_attempt_id is not null
    and new.finalized_upload_attempt_id is distinct from old.finalized_upload_attempt_id then
    raise exception 'public source finalized upload attempt binding is immutable';
  end if;
  if new.upload_state is distinct from old.upload_state and (old.upload_state, new.upload_state) not in (
    ('reserved', 'uploading'), ('reserved', 'cleanup_pending'), ('uploading', 'finalized'),
    ('uploading', 'cleanup_pending')
  ) then
    raise exception 'illegal public source upload state transition';
  end if;
  if new.upload_lease_token is distinct from old.upload_lease_token
    or new.upload_lease_expires_at is distinct from old.upload_lease_expires_at then
    if new.lifecycle is distinct from 'discovered'
      or new.staging_document_id is not null
      or new.upload_state is distinct from 'uploading'
      or new.upload_lease_token is not distinct from old.upload_lease_token
      or new.upload_lease_expires_at <= pg_catalog.clock_timestamp()
      or new.upload_lease_expires_at > pg_catalog.clock_timestamp() + interval '2 minutes 5 seconds'
      or not (old.upload_state = 'reserved'
        or (old.upload_state = 'uploading' and old.upload_lease_expires_at <= pg_catalog.clock_timestamp())) then
      raise exception 'public source upload attempt rotation is invalid';
    end if;
  end if;
  v_transition_allowed := (old.lifecycle, new.lifecycle) in (
    ('discovered', 'shadow'), ('discovered', 'quarantined'), ('discovered', 'tombstoned'), ('discovered', 'abandoned'),
    ('shadow', 'approved'), ('shadow', 'quarantined'), ('shadow', 'tombstoned'),
    ('approved', 'active'), ('approved', 'quarantined'), ('approved', 'tombstoned'),
    ('active', 'quarantined'), ('active', 'tombstoned'),
    ('quarantined', 'approved'), ('quarantined', 'tombstoned')
  );
  if new.lifecycle is distinct from old.lifecycle and not v_transition_allowed then
    raise exception 'illegal public source version lifecycle transition';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.guard_public_source_version_mutation() from public, anon, authenticated;
create trigger public_source_versions_guard_mutation
before update or delete on public.public_source_versions
for each row execute function public.guard_public_source_version_mutation();

create or replace function public.guard_public_source_document_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_keys text[] := array[
    'corpus_scope', 'source_kind', 'source_catalogue_key', 'source_policy_version', 'source_policy_digest',
    'public_source_activation_event_id', 'public_source_activation_sequence', 'public_source_version_id', 'public_source_steward_id',
    'content_mode', 'licence_policy', 'canonical_url', 'exact_version_url', 'version', 'content_hash',
    'raw_response_hash', 'raw_response_byte_count',
    'acquisition_disposition', 'public_source_storage_bucket'
  ];
begin
  if new.metadata->>'public_source_version_id' is not null
    or (tg_op = 'UPDATE' and old.metadata->>'public_source_version_id' is not null) then
    foreach v_key in array v_keys loop
      if not (new.metadata ? v_key) or jsonb_typeof(new.metadata->v_key) = 'null'
        or (tg_op = 'UPDATE' and old.metadata->>'public_source_version_id' is not null
          and new.metadata->>v_key is distinct from old.metadata->>v_key) then
        raise exception 'governed public source document identity is missing, null, or changed';
      end if;
    end loop;
    if tg_op = 'UPDATE' and old.metadata->>'public_source_version_id' is not null
      and (new.content_hash is distinct from old.content_hash
        or new.storage_path is distinct from old.storage_path
        or new.file_type is distinct from old.file_type
        or new.file_size is distinct from old.file_size) then
      raise exception 'governed public source document content identity changed';
    end if;
    if tg_op = 'UPDATE'
      and old.owner_id is not null and new.owner_id is null
      and new.metadata->'public_corpus' is not distinct from 'true'::jsonb then
      begin
        v_key := nullif(pg_catalog.current_setting('app.public_source_controlled_activation', true), '');
      exception when others then
        v_key := null;
      end;
      if v_key is null or not exists (
        select 1 from public.public_source_activation_guards guard
        where guard.token::text = v_key
          and guard.version_id::text = old.metadata->>'public_source_version_id'
          and guard.transaction_id = pg_catalog.txid_current()
          and guard.backend_pid = pg_catalog.pg_backend_pid()
      ) then
        raise exception 'generic P02 publication is forbidden for governed public sources';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_public_source_document_identity() from public, anon, authenticated;
create trigger documents_guard_public_source_identity
before insert or update on public.documents
for each row execute function public.guard_public_source_document_identity();

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
  v_operator_id uuid;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
    or p_manifest->>'version' is distinct from '1'
    or p_manifest->>'sourcePolicyVersion' is distinct from 'australian-source-policy-v1'
    or p_manifest->>'sourcePolicyDigest' is distinct from '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f'
    or coalesce(p_manifest->>'decision', '') not in ('activate', 'quarantine', 'retire')
    or char_length(p_source_catalogue_key) not between 1 and 100 then
    raise exception 'public source activation manifest is invalid';
  end if;
  begin
    v_operator_id := nullif(p_manifest->>'operatorId', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'public source activation evidence is invalid';
  end;
  if v_operator_id is null
    or char_length(trim(coalesce(p_manifest->>'reason', ''))) not between 3 and 2000
    or jsonb_typeof(p_manifest->'evidenceReferences') is distinct from 'array' then
    raise exception 'public source activation evidence is invalid';
  end if;
  select array_agg(value order by ordinality) into v_evidence
  from jsonb_array_elements_text(p_manifest->'evidenceReferences') with ordinality evidence(value, ordinality);
  if cardinality(v_evidence) not between 1 and 50
    or cardinality(v_evidence) is distinct from (select count(distinct value) from unnest(v_evidence) value)
    or exists (select 1 from unnest(v_evidence) value where char_length(trim(value)) not between 1 and 500) then
    raise exception 'public source activation evidence is invalid';
  end if;
  if p_manifest->>'decision' = 'activate' and not exists (
    select 1 from public.public_source_policy_entries policy
    where policy.source_catalogue_key = p_source_catalogue_key
      and policy.policy_version = p_manifest->>'sourcePolicyVersion'
      and policy.policy_digest = p_manifest->>'sourcePolicyDigest'
      and policy.lifecycle = 'active'
      and policy.content_mode = 'indexed_content'
      and policy.exact_document_licence = 'public_index_permitted'
  ) then
    raise exception 'source is not eligible for activation';
  end if;

  v_manifest_digest := encode(extensions.digest(convert_to(p_manifest::text, 'UTF8'), 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_catalogue_key, 0));
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = p_source_catalogue_key
  order by activation_sequence desc limit 1 for update;
  select * into v_event from public.public_source_activation_events where manifest_digest = v_manifest_digest;
  if found then return v_event; end if;
  insert into public.public_source_activation_events (
    source_catalogue_key, policy_version, policy_digest, decision,
    operator_id, reason, evidence_references, manifest_digest
  ) values (
    p_source_catalogue_key, p_manifest->>'sourcePolicyVersion', p_manifest->>'sourcePolicyDigest',
    p_manifest->>'decision', v_operator_id, trim(p_manifest->>'reason'), v_evidence, v_manifest_digest
  ) returning * into v_event;
  return v_event;
end;
$$;

revoke all on function public.record_public_source_activation(jsonb) from public, anon, authenticated;
grant execute on function public.record_public_source_activation(jsonb) to service_role;

create or replace function public.preflight_public_source_acquisition(p_manifest jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  p_source_catalogue_key text := trim(coalesce(p_manifest->>'catalogueKey', ''));
  v_policy public.public_source_policy_entries%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_activation_event_id uuid;
  v_activation_sequence bigint;
  v_steward_id uuid;
  v_storage_bucket text := coalesce(p_manifest->>'storageBucket', '');
  v_url_prefix text;
begin
  begin
    v_activation_event_id := nullif(p_manifest->>'activationEventId', '')::uuid;
    v_activation_sequence := nullif(p_manifest->>'activationSequence', '')::bigint;
    v_steward_id := nullif(p_manifest->>'stewardId', '')::uuid;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'public source authority identity is invalid';
  end;
  if jsonb_typeof(p_manifest) is distinct from 'object'
    or v_activation_event_id is null or v_activation_sequence is null or v_activation_sequence < 1
    or v_steward_id is null or v_storage_bucket !~ '^[a-z0-9][a-z0-9._-]{0,62}$'
    or p_manifest->>'sourcePolicyVersion' is distinct from 'australian-source-policy-v1'
    or p_manifest->>'sourcePolicyDigest' is distinct from '93b99a99f19ac2ae7f316e4b7b4aba24bc756e62c9c9cd51f113df996d517a3f'
    or char_length(p_source_catalogue_key) not between 1 and 100 then
    raise exception 'public source authority manifest is invalid';
  end if;

  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = p_source_catalogue_key
  order by activation_sequence desc limit 1 for update;
  if not found or v_event.decision is distinct from 'activate'
    or v_event.id is distinct from v_activation_event_id
    or v_event.activation_sequence is distinct from v_activation_sequence
    or v_event.policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_event.policy_digest is distinct from p_manifest->>'sourcePolicyDigest' then
    raise exception 'source policy digest does not match the active definition';
  end if;
  select * into v_policy from public.public_source_policy_entries
  where source_catalogue_key = p_source_catalogue_key
    and policy_version = v_event.policy_version and policy_digest = v_event.policy_digest
    and lifecycle = 'active' and content_mode = 'indexed_content'
    and exact_document_licence = 'public_index_permitted';
  if not found then raise exception 'source definition is not active for controlled acquisition'; end if;
  if not exists (select 1 from auth.users where id = v_steward_id) then
    raise exception 'public source steward authority is not current';
  end if;
  v_url_prefix := 'https://' || v_policy.canonical_host;
  if p_manifest->>'exactCanonicalUrl' is distinct from v_policy.canonical_url
    or lower(coalesce(p_manifest->>'exactHostname', '')) is distinct from v_policy.canonical_host
    or coalesce(p_manifest->>'exactVersionUrl', '') !~ '^https://'
    or position('#' in coalesce(p_manifest->>'exactVersionUrl', '')) > 0
    or not (
      lower(p_manifest->>'exactVersionUrl') = v_url_prefix
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || '/%'
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || '?%'
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || ':443/%'
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || ':443?%'
    ) then
    raise exception 'exact version URL is outside the eligible canonical host';
  end if;
  return jsonb_build_object(
    'catalogueKey', p_source_catalogue_key,
    'activationEventId', v_event.id,
    'activationSequence', v_event.activation_sequence,
    'stewardId', v_steward_id,
    'storageBucket', v_storage_bucket,
    'authorized', true
  );
end;
$$;

revoke all on function public.preflight_public_source_acquisition(jsonb) from public, anon, authenticated;
grant execute on function public.preflight_public_source_acquisition(jsonb) to service_role;

create or replace function public.reserve_public_source_version(p_manifest jsonb)
returns public.public_source_versions
language plpgsql
security definer set search_path = ''
as $$
declare
  p_source_catalogue_key text := trim(coalesce(p_manifest->>'catalogueKey', ''));
  v_policy public.public_source_policy_entries%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_version public.public_source_versions%rowtype;
  v_prior_version_id uuid;
  v_steward_id uuid;
  v_activation_event_id uuid;
  v_activation_sequence bigint;
  v_version_id uuid := gen_random_uuid();
  v_document_id uuid := gen_random_uuid();
  v_upload_lease_token uuid := gen_random_uuid();
  v_upload_lease_expires_at timestamptz := pg_catalog.clock_timestamp() + interval '15 minutes';
  v_storage_bucket text := coalesce(p_manifest->>'storageBucket', '');
  v_storage_path text;
  v_url_prefix text;
begin
  begin
    v_steward_id := nullif(p_manifest->>'stewardId', '')::uuid;
    v_activation_event_id := nullif(p_manifest->>'activationEventId', '')::uuid;
    v_activation_sequence := nullif(p_manifest->>'activationSequence', '')::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'public source reservation identity is invalid';
  end;
  if v_steward_id is null or v_activation_event_id is null or v_activation_sequence is null
    or coalesce(p_manifest->>'reservationKey', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_manifest->>'contentHash', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_manifest->>'rawResponseHash', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_manifest->>'rawResponseByteCount', '') !~ '^[0-9]{1,9}$'
    or (p_manifest->>'rawResponseByteCount')::bigint > 157286400
    or coalesce(p_manifest->>'licenceEvidenceDigest', '') !~ '^[0-9a-f]{64}$'
    or v_storage_bucket !~ '^[a-z0-9][a-z0-9._-]{0,62}$'
    or p_manifest->>'disposition' not in ('shadow', 'quarantined')
    or p_manifest->>'fileExtension' not in ('.pdf', '.docx', '.txt') then
    raise exception 'public source reservation manifest is invalid';
  end if;

  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = p_source_catalogue_key
  order by activation_sequence desc limit 1 for update;
  if not found or v_event.decision is distinct from 'activate'
    or v_event.id is distinct from v_activation_event_id
    or v_event.activation_sequence is distinct from v_activation_sequence
    or v_event.policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_event.policy_digest is distinct from p_manifest->>'sourcePolicyDigest' then
    raise exception 'source policy digest does not match the active definition';
  end if;
  select * into v_policy from public.public_source_policy_entries
  where source_catalogue_key = p_source_catalogue_key
    and policy_version = v_event.policy_version and policy_digest = v_event.policy_digest
    and lifecycle = 'active' and content_mode = 'indexed_content'
    and exact_document_licence = 'public_index_permitted';
  if not found then raise exception 'source definition is not active for controlled acquisition'; end if;
  if not exists (select 1 from auth.users where id = v_steward_id) then
    raise exception 'public source steward authority is not current';
  end if;
  v_url_prefix := 'https://' || v_policy.canonical_host;
  if p_manifest->>'exactCanonicalUrl' is distinct from v_policy.canonical_url
    or coalesce(p_manifest->>'exactVersionUrl', '') !~ '^https://'
    or position('#' in coalesce(p_manifest->>'exactVersionUrl', '')) > 0
    or not (
      lower(p_manifest->>'exactVersionUrl') = v_url_prefix
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || '/%'
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || '?%'
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || ':443/%'
      or lower(p_manifest->>'exactVersionUrl') like v_url_prefix || ':443?%'
    ) then
    raise exception 'exact version URL is outside the eligible canonical host';
  end if;

  -- lock-order: version
  select * into v_version from public.public_source_versions
  where reservation_key = p_manifest->>'reservationKey' and lifecycle <> 'abandoned' for update;
  if found then
    if v_version.source_catalogue_key is distinct from p_source_catalogue_key
      or v_version.source_policy_version is distinct from p_manifest->>'sourcePolicyVersion'
      or v_version.source_policy_digest is distinct from p_manifest->>'sourcePolicyDigest'
      or v_version.activation_event_id is distinct from v_activation_event_id
      or v_version.activation_sequence is distinct from v_activation_sequence
      or v_version.exact_canonical_url is distinct from p_manifest->>'exactCanonicalUrl'
      or v_version.exact_version_url is distinct from p_manifest->>'exactVersionUrl'
      or v_version.exact_version is distinct from p_manifest->>'exactVersion'
      or v_version.content_hash is distinct from p_manifest->>'contentHash'
      or v_version.licence_evidence_digest is distinct from p_manifest->>'licenceEvidenceDigest'
      or v_version.steward_id is distinct from v_steward_id
      or v_version.storage_bucket is distinct from v_storage_bucket
      or v_version.intended_disposition is distinct from p_manifest->>'disposition' then
      raise exception 'public source reservation manifest conflicts with existing identity';
    end if;
    return v_version;
  end if;
  if exists (
    select 1 from public.public_source_versions
    where source_catalogue_key = p_source_catalogue_key and content_hash = p_manifest->>'contentHash'
      and lifecycle <> 'abandoned'
  ) then
    raise exception 'public source reservation manifest conflicts with existing identity';
  end if;
  select id into v_prior_version_id from public.public_source_versions
  where source_catalogue_key = p_source_catalogue_key and lifecycle = 'active';
  v_storage_path := v_steward_id::text || '/public-source-staging/' || v_version_id::text || '/source' || p_manifest->>'fileExtension';
  insert into public.public_source_versions (
    id, reservation_key, source_catalogue_key, source_policy_version, source_policy_digest,
    exact_canonical_url, exact_version_url, exact_version, content_hash,
    raw_response_hash, raw_response_byte_count, retrieved_at,
    licence_evidence_digest, steward_id, reserved_document_id, reserved_storage_path, storage_bucket,
    upload_lease_token, upload_lease_expires_at, upload_state,
    intended_disposition, lifecycle, supersedes_version_id, activation_event_id, activation_sequence
  ) values (
    v_version_id, p_manifest->>'reservationKey', p_source_catalogue_key, v_event.policy_version, v_event.policy_digest,
    p_manifest->>'exactCanonicalUrl', p_manifest->>'exactVersionUrl', trim(p_manifest->>'exactVersion'),
    p_manifest->>'contentHash', p_manifest->>'rawResponseHash',
    (p_manifest->>'rawResponseByteCount')::bigint, (p_manifest->>'retrievedAt')::timestamptz,
    p_manifest->>'licenceEvidenceDigest', v_steward_id, v_document_id, v_storage_path, v_storage_bucket,
    v_upload_lease_token, v_upload_lease_expires_at, 'reserved',
    p_manifest->>'disposition', 'discovered', v_prior_version_id, v_event.id, v_event.activation_sequence
  ) returning * into v_version;
  return v_version;
end;
$$;

revoke all on function public.reserve_public_source_version(jsonb) from public, anon, authenticated;
grant execute on function public.reserve_public_source_version(jsonb) to service_role;

create or replace function public.schedule_public_source_upload_attempt_cleanup(p_attempt_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_attempt public.public_source_upload_attempts%rowtype;
  v_version public.public_source_versions%rowtype;
  v_guard_token uuid := gen_random_uuid();
begin
  select * into v_attempt from public.public_source_upload_attempts where id = p_attempt_id;
  select * into v_version from public.public_source_versions where id = v_attempt.version_id;
  if v_attempt.id is null or v_version.id is null or v_attempt.state is distinct from 'cleanup_pending' then
    raise exception 'public source upload attempt is not cleanup eligible';
  end if;
  insert into public.public_source_cleanup_mutation_guards(
    token, public_source_reservation_id, public_source_upload_attempt_id, operation, transaction_id, backend_pid
  ) values (
    v_guard_token, v_version.id, v_attempt.id, 'upsert', pg_catalog.txid_current(), pg_catalog.pg_backend_pid()
  );
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', v_guard_token::text, true);
  insert into public.storage_cleanup_jobs (
    owner_id, document_id, document_title, document_bucket, document_paths, image_paths,
    public_source_reservation_id, public_source_upload_attempt_id, public_source_storage_bucket,
    public_source_storage_path, public_source_cleanup_not_before, status, metadata
  ) values (
    v_version.steward_id, null, 'Retired controlled public source upload attempt',
    v_attempt.storage_bucket, array[v_attempt.storage_path], '{}'::text[], v_version.id, v_attempt.id,
    v_attempt.storage_bucket, v_attempt.storage_path, v_attempt.cleanup_not_before, 'pending',
    jsonb_build_object('public_source_reservation_id', v_version.id, 'public_source_upload_attempt_id', v_attempt.id)
  )
  on conflict (public_source_upload_attempt_id) do update
  set status = case when public.storage_cleanup_jobs.status = 'processing'
        and public.storage_cleanup_jobs.public_source_claim_expires_at > pg_catalog.clock_timestamp()
      then 'processing' else 'pending' end,
      attempts = case when public.storage_cleanup_jobs.status = 'processing'
        and public.storage_cleanup_jobs.public_source_claim_expires_at > pg_catalog.clock_timestamp()
      then public.storage_cleanup_jobs.attempts else 0 end,
      last_error = null, completed_at = null,
      public_source_claim_token = case when public.storage_cleanup_jobs.status = 'processing'
        and public.storage_cleanup_jobs.public_source_claim_expires_at > pg_catalog.clock_timestamp()
      then public.storage_cleanup_jobs.public_source_claim_token else null end,
      public_source_claim_expires_at = case when public.storage_cleanup_jobs.status = 'processing'
        and public.storage_cleanup_jobs.public_source_claim_expires_at > pg_catalog.clock_timestamp()
      then public.storage_cleanup_jobs.public_source_claim_expires_at else null end;
  delete from public.public_source_cleanup_mutation_guards where token = v_guard_token;
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', '', true);
end;
$$;

revoke all on function public.schedule_public_source_upload_attempt_cleanup(uuid) from public, anon, authenticated, service_role;

create or replace function public.reap_expired_public_source_upload_attempts(p_limit integer)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  v_candidate record;
  v_event public.public_source_activation_events%rowtype;
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_reaped integer := 0;
begin
  if p_limit not between 1 and 100 then
    raise exception 'public source upload attempt reap limit is invalid';
  end if;
  for v_candidate in
    select attempt.id, version.id as version_id, version.source_catalogue_key, version.reserved_document_id
    from public.public_source_upload_attempts attempt
    join public.public_source_versions version on version.id = attempt.version_id
    where attempt.state in ('authorized', 'bound')
      and attempt.claim_expires_at <= pg_catalog.clock_timestamp()
    order by version.source_catalogue_key, attempt.created_at, attempt.id
    limit p_limit
  loop
    -- lock-order: advisory
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_candidate.source_catalogue_key, 0));
    -- lock-order: latest-event
    select * into v_event from public.public_source_activation_events
    where source_catalogue_key = v_candidate.source_catalogue_key
    order by activation_sequence desc limit 1 for update;
    -- lock-order: document
    perform 1 from public.documents where id = v_candidate.reserved_document_id for update;
    -- lock-order: version
    select * into v_version from public.public_source_versions where id = v_candidate.version_id for update;
    -- lock-order: upload-attempt
    select * into v_attempt from public.public_source_upload_attempts where id = v_candidate.id for update;
    if v_event.id is not null and v_version.id is not null and v_attempt.id is not null
      and v_attempt.version_id = v_version.id and v_attempt.state in ('authorized', 'bound')
      and v_attempt.claim_expires_at <= pg_catalog.clock_timestamp() then
      update public.public_source_upload_attempts
      set state = 'cleanup_pending', updated_at = pg_catalog.clock_timestamp()
      where id = v_attempt.id;
      perform public.schedule_public_source_upload_attempt_cleanup(v_attempt.id);
      v_reaped := v_reaped + 1;
    end if;
  end loop;
  return v_reaped;
end;
$$;

revoke all on function public.reap_expired_public_source_upload_attempts(integer) from public, anon, authenticated;
grant execute on function public.reap_expired_public_source_upload_attempts(integer) to service_role;

create or replace function public.authorize_public_source_upload(p_manifest jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  p_source_catalogue_key text := trim(coalesce(p_manifest->>'catalogueKey', ''));
  v_event public.public_source_activation_events%rowtype;
  v_version public.public_source_versions%rowtype;
  v_prior_attempt public.public_source_upload_attempts%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_reservation_id uuid;
  v_steward_id uuid;
  v_activation_event_id uuid;
  v_activation_sequence bigint;
  v_upload_lease_token uuid;
  v_upload_lease_expires_at timestamptz;
  v_attempt_id uuid := gen_random_uuid();
  v_attempt_token uuid := gen_random_uuid();
  v_attempt_expires_at timestamptz := pg_catalog.clock_timestamp() + interval '2 minutes';
  v_attempt_path text;
begin
  begin
    v_reservation_id := nullif(p_manifest->>'reservationId', '')::uuid;
    v_steward_id := nullif(p_manifest->>'stewardId', '')::uuid;
    v_activation_event_id := nullif(p_manifest->>'activationEventId', '')::uuid;
    v_activation_sequence := nullif(p_manifest->>'activationSequence', '')::bigint;
    v_upload_lease_token := nullif(p_manifest->>'uploadLeaseToken', '')::uuid;
    v_upload_lease_expires_at := nullif(p_manifest->>'uploadLeaseExpiresAt', '')::timestamptz;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'public source upload authority identity is invalid';
  end;
  if v_reservation_id is null or v_steward_id is null or v_activation_event_id is null
    or v_activation_sequence is null or v_upload_lease_token is null or v_upload_lease_expires_at is null
    or coalesce(p_manifest->>'storageBucket', '') !~ '^[a-z0-9][a-z0-9._-]{0,62}$'
    or p_manifest->>'fileExtension' not in ('.pdf', '.docx', '.txt') then
    raise exception 'public source upload authority manifest is invalid';
  end if;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events where source_catalogue_key = p_source_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  perform 1 from public.documents where id = nullif(p_manifest->>'reservedDocumentId', '')::uuid for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions where id = v_reservation_id for update;
  -- lock-order: upload-attempt
  if v_version.current_upload_attempt_id is not null then
    select * into v_prior_attempt from public.public_source_upload_attempts
    where id = v_version.current_upload_attempt_id for update;
  end if;
  if v_version.id is null or v_event.decision is distinct from 'activate'
    or v_event.id is distinct from v_activation_event_id
    or v_event.activation_sequence is distinct from v_activation_sequence
    or v_version.activation_event_id is distinct from v_event.id
    or v_version.source_catalogue_key is distinct from p_source_catalogue_key
    or v_version.source_policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_version.source_policy_digest is distinct from p_manifest->>'sourcePolicyDigest'
    or v_version.reservation_key is distinct from p_manifest->>'reservationKey'
    or v_version.exact_canonical_url is distinct from p_manifest->>'exactCanonicalUrl'
    or v_version.exact_version_url is distinct from p_manifest->>'exactVersionUrl'
    or v_version.exact_version is distinct from p_manifest->>'exactVersion'
    or v_version.content_hash is distinct from p_manifest->>'contentHash'
    or v_version.raw_response_hash is distinct from p_manifest->>'rawResponseHash'
    or v_version.raw_response_byte_count is distinct from (p_manifest->>'rawResponseByteCount')::bigint
    or v_version.licence_evidence_digest is distinct from p_manifest->>'licenceEvidenceDigest'
    or v_version.intended_disposition is distinct from p_manifest->>'disposition'
    or v_version.steward_id is distinct from v_steward_id
    or v_version.reserved_document_id::text is distinct from p_manifest->>'reservedDocumentId'
    or v_version.reserved_storage_path is distinct from p_manifest->>'reservedStoragePath'
    or v_version.storage_bucket is distinct from p_manifest->>'storageBucket'
    or v_version.upload_lease_token is distinct from v_upload_lease_token
    or v_version.upload_lease_expires_at is distinct from v_upload_lease_expires_at
    or v_version.lifecycle is distinct from 'discovered' or v_version.staging_document_id is not null then
    raise exception 'public source upload lease is stale or governance changed';
  end if;
  if v_prior_attempt.id is not null then
    if v_prior_attempt.state in ('authorized', 'bound')
      and v_prior_attempt.claim_expires_at > pg_catalog.clock_timestamp() then
      raise exception 'public source upload attempt is already claimed';
    end if;
    if v_prior_attempt.state not in ('authorized', 'bound', 'cleanup_pending', 'cleaned') then
      raise exception 'public source upload attempt cannot be rotated';
    end if;
    if v_prior_attempt.state in ('authorized', 'bound') then
      update public.public_source_upload_attempts set state = 'cleanup_pending', updated_at = pg_catalog.clock_timestamp()
      where id = v_prior_attempt.id;
      perform public.schedule_public_source_upload_attempt_cleanup(v_prior_attempt.id);
    end if;
  elsif v_version.upload_state <> 'reserved' then
    raise exception 'public source upload attempt is already claimed';
  end if;
  if not exists (select 1 from auth.users where id = v_version.steward_id) then
    raise exception 'public source steward authority is not current';
  end if;
  v_attempt_path := v_version.steward_id::text || '/public-source-staging/' || v_version.id::text || '/' ||
    v_attempt_id::text || '/source' || p_manifest->>'fileExtension';
  insert into public.public_source_upload_attempts(
    id, version_id, claim_token, claim_expires_at, storage_bucket, storage_path,
    cleanup_not_before, state
  ) values (
    v_attempt_id, v_version.id, v_attempt_token, v_attempt_expires_at, v_version.storage_bucket, v_attempt_path,
    v_attempt_expires_at + interval '2 hours' + interval '60 seconds' + interval '5 minutes', 'authorized'
  ) returning * into v_attempt;
  update public.public_source_versions set upload_state = 'uploading', upload_lease_token = v_attempt_token,
    upload_lease_expires_at = v_attempt_expires_at, reserved_storage_path = v_attempt_path,
    current_upload_attempt_id = v_attempt.id
  where id = v_version.id returning * into v_version;
  return to_jsonb(v_version) || jsonb_build_object('upload_attempt_id', v_attempt.id);
end;
$$;

revoke all on function public.authorize_public_source_upload(jsonb) from public, anon, authenticated;
grant execute on function public.authorize_public_source_upload(jsonb) to service_role;

create or replace function public.bind_public_source_upload_authority(p_manifest jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_attempt_id uuid;
  v_claim_token uuid;
  v_signed_expires_at timestamptz;
begin
  begin
    v_attempt_id := nullif(p_manifest->>'uploadAttemptId', '')::uuid;
    v_claim_token := nullif(p_manifest->>'uploadLeaseToken', '')::uuid;
    v_signed_expires_at := nullif(p_manifest->>'signedAuthorityExpiresAt', '')::timestamptz;
  exception when invalid_text_representation then
    raise exception 'public source signed upload authority identity is invalid';
  end;
  if v_attempt_id is null or v_claim_token is null or v_signed_expires_at is null
    or coalesce(p_manifest->>'signedAuthorityDigest', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'public source signed upload authority manifest is invalid';
  end if;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_manifest->>'catalogueKey', 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = p_manifest->>'catalogueKey' order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  perform 1 from public.documents where id = nullif(p_manifest->>'reservedDocumentId', '')::uuid for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions where id = nullif(p_manifest->>'reservationId', '')::uuid for update;
  -- lock-order: upload-attempt
  select * into v_attempt from public.public_source_upload_attempts where id = v_attempt_id for update;
  if v_version.id is null or v_attempt.id is null or v_event.id is distinct from v_version.activation_event_id
    or v_event.id::text is distinct from p_manifest->>'activationEventId'
    or v_event.activation_sequence is distinct from v_version.activation_sequence
    or v_event.activation_sequence::text is distinct from p_manifest->>'activationSequence'
    or v_event.decision <> 'activate'
    or v_event.policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_event.policy_digest is distinct from p_manifest->>'sourcePolicyDigest'
    or v_version.source_catalogue_key is distinct from p_manifest->>'catalogueKey'
    or v_version.source_policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_version.source_policy_digest is distinct from p_manifest->>'sourcePolicyDigest'
    or v_version.reservation_key is distinct from p_manifest->>'reservationKey'
    or v_version.exact_canonical_url is distinct from p_manifest->>'exactCanonicalUrl'
    or v_version.exact_version_url is distinct from p_manifest->>'exactVersionUrl'
    or v_version.content_hash is distinct from p_manifest->>'contentHash'
    or v_version.raw_response_hash is distinct from p_manifest->>'rawResponseHash'
    or v_version.raw_response_byte_count is distinct from (p_manifest->>'rawResponseByteCount')::bigint
    or v_version.licence_evidence_digest is distinct from p_manifest->>'licenceEvidenceDigest'
    or v_version.intended_disposition is distinct from p_manifest->>'disposition'
    or v_version.reserved_document_id::text is distinct from p_manifest->>'reservedDocumentId'
    or v_version.current_upload_attempt_id is distinct from v_attempt.id
    or v_attempt.version_id is distinct from v_version.id or v_attempt.claim_token is distinct from v_claim_token
    or v_attempt.claim_expires_at is distinct from (p_manifest->>'uploadLeaseExpiresAt')::timestamptz
    or v_attempt.storage_bucket is distinct from p_manifest->>'storageBucket'
    or v_attempt.storage_path is distinct from p_manifest->>'reservedStoragePath'
    or v_version.steward_id::text is distinct from p_manifest->>'stewardId'
    or not exists (select 1 from auth.users where id = v_version.steward_id) then
    raise exception 'public source signed upload governance changed while locks were acquired';
  end if;
  if v_attempt.state = 'bound' then
    if v_attempt.signed_authority_digest is distinct from p_manifest->>'signedAuthorityDigest'
      or v_attempt.signed_authority_expires_at is distinct from v_signed_expires_at then
      raise exception 'public source signed upload authority conflicts with bound evidence';
    end if;
    return to_jsonb(v_attempt);
  end if;
  if v_attempt.state <> 'authorized' or v_attempt.claim_expires_at <= pg_catalog.clock_timestamp()
    or v_signed_expires_at <= pg_catalog.clock_timestamp()
    or v_signed_expires_at > pg_catalog.clock_timestamp() + interval '2 hours' + interval '60 seconds' then
    raise exception 'public source signed upload authority is stale or overlong';
  end if;
  update public.public_source_upload_attempts set state = 'bound',
    signed_authority_digest = p_manifest->>'signedAuthorityDigest', signed_authority_expires_at = v_signed_expires_at,
    cleanup_not_before = v_signed_expires_at + interval '60 seconds' + interval '5 minutes',
    updated_at = pg_catalog.clock_timestamp()
  where id = v_attempt.id returning * into v_attempt;
  return to_jsonb(v_attempt);
end;
$$;

revoke all on function public.bind_public_source_upload_authority(jsonb) from public, anon, authenticated;
grant execute on function public.bind_public_source_upload_authority(jsonb) to service_role;

create or replace function public.finalize_public_source_version(p_manifest jsonb, p_max_attempts integer)
returns public.public_source_versions
language plpgsql
security definer set search_path = ''
as $$
declare
  p_source_catalogue_key text := trim(coalesce(p_manifest->>'catalogueKey', ''));
  v_policy public.public_source_policy_entries%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_document public.documents%rowtype;
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_reservation_id uuid;
  v_document_id uuid;
  v_steward_id uuid;
  v_activation_event_id uuid;
  v_activation_sequence bigint;
  v_upload_lease_token uuid;
  v_upload_lease_expires_at timestamptz;
  v_upload_attempt_id uuid;
  v_signed_authority_expires_at timestamptz;
  v_url_prefix text;
begin
  begin
    v_reservation_id := nullif(p_manifest->>'reservationId', '')::uuid;
    v_document_id := nullif(p_manifest->'document'->>'id', '')::uuid;
    v_steward_id := nullif(p_manifest->>'stewardId', '')::uuid;
    v_activation_event_id := nullif(p_manifest->>'activationEventId', '')::uuid;
    v_activation_sequence := nullif(p_manifest->>'activationSequence', '')::bigint;
    v_upload_lease_token := nullif(p_manifest->>'uploadLeaseToken', '')::uuid;
    v_upload_lease_expires_at := nullif(p_manifest->>'uploadLeaseExpiresAt', '')::timestamptz;
    v_upload_attempt_id := nullif(p_manifest->>'uploadAttemptId', '')::uuid;
    v_signed_authority_expires_at := nullif(p_manifest->>'signedAuthorityExpiresAt', '')::timestamptz;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'public source finalization identity is invalid';
  end;
  if v_reservation_id is null or v_document_id is null or v_steward_id is null
    or v_activation_event_id is null or v_activation_sequence is null or v_upload_lease_token is null
    or v_upload_lease_expires_at is null or v_upload_attempt_id is null or v_signed_authority_expires_at is null
    or coalesce(p_manifest->>'signedAuthorityDigest', '') !~ '^[0-9a-f]{64}$'
    or coalesce(p_manifest->>'storageBucket', '') !~ '^[a-z0-9][a-z0-9._-]{0,62}$'
    or p_manifest->>'disposition' not in ('shadow', 'quarantined')
    or p_max_attempts not between 1 and 25 then
    raise exception 'public source finalization manifest is invalid';
  end if;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_source_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = p_source_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  select * into v_document from public.documents where id = v_document_id for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions where id = v_reservation_id for update;
  -- lock-order: upload-attempt
  select * into v_attempt from public.public_source_upload_attempts where id = v_upload_attempt_id for update;
  if v_version.id is null or v_attempt.id is null or v_event.id is distinct from v_version.activation_event_id
    or v_event.id is distinct from v_activation_event_id
    or v_event.activation_sequence is distinct from v_activation_sequence
    or v_version.activation_sequence is distinct from v_activation_sequence
    or v_event.decision is distinct from 'activate'
    or v_version.source_catalogue_key is distinct from p_source_catalogue_key
    or v_version.source_policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_version.source_policy_digest is distinct from p_manifest->>'sourcePolicyDigest'
    or v_version.reservation_key is distinct from p_manifest->>'reservationKey'
    or v_version.exact_canonical_url is distinct from p_manifest->>'exactCanonicalUrl'
    or v_version.exact_version_url is distinct from p_manifest->>'exactVersionUrl'
    or v_version.exact_version is distinct from p_manifest->>'exactVersion'
    or v_version.content_hash is distinct from p_manifest->>'contentHash'
    or v_version.raw_response_hash is distinct from p_manifest->>'rawResponseHash'
    or v_version.raw_response_byte_count is distinct from (p_manifest->>'rawResponseByteCount')::bigint
    or v_version.licence_evidence_digest is distinct from p_manifest->>'licenceEvidenceDigest'
    or v_version.steward_id is distinct from v_steward_id
    or v_version.storage_bucket is distinct from p_manifest->>'storageBucket'
    or v_version.upload_lease_token is distinct from v_upload_lease_token
    or v_version.upload_lease_expires_at is distinct from v_upload_lease_expires_at
    or v_version.current_upload_attempt_id is distinct from v_attempt.id
    or v_attempt.version_id is distinct from v_version.id
    or v_attempt.claim_token is distinct from v_upload_lease_token
    or v_attempt.claim_expires_at is distinct from v_upload_lease_expires_at
    or v_attempt.storage_bucket is distinct from p_manifest->>'storageBucket'
    or v_attempt.storage_path is distinct from p_manifest->'document'->>'storage_path'
    or v_attempt.signed_authority_digest is distinct from p_manifest->>'signedAuthorityDigest'
    or v_attempt.signed_authority_expires_at is distinct from v_signed_authority_expires_at
    or v_attempt.state not in ('bound', 'finalized')
    or v_version.upload_state not in ('uploading', 'finalized')
    or (v_version.upload_state = 'uploading' and pg_catalog.clock_timestamp() >= v_version.upload_lease_expires_at)
    or v_version.reserved_document_id is distinct from v_document_id
    or v_version.intended_disposition is distinct from p_manifest->>'disposition' then
    raise exception 'public source governance changed while locks were acquired';
  end if;
  select * into v_policy from public.public_source_policy_entries
  where source_catalogue_key = v_version.source_catalogue_key
    and policy_version = v_version.source_policy_version and policy_digest = v_version.source_policy_digest
    and lifecycle = 'active' and content_mode = 'indexed_content'
    and exact_document_licence = 'public_index_permitted';
  if not found then raise exception 'source policy digest does not match the active definition'; end if;
  if not exists (select 1 from auth.users where id = v_version.steward_id) then
    raise exception 'public source steward authority is not current';
  end if;
  v_url_prefix := 'https://' || v_policy.canonical_host;
  if v_version.exact_canonical_url is distinct from v_policy.canonical_url
    or not (
      lower(v_version.exact_version_url) = v_url_prefix
      or lower(v_version.exact_version_url) like v_url_prefix || '/%'
      or lower(v_version.exact_version_url) like v_url_prefix || '?%'
      or lower(v_version.exact_version_url) like v_url_prefix || ':443/%'
      or lower(v_version.exact_version_url) like v_url_prefix || ':443?%'
    ) then
    raise exception 'exact version URL is outside the eligible canonical host';
  end if;
  if v_version.staging_document_id is not null then
    if not found or v_version.upload_state is distinct from 'finalized'
      or v_document.id is distinct from v_version.staging_document_id
      or v_document.storage_path is distinct from v_version.reserved_storage_path
      or v_document.content_hash is distinct from v_version.content_hash then
      raise exception 'public source finalized state is inconsistent';
    end if;
    return v_version;
  end if;
  if v_document.id is not null then raise exception 'public source reserved document identity is already occupied'; end if;
  if p_manifest->'document'->>'owner_id' is distinct from v_steward_id::text
    or p_manifest->'document'->>'storage_path' is distinct from v_version.reserved_storage_path
    or p_manifest->'document'->>'content_hash' is distinct from v_version.content_hash
    or p_manifest->'document'->'metadata'->>'corpus_scope' is distinct from 'australian_public'
    or p_manifest->'document'->'metadata'->>'source_catalogue_key' is distinct from v_version.source_catalogue_key
    or p_manifest->'document'->'metadata'->>'source_policy_version' is distinct from v_version.source_policy_version
    or p_manifest->'document'->'metadata'->>'source_policy_digest' is distinct from v_version.source_policy_digest
    or p_manifest->'document'->'metadata'->>'public_source_activation_event_id' is distinct from v_version.activation_event_id::text
    or p_manifest->'document'->'metadata'->>'public_source_activation_sequence' is distinct from v_version.activation_sequence::text
    or p_manifest->'document'->'metadata'->>'public_source_version_id' is distinct from v_version.id::text
    or p_manifest->'document'->'metadata'->>'public_source_steward_id' is distinct from v_version.steward_id::text
    or p_manifest->'document'->'metadata'->>'content_mode' is distinct from 'indexed_content'
    or p_manifest->'document'->'metadata'->>'licence_policy' is distinct from 'public_index_permitted'
    or p_manifest->'document'->'metadata'->>'canonical_url' is distinct from v_version.exact_canonical_url
    or p_manifest->'document'->'metadata'->>'exact_version_url' is distinct from v_version.exact_version_url
    or p_manifest->'document'->'metadata'->>'version' is distinct from v_version.exact_version
    or p_manifest->'document'->'metadata'->>'content_hash' is distinct from v_version.content_hash
    or p_manifest->'document'->'metadata'->>'raw_response_hash' is distinct from v_version.raw_response_hash
    or p_manifest->'document'->'metadata'->>'raw_response_byte_count' is distinct from v_version.raw_response_byte_count::text
    or p_manifest->'document'->'metadata'->>'acquisition_disposition' is distinct from v_version.intended_disposition
    or p_manifest->'document'->'metadata'->>'public_source_storage_bucket' is distinct from v_version.storage_bucket then
    raise exception 'public source finalization document evidence does not match its reservation';
  end if;

  insert into public.documents (
    id, owner_id, title, description, file_name, file_type, file_size,
    storage_path, content_hash, status, metadata
  ) values (
    v_document_id, v_steward_id, p_manifest->'document'->>'title',
    nullif(p_manifest->'document'->>'description', ''), p_manifest->'document'->>'file_name',
    p_manifest->'document'->>'file_type', (p_manifest->'document'->>'file_size')::bigint,
    v_version.reserved_storage_path, v_version.content_hash,
    case when p_manifest->>'disposition' = 'shadow' then 'queued' else 'failed' end,
    p_manifest->'document'->'metadata'
  ) returning * into v_document;
  if v_document.content_hash is distinct from v_version.content_hash
    or v_document.metadata->>'exact_version_url' is distinct from v_version.exact_version_url then
    raise exception 'public source finalized document hash or exact URL mismatch';
  end if;
  if p_manifest->>'disposition' = 'shadow' then
    insert into public.ingestion_jobs (document_id, batch_id, status, stage, progress, max_attempts)
    values (v_document.id, null, 'pending', 'queued', 0, p_max_attempts);
  elsif p_manifest->>'disposition' = 'quarantined' then
    null; -- persisted and intentionally has no claimable job
  end if;
  update public.public_source_versions
  set staging_document_id = v_document.id,
      upload_state = 'finalized',
      finalized_upload_attempt_id = v_attempt.id,
      lifecycle = p_manifest->>'disposition',
      review_queued_at = case when p_manifest->>'disposition' = 'quarantined' then now() else null end,
      review_reason = case when p_manifest->>'disposition' = 'quarantined'
        then 'Trusted HTML retained a Healthdirect marker in visible main content.' else null end
  where id = v_version.id returning * into v_version;
  update public.public_source_upload_attempts
  set state = 'finalized', updated_at = pg_catalog.clock_timestamp()
  where id = v_attempt.id and state = 'bound';
  return v_version;
end;
$$;

revoke all on function public.finalize_public_source_version(jsonb, integer) from public, anon, authenticated;
grant execute on function public.finalize_public_source_version(jsonb, integer) to service_role;

create or replace function public.abandon_public_source_reservation(p_manifest jsonb)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_reservation_id uuid;
  v_activation_event_id uuid;
  v_activation_sequence bigint;
  v_steward_id uuid;
  v_reserved_document_id uuid;
  v_upload_lease_token uuid;
  v_upload_lease_expires_at timestamptz;
  v_upload_attempt_id uuid;
  v_signed_authority_expires_at timestamptz;
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_event public.public_source_activation_events%rowtype;
begin
  begin
    v_reservation_id := nullif(p_manifest->>'reservationId', '')::uuid;
    v_activation_event_id := nullif(p_manifest->>'activationEventId', '')::uuid;
    v_activation_sequence := nullif(p_manifest->>'activationSequence', '')::bigint;
    v_steward_id := nullif(p_manifest->>'stewardId', '')::uuid;
    v_reserved_document_id := nullif(p_manifest->>'reservedDocumentId', '')::uuid;
    v_upload_lease_token := nullif(p_manifest->>'uploadLeaseToken', '')::uuid;
    v_upload_lease_expires_at := nullif(p_manifest->>'uploadLeaseExpiresAt', '')::timestamptz;
    v_upload_attempt_id := nullif(p_manifest->>'uploadAttemptId', '')::uuid;
    v_signed_authority_expires_at := nullif(p_manifest->>'signedAuthorityExpiresAt', '')::timestamptz;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'public source abandonment identity is invalid';
  end;
  select * into v_version from public.public_source_versions where id = v_reservation_id;
  if not found then raise exception 'public source reservation was not found'; end if;

  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_version.source_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_version.source_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  perform 1 from public.documents where id = v_version.reserved_document_id for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions where id = v_reservation_id for update;
  -- lock-order: upload-attempt
  select * into v_attempt from public.public_source_upload_attempts where id = v_upload_attempt_id for update;
  if v_version.id is null or v_attempt.id is null or v_event.id is null
    or v_version.reservation_key is distinct from p_manifest->>'reservationKey'
    or v_version.source_catalogue_key is distinct from p_manifest->>'catalogueKey'
    or v_version.source_policy_version is distinct from p_manifest->>'sourcePolicyVersion'
    or v_version.source_policy_digest is distinct from p_manifest->>'sourcePolicyDigest'
    or v_version.activation_event_id is distinct from v_activation_event_id
    or v_version.activation_sequence is distinct from v_activation_sequence
    or v_version.exact_canonical_url is distinct from p_manifest->>'exactCanonicalUrl'
    or v_version.exact_version_url is distinct from p_manifest->>'exactVersionUrl'
    or v_version.exact_version is distinct from p_manifest->>'exactVersion'
    or v_version.content_hash is distinct from p_manifest->>'contentHash'
    or v_version.raw_response_hash is distinct from p_manifest->>'rawResponseHash'
    or v_version.raw_response_byte_count is distinct from (p_manifest->>'rawResponseByteCount')::bigint
    or v_version.licence_evidence_digest is distinct from p_manifest->>'licenceEvidenceDigest'
    or v_version.steward_id is distinct from v_steward_id
    or v_version.storage_bucket is distinct from p_manifest->>'storageBucket'
    or v_version.upload_lease_token is distinct from v_upload_lease_token
    or v_version.upload_lease_expires_at is distinct from v_upload_lease_expires_at
    or v_version.current_upload_attempt_id is distinct from v_attempt.id
    or v_attempt.version_id is distinct from v_version.id
    or v_attempt.claim_token is distinct from v_upload_lease_token
    or v_attempt.claim_expires_at is distinct from v_upload_lease_expires_at
    or v_attempt.signed_authority_digest is distinct from p_manifest->>'signedAuthorityDigest'
    or v_attempt.signed_authority_expires_at is distinct from v_signed_authority_expires_at
    or v_attempt.storage_bucket is distinct from p_manifest->>'storageBucket'
    or v_attempt.storage_path is distinct from p_manifest->>'reservedStoragePath'
    or v_version.intended_disposition is distinct from p_manifest->>'disposition'
    or v_version.reserved_document_id is distinct from v_reserved_document_id
    or v_version.reserved_storage_path is distinct from p_manifest->>'reservedStoragePath' then
    raise exception 'public source governance changed while locks were acquired';
  end if;

  if not exists (select 1 from auth.users where id = v_version.steward_id) then
    raise exception 'public source steward authority is not current';
  end if;

  if v_version.staging_document_id is not null then
    return jsonb_build_object(
      'status', 'committed', 'storagePath', v_version.reserved_storage_path,
      'storageOwned', true, 'storage_owned', true, 'lifecycle', v_version.lifecycle
    );
  end if;
  if exists (select 1 from public.documents where id = v_version.reserved_document_id)
    or exists (select 1 from public.ingestion_jobs where document_id = v_version.reserved_document_id) then
    raise exception 'public source reservation ownership is inconsistent';
  end if;
  if v_version.lifecycle not in ('discovered', 'abandoned') then
    raise exception 'only an unfinalized discovered reservation can be abandoned';
  end if;
  if v_version.lifecycle = 'discovered' then
    update public.public_source_versions
    set lifecycle = 'abandoned', upload_state = 'cleanup_pending', review_queued_at = now(),
        review_reason = 'Unfinalized reservation abandoned after definitive finalization failure.'
    where id = v_version.id returning * into v_version;
  end if;
  if v_attempt.state in ('authorized', 'bound') then
    update public.public_source_upload_attempts
    set state = 'cleanup_pending', updated_at = pg_catalog.clock_timestamp()
    where id = v_attempt.id;
  elsif v_attempt.state not in ('cleanup_pending', 'cleaned') then
    raise exception 'public source upload attempt cannot be abandoned';
  end if;
  if v_attempt.state <> 'cleaned' then
    perform public.schedule_public_source_upload_attempt_cleanup(v_attempt.id);
  end if;
  return jsonb_build_object(
    'status', 'abandoned', 'storagePath', v_version.reserved_storage_path,
    'storageOwned', false, 'storage_owned', false, 'cleanupDurable', true
  );
end;
$$;

revoke all on function public.abandon_public_source_reservation(jsonb) from public, anon, authenticated;
grant execute on function public.abandon_public_source_reservation(jsonb) to service_role;

create or replace function public.claim_public_source_cleanup_job(p_max_attempts integer)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.storage_cleanup_jobs%rowtype;
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_catalogue_key text;
  v_claim_token uuid := gen_random_uuid();
  v_guard_token uuid := gen_random_uuid();
begin
  if p_max_attempts not between 1 and 25 then
    raise exception 'public source cleanup claim limit is invalid';
  end if;
  select * into v_job from public.storage_cleanup_jobs
  where public_source_reservation_id is not null
    and public_source_cleanup_not_before <= pg_catalog.clock_timestamp()
    and attempts < p_max_attempts
    and (status in ('pending', 'failed')
      or (status = 'processing' and public_source_claim_expires_at <= pg_catalog.clock_timestamp()))
  order by created_at, id limit 1;
  if not found then return null; end if;
  select source_catalogue_key into v_catalogue_key from public.public_source_versions
  where id = v_job.public_source_reservation_id;
  if not found then raise exception 'public source cleanup reservation is missing'; end if;

  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  perform 1 from public.documents where id = v_job.document_id for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions
  where id = v_job.public_source_reservation_id for update;
  -- lock-order: upload-attempt
  select * into v_attempt from public.public_source_upload_attempts
  where id = v_job.public_source_upload_attempt_id for update;
  -- lock-order: cleanup-job
  select * into v_job from public.storage_cleanup_jobs where id = v_job.id for update;
  if not found or v_event.id is null
    or v_attempt.state is distinct from 'cleanup_pending'
    or v_attempt.version_id is distinct from v_version.id
    or v_job.public_source_upload_attempt_id is distinct from v_attempt.id
    or v_job.public_source_reservation_id is distinct from v_version.id
    or v_job.public_source_storage_bucket is distinct from v_attempt.storage_bucket
    or v_job.public_source_storage_path is distinct from v_attempt.storage_path
    or v_job.document_bucket is distinct from v_attempt.storage_bucket
    or v_job.document_paths is distinct from array[v_attempt.storage_path]
    or v_job.image_paths is distinct from '{}'::text[]
    or v_job.public_source_cleanup_not_before is distinct from v_attempt.cleanup_not_before
    or v_job.public_source_cleanup_not_before > pg_catalog.clock_timestamp()
    or v_job.attempts >= p_max_attempts
    or not (v_job.status in ('pending', 'failed')
      or (v_job.status = 'processing'
        and v_job.public_source_claim_expires_at <= pg_catalog.clock_timestamp())) then
    return null;
  end if;
  insert into public.public_source_cleanup_mutation_guards(
    token, public_source_reservation_id, public_source_upload_attempt_id, operation, transaction_id, backend_pid
  ) values (
    v_guard_token, v_version.id, v_attempt.id, 'claim', pg_catalog.txid_current(), pg_catalog.pg_backend_pid()
  );
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', v_guard_token::text, true);
  update public.storage_cleanup_jobs
  set status = 'processing', attempts = attempts + 1,
      public_source_claim_token = v_claim_token,
      public_source_claim_expires_at = pg_catalog.clock_timestamp() + interval '2 minutes',
      last_error = null, completed_at = null
  where id = v_job.id returning * into v_job;
  delete from public.public_source_cleanup_mutation_guards where token = v_guard_token;
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', '', true);
  return jsonb_build_object(
    'id', v_job.id,
    'claimToken', v_claim_token,
    'claimExpiresAt', v_job.public_source_claim_expires_at,
    'reservationId', v_version.id,
    'uploadAttemptId', v_attempt.id,
    'bucket', v_attempt.storage_bucket,
    'path', v_attempt.storage_path,
    'imagePaths', jsonb_build_array(),
    'attempts', v_job.attempts
  );
end;
$$;

revoke all on function public.claim_public_source_cleanup_job(integer) from public, anon, authenticated;
grant execute on function public.claim_public_source_cleanup_job(integer) to service_role;

create or replace function public.complete_public_source_cleanup_job(
  p_job_id uuid, p_claim_token uuid, p_storage_removed integer
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.storage_cleanup_jobs%rowtype;
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_catalogue_key text;
  v_guard_token uuid := gen_random_uuid();
begin
  select * into v_job from public.storage_cleanup_jobs where id = p_job_id;
  if not found or v_job.public_source_reservation_id is null then
    raise exception 'public source cleanup claim is invalid';
  end if;
  select source_catalogue_key into v_catalogue_key from public.public_source_versions
  where id = v_job.public_source_reservation_id;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  perform 1 from public.documents where id = v_job.document_id for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions
  where id = v_job.public_source_reservation_id for update;
  -- lock-order: upload-attempt
  select * into v_attempt from public.public_source_upload_attempts
  where id = v_job.public_source_upload_attempt_id for update;
  -- lock-order: cleanup-job
  select * into v_job from public.storage_cleanup_jobs where id = p_job_id for update;
  if not found or v_event.id is null
    or v_job.status is distinct from 'processing'
    or v_job.public_source_claim_token is distinct from p_claim_token
    or v_job.public_source_claim_expires_at <= pg_catalog.clock_timestamp()
    or p_storage_removed not between 0 and 100
    or v_attempt.state is distinct from 'cleanup_pending'
    or v_attempt.version_id is distinct from v_version.id
    or v_job.public_source_upload_attempt_id is distinct from v_attempt.id
    or v_job.public_source_reservation_id is distinct from v_version.id
    or v_job.public_source_storage_bucket is distinct from v_attempt.storage_bucket
    or v_job.public_source_storage_path is distinct from v_attempt.storage_path
    or v_job.public_source_cleanup_not_before is distinct from v_attempt.cleanup_not_before then
    raise exception 'public source cleanup claim is stale or inconsistent';
  end if;
  insert into public.public_source_cleanup_mutation_guards(
    token, public_source_reservation_id, public_source_upload_attempt_id, operation, transaction_id, backend_pid
  ) values (
    v_guard_token, v_version.id, v_attempt.id, 'complete', pg_catalog.txid_current(), pg_catalog.pg_backend_pid()
  );
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', v_guard_token::text, true);
  update public.storage_cleanup_jobs
  set status = 'completed', storage_removed = p_storage_removed,
      public_source_claim_token = null, public_source_claim_expires_at = null,
      last_error = null, completed_at = pg_catalog.clock_timestamp()
  where id = p_job_id and public_source_claim_token = p_claim_token;
  update public.public_source_upload_attempts
  set state = 'cleaned', updated_at = pg_catalog.clock_timestamp()
  where id = v_attempt.id and state = 'cleanup_pending';
  delete from public.public_source_cleanup_mutation_guards where token = v_guard_token;
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', '', true);
  return jsonb_build_object('status', 'completed', 'id', p_job_id);
end;
$$;

revoke all on function public.complete_public_source_cleanup_job(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.complete_public_source_cleanup_job(uuid, uuid, integer) to service_role;

create or replace function public.release_public_source_cleanup_job(
  p_job_id uuid, p_claim_token uuid, p_error text
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
  v_job public.storage_cleanup_jobs%rowtype;
  v_version public.public_source_versions%rowtype;
  v_attempt public.public_source_upload_attempts%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_catalogue_key text;
  v_guard_token uuid := gen_random_uuid();
begin
  if p_error is distinct from 'storage_delete_failed' then
    raise exception 'public source cleanup release reason is invalid';
  end if;
  select * into v_job from public.storage_cleanup_jobs where id = p_job_id;
  if not found or v_job.public_source_reservation_id is null then
    raise exception 'public source cleanup claim is invalid';
  end if;
  select source_catalogue_key into v_catalogue_key from public.public_source_versions
  where id = v_job.public_source_reservation_id;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  perform 1 from public.documents where id = v_job.document_id for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions
  where id = v_job.public_source_reservation_id for update;
  -- lock-order: upload-attempt
  select * into v_attempt from public.public_source_upload_attempts
  where id = v_job.public_source_upload_attempt_id for update;
  -- lock-order: cleanup-job
  select * into v_job from public.storage_cleanup_jobs where id = p_job_id for update;
  if not found or v_event.id is null
    or v_job.status is distinct from 'processing'
    or v_job.public_source_claim_token is distinct from p_claim_token
    or v_job.public_source_claim_expires_at <= pg_catalog.clock_timestamp()
    or v_attempt.state is distinct from 'cleanup_pending'
    or v_attempt.version_id is distinct from v_version.id
    or v_job.public_source_upload_attempt_id is distinct from v_attempt.id
    or v_job.public_source_reservation_id is distinct from v_version.id
    or v_job.public_source_storage_bucket is distinct from v_attempt.storage_bucket
    or v_job.public_source_storage_path is distinct from v_attempt.storage_path
    or v_job.public_source_cleanup_not_before is distinct from v_attempt.cleanup_not_before then
    raise exception 'public source cleanup claim is stale or inconsistent';
  end if;
  insert into public.public_source_cleanup_mutation_guards(
    token, public_source_reservation_id, public_source_upload_attempt_id, operation, transaction_id, backend_pid
  ) values (
    v_guard_token, v_version.id, v_attempt.id, 'release', pg_catalog.txid_current(), pg_catalog.pg_backend_pid()
  );
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', v_guard_token::text, true);
  update public.storage_cleanup_jobs
  set status = 'failed', public_source_claim_token = null,
      public_source_claim_expires_at = null, last_error = p_error, completed_at = null
  where id = p_job_id and public_source_claim_token = p_claim_token;
  delete from public.public_source_cleanup_mutation_guards where token = v_guard_token;
  perform pg_catalog.set_config('app.public_source_cleanup_mutation', '', true);
  return jsonb_build_object('status', 'failed', 'id', p_job_id);
end;
$$;

revoke all on function public.release_public_source_cleanup_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.release_public_source_cleanup_job(uuid, uuid, text) to service_role;

create or replace function public.assert_public_source_document_governance(p_document_id uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  v_catalogue_key text;
  v_version_id uuid;
  v_version_marker text;
  v_document public.documents%rowtype;
  v_version public.public_source_versions%rowtype;
  v_event public.public_source_activation_events%rowtype;
begin
  select metadata->>'source_catalogue_key', metadata->>'public_source_version_id',
    case when metadata->>'public_source_version_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (metadata->>'public_source_version_id')::uuid end
  into v_catalogue_key, v_version_marker, v_version_id
  from public.documents where id = p_document_id;
  if not found then raise exception 'governed public source document was not found'; end if;
  if v_version_marker is not null and v_version_id is null then
    raise exception 'governed public source document marker is invalid';
  end if;
  if v_version_id is null then return; end if;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  select * into v_document from public.documents where id = p_document_id for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions where id = v_version_id for update;
  if v_document.metadata->>'source_catalogue_key' is distinct from v_catalogue_key
    or v_document.metadata->>'public_source_version_id' is distinct from v_version_id::text
    or v_version.source_catalogue_key is distinct from v_catalogue_key
    or v_version.staging_document_id is distinct from v_document.id then
    raise exception 'public source governance changed while locks were acquired';
  end if;
  if v_document.owner_id is null
    or v_document.owner_id::text is distinct from v_document.metadata->>'public_source_steward_id'
    or v_document.metadata->>'public_source_storage_bucket' is distinct from v_version.storage_bucket then
    raise exception 'governed public source document lost steward ownership';
  end if;
  if v_version.steward_id is distinct from v_document.owner_id
    or v_version.lifecycle not in ('shadow', 'approved')
    or v_document.metadata->>'corpus_scope' is distinct from 'australian_public'
    or v_document.metadata->>'source_kind' is distinct from 'document'
    or v_document.metadata->>'source_policy_version' is distinct from v_version.source_policy_version
    or v_document.metadata->>'source_policy_digest' is distinct from v_version.source_policy_digest
    or v_document.metadata->>'public_source_activation_event_id' is distinct from v_version.activation_event_id::text
    or v_document.metadata->>'public_source_activation_sequence' is distinct from v_version.activation_sequence::text
    or v_document.metadata->>'content_mode' is distinct from 'indexed_content'
    or v_document.metadata->>'licence_policy' is distinct from 'public_index_permitted'
    or v_document.metadata->>'canonical_url' is distinct from v_version.exact_canonical_url
    or v_document.metadata->>'exact_version_url' is distinct from v_version.exact_version_url
    or v_document.metadata->>'version' is distinct from v_version.exact_version
    or v_document.metadata->>'content_hash' is distinct from v_version.content_hash
    or v_document.metadata->>'raw_response_hash' is distinct from v_version.raw_response_hash
    or v_document.metadata->>'raw_response_byte_count' is distinct from v_version.raw_response_byte_count::text
    or v_document.content_hash is distinct from v_version.content_hash
    or v_document.metadata->>'acquisition_disposition' is distinct from 'shadow' then
    raise exception 'governed public source document metadata is invalid';
  end if;
  if v_event.id is distinct from v_version.activation_event_id
    or v_event.activation_sequence is distinct from v_version.activation_sequence
    or v_event.decision is distinct from 'activate'
    or v_event.policy_digest is distinct from v_version.source_policy_digest then
    raise exception 'governed public source is no longer active';
  end if;
end;
$$;

revoke all on function public.assert_public_source_document_governance(uuid) from public, anon, authenticated;
grant execute on function public.assert_public_source_document_governance(uuid) to service_role;

create or replace function public.restore_public_source_document_to_steward(
  p_document_id uuid,
  p_steward_id uuid,
  p_change_state text
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_cache_rows integer;
begin
  update public.document_labels set owner_id = p_steward_id, updated_at = now() where document_id = p_document_id;
  update public.document_summaries set owner_id = p_steward_id, updated_at = now() where document_id = p_document_id;
  update public.document_sections set owner_id = p_steward_id, updated_at = now() where document_id = p_document_id;
  update public.document_memory_cards set owner_id = p_steward_id, updated_at = now() where document_id = p_document_id;
  update public.document_table_facts set owner_id = p_steward_id where document_id = p_document_id;
  update public.document_embedding_fields set owner_id = p_steward_id where document_id = p_document_id;
  update public.document_index_quality set owner_id = p_steward_id, updated_at = now() where document_id = p_document_id;
  update public.document_index_units set owner_id = p_steward_id, updated_at = now() where document_id = p_document_id;
  update public.documents
  set owner_id = p_steward_id,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'change_state', p_change_state,
        'public_corpus', false,
        'public_source_retrieval_removed_at', now()
      ),
      updated_at = now()
  where id = p_document_id;
  delete from public.rag_response_cache
  where owner_id is null and cache_kind in ('search', 'answer');
  get diagnostics v_cache_rows = row_count;
  return v_cache_rows;
end;
$$;

revoke all on function public.restore_public_source_document_to_steward(uuid, uuid, text) from public, anon, authenticated, service_role;

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
  v_catalogue_key text;
  v_document_id uuid;
  v_prior_version_id uuid;
  v_prior_document_id uuid;
  v_version public.public_source_versions%rowtype;
  v_prior_version public.public_source_versions%rowtype;
  v_document public.documents%rowtype;
  v_prior_document public.documents%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_approval public.document_publication_approvals%rowtype;
  v_prior_approval public.document_publication_approvals%rowtype;
begin
  select source_catalogue_key, staging_document_id, supersedes_version_id
  into v_catalogue_key, v_document_id, v_prior_version_id
  from public.public_source_versions where id = p_version_id;
  if not found then raise exception 'public source version was not found'; end if;
  if v_prior_version_id is not null then
    select staging_document_id into v_prior_document_id from public.public_source_versions where id = v_prior_version_id;
  end if;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  perform 1 from public.documents
  where id = any(array_remove(array[v_document_id, v_prior_document_id], null))
  order by id for update;
  -- lock-order: version
  perform 1 from public.public_source_versions
  where id = any(array_remove(array[p_version_id, v_prior_version_id], null))
  order by id for update;
  select * into v_version from public.public_source_versions where id = p_version_id;
  select * into v_document from public.documents where id = v_version.staging_document_id;
  if v_version.source_catalogue_key is distinct from v_catalogue_key
    or v_version.staging_document_id is distinct from v_document_id
    or v_version.supersedes_version_id is distinct from v_prior_version_id
    or v_event.source_catalogue_key is distinct from v_catalogue_key then
    raise exception 'public source governance changed while locks were acquired';
  end if;
  if v_event.id is distinct from p_activation_event_id
    or v_event.id is distinct from v_version.activation_event_id
    or v_event.activation_sequence is distinct from v_version.activation_sequence
    or v_event.decision is distinct from 'activate'
    or v_event.policy_digest is distinct from v_version.source_policy_digest then
    raise exception 'public source lifecycle transition lacks active definition evidence';
  end if;
  if v_document.id is null then raise exception 'public source staging document was not found'; end if;

  if p_target_lifecycle = 'approved' then
    if v_version.lifecycle not in ('shadow', 'quarantined')
      or v_document.owner_id is null or v_document.owner_id is distinct from v_version.steward_id
      or v_document.status is distinct from 'indexed' or v_document.index_generation_id is null then
      raise exception 'public source approval requires an indexed steward-owned document';
    end if;
    select * into v_approval from public.document_publication_approvals approval
    where approval.document_id = v_document.id
      and approval.expected_prior_owner_id = v_version.steward_id
      and approval.decision = 'approved'
      and approval.source_catalogue_key = v_version.source_catalogue_key
      and approval.source_policy_version = v_version.source_policy_version
      and approval.reviewed_index_generation_id = v_document.index_generation_id
    order by approval.approved_at desc, approval.id desc limit 1 for update;
    if not found then raise exception 'public source version lacks matching P02 approval'; end if;
  elsif p_target_lifecycle = 'active' then
    raise exception 'use the controlled public source activation RPC';
  end if;

  if p_target_lifecycle in ('quarantined', 'tombstoned') then
    perform public.restore_public_source_document_to_steward(
      v_document.id, v_version.steward_id,
      case when p_target_lifecycle = 'quarantined' then 'quarantined' else 'withdrawn' end
    );
  end if;
  update public.public_source_versions
  set lifecycle = p_target_lifecycle,
      extraction_index_generation_id = coalesce(extraction_index_generation_id, v_document.index_generation_id)
  where id = p_version_id returning * into v_version;
  return v_version;
end;
$$;

revoke all on function public.transition_public_source_version(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.transition_public_source_version(uuid, text, uuid) to service_role;

create or replace function public.activate_public_source_version(
  p_version_id uuid,
  p_activation_event_id uuid,
  p_publication_manifest jsonb,
  p_expected_state_digest text,
  p_expected_generation_ids uuid[]
)
returns public.public_source_versions
language plpgsql
security definer set search_path = ''
as $$
declare
  v_catalogue_key text;
  v_document_id uuid;
  v_prior_version_id uuid;
  v_prior_document_id uuid;
  v_guard_token uuid := extensions.gen_random_uuid();
  v_version public.public_source_versions%rowtype;
  v_prior_version public.public_source_versions%rowtype;
  v_document public.documents%rowtype;
  v_prior_document public.documents%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_approval public.document_publication_approvals%rowtype;
  v_prior_approval public.document_publication_approvals%rowtype;
begin
  select source_catalogue_key, staging_document_id
  into v_catalogue_key, v_document_id
  from public.public_source_versions where id = p_version_id;
  if not found or v_document_id is null then raise exception 'public source version was not found'; end if;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_catalogue_key
  order by activation_sequence desc limit 1 for update;
  select id, staging_document_id into v_prior_version_id, v_prior_document_id
  from public.public_source_versions
  where source_catalogue_key = v_catalogue_key and lifecycle = 'active' and id <> p_version_id;
  -- lock-order: document
  perform 1 from public.documents
  where id = any(array_remove(array[v_document_id, v_prior_document_id], null))
  order by id for update;
  -- lock-order: version
  perform 1 from public.public_source_versions
  where id = any(array_remove(array[p_version_id, v_prior_version_id], null))
  order by id for update;
  select * into v_version from public.public_source_versions where id = p_version_id;
  select * into v_document from public.documents where id = v_version.staging_document_id;
  if v_prior_version_id is not null then
    select * into v_prior_version from public.public_source_versions where id = v_prior_version_id;
    select * into v_prior_document from public.documents where id = v_prior_document_id;
  end if;
  if v_version.source_catalogue_key is distinct from v_catalogue_key
    or v_version.staging_document_id is distinct from v_document_id
    or v_event.source_catalogue_key is distinct from v_catalogue_key
    or (v_prior_version_id is not null and (
      v_prior_version.source_catalogue_key is distinct from v_catalogue_key
      or v_prior_version.staging_document_id is distinct from v_prior_document_id
      or v_prior_version.lifecycle is distinct from 'active'
    )) then
    raise exception 'public source governance changed while locks were acquired';
  end if;
  if v_event.id is distinct from p_activation_event_id
    or v_event.id is distinct from v_version.activation_event_id
    or v_event.activation_sequence is distinct from v_version.activation_sequence
    or v_event.decision is distinct from 'activate'
    or v_event.policy_digest is distinct from v_version.source_policy_digest then
    raise exception 'public source activation lacks current definition evidence';
  end if;
  if v_version.lifecycle is distinct from 'approved'
    or v_document.owner_id is distinct from v_version.steward_id
    or v_document.status is distinct from 'indexed'
    or v_document.index_generation_id is null
    or v_document.content_hash is distinct from v_version.content_hash
    or v_document.metadata->>'public_source_version_id' is distinct from v_version.id::text
    or v_document.metadata->>'source_catalogue_key' is distinct from v_version.source_catalogue_key
    or v_document.metadata->>'source_policy_version' is distinct from v_version.source_policy_version
    or v_document.metadata->>'source_policy_digest' is distinct from v_version.source_policy_digest
    or v_document.metadata->>'exact_version_url' is distinct from v_version.exact_version_url
    or v_document.metadata->>'public_source_steward_id' is distinct from v_version.steward_id::text
    or v_document.metadata->>'public_source_storage_bucket' is distinct from v_version.storage_bucket then
    raise exception 'public source activation document governance is invalid';
  end if;
  if jsonb_typeof(p_publication_manifest->'documents') is distinct from 'array'
    or jsonb_array_length(p_publication_manifest->'documents') <> 1
    or p_publication_manifest->'documents'->0->>'documentId' is distinct from v_document.id::text
    or p_publication_manifest->'documents'->0->>'decision' is distinct from 'approved'
    or p_publication_manifest->'documents'->0->>'sourceCatalogueKey' is distinct from v_version.source_catalogue_key then
    raise exception 'controlled public source activation requires one exact P02 document';
  end if;
  select * into v_approval from public.document_publication_approvals approval
  where approval.document_id = v_document.id
    and approval.expected_prior_owner_id = v_version.steward_id
    and approval.decision = 'approved'
    and approval.source_catalogue_key = v_version.source_catalogue_key
    and approval.source_policy_version = v_version.source_policy_version
    and approval.reviewed_index_generation_id = v_document.index_generation_id
  order by approval.approved_at desc, approval.id desc limit 1 for update;
  if not found then raise exception 'public source activation lacks matching P02 approval'; end if;
  if v_prior_version_id is not null then
    if v_version.supersedes_version_id is distinct from v_prior_version_id then
      raise exception 'replacement requires the currently active predecessor';
    end if;
    if v_prior_document.owner_id is not null
      or v_prior_document.metadata->'public_corpus' is distinct from 'true'::jsonb
      or v_prior_document.metadata->>'publication_approval_id' is null then
      raise exception 'replacement predecessor lacks exact public receipt facts';
    end if;
    select * into v_prior_approval from public.document_publication_approvals approval
    where approval.id = (v_prior_document.metadata->>'publication_approval_id')::uuid
      and approval.document_id = v_prior_document.id and approval.decision = 'approved'
      and approval.source_catalogue_key = v_prior_version.source_catalogue_key
      and approval.source_policy_version = v_prior_version.source_policy_version
      and approval.reviewed_index_generation_id = v_prior_document.index_generation_id
    for update;
    if not found then raise exception 'replacement predecessor lacks matching P02 approval history'; end if;
  elsif v_version.supersedes_version_id is not null then
    raise exception 'replacement requires the currently active predecessor';
  end if;

  insert into public.public_source_activation_guards(token, version_id, transaction_id, backend_pid)
  values (v_guard_token, v_version.id, pg_catalog.txid_current(), pg_catalog.pg_backend_pid());
  perform pg_catalog.set_config('app.public_source_controlled_activation', v_guard_token::text, true);
  perform public.activate_approved_public_documents(
    p_publication_manifest, p_expected_state_digest, p_expected_generation_ids
  );
  delete from public.public_source_activation_guards where token = v_guard_token;
  perform pg_catalog.set_config('app.public_source_controlled_activation', '', true);

  select * into v_document from public.documents where id = v_document_id;
  if v_document.owner_id is not null
    or v_document.metadata->'public_corpus' is distinct from 'true'::jsonb
    or v_document.metadata->>'publication_approval_id' is distinct from v_approval.id::text
    or v_document.metadata->>'publication_source_policy_version' is distinct from v_version.source_policy_version
    or v_document.metadata->>'publication_reviewed_index_generation_id' is distinct from v_document.index_generation_id::text then
    raise exception 'public source activation lacks matching P02 public receipt facts';
  end if;
  if v_prior_version_id is not null then
    update public.public_source_versions
    set lifecycle = 'tombstoned', review_queued_at = now(), review_reason = 'Superseded by approved replacement.'
    where id = v_prior_version.id;
    perform public.restore_public_source_document_to_steward(
      v_prior_document.id, v_prior_version.steward_id, 'superseded'
    );
  end if;
  update public.public_source_versions
  set lifecycle = 'active'
  where id = v_version.id returning * into v_version;
  return v_version;
end;
$$;

revoke all on function public.activate_public_source_version(uuid, uuid, jsonb, text, uuid[]) from public, anon, authenticated;
grant execute on function public.activate_public_source_version(uuid, uuid, jsonb, text, uuid[]) to service_role;

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
  v_catalogue_key text;
  v_document_id uuid;
  v_version public.public_source_versions%rowtype;
  v_document public.documents%rowtype;
  v_event public.public_source_activation_events%rowtype;
  v_cache_rows integer;
begin
  if p_operator_id is null or char_length(trim(coalesce(p_reason, ''))) not between 3 and 2000 then
    raise exception 'public source withdrawal evidence is invalid';
  end if;
  select source_catalogue_key, staging_document_id into v_catalogue_key, v_document_id
  from public.public_source_versions where id = p_version_id;
  if not found or v_document_id is null then raise exception 'public source version was not found'; end if;
  -- lock-order: advisory
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_catalogue_key, 0));
  -- lock-order: latest-event
  select * into v_event from public.public_source_activation_events
  where source_catalogue_key = v_catalogue_key
  order by activation_sequence desc limit 1 for update;
  -- lock-order: document
  select * into v_document from public.documents where id = v_document_id for update;
  -- lock-order: version
  select * into v_version from public.public_source_versions where id = p_version_id for update;
  if v_version.source_catalogue_key is distinct from v_catalogue_key
    or v_version.staging_document_id is distinct from v_document.id
    or v_event.source_catalogue_key is distinct from v_catalogue_key then
    raise exception 'public source governance changed while locks were acquired';
  end if;
  if not exists (select 1 from auth.users where id = v_version.steward_id) then
    raise exception 'public source steward authority is not current';
  end if;
  if v_version.lifecycle = 'tombstoned' then
    return jsonb_build_object('version_id', v_version.id, 'lifecycle', 'tombstoned', 'retrieval_removed', true);
  end if;
  update public.public_source_versions
  set lifecycle = 'tombstoned', review_queued_at = now(), review_reason = trim(p_reason)
  where id = v_version.id;
  v_cache_rows := public.restore_public_source_document_to_steward(
    v_document.id, v_version.steward_id, 'withdrawn'
  );
  update public.documents
  set metadata = metadata || jsonb_build_object(
    'public_source_withdrawal_operator_id', p_operator_id,
    'public_source_withdrawal_reason', trim(p_reason),
    'public_source_withdrawn_at', now()
  ) where id = v_document.id;
  return jsonb_build_object(
    'version_id', v_version.id, 'lifecycle', 'tombstoned', 'retrieval_removed', true,
    'queue_human_review', true, 'anonymous_cache_rows_removed', v_cache_rows
  );
end;
$$;

revoke all on function public.withdraw_public_source_version(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.withdraw_public_source_version(uuid, uuid, text) to service_role;

-- Rebuild the claim primitive so a governed row is claimable only while its
-- exact policy, activation, reservation, owned document, and shadow version agree.
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
        d.metadata->>'public_source_version_id' is null
        or (
          d.owner_id is not null
          and d.owner_id::text = d.metadata->>'public_source_steward_id'
          and d.metadata->>'source_kind' = 'document'
          and d.metadata->>'content_mode' = 'indexed_content'
          and d.metadata->>'licence_policy' = 'public_index_permitted'
          and d.metadata->>'acquisition_disposition' = 'shadow'
          and exists (
            select 1
            from public.public_source_versions version
            join public.public_source_policy_entries policy
              on policy.source_catalogue_key = version.source_catalogue_key
              and policy.policy_version = version.source_policy_version
              and policy.policy_digest = version.source_policy_digest
              and policy.lifecycle = 'active' and policy.content_mode = 'indexed_content'
              and policy.exact_document_licence = 'public_index_permitted'
            join lateral (
              select event.id, event.activation_sequence, event.decision, event.policy_digest
              from public.public_source_activation_events event
              where event.source_catalogue_key = version.source_catalogue_key
              order by activation_sequence desc limit 1
            ) latest on true
            where version.id = case
                when d.metadata->>'public_source_version_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                then (d.metadata->>'public_source_version_id')::uuid
              end
              and version.staging_document_id = d.id
              and version.steward_id = d.owner_id
              and version.lifecycle = 'shadow'
              and version.intended_disposition = 'shadow'
              and version.content_hash = d.content_hash
              and d.metadata->>'source_catalogue_key' = version.source_catalogue_key
              and d.metadata->>'source_policy_version' = version.source_policy_version
              and d.metadata->>'source_policy_digest' = version.source_policy_digest
              and d.metadata->>'public_source_activation_event_id' = version.activation_event_id::text
              and d.metadata->>'public_source_activation_sequence' = version.activation_sequence::text
              and d.metadata->>'canonical_url' = version.exact_canonical_url
              and d.metadata->>'exact_version_url' = version.exact_version_url
              and d.metadata->>'content_hash' = version.content_hash
              and d.metadata->>'raw_response_hash' = version.raw_response_hash
              and d.metadata->>'raw_response_byte_count' = version.raw_response_byte_count::text
              and d.metadata->>'public_source_storage_bucket' = version.storage_bucket
              and latest.id = version.activation_event_id
              and latest.activation_sequence = version.activation_sequence
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
  v_merged_metadata jsonb;
  v_key text;
  v_identity_keys text[] := array[
    'corpus_scope', 'source_kind', 'source_catalogue_key', 'source_policy_version', 'source_policy_digest',
    'public_source_activation_event_id', 'public_source_activation_sequence', 'public_source_version_id', 'public_source_steward_id',
    'content_mode', 'licence_policy', 'canonical_url', 'exact_version_url', 'version', 'content_hash',
    'raw_response_hash', 'raw_response_byte_count',
    'acquisition_disposition', 'public_source_storage_bucket'
  ];
begin
  select * into v_job from public.ingestion_jobs where id = p_job_id for update;
  if not found or v_job.document_id is distinct from p_document_id
    or v_job.status is distinct from 'processing' or v_job.locked_by is distinct from p_worker_id then
    raise exception using errcode = 'P0001', message = 'ingestion_lease_lost';
  end if;
  perform public.assert_public_source_document_governance(p_document_id);
  select * into v_document from public.documents where id = p_document_id;
  if v_document.metadata->>'public_source_version_id' is not null then
    v_merged_metadata := coalesce(v_document.metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb);
    foreach v_key in array v_identity_keys loop
      if not (v_merged_metadata ? v_key)
        or jsonb_typeof(v_merged_metadata->v_key) = 'null'
        or v_merged_metadata->>v_key is distinct from v_document.metadata->>v_key then
        raise exception 'governed public source artifact commit removed or changed policy identity';
      end if;
    end loop;
  end if;
  return public.commit_document_index_generation(
    p_document_id, p_index_generation_id, p_status, p_page_count, p_chunk_count,
    p_image_count, coalesce(p_metadata, '{}'::jsonb), p_pages, p_quality
  );
end;
$$;

revoke all on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commit_document_index_generation(
  uuid, text, uuid, uuid, text, integer, integer, integer, jsonb, jsonb, jsonb
) to service_role;
