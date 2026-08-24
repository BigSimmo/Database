-- Durable ownerless site-content publication, release, and fenced outbox control plane.
-- Legacy owner-scoped registry rows remain drafts/provenance and are never public authority.

create table public.site_content_publications (
  id uuid primary key default gen_random_uuid(),
  logical_id text not null,
  kind text not null check (kind in ('service', 'form', 'medication', 'differential', 'presentation')),
  slug text not null,
  source_table text not null check (source_table in ('clinical_registry_records', 'medication_records', 'differential_records')),
  source_row_id uuid not null,
  source_owner_id uuid not null,
  source_version text not null,
  published_by uuid not null,
  reconciliation_plan_digest text,
  record jsonb not null,
  render_payload jsonb not null,
  retired boolean not null default false,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (jsonb_typeof(record) = 'object'),
  check (jsonb_typeof(render_payload) = 'object'),
  check (reconciliation_plan_digest is null or reconciliation_plan_digest ~ '^[0-9a-f]{64}$'),
  unique (id, logical_id)
);

create table public.site_content_reconciliation_plans (
  plan_digest text primary key check (plan_digest ~ '^[0-9a-f]{64}$'),
  trusted_snapshot_digest text not null check (trusted_snapshot_digest ~ '^[0-9a-f]{64}$'),
  dispositions jsonb not null check (jsonb_typeof(dispositions) = 'array'),
  expected_record_count integer not null check (expected_record_count > 0 and expected_record_count <= 5000),
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default pg_catalog.clock_timestamp()
);

create table public.site_content_public_records (
  logical_id text primary key,
  kind text not null check (kind in ('service', 'form', 'medication', 'differential', 'presentation')),
  slug text not null,
  current_publication_id uuid not null,
  retired boolean not null default false,
  pending_event_sequence bigint,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (kind, slug),
  foreign key (current_publication_id, logical_id)
    references public.site_content_publications(id, logical_id)
);

create table public.site_content_sync_state (
  singleton boolean primary key default true check (singleton),
  change_epoch bigint not null default 0 check (change_epoch >= 0),
  active_release_id uuid,
  active_release_digest text,
  initialized boolean not null default false,
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (active_release_digest is null or active_release_digest ~ '^[0-9a-f]{64}$')
);

insert into public.site_content_sync_state(singleton) values (true);

create table public.site_content_sync_events (
  event_sequence bigint generated always as identity primary key,
  logical_id text not null,
  target_publication_id uuid not null,
  target_change_epoch bigint not null check (target_change_epoch > 0),
  state text not null default 'pending'
    check (state in ('pending', 'processing', 'retry_pending', 'ready', 'completed', 'quarantined')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default pg_catalog.clock_timestamp(),
  worker_id uuid,
  lease_token uuid,
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  lease_expires_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key (logical_id) references public.site_content_public_records(logical_id),
  foreign key (target_publication_id, logical_id)
    references public.site_content_publications(id, logical_id),
  unique (logical_id, target_change_epoch, target_publication_id),
  check (
    (state = 'processing' and worker_id is not null and lease_token is not null and lease_expires_at is not null)
    or (state <> 'processing')
  )
);

alter table public.site_content_public_records
  add constraint site_content_public_records_pending_event_fkey
  foreign key (pending_event_sequence) references public.site_content_sync_events(event_sequence)
  deferrable initially deferred;

-- Immutable deterministic planner hand-off. Keeping the reviewed plan outside
-- the mutable lease row prevents claim/retry bookkeeping from changing its
-- content address while still allowing the automatic worker to fetch it only
-- through a fenced RPC.
create table public.site_content_sync_event_plans (
  event_sequence bigint primary key references public.site_content_sync_events(event_sequence),
  plan_digest text not null check (plan_digest ~ '^[0-9a-f]{64}$'),
  target_change_epoch bigint not null check (target_change_epoch > 0),
  plan jsonb not null check (jsonb_typeof(plan) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (event_sequence, plan_digest)
);

create table public.site_content_releases (
  id uuid primary key,
  state text not null check (state in ('candidate', 'active', 'superseded', 'abandoned', 'rolled_back')),
  target_change_epoch bigint not null check (target_change_epoch >= 0),
  previous_release_id uuid references public.site_content_releases(id),
  registry_version text not null,
  static_manifest_digest text not null check (static_manifest_digest ~ '^[0-9a-f]{64}$'),
  dynamic_state_digest text not null check (dynamic_state_digest ~ '^[0-9a-f]{64}$'),
  release_digest text not null check (release_digest ~ '^[0-9a-f]{64}$'),
  generation_id text not null,
  expected_record_count integer not null check (expected_record_count >= 0),
  expected_tombstone_count integer not null check (expected_tombstone_count >= 0),
  must_pass_checks boolean not null default false,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  activated_at timestamptz,
  unique (release_digest, target_change_epoch)
);

alter table public.site_content_sync_state
  add constraint site_content_sync_state_active_release_fkey
  foreign key (active_release_id) references public.site_content_releases(id);

create table public.site_content_release_records (
  release_id uuid not null references public.site_content_releases(id),
  logical_id text not null,
  target_publication_id uuid,
  logical_document_id uuid not null,
  logical_chunk_id uuid not null,
  normalized_text text not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  publication_fingerprint text not null,
  governance_fingerprint text not null,
  lineage_fingerprint text not null,
  public_metadata_fingerprint text not null,
  embedding_model text not null,
  embedding_dimensions integer not null check (embedding_dimensions > 0),
  embedding_fingerprint text not null,
  embedding extensions.vector(1536),
  tombstone boolean not null default false,
  public_visible boolean not null default true,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (release_id, logical_id),
  unique (release_id, logical_document_id),
  unique (release_id, logical_chunk_id),
  check ((tombstone and embedding is null and not public_visible) or (not tombstone and public_visible)),
  foreign key (target_publication_id, logical_id)
    references public.site_content_publications(id, logical_id)
);

create table public.site_content_release_receipts (
  receipt_id text primary key check (receipt_id ~ '^sha256:[0-9a-f]{64}$'),
  release_id uuid not null references public.site_content_releases(id),
  receipt_kind text not null check (receipt_kind in ('activation', 'rollback')),
  recovery_readiness_digest text not null check (recovery_readiness_digest ~ '^[0-9a-f]{64}$'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique (release_id, receipt_kind, receipt_id)
);

create index site_content_sync_events_claim_idx
  on public.site_content_sync_events(state, next_attempt_at, event_sequence)
  where state in ('pending', 'retry_pending');
create index site_content_sync_events_target_idx
  on public.site_content_sync_events(target_change_epoch, logical_id, state);
create index site_content_release_records_public_idx
  on public.site_content_release_records(release_id, logical_id)
  where public_visible and not tombstone;

create or replace function public.guard_site_content_immutable_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'site_content_immutable_row';
end;
$$;

create trigger site_content_publications_immutable
before update or delete on public.site_content_publications
for each row execute function public.guard_site_content_immutable_row();

create trigger site_content_reconciliation_plans_immutable
before update or delete on public.site_content_reconciliation_plans
for each row execute function public.guard_site_content_immutable_row();

create trigger site_content_sync_event_plans_immutable
before update or delete on public.site_content_sync_event_plans
for each row execute function public.guard_site_content_immutable_row();

create trigger site_content_release_records_immutable
before update or delete on public.site_content_release_records
for each row execute function public.guard_site_content_immutable_row();

create trigger site_content_release_receipts_append_only
before update or delete on public.site_content_release_receipts
for each row execute function public.guard_site_content_immutable_row();

create or replace function public.site_content_canonical_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(line, E'\n' order by ordinal), '')
  from (
    select ordinal,
      btrim(regexp_replace(raw_line, '[\t\f\v ]+', ' ', 'g')) as line
    from regexp_split_to_table(replace(replace(coalesce(p_value, ''), E'\r\n', E'\n'), E'\r', E'\n'), E'\n')
      with ordinality split(raw_line, ordinal)
  ) normalized
  where line <> '';
$$;

create or replace function public.site_content_source_projection(
  p_kind text,
  p_source_row_id uuid
)
returns table (
  source_table text,
  source_owner_id uuid,
  source_version text,
  logical_id text,
  slug text,
  record jsonb,
  render_payload jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_domain text;
  v_route text;
  v_source_role text;
  v_title text;
  v_body text;
  v_content_hash text;
  v_publication_version text;
begin
  if p_kind in ('service', 'form') then
    select to_jsonb(r) into strict v_row
    from public.clinical_registry_records r
    where r.id = p_source_row_id and r.kind = p_kind
    for update;
    source_table := 'clinical_registry_records';
    v_domain := case p_kind when 'service' then 'services' else 'forms' end;
    v_route := case p_kind when 'service' then '/services/' else '/forms/' end || (v_row->>'slug');
    v_source_role := case p_kind when 'service' then 'service_directory' else 'form_reference' end;
  elsif p_kind = 'medication' then
    select to_jsonb(r) into strict v_row
    from public.medication_records r
    where r.id = p_source_row_id
    for update;
    source_table := 'medication_records';
    v_domain := 'medications';
    v_route := '/medications/' || (v_row->>'slug');
    v_source_role := 'clinical_reference';
  elsif p_kind in ('differential', 'presentation') then
    select to_jsonb(r) into strict v_row
    from public.differential_records r
    where r.id = p_source_row_id
      and r.kind = case p_kind when 'presentation' then 'presentation' else 'diagnosis' end
    for update;
    source_table := 'differential_records';
    v_domain := 'differentials';
    v_route := '/differentials/' || case p_kind when 'presentation' then 'presentations/' else 'diagnoses/' end || (v_row->>'slug');
    v_source_role := 'clinical_reference';
  else
    raise exception using errcode = '22023', message = 'site_content_kind_invalid';
  end if;

  source_owner_id := (v_row->>'owner_id')::uuid;
  source_version := to_char((v_row->>'updated_at')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  slug := v_row->>'slug';
  logical_id := v_domain || ':' || case when p_kind in ('differential', 'presentation') then
    case p_kind when 'presentation' then 'presentation:' else 'diagnosis:' end else '' end || slug;
  if p_kind = 'medication' then
    v_title := public.site_content_canonical_text(v_row->>'name');
    v_body := public.site_content_canonical_text(pg_catalog.concat_ws(E'\n',
      v_row->>'name', v_row->>'class', v_row->>'subclass', v_row->>'category', v_row->>'schedule',
      v_row->>'stats', v_row->>'sections', v_row->>'quick'));
  elsif p_kind in ('differential', 'presentation') then
    v_title := public.site_content_canonical_text(v_row->>'title');
    v_body := public.site_content_canonical_text(pg_catalog.concat_ws(E'\n',
      v_row->>'title', v_row->>'subtitle', v_row->>'clinical_hinge', v_row->>'tags',
      v_row->>'payload', v_row->>'source'));
  else
    v_title := public.site_content_canonical_text(v_row->>'title');
    v_body := public.site_content_canonical_text(pg_catalog.concat_ws(E'\n',
      v_row->>'title', v_row->>'subtitle', v_row->>'eligibility', v_row->>'cost', v_row->>'referral',
      v_row->>'location', v_row->>'best_use', v_row->>'tags', v_row->>'status_chips', v_row->>'contacts',
      v_row->>'summary_cards', v_row->>'referral_info', v_row->>'criteria', v_row->>'source'));
  end if;
  v_content_hash := encode(extensions.digest(convert_to(
    '{"body":' || to_jsonb(v_body)::text || ',"title":' || to_jsonb(v_title)::text || '}', 'UTF8'), 'sha256'), 'hex');
  v_publication_version := encode(extensions.digest(convert_to(
    '{"access":"public","body":' || to_jsonb(v_body)::text ||
    ',"domain":' || to_jsonb(v_domain)::text || ',"logicalId":' || to_jsonb(logical_id)::text ||
    ',"producerClass":"dynamic_registry","route":' || to_jsonb(v_route)::text ||
    ',"sourceLineage":[],"sourceRole":' || to_jsonb(v_source_role)::text ||
    ',"sourceStatus":' || to_jsonb(coalesce(v_row->>'source_status', 'unknown'))::text ||
    ',"title":' || to_jsonb(v_title)::text || ',"validationStatus":' ||
    to_jsonb(coalesce(v_row->>'validation_status', 'unverified'))::text ||
    ',"version":"site-content-record-v1"}', 'UTF8'), 'sha256'), 'hex');
  record := jsonb_build_object(
    'version', 'site-content-record-v1',
    'logicalId', logical_id,
    'producerClass', 'dynamic_registry',
    'domain', v_domain,
    'route', v_route,
    'title', v_title,
    'body', v_body,
    'sourceRole', v_source_role,
    'access', 'public',
    'validationStatus', coalesce(v_row->>'validation_status', 'unverified'),
    'sourceStatus', coalesce(v_row->>'source_status', 'unknown'),
    'publicationVersion', v_publication_version,
    'sourceLineage', '[]'::jsonb,
    'contentHash', v_content_hash
  );
  render_payload := v_row - array['id', 'owner_id', 'created_at', 'updated_at'];
  return next;
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'site_content_source_not_found';
end;
$$;

create or replace function public.guard_site_content_receipt_shape(
  p_receipt jsonb,
  p_kind text,
  p_release_id uuid,
  p_recovery_digest text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_id text;
begin
  if jsonb_typeof(p_receipt) <> 'object'
    or p_receipt->>'version' <> (case p_kind when 'activation' then 'activation-receipt-v1' else 'rollback-receipt-v1' end)
    or p_receipt->>'operation' <> 'site_release'
    or coalesce(p_receipt->>'projectRef', '') = '' then
    raise exception using errcode = '22023', message = 'site_content_receipt_invalid';
  end if;
  v_id := p_receipt->>'receiptId';
  if v_id is null or v_id !~ '^sha256:[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'site_content_receipt_id_invalid';
  end if;
  if p_kind = 'activation' then
    if p_receipt->>'recoveryReadinessDigest' is distinct from p_recovery_digest
      or p_receipt#>>'{resource,kind}' <> 'site_release'
      or p_receipt#>>'{resource,siteReleaseId}' is distinct from p_release_id::text then
      raise exception using errcode = '22023', message = 'site_content_activation_receipt_mismatch';
    end if;
  elsif p_receipt->>'method' <> 'retained_previous'
    or p_receipt->>'requiresReconstruction' <> 'false'
    or p_receipt->>'outcome' <> 'succeeded'
    or p_receipt#>>'{target,kind}' <> 'site_release'
    or p_receipt#>>'{target,siteReleaseId}' is distinct from p_release_id::text then
    raise exception using errcode = '22023', message = 'site_content_rollback_receipt_mismatch';
  end if;
  return v_id;
end;
$$;

create or replace function public.record_site_content_reconciliation_plan(
  p_plan_digest text,
  p_trusted_snapshot_digest text,
  p_dispositions jsonb,
  p_expected_record_count integer,
  p_reviewed_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_dispositions) <> 'array'
    or jsonb_array_length(p_dispositions) <> p_expected_record_count
    or jsonb_path_exists(p_dispositions, '$[*] ? (@.disposition == "divergent_requires_administrator_review")')
    or not jsonb_path_exists(p_dispositions, '$[*] ? (@.logicalId.type() == "string")') then
    raise exception using errcode = '22023', message = 'site_content_reconciliation_unresolved';
  end if;
  insert into public.site_content_reconciliation_plans(
    plan_digest, trusted_snapshot_digest, dispositions, expected_record_count, reviewed_by
  ) values (
    p_plan_digest, p_trusted_snapshot_digest, p_dispositions, p_expected_record_count, p_reviewed_by
  ) on conflict (plan_digest) do nothing;
  return found;
end;
$$;

create or replace function public.publish_site_content_record(
  p_kind text,
  p_source_row_id uuid,
  p_expected_source_version text,
  p_expected_change_epoch bigint,
  p_reconciliation_plan_digest text,
  p_published_by uuid
)
returns table (logical_id text, publication_id uuid, event_sequence bigint, change_epoch bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_source record;
  v_existing public.site_content_public_records%rowtype;
  v_publication_id uuid := gen_random_uuid();
  v_event_sequence bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  if v_state.change_epoch is distinct from p_expected_change_epoch then
    return;
  end if;

  select * into strict v_source from public.site_content_source_projection(p_kind, p_source_row_id);
  if v_source.source_version is distinct from p_expected_source_version then
    return;
  end if;
  select * into v_existing
  from public.site_content_public_records h
  where h.logical_id = v_source.logical_id
  for update;
  if not found then
    if p_reconciliation_plan_digest is null or not exists (
      select 1 from public.site_content_reconciliation_plans p
      where p.plan_digest = p_reconciliation_plan_digest
        and jsonb_path_exists(p.dispositions, '$[*] ? (@.logicalId == $logical && @.disposition != "divergent_requires_administrator_review")', jsonb_build_object('logical', v_source.logical_id))
    ) then
      raise exception using errcode = '55000', message = 'site_content_reconciliation_required';
    end if;
  end if;

  insert into public.site_content_publications(
    id, logical_id, kind, slug, source_table, source_row_id, source_owner_id,
    source_version, published_by, reconciliation_plan_digest, record, render_payload, retired
  ) values (
    v_publication_id, v_source.logical_id, p_kind, v_source.slug, v_source.source_table,
    p_source_row_id, v_source.source_owner_id, v_source.source_version, p_published_by,
    p_reconciliation_plan_digest, v_source.record, v_source.render_payload, false
  );
  change_epoch := v_state.change_epoch + 1;
  insert into public.site_content_public_records(logical_id, kind, slug, current_publication_id, retired)
  values (v_source.logical_id, p_kind, v_source.slug, v_publication_id, false)
  on conflict (logical_id) do update set
    current_publication_id = excluded.current_publication_id,
    kind = excluded.kind,
    slug = excluded.slug,
    retired = false,
    updated_at = pg_catalog.clock_timestamp();
  insert into public.site_content_sync_events(logical_id, target_publication_id, target_change_epoch)
  values (v_source.logical_id, v_publication_id, change_epoch)
  returning site_content_sync_events.event_sequence into v_event_sequence;
  update public.site_content_public_records
  set pending_event_sequence = v_event_sequence, updated_at = pg_catalog.clock_timestamp()
  where site_content_public_records.logical_id = v_source.logical_id;
  update public.site_content_sync_state
  set change_epoch = v_state.change_epoch + 1, updated_at = pg_catalog.clock_timestamp()
  where singleton;
  logical_id := v_source.logical_id;
  publication_id := v_publication_id;
  event_sequence := v_event_sequence;
  return next;
end;
$$;

create or replace function public.retire_site_content_record(
  p_kind text,
  p_source_row_id uuid,
  p_expected_source_version text,
  p_expected_change_epoch bigint,
  p_reconciliation_plan_digest text,
  p_published_by uuid
)
returns table (logical_id text, publication_id uuid, event_sequence bigint, change_epoch bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_source record;
  v_head public.site_content_public_records%rowtype;
  v_publication_id uuid := gen_random_uuid();
  v_event_sequence bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  if v_state.change_epoch is distinct from p_expected_change_epoch then return; end if;
  select * into strict v_source from public.site_content_source_projection(p_kind, p_source_row_id);
  if v_source.source_version is distinct from p_expected_source_version then return; end if;
  select * into v_head from public.site_content_public_records where site_content_public_records.logical_id = v_source.logical_id for update;
  if not found or v_head.retired then return; end if;
  insert into public.site_content_publications(
    id, logical_id, kind, slug, source_table, source_row_id, source_owner_id,
    source_version, published_by, reconciliation_plan_digest, record, render_payload, retired
  ) values (
    v_publication_id, v_source.logical_id, p_kind, v_source.slug, v_source.source_table,
    p_source_row_id, v_source.source_owner_id, v_source.source_version, p_published_by,
    null, v_source.record, v_source.render_payload, true
  );
  change_epoch := v_state.change_epoch + 1;
  update public.site_content_public_records set current_publication_id = v_publication_id, retired = true,
    updated_at = pg_catalog.clock_timestamp() where site_content_public_records.logical_id = v_source.logical_id;
  insert into public.site_content_sync_events(logical_id, target_publication_id, target_change_epoch)
  values (v_source.logical_id, v_publication_id, change_epoch)
  returning site_content_sync_events.event_sequence into v_event_sequence;
  update public.site_content_public_records set pending_event_sequence = v_event_sequence
  where site_content_public_records.logical_id = v_source.logical_id;
  update public.site_content_sync_state set change_epoch = v_state.change_epoch + 1, updated_at = pg_catalog.clock_timestamp() where singleton;
  logical_id := v_source.logical_id;
  publication_id := v_publication_id;
  event_sequence := v_event_sequence;
  return next;
end;
$$;

create or replace function public.read_site_content_public_records(
  p_kind text,
  p_slug text default null
)
returns table (initialized boolean, record jsonb, render_payload jsonb, snapshot jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with state as (
    select s.* from public.site_content_sync_state s where s.singleton
  ), requested as (
    select h.logical_id, h.current_publication_id, h.retired, h.pending_event_sequence
    from public.site_content_public_records h
    where h.kind = p_kind and (p_slug is null or h.slug = p_slug)
  ), safe_requested as (
    select r.*
    from requested r
    cross join state s
    where not r.retired
      and (
        not s.initialized
        or (
          s.active_release_id is not null
          and (
            p_slug is not null
            or not exists (
              select 1 from public.site_content_sync_events pending
              where pending.state <> 'completed'
            )
          )
          and not exists (
            select 1 from public.site_content_sync_events e
            where e.logical_id = r.logical_id
              and e.state <> 'completed'
          )
          and exists (
            select 1 from public.site_content_release_records rr
            where rr.release_id = s.active_release_id
              and rr.logical_id = r.logical_id
              and rr.target_publication_id = r.current_publication_id
              and rr.public_visible
              and not rr.tombstone
          )
        )
      )
  )
  select s.initialized,
    case when s.initialized then p.record else null end,
    case when s.initialized then p.render_payload else null end,
    jsonb_build_object(
      'releaseId', s.active_release_id,
      'staticManifestDigest', rel.static_manifest_digest,
      'dynamicStateDigest', rel.dynamic_state_digest,
      'releaseDigest', s.active_release_digest,
      'changeEpoch', s.change_epoch::text,
      'state', case
        when not s.initialized then 'unavailable'
        when exists (select 1 from public.site_content_sync_events e where e.state <> 'completed') then 'updating'
        when s.active_release_id is null then 'unavailable'
        else 'current'
      end
    ) as snapshot
  from state s
  left join public.site_content_releases rel on rel.id = s.active_release_id
  left join safe_requested r on true
  left join public.site_content_publications p on p.id = r.current_publication_id;
$$;

create or replace function public.claim_site_content_sync_events(
  p_worker_id uuid,
  p_limit integer,
  p_lease_seconds integer
)
returns setof public.site_content_sync_events
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 50 or p_lease_seconds < 10 or p_lease_seconds > 900 then
    raise exception using errcode = '22023', message = 'site_content_claim_bounds_invalid';
  end if;
  return query
  with claimable as (
    select e.event_sequence
    from public.site_content_sync_events e
    where e.state in ('pending', 'retry_pending')
      and e.next_attempt_at <= pg_catalog.clock_timestamp()
      and exists (
        select 1 from public.site_content_sync_event_plans ep
        where ep.event_sequence = e.event_sequence
          and ep.target_change_epoch = e.target_change_epoch
      )
    order by e.event_sequence
    for update skip locked
    limit p_limit
  )
  update public.site_content_sync_events e set
    state = 'processing',
    attempt_count = e.attempt_count + 1,
    worker_id = p_worker_id,
    lease_token = gen_random_uuid(),
    lease_generation = e.lease_generation + 1,
    lease_expires_at = pg_catalog.clock_timestamp() + make_interval(secs => p_lease_seconds),
    updated_at = pg_catalog.clock_timestamp()
  from claimable c
  where e.event_sequence = c.event_sequence
  returning e.*;
end;
$$;

create or replace function public.heartbeat_site_content_sync_event(
  p_event_sequence bigint,
  p_worker_id uuid,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_lease_seconds integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with heartbeat as (
    update public.site_content_sync_events e set
      lease_expires_at = pg_catalog.clock_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = pg_catalog.clock_timestamp()
    where e.event_sequence = p_event_sequence
      and e.state = 'processing'
      and e.worker_id = p_worker_id
      and e.lease_token = p_lease_token
      and e.lease_generation = p_lease_generation
      and e.lease_expires_at > pg_catalog.clock_timestamp()
      and p_lease_seconds between 10 and 900
    returning 1
  ) select exists(select 1 from heartbeat);
$$;

create or replace function public.record_site_content_sync_event_plan(
  p_event_sequence bigint,
  p_expected_change_epoch bigint,
  p_plan_digest text,
  p_plan jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.site_content_sync_events%rowtype;
begin
  if p_plan_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_plan) <> 'object'
    or p_plan->>'version' <> 'site-content-sync-plan-v1'
    or p_plan->>'planDigest' is distinct from p_plan_digest
    or (p_plan->>'targetChangeEpoch')::bigint is distinct from p_expected_change_epoch
    or jsonb_typeof(p_plan->'added') <> 'array'
    or jsonb_typeof(p_plan->'changed') <> 'array'
    or jsonb_typeof(p_plan->'unchanged') <> 'array'
    or jsonb_typeof(p_plan->'tombstones') <> 'array'
    or (jsonb_array_length(p_plan->'added') + jsonb_array_length(p_plan->'changed')
      + jsonb_array_length(p_plan->'unchanged') + jsonb_array_length(p_plan->'tombstones')) > 5000 then
    return false;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into v_event from public.site_content_sync_events e
  where e.event_sequence = p_event_sequence for update;
  if not found
    or v_event.target_change_epoch is distinct from p_expected_change_epoch
    or v_event.state not in ('pending', 'retry_pending')
    or not exists (
      select 1
      from jsonb_array_elements((p_plan->'added') || (p_plan->'changed') || (p_plan->'unchanged')) item
      where item->>'logicalId' = v_event.logical_id
        and item->>'targetPublicationId' = v_event.target_publication_id::text
    ) then return false; end if;
  insert into public.site_content_sync_event_plans(event_sequence, plan_digest, target_change_epoch, plan)
  values (p_event_sequence, p_plan_digest, p_expected_change_epoch, p_plan)
  on conflict (event_sequence) do nothing;
  return found or exists (
    select 1 from public.site_content_sync_event_plans ep
    where ep.event_sequence = p_event_sequence and ep.plan_digest = p_plan_digest and ep.plan = p_plan
  );
end;
$$;

create or replace function public.read_site_content_sync_event_plan(
  p_event_sequence bigint,
  p_worker_id uuid,
  p_lease_token uuid,
  p_lease_generation bigint
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select ep.plan
  from public.site_content_sync_events e
  join public.site_content_sync_event_plans ep on ep.event_sequence = e.event_sequence
  where e.event_sequence = p_event_sequence
    and e.state = 'processing'
    and e.worker_id = p_worker_id
    and e.lease_token = p_lease_token
    and e.lease_generation = p_lease_generation
    and e.lease_expires_at > pg_catalog.clock_timestamp();
$$;

create or replace function public.stage_site_content_sync_event(
  p_event_sequence bigint,
  p_worker_id uuid,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_stage jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_release_id uuid := (p_stage->>'releaseId')::uuid;
  v_state public.site_content_sync_state%rowtype;
  v_event public.site_content_sync_events%rowtype;
  v_plan public.site_content_sync_event_plans%rowtype;
  v_release public.site_content_releases%rowtype;
  v_record jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  select * into v_event from public.site_content_sync_events e
  where e.event_sequence = p_event_sequence;
  select * into v_plan from public.site_content_sync_event_plans ep
  where ep.event_sequence = p_event_sequence;
  if v_event.event_sequence is null
    or v_plan.event_sequence is null
    or v_event.state <> 'processing'
    or v_event.worker_id is distinct from p_worker_id
    or v_event.lease_token is distinct from p_lease_token
    or v_event.lease_generation is distinct from p_lease_generation
    or v_event.lease_expires_at <= pg_catalog.clock_timestamp()
    or v_event.target_change_epoch is distinct from (p_stage->>'targetChangeEpoch')::bigint
    or v_state.change_epoch is distinct from (p_stage->>'targetChangeEpoch')::bigint
    or v_plan.plan_digest is distinct from p_stage->>'planDigest'
    or v_plan.target_change_epoch is distinct from v_event.target_change_epoch
    or v_plan.plan->>'releaseDigest' is distinct from p_stage->>'releaseDigest' then
    return false;
  end if;
  insert into public.site_content_releases(
    id, state, target_change_epoch, previous_release_id, registry_version, static_manifest_digest,
    dynamic_state_digest, release_digest, generation_id, expected_record_count,
    expected_tombstone_count, must_pass_checks
  ) values (
    v_release_id, 'candidate', (p_stage->>'targetChangeEpoch')::bigint, v_state.active_release_id,
    p_stage->>'registryVersion', p_stage->>'staticManifestDigest', p_stage->>'dynamicStateDigest',
    p_stage->>'releaseDigest', p_stage->>'generationId', (p_stage#>>'{counts,total}')::integer,
    (p_stage#>>'{counts,tombstones}')::integer, coalesce((p_stage->>'mustPassChecks')::boolean, false)
  ) on conflict (id) do nothing;
  select * into strict v_release from public.site_content_releases r where r.id = v_release_id for update;
  if v_release.release_digest is distinct from p_stage->>'releaseDigest'
    or v_release.target_change_epoch is distinct from (p_stage->>'targetChangeEpoch')::bigint
    or v_release.state <> 'candidate' then
    raise exception using errcode = '23514', message = 'site_content_release_identity_mismatch';
  end if;
  select * into v_event from public.site_content_sync_events e
  where e.event_sequence = p_event_sequence for update;
  select * into v_plan from public.site_content_sync_event_plans ep
  where ep.event_sequence = p_event_sequence;
  if v_event.event_sequence is null
    or v_plan.event_sequence is null
    or v_event.state <> 'processing'
    or v_event.worker_id is distinct from p_worker_id
    or v_event.lease_token is distinct from p_lease_token
    or v_event.lease_generation is distinct from p_lease_generation
    or v_event.lease_expires_at <= pg_catalog.clock_timestamp()
    or v_event.target_change_epoch is distinct from (p_stage->>'targetChangeEpoch')::bigint
    or v_state.change_epoch is distinct from (p_stage->>'targetChangeEpoch')::bigint
    or v_plan.plan_digest is distinct from p_stage->>'planDigest'
    or v_plan.target_change_epoch is distinct from v_event.target_change_epoch
    or v_plan.plan->>'releaseDigest' is distinct from p_stage->>'releaseDigest' then
    raise exception using errcode = '40001', message = 'site_content_stage_stale';
  end if;
  if jsonb_typeof(p_stage->'records') <> 'array'
    or p_stage->'counts' is distinct from v_plan.plan->'counts'
    or jsonb_array_length(p_stage->'records') is distinct from (p_stage#>>'{counts,total}')::integer
    or exists (
      select 1
      from jsonb_array_elements(p_stage->'records') staged
      where not exists (
        select 1
        from jsonb_array_elements(
          (v_plan.plan->'added') || (v_plan.plan->'changed') ||
          (v_plan.plan->'unchanged') || (v_plan.plan->'tombstones')
        ) planned
        where planned->>'logicalId' = staged->>'logicalId'
          and coalesce(planned->>'targetPublicationId', '') = coalesce(staged->>'targetPublicationId', '')
          and coalesce(planned->>'documentId', '') = coalesce(staged->>'documentId', '')
          and coalesce(planned->>'chunkId', '') = coalesce(staged->>'chunkId', '')
          and coalesce(planned->>'contentHash', '') = coalesce(staged->>'contentHash', '')
          and coalesce(planned->>'publicationFingerprint', '') = coalesce(staged->>'publicationFingerprint', '')
          and coalesce(planned->>'governanceFingerprint', '') = coalesce(staged->>'governanceFingerprint', '')
          and coalesce(planned->>'lineageFingerprint', '') = coalesce(staged->>'lineageFingerprint', '')
          and coalesce(planned->>'publicMetadataFingerprint', '') = coalesce(staged->>'publicMetadataFingerprint', '')
          and coalesce((planned->>'tombstone')::boolean, false) = coalesce((staged->>'tombstone')::boolean, false)
      )
    ) then
    raise exception using errcode = '23514', message = 'site_content_stage_plan_mismatch';
  end if;
  for v_record in select value from jsonb_array_elements(p_stage->'records') loop
    insert into public.site_content_release_records(
      release_id, logical_id, target_publication_id, logical_document_id, logical_chunk_id,
      normalized_text, content_hash, publication_fingerprint, governance_fingerprint,
      lineage_fingerprint, public_metadata_fingerprint, embedding_model, embedding_dimensions,
      embedding_fingerprint, embedding, tombstone, public_visible
    ) values (
      v_release_id, v_record->>'logicalId', nullif(v_record->>'targetPublicationId', '')::uuid,
      (v_record->>'documentId')::uuid, (v_record->>'chunkId')::uuid,
      coalesce(v_record->>'normalizedText', ''), v_record->>'contentHash', v_record->>'publicationFingerprint',
      v_record->>'governanceFingerprint', v_record->>'lineageFingerprint',
      v_record->>'publicMetadataFingerprint', v_record->>'embeddingModel',
      (v_record->>'embeddingDimensions')::integer, v_record->>'embeddingFingerprint',
      case when v_record ? 'embedding' then (v_record->>'embedding')::extensions.vector else null end,
      coalesce((v_record->>'tombstone')::boolean, false),
      not coalesce((v_record->>'tombstone')::boolean, false)
    ) on conflict (release_id, logical_id) do nothing;
  end loop;
  update public.site_content_sync_events set state = 'ready', worker_id = null, lease_token = null,
    lease_expires_at = null, updated_at = pg_catalog.clock_timestamp()
  where event_sequence = p_event_sequence;
  return true;
exception when serialization_failure or unique_violation or foreign_key_violation or check_violation then
  return false;
end;
$$;

create or replace function public.fail_site_content_sync_event(
  p_event_sequence bigint,
  p_worker_id uuid,
  p_lease_token uuid,
  p_lease_generation bigint,
  p_error_code text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with failed as (
    update public.site_content_sync_events e set
      state = case when e.attempt_count >= 5 then 'quarantined' else 'retry_pending' end,
      next_attempt_at = pg_catalog.clock_timestamp() + make_interval(secs => least(300, (2 ^ greatest(e.attempt_count, 1))::integer)),
      worker_id = null,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = left(p_error_code, 64),
      updated_at = pg_catalog.clock_timestamp()
    where e.event_sequence = p_event_sequence
      and e.state = 'processing'
      and e.worker_id = p_worker_id
      and e.lease_token = p_lease_token
      and e.lease_generation = p_lease_generation
      and e.lease_expires_at > pg_catalog.clock_timestamp()
    returning 1
  ) select exists(select 1 from failed);
$$;

create or replace function public.activate_site_content_release(
  p_release_id uuid,
  p_expected_release_digest text,
  p_expected_change_epoch bigint,
  p_recovery_digest text,
  p_activation_receipt jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_release public.site_content_releases%rowtype;
  v_receipt_id text;
begin
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  perform 1 from public.site_content_releases r
    where r.id in (p_release_id, v_state.active_release_id)
    order by r.id for update;
  select * into v_release from public.site_content_releases where id = p_release_id;
  if not found or v_release.state <> 'candidate'
    or v_release.release_digest is distinct from p_expected_release_digest
    or v_release.target_change_epoch is distinct from p_expected_change_epoch
    or v_state.change_epoch is distinct from p_expected_change_epoch
    or not v_release.must_pass_checks
    or p_activation_receipt#>>'{resource,siteReleaseDigest}' is distinct from v_release.release_digest
    or p_activation_receipt#>>'{resource,previousSiteReleaseId}' is distinct from coalesce(v_release.previous_release_id::text, '')
    or p_activation_receipt#>>'{resource,previousSiteReleaseDigest}' is distinct from coalesce(v_state.active_release_digest, '')
    then return false; end if;
  perform 1 from public.site_content_public_records h order by h.logical_id for update;
  perform 1 from public.site_content_sync_events e
    where e.target_change_epoch = p_expected_change_epoch order by e.event_sequence for update;
  perform 1 from public.site_content_release_records rr
    where rr.release_id = p_release_id order by rr.logical_id for update;
  if (select count(*) from public.site_content_release_records rr where rr.release_id = p_release_id) <> v_release.expected_record_count
    or (select count(*) from public.site_content_release_records rr where rr.release_id = p_release_id and rr.tombstone) <> v_release.expected_tombstone_count
    or exists (select 1 from public.site_content_release_records rr where rr.release_id = p_release_id and not rr.tombstone and (rr.embedding is null or not rr.public_visible))
    or exists (select 1 from public.site_content_sync_events e where e.target_change_epoch = p_expected_change_epoch and e.state <> 'ready')
    or exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_release_records rr on rr.release_id = p_release_id and rr.logical_id = h.logical_id
      where rr.logical_id is null or rr.target_publication_id is distinct from h.current_publication_id
        or rr.governance_fingerprint = '' or rr.lineage_fingerprint = ''
    ) then return false; end if;
  v_receipt_id := public.guard_site_content_receipt_shape(p_activation_receipt, 'activation', p_release_id, p_recovery_digest);
  insert into public.site_content_release_receipts(receipt_id, release_id, receipt_kind, recovery_readiness_digest, receipt)
  values (v_receipt_id, p_release_id, 'activation', p_recovery_digest, p_activation_receipt);
  if v_state.active_release_id is not null then
    update public.site_content_releases set state = 'superseded' where id = v_state.active_release_id;
  end if;
  update public.site_content_releases set state = 'active', activated_at = pg_catalog.clock_timestamp() where id = p_release_id;
  update public.site_content_sync_state set active_release_id = p_release_id,
    active_release_digest = p_expected_release_digest, initialized = true,
    updated_at = pg_catalog.clock_timestamp() where singleton;
  update public.site_content_sync_events e set state = 'completed', updated_at = pg_catalog.clock_timestamp()
  where e.target_change_epoch = p_expected_change_epoch and e.state = 'ready'
    and exists (
      select 1 from public.site_content_release_records rr
      where rr.release_id = p_release_id and rr.logical_id = e.logical_id
        and rr.target_publication_id = e.target_publication_id
    );
  update public.site_content_public_records h set pending_event_sequence = null,
    updated_at = pg_catalog.clock_timestamp()
  where exists (
    select 1 from public.site_content_sync_events e
    where e.event_sequence = h.pending_event_sequence and e.state = 'completed'
  );
  return true;
end;
$$;

create or replace function public.rollback_site_content_release(
  p_expected_active_release_id uuid,
  p_target_release_id uuid,
  p_recovery_digest text,
  p_rollback_receipt jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.site_content_sync_state%rowtype;
  v_active public.site_content_releases%rowtype;
  v_target public.site_content_releases%rowtype;
  v_activation public.site_content_release_receipts%rowtype;
  v_receipt_id text;
begin
  perform pg_catalog.pg_advisory_xact_lock(93206431);
  select * into strict v_state from public.site_content_sync_state where singleton for update;
  if v_state.active_release_id is distinct from p_expected_active_release_id then return false; end if;
  perform 1 from public.site_content_releases r
    where r.id in (p_expected_active_release_id, p_target_release_id)
    order by r.id for update;
  select * into strict v_active from public.site_content_releases where id = p_expected_active_release_id;
  select * into strict v_target from public.site_content_releases where id = p_target_release_id;
  if v_active.previous_release_id is distinct from p_target_release_id or v_target.state <> 'superseded' then return false; end if;
  select * into v_activation from public.site_content_release_receipts
  where release_id = p_expected_active_release_id and receipt_kind = 'activation'
  order by created_at desc limit 1;
  if not found
    or p_rollback_receipt->>'activationReceiptId' is distinct from v_activation.receipt_id
    or p_rollback_receipt->>'promotionId' is distinct from v_activation.receipt->>'promotionId'
    or p_rollback_receipt->>'projectRef' is distinct from v_activation.receipt->>'projectRef'
    or p_rollback_receipt->>'operation' is distinct from 'site_release'
    or p_rollback_receipt#>>'{target,siteReleaseId}' is distinct from p_target_release_id::text
    or p_rollback_receipt#>>'{target,siteReleaseDigest}' is distinct from v_target.release_digest then return false; end if;
  perform 1 from public.site_content_release_records rr
    where rr.release_id in (p_expected_active_release_id, p_target_release_id)
    order by rr.logical_id for update;
  v_receipt_id := public.guard_site_content_receipt_shape(p_rollback_receipt, 'rollback', p_target_release_id, p_recovery_digest);
  insert into public.site_content_release_receipts(receipt_id, release_id, receipt_kind, recovery_readiness_digest, receipt)
  values (v_receipt_id, p_target_release_id, 'rollback', p_recovery_digest, p_rollback_receipt);
  update public.site_content_releases set state = 'rolled_back' where id = p_expected_active_release_id;
  update public.site_content_releases set state = 'active' where id = p_target_release_id;
  update public.site_content_sync_state set active_release_id = p_target_release_id,
    active_release_digest = v_target.release_digest, updated_at = pg_catalog.clock_timestamp()
  where singleton and active_release_id = p_expected_active_release_id;
  return found;
end;
$$;

alter table public.site_content_publications enable row level security;
alter table public.site_content_publications force row level security;
alter table public.site_content_reconciliation_plans enable row level security;
alter table public.site_content_reconciliation_plans force row level security;
alter table public.site_content_public_records enable row level security;
alter table public.site_content_public_records force row level security;
alter table public.site_content_sync_state enable row level security;
alter table public.site_content_sync_state force row level security;
alter table public.site_content_sync_events enable row level security;
alter table public.site_content_sync_events force row level security;
alter table public.site_content_sync_event_plans enable row level security;
alter table public.site_content_sync_event_plans force row level security;
alter table public.site_content_releases enable row level security;
alter table public.site_content_releases force row level security;
alter table public.site_content_release_records enable row level security;
alter table public.site_content_release_records force row level security;
alter table public.site_content_release_receipts enable row level security;
alter table public.site_content_release_receipts force row level security;

revoke all on table public.site_content_publications from public, anon, authenticated, service_role;
revoke all on table public.site_content_reconciliation_plans from public, anon, authenticated, service_role;
revoke all on table public.site_content_public_records from public, anon, authenticated, service_role;
revoke all on table public.site_content_sync_state from public, anon, authenticated, service_role;
revoke all on table public.site_content_sync_events from public, anon, authenticated, service_role;
revoke all on table public.site_content_sync_event_plans from public, anon, authenticated, service_role;
revoke all on table public.site_content_releases from public, anon, authenticated, service_role;
revoke all on table public.site_content_release_records from public, anon, authenticated, service_role;
revoke all on table public.site_content_release_receipts from public, anon, authenticated, service_role;
revoke all on sequence public.site_content_sync_events_event_sequence_seq from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated, service_role;

revoke all on function public.guard_site_content_immutable_row() from public, anon, authenticated, service_role;
revoke all on function public.site_content_canonical_text(text) from public, anon, authenticated, service_role;
revoke all on function public.site_content_source_projection(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.guard_site_content_receipt_shape(jsonb, text, uuid, text) from public, anon, authenticated, service_role;

revoke all on function public.read_site_content_public_records(text, text) from public;
grant execute on function public.read_site_content_public_records(text, text) to anon, authenticated, service_role;

revoke all on function public.record_site_content_reconciliation_plan(text, text, jsonb, integer, uuid) from public, anon, authenticated;
grant execute on function public.record_site_content_reconciliation_plan(text, text, jsonb, integer, uuid) to service_role;
revoke all on function public.publish_site_content_record(text, uuid, text, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_site_content_record(text, uuid, text, bigint, text, uuid) to service_role;
revoke all on function public.retire_site_content_record(text, uuid, text, bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.retire_site_content_record(text, uuid, text, bigint, text, uuid) to service_role;
revoke all on function public.claim_site_content_sync_events(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_site_content_sync_events(uuid, integer, integer) to service_role;
revoke all on function public.heartbeat_site_content_sync_event(bigint, uuid, uuid, bigint, integer) from public, anon, authenticated;
grant execute on function public.heartbeat_site_content_sync_event(bigint, uuid, uuid, bigint, integer) to service_role;
revoke all on function public.record_site_content_sync_event_plan(bigint, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_site_content_sync_event_plan(bigint, bigint, text, jsonb) to service_role;
revoke all on function public.read_site_content_sync_event_plan(bigint, uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.read_site_content_sync_event_plan(bigint, uuid, uuid, bigint) to service_role;
revoke all on function public.stage_site_content_sync_event(bigint, uuid, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.stage_site_content_sync_event(bigint, uuid, uuid, bigint, jsonb) to service_role;
revoke all on function public.fail_site_content_sync_event(bigint, uuid, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.fail_site_content_sync_event(bigint, uuid, uuid, bigint, text) to service_role;
revoke all on function public.activate_site_content_release(uuid, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.activate_site_content_release(uuid, text, bigint, text, jsonb) to service_role;
revoke all on function public.rollback_site_content_release(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.rollback_site_content_release(uuid, uuid, text, jsonb) to service_role;

alter table public.site_content_publications owner to postgres;
alter table public.site_content_reconciliation_plans owner to postgres;
alter table public.site_content_public_records owner to postgres;
alter table public.site_content_sync_state owner to postgres;
alter table public.site_content_sync_events owner to postgres;
alter table public.site_content_sync_event_plans owner to postgres;
alter table public.site_content_releases owner to postgres;
alter table public.site_content_release_records owner to postgres;
alter table public.site_content_release_receipts owner to postgres;
alter function public.guard_site_content_immutable_row() owner to postgres;
alter function public.site_content_canonical_text(text) owner to postgres;
alter function public.site_content_source_projection(text, uuid) owner to postgres;
alter function public.guard_site_content_receipt_shape(jsonb, text, uuid, text) owner to postgres;
alter function public.record_site_content_reconciliation_plan(text, text, jsonb, integer, uuid) owner to postgres;
alter function public.publish_site_content_record(text, uuid, text, bigint, text, uuid) owner to postgres;
alter function public.retire_site_content_record(text, uuid, text, bigint, text, uuid) owner to postgres;
alter function public.read_site_content_public_records(text, text) owner to postgres;
alter function public.claim_site_content_sync_events(uuid, integer, integer) owner to postgres;
alter function public.heartbeat_site_content_sync_event(bigint, uuid, uuid, bigint, integer) owner to postgres;
alter function public.record_site_content_sync_event_plan(bigint, bigint, text, jsonb) owner to postgres;
alter function public.read_site_content_sync_event_plan(bigint, uuid, uuid, bigint) owner to postgres;
alter function public.stage_site_content_sync_event(bigint, uuid, uuid, bigint, jsonb) owner to postgres;
alter function public.fail_site_content_sync_event(bigint, uuid, uuid, bigint, text) owner to postgres;
alter function public.activate_site_content_release(uuid, text, bigint, text, jsonb) owner to postgres;
alter function public.rollback_site_content_release(uuid, uuid, text, jsonb) owner to postgres;
