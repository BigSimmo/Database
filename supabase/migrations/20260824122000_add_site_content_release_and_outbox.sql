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
  version text not null check (version = 'site-content-reconciliation-plan-v1'),
  trusted_snapshot_digest text not null check (trusted_snapshot_digest ~ '^[0-9a-f]{64}$'),
  trusted_snapshots jsonb not null check (jsonb_typeof(trusted_snapshots) = 'array'),
  dispositions jsonb not null check (jsonb_typeof(dispositions) = 'array'),
  expected_record_count integer not null check (expected_record_count > 0 and expected_record_count <= 5000),
  expected_group_count integer not null check (expected_group_count > 0 and expected_group_count <= 5000),
  batch_size integer not null check (batch_size between 1 and 500),
  batch_count integer not null check (batch_count > 0 and batch_count <= 5000),
  counts jsonb not null check (jsonb_typeof(counts) = 'object'),
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default pg_catalog.clock_timestamp()
);

create table public.site_content_public_records (
  logical_id text primary key,
  kind text not null check (kind in ('service', 'form', 'medication', 'differential', 'presentation')),
  slug text not null,
  current_publication_id uuid not null,
  head_change_epoch bigint not null check (head_change_epoch > 0),
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
  served_change_epoch bigint not null default 0 check (served_change_epoch >= 0 and served_change_epoch <= change_epoch),
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
    check (state in ('pending', 'processing', 'retry_pending', 'ready', 'completed', 'quarantined', 'superseded')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 5),
  next_attempt_at timestamptz not null default pg_catalog.clock_timestamp(),
  worker_id uuid,
  lease_token uuid,
  lease_generation bigint not null default 0 check (lease_generation >= 0),
  lease_expires_at timestamptz,
  superseded_by_event_sequence bigint references public.site_content_sync_events(event_sequence),
  terminal_at timestamptz,
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
  release_id uuid not null,
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
  plan_digest text not null check (plan_digest ~ '^[0-9a-f]{64}$'),
  reconciliation_plan_digest text references public.site_content_reconciliation_plans(plan_digest),
  expected_added_count integer not null check (expected_added_count >= 0),
  expected_changed_count integer not null check (expected_changed_count >= 0),
  expected_unchanged_count integer not null check (expected_unchanged_count >= 0),
  expected_record_count integer not null check (expected_record_count >= 0),
  expected_tombstone_count integer not null check (expected_tombstone_count >= 0),
  must_pass_checks boolean not null default false,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  activated_at timestamptz,
  unique (release_digest, target_change_epoch)
);

-- The retained epoch-zero predecessor gives the first P05 activation an
-- exact non-null previous release identity. It contains no canonical rows;
-- initialized=false continues to route reads to the reviewed P03 seed set.
insert into public.site_content_releases(
  id, state, target_change_epoch, previous_release_id, registry_version,
  static_manifest_digest, dynamic_state_digest, release_digest, generation_id,
  plan_digest, reconciliation_plan_digest, expected_added_count,
  expected_changed_count, expected_unchanged_count, expected_record_count,
  expected_tombstone_count, must_pass_checks
) values (
  '5ee32388-b546-5b46-8723-b2912ea93d6a', 'active', 0, null,
  'site-content-bootstrap-v1', repeat('0', 64),
  '78448dcabf3e218a69877b0bd97bc28a3522460fde591ede7fcbc8c23ab7e769',
  'f04b8186562b31bb6cda6527082aa9e694ceea761dabeea04d67fb2664669dfb',
  'bootstrap', 'eba9df3da23d058eca56f969f95d21cf89e6c3843dcf2b2c942a10dc37769a20',
  null, 0, 0, 0, 0, 0, true
);

update public.site_content_sync_state set
  active_release_id = '5ee32388-b546-5b46-8723-b2912ea93d6a',
  active_release_digest = 'f04b8186562b31bb6cda6527082aa9e694ceea761dabeea04d67fb2664669dfb'
where singleton;

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
  embedding_dimensions integer not null check (embedding_dimensions = 1536),
  embedding_fingerprint text not null,
  embedding_value_digest text check (embedding_value_digest is null or embedding_value_digest ~ '^[0-9a-f]{64}$'),
  embedding extensions.vector(1536),
  record jsonb,
  render_payload jsonb,
  tombstone boolean not null default false,
  public_visible boolean not null default true,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (release_id, logical_id),
  unique (release_id, logical_document_id),
  unique (release_id, logical_chunk_id),
  check ((tombstone and embedding is null and not public_visible) or (not tombstone and public_visible)),
  check ((target_publication_id is null and record is null and render_payload is null) or
    (target_publication_id is not null and jsonb_typeof(record) = 'object' and jsonb_typeof(render_payload) = 'object')),
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
create index site_content_sync_events_reclaim_idx
  on public.site_content_sync_events(lease_expires_at, event_sequence)
  where state = 'processing';
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

create or replace function public.site_content_canonical_json(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result text;
begin
  if p_value is null then return 'null'; end if;
  if jsonb_typeof(p_value) = 'object' then
    select '{' || coalesce(string_agg(to_jsonb(entry.key)::text || ':' ||
      public.site_content_canonical_json(entry.value), ',' order by entry.key collate "C"), '') || '}'
    into v_result from jsonb_each(p_value) entry;
    return v_result;
  end if;
  if jsonb_typeof(p_value) = 'array' then
    select '[' || coalesce(string_agg(public.site_content_canonical_json(entry.value), ',' order by entry.ordinal), '') || ']'
    into v_result from jsonb_array_elements(p_value) with ordinality entry(value, ordinal);
    return v_result;
  end if;
  return p_value::text;
end;
$$;

create or replace function public.site_content_compact_text(p_value text, p_limit integer default 8000)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := public.site_content_canonical_text(p_value);
begin
  if p_limit < 4 then raise exception using errcode = '22023', message = 'site_content_text_limit_invalid'; end if;
  if char_length(v_text) <= p_limit then return v_text; end if;
  return rtrim(left(v_text, p_limit - 3)) || '...';
end;
$$;

create or replace function public.site_content_json_sha256(p_value jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(public.site_content_canonical_json(p_value), 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function public.site_content_public_json_projection(
  p_kind text,
  p_value jsonb,
  p_path text[] default array[]::text[]
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result jsonb;
  v_allowed text[];
  v_private constant text[] := array[
    'actor','actorid','authorid','createdby','creatorid','editorid','owner','ownerid','publishedby','publisherid',
    'retireeid','reviewedby','reviewerid','sourceownerid','sourcerowid','privatedocumentid','updatedby','updaterid'
  ];
  v_nested constant text[] := array[
    'accent','action','acuity_flags','actSections','after','age','aliases','age_groups','archiveGeneratedAt','authorises','authority','availability','before','bedside-question','bestUse','body','candidates',
    'catalogPayload','catalogueLabel','category','catchments','class','clinicalHinge','clock','cls','comparison','confidence',
    'contacts','copies','cost','criteria','currentPresentation','destination','detail','doesNotAuthorise','documentationStem','documentTitle','eligibility',
    'factors','fileName','flag','form','gt','hepatic','highestUrgencyNote','housing_flags','immediate-action','immediateActions','indexedAt','indexedClock',
    'indexedTerms','investigations','involved','items','key','kind','label','lastUpdated','legalNote','likelihood',
    'localPdfBytes','localPdfPath','localPdfSha256','locallyVerified','location','lt','maker','match','mimics-overlap','must-not-miss','name','navigatorQuery',
    'note','notes','officialPdfPasswordProtected','officialPdfUrl','officialRegisterUrl','officialTitleCheckedAt',
    'parallel','pages','patient','practicePearls','preUseChecks','primaryContact','priorityFacts','published','purpose',
    'quick','referral','referralInfo','related','reviewChecklist','reviewStatus','reviewed','riskLevel','route','rows',
    'safetyPearl','safetySnapshot','schedule','scopeLabel','scr','searchTerms','section','sectionCue','sections','selected','setting_flags',
    'selectedCount','severity','slug','source','sourceFacts','sourceNote','sourceStatus','sourceTitle','stats','status',
    'statusChips','subclass','subtitle','substance_flags','summary','summaryCards','tag','tags','threshold','timings','title','titleAliases',
    'tone','totalCount','traps','type','url','val','value','verification','version','what-argues-against','why-it-fits'
  ];
begin
  if p_value is null then return 'null'::jsonb; end if;
  if jsonb_typeof(p_value) = 'array' then
    select coalesce(jsonb_agg(public.site_content_public_json_projection(p_kind, entry.value, p_path)
      order by entry.ordinal), '[]'::jsonb)
    into v_result from jsonb_array_elements(p_value) with ordinality entry(value, ordinal);
    return v_result;
  end if;
  if jsonb_typeof(p_value) = 'object' then
    v_allowed := case
      when p_path = array['source'] then
        array['label','status','url','published','reviewed','notes','summary','title','version','lastUpdated']
      when p_path[array_length(p_path, 1)] = 'source' then
        array['label','status','url','published','reviewed','notes','summary','title','version','lastUpdated']
      when p_path[array_length(p_path, 1)] = 'patient' then
        array['factors','action','severity','match','note']
      when p_path[array_length(p_path, 1)] = 'summaryCards' then
        array['id','label','title','detail']
      when p_path[array_length(p_path, 1)] = 'catalogPayload' then
        v_nested || array['id']
      when p_path[array_length(p_path, 1)] = 'sections' then
        v_nested || array['id']
      when p_path[array_length(p_path, 1)] = 'related' then
        array['id','label','likelihood','note']
      when p_path[array_length(p_path, 1)] = 'candidates' then
        v_nested || array['id']
      when p_path[array_length(p_path, 1)] = 'criteria' then
        v_nested || array['id']
      when cardinality(p_path) = 0 and p_kind in ('service','form') then
        array['slug','title','subtitle','statusChips','primaryContact','contacts','route','eligibility','cost','referral',
          'location','summaryCards','referralInfo','bestUse','criteria','verification','tags','catchments',
          'catalogueLabel','navigatorQuery','source','catalogPayload']
      when cardinality(p_path) = 0 and p_kind = 'medication' then
        array['slug','name','class','subclass','category','accent','tag','schedule','stats','sections','quick']
      when cardinality(p_path) = 0 and p_kind = 'differential' then
        array['slug','title','status','subtitle','clinicalHinge','safetySnapshot','sections','related',
          'currentPresentation','investigations','immediateActions']
      when cardinality(p_path) = 0 and p_kind = 'presentation' then
        array['id','title','sourceTitle','scopeLabel','titleAliases','status','subtitle','selectedCount','totalCount',
          'safetySnapshot','criteria','candidates','reviewChecklist','highestUrgencyNote','sourceStatus']
      else v_nested
    end;
    select coalesce(jsonb_object_agg(entry.key, public.site_content_public_json_projection(
      p_kind, entry.value, p_path || entry.key)
      order by entry.key collate "C"), '{}'::jsonb)
    into v_result from jsonb_each(p_value) entry
    where entry.key = any(v_allowed)
      and lower(regexp_replace(entry.key, '[^a-z0-9]', '', 'g')) <> all(v_private);
    return v_result;
  end if;
  return p_value;
end;
$$;

create or replace function public.site_content_json_text(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result text;
begin
  if p_value is null or p_value = 'null'::jsonb then return ''; end if;
  if jsonb_typeof(p_value) in ('string','number','boolean') then return trim(both '"' from p_value::text); end if;
  if jsonb_typeof(p_value) = 'array' then
    select coalesce(string_agg(public.site_content_json_text(value), ' ' order by ordinal), '') into v_result
    from jsonb_array_elements(p_value) with ordinality item(value, ordinal);
  else
    select coalesce(string_agg(public.site_content_json_text(value), ' ' order by key collate "C"), '') into v_result
    from jsonb_each(p_value);
  end if;
  return regexp_replace(trim(v_result), '\s+', ' ', 'g');
end;
$$;

create or replace function public.site_content_normalize_search_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9+./\s-]', ' ', 'g'), '\s+', ' ', 'g'));
$$;

-- Extract an ordered list of explicitly named scalar/array fields. This is
-- deliberately not a generic JSON serializer: P03 search text has semantic
-- field order, and object keys outside the named projection must not affect
-- normalized text, hashes, vectors, or receipts.
create or replace function public.site_content_json_array_fields(
  p_value jsonb,
  p_fields text[]
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_result text := '';
  v_item jsonb;
  v_field text;
  v_value jsonb;
  v_text text;
begin
  if jsonb_typeof(p_value) <> 'array' then return ''; end if;
  for v_item in select value from jsonb_array_elements(p_value) loop
    if jsonb_typeof(v_item) <> 'object' then continue; end if;
    foreach v_field in array p_fields loop
      v_value := v_item->v_field;
      if v_value is null or v_value = 'null'::jsonb then continue; end if;
      if jsonb_typeof(v_value) = 'array' then
        v_text := public.site_content_json_text(v_value);
      elsif jsonb_typeof(v_value) in ('string','number','boolean') then
        v_text := v_item->>v_field;
      else
        v_text := '';
      end if;
      if btrim(coalesce(v_text, '')) <> '' then v_result := concat_ws(' ', v_result, v_text); end if;
    end loop;
  end loop;
  return regexp_replace(btrim(v_result), '\\s+', ' ', 'g');
end;
$$;

-- Canonical content is produced server-side by the exact P03 owners
-- clinicalRegistryRecordToCorpusEntry, medicationRecordToCorpusEntry and
-- differentialRecordToCorpusEntry after public registry baseline merging.
-- This transaction re-locks the selected legacy row/version and independently
-- validates the canonical hashes and recursive public allowlist before insert.
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
  v_search text;
  v_record jsonb;
  v_render jsonb;
  v_sections text;
  v_quick text;
begin
  if p_kind in ('service', 'form') then
    select to_jsonb(r) into strict v_row from public.clinical_registry_records r
    where r.id = p_source_row_id and r.kind = p_kind for update;
    source_table := 'clinical_registry_records';
    v_domain := case p_kind when 'service' then 'services' else 'forms' end;
    v_route := case p_kind when 'service' then '/services/' else '/forms/' end || (v_row->>'slug');
    v_source_role := case p_kind when 'service' then 'service_directory' else 'form_reference' end;
    v_render := jsonb_strip_nulls(jsonb_build_object(
      'slug', v_row->>'slug', 'title', v_row->>'title', 'subtitle', v_row->'subtitle',
      'statusChips', coalesce(v_row->'status_chips', '[]'::jsonb),
      'primaryContact', v_row->'primary_contact', 'contacts', coalesce(v_row->'contacts', '[]'::jsonb),
      'route', v_row->'route', 'eligibility', v_row->'eligibility', 'cost', v_row->'cost',
      'referral', v_row->'referral', 'location', v_row->'location',
      'summaryCards', coalesce(v_row->'summary_cards', '[]'::jsonb),
      'referralInfo', coalesce(v_row->'referral_info', '[]'::jsonb), 'bestUse', v_row->'best_use',
      'criteria', coalesce(v_row->'criteria', '[]'::jsonb), 'verification', v_row->'verification',
      'tags', coalesce(v_row->'tags', '[]'::jsonb), 'catchments', coalesce(v_row->'catchments', '[]'::jsonb),
      'catalogueLabel', v_row->'catalogue_label', 'navigatorQuery', v_row->'navigator_query',
      'source', v_row->'source', 'catalogPayload', coalesce(v_row->'catalog_payload', '{}'::jsonb)
    ));
    v_title := v_render->>'title';
    v_search := public.site_content_normalize_search_text(concat_ws(' ',
      v_render->>'title', v_render->>'slug', v_render->>'subtitle', v_render->>'route',
      v_render->>'eligibility', v_render->>'cost', v_render->>'referral', v_render->>'location',
      v_render->>'bestUse', v_render->>'catalogueLabel', v_render->>'navigatorQuery',
      v_render#>>'{primaryContact,value}', v_render#>>'{primaryContact,detail}',
      v_render#>>'{source,label}', v_render#>>'{source,status}', v_render#>>'{source,reviewed}',
      public.site_content_json_text(v_render->'tags'), public.site_content_json_text(v_render->'catchments'),
      public.site_content_json_array_fields(v_render->'statusChips',
        case p_kind when 'form' then array['label'] else array['label','tone'] end),
      public.site_content_json_array_fields(v_render->'contacts',
        case p_kind when 'form' then array['label','value','detail'] else array['label','value','detail','kind'] end),
      public.site_content_json_array_fields(v_render->'summaryCards', array['label','title','detail']),
      public.site_content_json_array_fields(v_render->'referralInfo', array['label','value']),
      public.site_content_json_array_fields(v_render->'criteria', array['label','tone']),
      public.site_content_json_text(v_render#>'{verification,notes}'),
      case when p_kind = 'service' then public.site_content_json_text(v_render#>'{source,notes}') end,
      case when p_kind = 'form' then concat_ws(' ',
        v_render#>>'{catalogPayload,form}', v_render#>>'{catalogPayload,category}',
        v_render#>>'{catalogPayload,purpose}', v_render#>>'{catalogPayload,maker}',
        v_render#>>'{catalogPayload,threshold}', v_render#>>'{catalogPayload,clock}',
        v_render#>>'{catalogPayload,authorises}', v_render#>>'{catalogPayload,doesNotAuthorise}',
        public.site_content_json_text(v_render#>'{catalogPayload,aliases}'),
        public.site_content_json_text(v_render#>'{catalogPayload,searchTerms}'),
        public.site_content_json_text(v_render#>'{catalogPayload,indexedTerms}'),
        (select coalesce(string_agg(concat_ws(' ', 'section ' || (section.value->>'section'),
          section.value->>'title', section.value->>'summary'), ' ' order by section.ordinal), '')
          from jsonb_array_elements(coalesce(v_render#>'{catalogPayload,actSections}', '[]'::jsonb))
            with ordinality section(value, ordinal))) end,
      case p_kind when 'form' then 'form forms checklist assessment transfer template'
        else 'service services source record pathway' end));
    v_body := public.site_content_compact_text(concat_ws(E'\n',
      case p_kind when 'form' then 'Form: ' else 'Service: ' end || v_title,
      nullif(v_render->>'subtitle', ''),
      case when v_render ? 'route' then 'Route: ' || (v_render->>'route') end,
      case when v_render ? 'eligibility' then 'Eligibility: ' || (v_render->>'eligibility') end,
      case when v_render ? 'referral' then 'Referral: ' || (v_render->>'referral') end,
      case when v_render ? 'location' then 'Location: ' || (v_render->>'location') end,
      case when v_render ? 'bestUse' then 'Best use: ' || (v_render->>'bestUse') end,
      case when v_render#>>'{primaryContact,value}' is not null then 'Primary contact: ' ||
        (v_render#>>'{primaryContact,value}') || ' ' || coalesce(v_render#>>'{primaryContact,detail}', '') end,
      case when jsonb_array_length(coalesce(v_render->'tags','[]'::jsonb)) > 0 then
        'Tags: ' || (select string_agg(value, ', ' order by ordinal) from jsonb_array_elements_text(v_render->'tags') with ordinality tag(value, ordinal)) end,
      case when jsonb_array_length(coalesce(v_render->'catchments','[]'::jsonb)) > 0 then
        'Catchments: ' || (select string_agg(value, ', ' order by ordinal) from jsonb_array_elements_text(v_render->'catchments') with ordinality tag(value, ordinal)) end,
      v_search));
  elsif p_kind = 'medication' then
    select to_jsonb(r) into strict v_row from public.medication_records r
    where r.id = p_source_row_id for update;
    source_table := 'medication_records'; v_domain := 'medications';
    v_route := '/medications/' || (v_row->>'slug'); v_source_role := 'clinical_reference';
    v_render := jsonb_build_object(
      'slug', v_row->>'slug', 'name', v_row->>'name', 'class', coalesce(v_row->>'class',''),
      'subclass', coalesce(v_row->>'subclass',''), 'category', coalesce(v_row->>'category',''),
      'accent', coalesce(v_row->>'accent','#0f766e'), 'tag', coalesce(v_row->>'tag',''),
      'schedule', coalesce(v_row->>'schedule',''), 'stats', coalesce(v_row->'stats','[]'::jsonb),
      'sections', coalesce(v_row->'sections','[]'::jsonb), 'quick', coalesce(v_row->'quick','[]'::jsonb));
    v_title := v_render->>'name';
    select coalesce(string_agg(concat_ws(' ', section.value->>'title', section.value->>'type',
      public.site_content_json_array_fields(section.value->'rows', array['key','val'])), ' '
      order by section.ordinal), '') into v_sections
    from jsonb_array_elements(v_render->'sections') with ordinality section(value, ordinal);
    v_quick := public.site_content_json_array_fields(v_render->'quick', array['label','value']);
    v_body := public.site_content_compact_text(concat_ws(E'\n',
      'Medication: ' || v_title,
      case when v_render->>'class' <> '' then 'Class: ' || (v_render->>'class') end,
      case when v_render->>'subclass' <> '' then 'Subclass: ' || (v_render->>'subclass') end,
      case when v_render->>'schedule' <> '' then 'Schedule: ' || (v_render->>'schedule') end,
      case when v_render->>'tag' <> '' then 'Tag: ' || (v_render->>'tag') end,
      nullif(v_sections, ''), nullif(v_quick, '')));
  elsif p_kind in ('differential', 'presentation') then
    select to_jsonb(r) into strict v_row from public.differential_records r
    where r.id = p_source_row_id and r.kind = case p_kind when 'presentation' then 'presentation' else 'diagnosis' end
    for update;
    source_table := 'differential_records'; v_domain := 'differentials';
    v_route := '/differentials/' || case p_kind when 'presentation' then 'presentations/' else 'diagnoses/' end || (v_row->>'slug');
    v_source_role := 'clinical_reference';
    v_render := coalesce(v_row->'payload', '{}'::jsonb);
    v_title := v_render->>'title';
    if p_kind = 'differential' then
      v_search := public.site_content_normalize_search_text(concat_ws(' ',
        v_render->>'title', v_render->>'slug', v_render->>'subtitle', v_render->>'clinicalHinge',
        v_render#>>'{safetySnapshot,summary}', public.site_content_json_text(v_render#>'{safetySnapshot,tags}'),
        public.site_content_json_array_fields(v_render->'sections', array['title','summary','items']),
        public.site_content_json_array_fields(v_render->'related', array['label','note']),
        public.site_content_json_text(v_render->'currentPresentation'),
        public.site_content_json_text(v_render->'investigations'),
        public.site_content_json_text(v_render->'immediateActions')));
    else
      v_search := public.site_content_normalize_search_text(concat_ws(' ',
        v_render->>'title', v_render->>'sourceTitle', v_render->>'scopeLabel',
        public.site_content_json_text(v_render->'titleAliases'), v_render->>'id', v_render->>'subtitle',
        public.site_content_json_text(v_render#>'{safetySnapshot,tags}'), v_render#>>'{safetySnapshot,summary}',
        v_render->>'highestUrgencyNote', public.site_content_json_text(v_render->'reviewChecklist'),
        (select coalesce(string_agg(replace(candidate.value->>'slug', '-', ' '), ' '
          order by candidate.ordinal), '')
          from jsonb_array_elements(v_render->'candidates') with ordinality candidate(value, ordinal))));
    end if;
    v_body := public.site_content_compact_text(concat_ws(E'\n',
      case p_kind when 'presentation' then 'Presentation workflow: ' else 'Differential diagnosis: ' end || v_title,
      nullif(v_render->>'subtitle',''),
      -- Preserve the current P03 converter exactly: its `!isPresentation && ...`
      -- expression is passed to compactText, which stringifies false.
      case when p_kind = 'presentation' then 'false' end,
      case when p_kind = 'differential' and v_render->>'clinicalHinge' <> '' then
        'Clinical hinge: ' || (v_render->>'clinicalHinge') end,
      case when jsonb_array_length(coalesce(v_render#>'{safetySnapshot,tags}','[]'::jsonb)) > 0 then
        'Tags: ' || (select string_agg(value, ', ' order by ordinal)
          from jsonb_array_elements_text(v_render#>'{safetySnapshot,tags}') with ordinality tag(value, ordinal)) end,
      v_search));
  else
    raise exception using errcode = '22023', message = 'site_content_kind_invalid';
  end if;
  source_owner_id := (v_row->>'owner_id')::uuid;
  source_version := to_char((v_row->>'updated_at')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  slug := v_row->>'slug';
  logical_id := v_domain || ':' || case when p_kind in ('differential', 'presentation') then
    case p_kind when 'presentation' then 'presentation:' else 'diagnosis:' end else '' end || slug;
  v_render := public.site_content_public_json_projection(p_kind, v_render, array[]::text[]);
  v_record := jsonb_build_object(
    'version', 'site-content-record-v1', 'logicalId', logical_id, 'producerClass', 'dynamic_registry',
    'domain', v_domain, 'route', v_route, 'title', public.site_content_canonical_text(v_title),
    'body', v_body, 'sourceRole', v_source_role, 'access', 'public',
    'validationStatus', case when v_row->>'validation_status' in ('approved','locally_reviewed')
      then v_row->>'validation_status' else 'unverified' end,
    'sourceStatus', case when v_row->>'source_status' in ('current','review_due','outdated')
      then v_row->>'source_status' else 'unknown' end,
    'sourceLineage', '[]'::jsonb);
  v_record := v_record || jsonb_build_object(
    'contentHash', public.site_content_json_sha256(jsonb_build_object('title', v_record->>'title', 'body', v_record->>'body')),
    'publicationVersion', public.site_content_json_sha256(v_record));
  record := v_record; render_payload := v_render; return next;
exception when no_data_found then
  raise exception using errcode = 'P0002', message = 'site_content_source_not_found';
end;
$$;

create or replace function public.site_content_record_governance_hash(p_record jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select public.site_content_json_sha256(jsonb_build_object(
    'version', p_record->>'version',
    'producerClass', p_record->>'producerClass',
    'domain', p_record->>'domain',
    'sourceRole', p_record->>'sourceRole',
    'access', p_record->>'access',
    'validationStatus', p_record->>'validationStatus',
    'sourceStatus', p_record->>'sourceStatus',
    'sourceLineage', p_record->'sourceLineage'));
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
  v_expected text;
  v_fields jsonb;
begin
  if jsonb_typeof(p_receipt) <> 'object' or p_receipt->>'operation' <> 'site_release'
    or p_receipt->>'projectRef' !~ '^[a-z0-9][a-z0-9_-]{2,63}$' then
    raise exception using errcode = '22023', message = 'site_content_receipt_invalid';
  end if;
  v_id := p_receipt->>'receiptId';
  if v_id is null or v_id !~ '^sha256:[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'site_content_receipt_id_invalid';
  end if;
  if p_kind = 'activation' then
    if p_receipt - array['version','receiptId','promotionId','projectRef','operation','recoveryReadinessDigest','activatedAt','resource'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt)) <> 8
      or p_receipt->>'version' <> 'activation-receipt-v1'
      or p_receipt->>'promotionId' not like 'site-release:%'
      or p_receipt->>'recoveryReadinessDigest' is distinct from p_recovery_digest
      or p_receipt->>'activatedAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      or (p_receipt->>'activatedAt')::timestamptz > pg_catalog.clock_timestamp()
      or p_receipt#>>'{resource,kind}' <> 'site_release'
      or p_receipt#>>'{resource,siteReleaseId}' is distinct from p_release_id::text
      or (p_receipt->'resource') - array['kind','siteReleaseId','siteReleaseDigest','previousSiteReleaseId','previousSiteReleaseDigest'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt->'resource')) <> 5 then
      raise exception using errcode = '22023', message = 'site_content_activation_receipt_mismatch';
    end if;
    v_fields := p_receipt - 'receiptId';
    v_expected := 'sha256:' || encode(extensions.digest(convert_to(
      'activation-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_fields), 'UTF8'), 'sha256'), 'hex');
  elsif p_kind = 'rollback' then
    if p_receipt - array['version','receiptId','activationReceiptId','promotionId','projectRef','operation','rolledBackAt','method','requiresReconstruction','outcome','target'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt)) <> 11
      or p_receipt->>'version' <> 'rollback-receipt-v1'
      or p_receipt->>'activationReceiptId' !~ '^sha256:[0-9a-f]{64}$'
      or p_receipt->>'promotionId' not like 'site-release:%'
      or p_receipt->>'rolledBackAt' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      or (p_receipt->>'rolledBackAt')::timestamptz > pg_catalog.clock_timestamp()
      or p_receipt->>'method' <> 'retained_previous'
      or p_receipt->>'requiresReconstruction' <> 'false'
      or p_receipt->>'outcome' <> 'succeeded'
      or p_receipt#>>'{target,kind}' <> 'site_release'
      or p_receipt#>>'{target,siteReleaseId}' is distinct from p_release_id::text
      or (p_receipt->'target') - array['kind','siteReleaseId','siteReleaseDigest'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(p_receipt->'target')) <> 3 then
      raise exception using errcode = '22023', message = 'site_content_rollback_receipt_mismatch';
    end if;
    v_fields := p_receipt - 'receiptId';
    v_expected := 'sha256:' || encode(extensions.digest(convert_to(
      'rollback-receipt-identity-v1' || E'\n' || public.site_content_canonical_json(v_fields), 'UTF8'), 'sha256'), 'hex');
  else
    raise exception using errcode = '22023', message = 'site_content_receipt_kind_invalid';
  end if;
  if v_id is distinct from v_expected then
    raise exception using errcode = '22023', message = 'site_content_receipt_identity_invalid';
  end if;
  return v_id;
end;
$$;

create or replace function public.record_site_content_reconciliation_plan(
  p_plan jsonb,
  p_reviewed_by uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dispositions jsonb := p_plan->'dispositions';
  v_trusted jsonb := p_plan->'trustedSnapshots';
  v_expected integer := (p_plan->>'expectedRecordCount')::integer;
  v_groups integer := (p_plan->>'expectedGroupCount')::integer;
  v_item jsonb;
  v_snapshot jsonb;
  source record;
  v_live_count integer;
begin
  if jsonb_typeof(p_plan) <> 'object'
    or p_plan - array['version','planDigest','trustedSnapshotDigest','expectedRecordCount','expectedGroupCount',
      'batchSize','batchCount','counts','trustedSnapshots','dispositions'] <> '{}'::jsonb
    or (select count(*) from jsonb_object_keys(p_plan)) <> 10
    or p_plan->>'version' <> 'site-content-reconciliation-plan-v1'
    or jsonb_typeof(v_dispositions) <> 'array'
    or jsonb_typeof(v_trusted) <> 'array'
    or v_expected < 1 or v_expected > 5000
    or v_groups < 1 or v_groups > v_expected
    or jsonb_array_length(v_dispositions) <> v_expected
    or jsonb_array_length(v_trusted) <> v_groups
    or (p_plan->>'batchSize')::integer not between 1 and 500
    or (p_plan->>'batchCount')::integer <> ceil(v_expected::numeric / (p_plan->>'batchSize')::integer)::integer
    or p_plan->>'planDigest' is distinct from public.site_content_json_sha256(p_plan - 'planDigest')
    or p_plan->>'trustedSnapshotDigest' is distinct from public.site_content_json_sha256(jsonb_build_object(
      'version', 'site-content-trusted-snapshot-v1', 'records', v_trusted))
    or (p_plan#>>'{counts,total}')::integer <> v_expected
    or (p_plan#>>'{counts,adopt}')::integer <> (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'adopt')
    or (p_plan#>>'{counts,retire}')::integer <> (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'retire')
    or (p_plan#>>'{counts,identicalDuplicate}')::integer <> (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'identical_duplicate')
    or (select count(*) from jsonb_array_elements(v_dispositions) item where item->>'disposition' = 'adopt') <> v_groups
    or (select count(distinct item->>'logicalId') from jsonb_array_elements(v_dispositions) item) <> v_groups
    or (select count(distinct item->>'logicalId') from jsonb_array_elements(v_dispositions) item
      where item->>'disposition' = 'adopt') <> v_groups
    or (select count(distinct ((item->>'sourceKind') || ':' || (item->>'sourceRowId')))
      from jsonb_array_elements(v_dispositions) item) <> v_expected
    or v_dispositions is distinct from (select jsonb_agg(item order by item->>'logicalId' collate "C",
      item->>'sourceKind' collate "C", item->>'sourceRowId' collate "C") from jsonb_array_elements(v_dispositions) item)
    or v_trusted is distinct from (select jsonb_agg(item order by item->>'logicalId' collate "C")
      from jsonb_array_elements(v_trusted) item)
    or (select count(distinct item->>'logicalId') from jsonb_array_elements(v_trusted) item) <> v_groups
    then
    raise exception using errcode = '22023', message = 'site_content_reconciliation_unresolved';
  end if;
  for v_snapshot in select value from jsonb_array_elements(v_trusted) loop
    if v_snapshot - array['logicalId','publicRecordId','route','contentHash','publicationVersion','governanceHash'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(v_snapshot)) <> 6
      or v_snapshot->>'logicalId' !~ '^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$'
      or v_snapshot->>'publicRecordId' is distinct from v_snapshot->>'logicalId'
      or v_snapshot->>'route' not like '/%'
      or v_snapshot->>'contentHash' !~ '^[0-9a-f]{64}$'
      or v_snapshot->>'publicationVersion' !~ '^[0-9a-f]{64}$'
      or v_snapshot->>'governanceHash' !~ '^[0-9a-f]{64}$'
      then raise exception using errcode = '22023', message = 'site_content_reconciliation_snapshot_invalid';
    end if;
  end loop;
  for v_item in select value from jsonb_array_elements(v_dispositions) loop
    if v_item - array['logicalId','disposition','sourceKind','sourceRowId','sourceVersion','contentHash',
        'publicationVersion','trustedPublicRecordId','trustedRoute','trustedGovernanceHash'] <> '{}'::jsonb
      or (select count(*) from jsonb_object_keys(v_item)) <> 10
      or v_item->>'logicalId' !~ '^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]*$'
      or v_item->>'disposition' not in ('adopt','retire','identical_duplicate')
      or v_item->>'sourceKind' not in ('service','form','medication','differential','presentation')
      or v_item->>'sourceRowId' !~ '^[0-9a-f-]{36}$'
      or v_item->>'sourceVersion' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$'
      or v_item->>'contentHash' !~ '^[0-9a-f]{64}$'
      or v_item->>'publicationVersion' !~ '^[0-9a-f]{64}$'
      or v_item->>'trustedGovernanceHash' !~ '^[0-9a-f]{64}$'
      then raise exception using errcode = '22023', message = 'site_content_reconciliation_item_invalid';
    end if;
    select * into strict source from public.site_content_source_projection(
      v_item->>'sourceKind', (v_item->>'sourceRowId')::uuid);
    select value into strict v_snapshot from jsonb_array_elements(v_trusted)
      where value->>'logicalId' = v_item->>'logicalId';
    if v_item->>'sourceVersion' is distinct from source.source_version
      or v_item->>'logicalId' is distinct from source.logical_id
      or v_item->>'contentHash' is distinct from source.record->>'contentHash'
      or v_item->>'publicationVersion' is distinct from source.record->>'publicationVersion'
      or v_item->>'trustedPublicRecordId' is distinct from v_snapshot->>'publicRecordId'
      or v_item->>'trustedRoute' is distinct from v_snapshot->>'route'
      or v_item->>'trustedGovernanceHash' is distinct from v_snapshot->>'governanceHash'
      or (v_item->>'disposition' in ('adopt','identical_duplicate') and (
        source.record->>'contentHash' is distinct from v_snapshot->>'contentHash'
        or source.record->>'publicationVersion' is distinct from v_snapshot->>'publicationVersion'
        or source.record->>'route' is distinct from v_snapshot->>'route'
        or public.site_content_record_governance_hash(source.record) is distinct from v_snapshot->>'governanceHash'))
      or (v_item->>'disposition' = 'retire' and
        source.record->>'contentHash' = v_snapshot->>'contentHash'
        and source.record->>'publicationVersion' = v_snapshot->>'publicationVersion'
        and source.record->>'route' = v_snapshot->>'route'
        and public.site_content_record_governance_hash(source.record) = v_snapshot->>'governanceHash')
      then raise exception using errcode = '22023', message = 'site_content_reconciliation_source_evidence_mismatch';
    end if;
  end loop;
  select count(*) into v_live_count from (
    select 'service'::text as source_kind, id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') source_version
      from public.clinical_registry_records where kind = 'service'
    union all select 'form', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      from public.clinical_registry_records where kind = 'form'
    union all select 'medication', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.medication_records
    union all select case kind when 'presentation' then 'presentation' else 'differential' end, id,
      to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.differential_records
  ) live;
  if v_live_count <> v_expected or exists (
    select 1 from (
      select 'service'::text source_kind, id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') source_version
        from public.clinical_registry_records where kind = 'service'
      union all select 'form', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.clinical_registry_records where kind = 'form'
      union all select 'medication', id, to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.medication_records
      union all select case kind when 'presentation' then 'presentation' else 'differential' end, id,
        to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') from public.differential_records
    ) live left join jsonb_array_elements(v_dispositions) item
      on item->>'sourceKind' = live.source_kind and item->>'sourceRowId' = live.id::text
        and item->>'sourceVersion' = live.source_version
    where item is null
  ) then raise exception using errcode = '22023', message = 'site_content_reconciliation_population_mismatch'; end if;
  insert into public.site_content_reconciliation_plans(
    plan_digest, version, trusted_snapshot_digest, trusted_snapshots, dispositions, expected_record_count,
    expected_group_count, batch_size, batch_count, counts, reviewed_by
  ) values (
    p_plan->>'planDigest', p_plan->>'version', p_plan->>'trustedSnapshotDigest', v_trusted, v_dispositions,
    v_expected, v_groups, (p_plan->>'batchSize')::integer, (p_plan->>'batchCount')::integer, p_plan->'counts', p_reviewed_by
  ) on conflict (plan_digest) do nothing;
  return exists (
    select 1 from public.site_content_reconciliation_plans rp
    where rp.plan_digest = p_plan->>'planDigest'
      and rp.version = p_plan->>'version'
      and rp.trusted_snapshot_digest = p_plan->>'trustedSnapshotDigest'
      and rp.trusted_snapshots = v_trusted
      and rp.dispositions = v_dispositions
      and rp.expected_record_count = v_expected
      and rp.expected_group_count = v_groups
      and rp.batch_size = (p_plan->>'batchSize')::integer
      and rp.batch_count = (p_plan->>'batchCount')::integer
      and rp.counts = p_plan->'counts'
      and rp.reviewed_by = p_reviewed_by
  );
end;
$$;

create or replace function public.site_content_reconciliation_sources_match(p_plan_digest text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan public.site_content_reconciliation_plans%rowtype;
  v_item jsonb;
  v_snapshot jsonb;
  source record;
begin
  select * into strict v_plan from public.site_content_reconciliation_plans rp
  where rp.plan_digest = p_plan_digest;
  for v_item in select value from jsonb_array_elements(v_plan.dispositions) loop
    select * into strict source from public.site_content_source_projection(
      v_item->>'sourceKind', (v_item->>'sourceRowId')::uuid);
    select value into strict v_snapshot from jsonb_array_elements(v_plan.trusted_snapshots)
      where value->>'logicalId' = v_item->>'logicalId';
    if v_item->>'sourceVersion' is distinct from source.source_version
      or v_item->>'logicalId' is distinct from source.logical_id
      or v_item->>'contentHash' is distinct from source.record->>'contentHash'
      or v_item->>'publicationVersion' is distinct from source.record->>'publicationVersion'
      or v_item->>'trustedPublicRecordId' is distinct from v_snapshot->>'publicRecordId'
      or v_item->>'trustedRoute' is distinct from v_snapshot->>'route'
      or v_item->>'trustedGovernanceHash' is distinct from v_snapshot->>'governanceHash'
      or (v_item->>'disposition' in ('adopt','identical_duplicate') and (
        source.record->>'contentHash' is distinct from v_snapshot->>'contentHash'
        or source.record->>'publicationVersion' is distinct from v_snapshot->>'publicationVersion'
        or source.record->>'route' is distinct from v_snapshot->>'route'
        or public.site_content_record_governance_hash(source.record) is distinct from v_snapshot->>'governanceHash'))
      or (v_item->>'disposition' = 'retire' and
        source.record->>'contentHash' = v_snapshot->>'contentHash'
        and source.record->>'publicationVersion' = v_snapshot->>'publicationVersion'
        and source.record->>'route' = v_snapshot->>'route'
        and public.site_content_record_governance_hash(source.record) = v_snapshot->>'governanceHash')
      then return false;
    end if;
  end loop;
  return true;
exception when no_data_found then return false;
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
returns table (outcome text, conflict_code text, logical_id text, publication_id uuid, event_sequence bigint, change_epoch bigint)
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
    outcome := 'conflict'; conflict_code := 'stale_change_epoch'; return next; return;
  end if;

  select * into strict v_source from public.site_content_source_projection(p_kind, p_source_row_id);
  if v_source.source_version is distinct from p_expected_source_version then
    outcome := 'conflict'; conflict_code := 'stale_source_version'; return next; return;
  end if;
  select * into v_existing
  from public.site_content_public_records h
  where h.logical_id = v_source.logical_id
  for update;
  if v_existing.logical_id is not null and not v_existing.retired and exists (
    select 1 from public.site_content_publications p
    where p.id = v_existing.current_publication_id
      and p.source_row_id = p_source_row_id
      and p.source_version = v_source.source_version
  ) then
    outcome := 'conflict'; conflict_code := 'already_published'; return next; return;
  end if;
  if v_existing.logical_id is null and not v_state.initialized then
    if p_reconciliation_plan_digest is null or not exists (
      select 1 from public.site_content_reconciliation_plans p
      where p.plan_digest = p_reconciliation_plan_digest
        and exists (
          select 1 from jsonb_array_elements(p.dispositions) item
          where item->>'logicalId' = v_source.logical_id and item->>'disposition' = 'adopt'
            and item->>'sourceKind' = p_kind
            and item->>'sourceRowId' = p_source_row_id::text
            and item->>'sourceVersion' = v_source.source_version
            and item->>'contentHash' = v_source.record->>'contentHash'
            and item->>'publicationVersion' = v_source.record->>'publicationVersion'
            and item->>'trustedPublicRecordId' = v_source.logical_id
            and item->>'trustedRoute' = v_source.record->>'route'
            and item->>'trustedGovernanceHash' = public.site_content_record_governance_hash(v_source.record)
        )
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
  insert into public.site_content_public_records(logical_id, kind, slug, current_publication_id, head_change_epoch, retired)
  values (v_source.logical_id, p_kind, v_source.slug, v_publication_id, change_epoch, false)
  on conflict on constraint site_content_public_records_pkey do update set
    current_publication_id = excluded.current_publication_id,
    kind = excluded.kind,
    slug = excluded.slug,
    head_change_epoch = excluded.head_change_epoch,
    retired = false,
    updated_at = pg_catalog.clock_timestamp();
  insert into public.site_content_sync_events(logical_id, target_publication_id, target_change_epoch)
  values (v_source.logical_id, v_publication_id, change_epoch)
  returning site_content_sync_events.event_sequence into v_event_sequence;
  update public.site_content_sync_events e set state = 'superseded', worker_id = null, lease_token = null,
    lease_expires_at = null, superseded_by_event_sequence = v_event_sequence,
    terminal_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where e.event_sequence <> v_event_sequence and e.target_change_epoch < change_epoch
    and e.state in ('pending', 'retry_pending', 'processing', 'ready');
  update public.site_content_releases set state = 'abandoned'
  where state = 'candidate' and target_change_epoch < change_epoch;
  update public.site_content_public_records
  set pending_event_sequence = v_event_sequence, updated_at = pg_catalog.clock_timestamp()
  where site_content_public_records.logical_id = v_source.logical_id;
  update public.site_content_sync_state
  set change_epoch = v_state.change_epoch + 1, updated_at = pg_catalog.clock_timestamp()
  where singleton;
  logical_id := v_source.logical_id;
  publication_id := v_publication_id;
  event_sequence := v_event_sequence;
  outcome := 'applied'; conflict_code := null;
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
returns table (outcome text, conflict_code text, logical_id text, publication_id uuid, event_sequence bigint, change_epoch bigint)
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
  if v_state.change_epoch is distinct from p_expected_change_epoch then
    outcome := 'conflict'; conflict_code := 'stale_change_epoch'; return next; return;
  end if;
  select * into strict v_source from public.site_content_source_projection(p_kind, p_source_row_id);
  if v_source.source_version is distinct from p_expected_source_version then
    outcome := 'conflict'; conflict_code := 'stale_source_version'; return next; return;
  end if;
  select * into v_head from public.site_content_public_records where site_content_public_records.logical_id = v_source.logical_id for update;
  if not found then outcome := 'conflict'; conflict_code := 'missing_publication'; return next; return; end if;
  if v_head.retired then outcome := 'conflict'; conflict_code := 'already_retired'; return next; return; end if;
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
    head_change_epoch = change_epoch, updated_at = pg_catalog.clock_timestamp()
  where site_content_public_records.logical_id = v_source.logical_id;
  insert into public.site_content_sync_events(logical_id, target_publication_id, target_change_epoch)
  values (v_source.logical_id, v_publication_id, change_epoch)
  returning site_content_sync_events.event_sequence into v_event_sequence;
  update public.site_content_sync_events e set state = 'superseded', worker_id = null, lease_token = null,
    lease_expires_at = null, superseded_by_event_sequence = v_event_sequence,
    terminal_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  where e.event_sequence <> v_event_sequence and e.target_change_epoch < change_epoch
    and e.state in ('pending', 'retry_pending', 'processing', 'ready');
  update public.site_content_releases set state = 'abandoned'
  where state = 'candidate' and target_change_epoch < change_epoch;
  update public.site_content_public_records set pending_event_sequence = v_event_sequence
  where site_content_public_records.logical_id = v_source.logical_id;
  update public.site_content_sync_state set change_epoch = v_state.change_epoch + 1, updated_at = pg_catalog.clock_timestamp() where singleton;
  logical_id := v_source.logical_id;
  publication_id := v_publication_id;
  event_sequence := v_event_sequence;
  outcome := 'applied'; conflict_code := null;
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
    select rr.logical_id, rr.record, rr.render_payload
    from state s
    join public.site_content_release_records rr on rr.release_id = s.active_release_id
    join public.site_content_publications p on p.id = rr.target_publication_id and p.logical_id = rr.logical_id
    where p.kind = p_kind and (p_slug is null or p.slug = p_slug)
      and rr.public_visible and not rr.tombstone
  ), safe_requested as (
    select r.*
    from requested r
    cross join state s
    where s.initialized and s.active_release_id is not null
      and not exists (
        select 1 from public.site_content_public_records h
        where h.head_change_epoch > s.served_change_epoch
          and (p_slug is null or h.logical_id = r.logical_id)
          and h.pending_event_sequence is not null
      )
  )
  select s.initialized,
    case when s.initialized then r.record else null end,
    case when s.initialized then r.render_payload else null end,
    jsonb_build_object(
      'releaseId', s.active_release_id,
      'staticManifestDigest', rel.static_manifest_digest,
      'dynamicStateDigest', rel.dynamic_state_digest,
      'releaseDigest', s.active_release_digest,
      'changeEpoch', rel.target_change_epoch::text,
      'state', case
        when not s.initialized then 'unavailable'
        when exists (
          select 1 from public.site_content_public_records h
          where h.head_change_epoch > s.served_change_epoch
            and h.pending_event_sequence is not null
        ) then 'updating'
        when s.active_release_id is null then 'unavailable'
        else 'current'
      end
    ) as snapshot
  from state s
  left join public.site_content_releases rel on rel.id = s.active_release_id
  left join safe_requested r on true
  ;
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
  update public.site_content_sync_events e set state = 'quarantined', worker_id = null, lease_token = null,
    lease_expires_at = null, terminal_at = pg_catalog.clock_timestamp(), last_error_code = 'lease_expired',
    updated_at = pg_catalog.clock_timestamp()
  where e.state = 'processing' and e.lease_expires_at <= pg_catalog.clock_timestamp()
    and e.attempt_count >= 5;
  return query
  with claimable as (
    select e.event_sequence
    from public.site_content_sync_events e
    where ((e.state in ('pending', 'retry_pending') and e.next_attempt_at <= pg_catalog.clock_timestamp())
      or (e.state = 'processing' and e.lease_expires_at <= pg_catalog.clock_timestamp()
        and e.attempt_count < 5))
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
  v_records jsonb;
  v_total integer;
begin
  v_records := (p_plan->'added') || (p_plan->'changed') || (p_plan->'unchanged') || (p_plan->'tombstones');
  v_total := jsonb_array_length(p_plan->'added') + jsonb_array_length(p_plan->'changed')
    + jsonb_array_length(p_plan->'unchanged') + jsonb_array_length(p_plan->'tombstones');
  if p_plan_digest !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_plan) <> 'object'
    or p_plan->>'version' <> 'site-content-sync-plan-v1'
    or p_plan->>'planDigest' is distinct from p_plan_digest
    or p_plan_digest is distinct from public.site_content_json_sha256(
      jsonb_build_object('domain', 'site-content-sync-plan-v1') || (p_plan - 'planDigest'))
    or p_plan->>'releaseId' !~ '^[0-9a-f-]{36}$'
    or (p_plan->>'targetChangeEpoch')::bigint is distinct from p_expected_change_epoch
    or jsonb_typeof(p_plan->'added') <> 'array'
    or jsonb_typeof(p_plan->'changed') <> 'array'
    or jsonb_typeof(p_plan->'unchanged') <> 'array'
    or jsonb_typeof(p_plan->'tombstones') <> 'array'
    or v_total > 5000
    or (p_plan#>>'{counts,added}')::integer <> jsonb_array_length(p_plan->'added')
    or (p_plan#>>'{counts,changed}')::integer <> jsonb_array_length(p_plan->'changed')
    or (p_plan#>>'{counts,unchanged}')::integer <> jsonb_array_length(p_plan->'unchanged')
    or (p_plan#>>'{counts,tombstones}')::integer <> jsonb_array_length(p_plan->'tombstones')
    or (p_plan#>>'{counts,total}')::integer <> v_total
    or (select count(distinct item->>'logicalId') from jsonb_array_elements(v_records) item) <> v_total
    or (p_plan->>'reconciliationPlanDigest' is not null and not exists (
      select 1 from public.site_content_reconciliation_plans rp
      where rp.plan_digest = p_plan->>'reconciliationPlanDigest')) then
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
      from jsonb_array_elements((p_plan->'added') || (p_plan->'changed') ||
        (p_plan->'unchanged') || (p_plan->'tombstones')) item
      where item->>'logicalId' = v_event.logical_id
        and item->>'targetPublicationId' = v_event.target_publication_id::text
    ) then return false; end if;
  insert into public.site_content_sync_event_plans(event_sequence, plan_digest, target_change_epoch, plan, release_id)
  values (p_event_sequence, p_plan_digest, p_expected_change_epoch, p_plan, (p_plan->>'releaseId')::uuid)
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

create or replace function public.site_content_release_id(
  p_release_digest text,
  p_target_change_epoch bigint,
  p_generation_id text
)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_hash text;
  v_value text;
begin
  v_hash := public.site_content_json_sha256(jsonb_build_object(
    'version', 'site-content-release-instance-v1',
    'releaseDigest', p_release_digest,
    'targetChangeEpoch', p_target_change_epoch::text,
    'generationId', p_generation_id));
  v_value := substr(v_hash, 1, 12) || '5' || substr(v_hash, 14, 3) || '8' || substr(v_hash, 18, 15);
  return (substr(v_value,1,8) || '-' || substr(v_value,9,4) || '-' || substr(v_value,13,4) || '-' ||
    substr(v_value,17,4) || '-' || substr(v_value,21,12))::uuid;
end;
$$;

create or replace function public.site_content_dynamic_state_digest(p_release_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select public.site_content_json_sha256(jsonb_build_object(
    'version', 'site-content-dynamic-state-v1',
    'records', coalesce(jsonb_agg(jsonb_build_object(
      'logicalId', rr.logical_id,
      'documentId', rr.logical_document_id::text,
      'chunkId', rr.logical_chunk_id::text,
      'publicationVersion', rr.publication_fingerprint,
      'contentHash', rr.content_hash,
      'governanceFingerprint', rr.governance_fingerprint,
      'lineageFingerprint', rr.lineage_fingerprint,
      'publicMetadataFingerprint', rr.public_metadata_fingerprint,
      'tombstone', false
    ) order by rr.logical_id collate "C") filter (where rr.target_publication_id is not null and not rr.tombstone), '[]'::jsonb)
  )) from public.site_content_release_records rr where rr.release_id = p_release_id;
$$;

create or replace function public.site_content_release_digest(p_release_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select public.site_content_json_sha256(jsonb_build_object(
    'version', 'site-content-release-digest-v1',
    'registryVersion', r.registry_version,
    'staticManifestDigest', r.static_manifest_digest,
    'dynamicStateDigest', public.site_content_dynamic_state_digest(r.id),
    'records', coalesce((select jsonb_agg(jsonb_build_object(
      'logicalId', rr.logical_id,
      'documentId', rr.logical_document_id::text,
      'chunkId', rr.logical_chunk_id::text,
      'publicationVersion', rr.publication_fingerprint,
      'contentHash', rr.content_hash,
      'governanceFingerprint', rr.governance_fingerprint,
      'lineageFingerprint', rr.lineage_fingerprint,
      'publicMetadataFingerprint', rr.public_metadata_fingerprint,
      'tombstone', false,
      'embeddingModel', rr.embedding_model,
      'embeddingDimensions', rr.embedding_dimensions,
      'embeddingFingerprint', rr.embedding_fingerprint
    ) order by rr.logical_id collate "C") from public.site_content_release_records rr
      where rr.release_id = r.id and not rr.tombstone), '[]'::jsonb),
    'tombstones', coalesce((select jsonb_agg(jsonb_build_object(
      'logicalId', rr.logical_id, 'documentId', rr.logical_document_id::text,
      'chunkId', rr.logical_chunk_id::text, 'tombstone', true
    ) order by rr.logical_id collate "C") from public.site_content_release_records rr
      where rr.release_id = r.id and rr.tombstone), '[]'::jsonb)
  )) from public.site_content_releases r where r.id = p_release_id;
$$;

create or replace function public.site_content_provider_free_checks_pass(p_release_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select not exists (
    select 1 from public.site_content_release_records rr
    where rr.release_id = p_release_id and (
      (not rr.tombstone and (rr.embedding is null or extensions.vector_dims(rr.embedding) <> rr.embedding_dimensions
        or rr.normalized_text = '' or not rr.public_visible))
      or (rr.tombstone and (rr.embedding is not null or rr.public_visible))
      or rr.governance_fingerprint = '' or rr.lineage_fingerprint = '' or rr.public_metadata_fingerprint = ''
    )
  );
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
    or v_plan.plan->>'releaseDigest' is distinct from p_stage->>'releaseDigest'
    or p_stage->>'releaseId' is distinct from public.site_content_release_id(
      p_stage->>'releaseDigest', (p_stage->>'targetChangeEpoch')::bigint, p_stage->>'generationId')::text
    or (p_stage - 'records') is distinct from v_plan.plan then
    return false;
  end if;
  insert into public.site_content_releases(
    id, state, target_change_epoch, previous_release_id, registry_version, static_manifest_digest,
    dynamic_state_digest, release_digest, generation_id, plan_digest, reconciliation_plan_digest,
    expected_added_count, expected_changed_count, expected_unchanged_count, expected_record_count,
    expected_tombstone_count, must_pass_checks
  ) values (
    v_release_id, 'candidate', (p_stage->>'targetChangeEpoch')::bigint, v_state.active_release_id,
    p_stage->>'registryVersion', p_stage->>'staticManifestDigest', p_stage->>'dynamicStateDigest',
    p_stage->>'releaseDigest', p_stage->>'generationId', p_stage->>'planDigest',
    nullif(p_stage->>'reconciliationPlanDigest', ''), (p_stage#>>'{counts,added}')::integer,
    (p_stage#>>'{counts,changed}')::integer, (p_stage#>>'{counts,unchanged}')::integer,
    (p_stage#>>'{counts,total}')::integer, (p_stage#>>'{counts,tombstones}')::integer, false
  ) on conflict (id) do nothing;
  select * into strict v_release from public.site_content_releases r where r.id = v_release_id for update;
  if v_release.release_digest is distinct from p_stage->>'releaseDigest'
    or v_release.target_change_epoch is distinct from (p_stage->>'targetChangeEpoch')::bigint
    or v_release.plan_digest is distinct from p_stage->>'planDigest'
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
    or v_plan.plan->>'releaseDigest' is distinct from p_stage->>'releaseDigest'
    or (p_stage - 'records') is distinct from v_plan.plan then
    raise exception using errcode = '40001', message = 'site_content_stage_stale';
  end if;
  if jsonb_typeof(p_stage->'records') <> 'array'
    or (p_stage#>>'{embedding,dimensions}')::integer <> 1536
    or p_stage->'counts' is distinct from v_plan.plan->'counts'
    or jsonb_array_length(p_stage->'records') is distinct from (p_stage#>>'{counts,total}')::integer
    or (select count(distinct staged->>'logicalId') from jsonb_array_elements(p_stage->'records') staged)
      is distinct from (p_stage#>>'{counts,total}')::integer
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
          and coalesce(planned->>'normalizedText', '') = coalesce(staged->>'normalizedText', '')
          and coalesce(planned->>'reuseEmbedding', 'false') = coalesce(staged->>'reuseEmbedding', 'false')
          and coalesce(planned->'renderPayload', 'null'::jsonb) = coalesce(staged->'renderPayload', 'null'::jsonb)
          and staged->>'embeddingModel' = p_stage#>>'{embedding,model}'
          and (staged->>'embeddingDimensions')::integer = (p_stage#>>'{embedding,dimensions}')::integer
          and staged->>'embeddingFingerprint' = p_stage#>>'{embedding,fingerprint}'
          and (coalesce((planned->>'reuseEmbedding')::boolean, false) = false
            or planned->'embedding' = staged->'embedding')
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
      embedding_fingerprint, embedding_value_digest, embedding, record, render_payload, tombstone, public_visible
    ) values (
      v_release_id, v_record->>'logicalId', nullif(v_record->>'targetPublicationId', '')::uuid,
      (v_record->>'documentId')::uuid, (v_record->>'chunkId')::uuid,
      coalesce(v_record->>'normalizedText', ''), v_record->>'contentHash', v_record->>'publicationFingerprint',
      v_record->>'governanceFingerprint', v_record->>'lineageFingerprint',
      v_record->>'publicMetadataFingerprint', v_record->>'embeddingModel',
      (v_record->>'embeddingDimensions')::integer, v_record->>'embeddingFingerprint',
      case when v_record ? 'embedding' then encode(extensions.digest(convert_to(
        ((v_record->>'embedding')::extensions.vector)::text, 'UTF8'), 'sha256'), 'hex') else null end,
      case when v_record ? 'embedding' then (v_record->>'embedding')::extensions.vector else null end,
      (select p.record from public.site_content_publications p
        where p.id = nullif(v_record->>'targetPublicationId', '')::uuid and p.logical_id = v_record->>'logicalId'),
      (select p.render_payload from public.site_content_publications p
        where p.id = nullif(v_record->>'targetPublicationId', '')::uuid and p.logical_id = v_record->>'logicalId'),
      coalesce((v_record->>'tombstone')::boolean, false),
      not coalesce((v_record->>'tombstone')::boolean, false)
    ) on conflict (release_id, logical_id) do nothing;
  end loop;
  if (select count(*) from public.site_content_release_records rr where rr.release_id = v_release_id)
      is distinct from (p_stage#>>'{counts,total}')::integer then
    raise exception using errcode = '23514', message = 'site_content_stage_population_mismatch';
  end if;
  if exists (
    select 1 from public.site_content_release_records rr
    join public.site_content_publications p on p.id = rr.target_publication_id and p.logical_id = rr.logical_id
    where rr.release_id = v_release_id and not rr.tombstone and (
      rr.normalized_text is distinct from p.record->>'body'
      or rr.content_hash is distinct from p.record->>'contentHash'
      or rr.publication_fingerprint is distinct from p.record->>'publicationVersion'
      or rr.governance_fingerprint is distinct from public.site_content_json_sha256(jsonb_build_object(
        'access', p.record->>'access', 'validationStatus', p.record->>'validationStatus',
        'sourceStatus', p.record->>'sourceStatus'))
      or rr.lineage_fingerprint is distinct from public.site_content_json_sha256(p.record->'sourceLineage')
      or rr.public_metadata_fingerprint is distinct from public.site_content_json_sha256(jsonb_build_object(
        'route', p.record->>'route', 'title', p.record->>'title', 'sourceRole', p.record->>'sourceRole'))
      or rr.render_payload is distinct from p.render_payload
      or extensions.vector_dims(rr.embedding) <> rr.embedding_dimensions
    )
  ) or exists (
    select 1 from public.site_content_release_records rr
    join public.site_content_publications p on p.id = rr.target_publication_id and p.logical_id = rr.logical_id
    where rr.release_id = v_release_id and rr.tombstone and not p.retired
  ) or not public.site_content_provider_free_checks_pass(v_release_id) then
    raise exception using errcode = '23514', message = 'site_content_stage_authoritative_check_failed';
  end if;
  update public.site_content_releases set must_pass_checks = true where id = v_release_id;
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
    or not public.site_content_provider_free_checks_pass(p_release_id)
    or public.site_content_dynamic_state_digest(p_release_id) is distinct from v_release.dynamic_state_digest
    or public.site_content_release_digest(p_release_id) is distinct from v_release.release_digest
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
    or (select jsonb_array_length(ep.plan->'added') from public.site_content_sync_event_plans ep where ep.plan_digest = v_release.plan_digest limit 1) <> v_release.expected_added_count
    or (select jsonb_array_length(ep.plan->'changed') from public.site_content_sync_event_plans ep where ep.plan_digest = v_release.plan_digest limit 1) <> v_release.expected_changed_count
    or (select jsonb_array_length(ep.plan->'unchanged') from public.site_content_sync_event_plans ep where ep.plan_digest = v_release.plan_digest limit 1) <> v_release.expected_unchanged_count
    or exists (select 1 from public.site_content_release_records rr where rr.release_id = p_release_id and not rr.tombstone and
      (rr.embedding is null or extensions.vector_dims(rr.embedding) <> rr.embedding_dimensions
        or rr.embedding_value_digest is distinct from encode(extensions.digest(convert_to(rr.embedding::text, 'UTF8'), 'sha256'), 'hex')
        or not rr.public_visible))
    or exists (select 1 from public.site_content_sync_events e where e.target_change_epoch = p_expected_change_epoch and e.state <> 'ready')
    or exists (
      select 1 from public.site_content_public_records h
      left join public.site_content_release_records rr on rr.release_id = p_release_id and rr.logical_id = h.logical_id
      where rr.logical_id is null or rr.target_publication_id is distinct from h.current_publication_id
        or rr.tombstone is distinct from h.retired
        or rr.governance_fingerprint = '' or rr.lineage_fingerprint = ''
    ) or exists (
      select 1 from public.site_content_release_records rr
      where rr.release_id = p_release_id and rr.target_publication_id is not null and not rr.tombstone
        and not exists (select 1 from public.site_content_public_records h
          where h.logical_id = rr.logical_id and h.current_publication_id = rr.target_publication_id)
    ) then return false; end if;
  if not v_state.initialized and (
    v_release.reconciliation_plan_digest is null
    or not exists (
      select 1 from public.site_content_reconciliation_plans rp
      where rp.plan_digest = v_release.reconciliation_plan_digest
        and public.site_content_reconciliation_sources_match(rp.plan_digest)
        and (select count(*) from jsonb_array_elements(rp.dispositions) item where item->>'disposition' = 'adopt') =
          (select count(*) from public.site_content_public_records)
        and not exists (
          select 1 from jsonb_array_elements(rp.dispositions) item
          where item->>'disposition' = 'adopt' and not exists (
            select 1 from public.site_content_public_records h
            join public.site_content_publications p on p.id = h.current_publication_id
            join public.site_content_release_records rr on rr.release_id = p_release_id and rr.logical_id = h.logical_id
            where h.logical_id = item->>'logicalId'
              and p.reconciliation_plan_digest = rp.plan_digest
              and p.source_row_id::text = item->>'sourceRowId'
              and p.source_version = item->>'sourceVersion'
              and p.record->>'contentHash' = item->>'contentHash'
              and p.record->>'publicationVersion' = item->>'publicationVersion'
              and item->>'trustedPublicRecordId' = h.logical_id
              and item->>'trustedRoute' = p.record->>'route'
              and item->>'trustedGovernanceHash' = public.site_content_record_governance_hash(p.record)
              and rr.target_publication_id = p.id
              and exists (
                select 1 from (
                  select 'service'::text source_kind, id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') source_version
                    from public.clinical_registry_records where kind = 'service'
                  union all select 'form', id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    from public.clinical_registry_records where kind = 'form'
                  union all select 'medication', id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    from public.medication_records
                  union all select case kind when 'presentation' then 'presentation' else 'differential' end, id,
                    to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                    from public.differential_records
                ) live
                where live.source_kind = item->>'sourceKind'
                  and live.id::text = item->>'sourceRowId'
                  and live.source_version = item->>'sourceVersion'
              )
          )
        )
    )
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
    served_change_epoch = p_expected_change_epoch,
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
    select 1 from public.site_content_release_records rr
    where rr.release_id = p_release_id and rr.logical_id = h.logical_id
      and rr.target_publication_id = h.current_publication_id
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
    or (p_rollback_receipt->>'rolledBackAt')::timestamptz <
      (v_activation.receipt->>'activatedAt')::timestamptz
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
    active_release_digest = v_target.release_digest,
    initialized = v_target.target_change_epoch > 0,
    served_change_epoch = v_target.target_change_epoch,
    updated_at = pg_catalog.clock_timestamp()
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
revoke all on function public.site_content_compact_text(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.site_content_canonical_json(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.site_content_json_sha256(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.site_content_public_json_projection(text, jsonb, text[]) from public, anon, authenticated, service_role;
revoke all on function public.site_content_json_text(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.site_content_normalize_search_text(text) from public, anon, authenticated, service_role;
revoke all on function public.site_content_json_array_fields(jsonb, text[]) from public, anon, authenticated, service_role;
revoke all on function public.site_content_source_projection(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.site_content_record_governance_hash(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.guard_site_content_receipt_shape(jsonb, text, uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.site_content_release_id(text, bigint, text) from public, anon, authenticated, service_role;
revoke all on function public.site_content_dynamic_state_digest(uuid) from public, anon, authenticated, service_role;
revoke all on function public.site_content_release_digest(uuid) from public, anon, authenticated, service_role;
revoke all on function public.site_content_provider_free_checks_pass(uuid) from public, anon, authenticated, service_role;

revoke all on function public.read_site_content_public_records(text, text) from public;
grant execute on function public.read_site_content_public_records(text, text) to anon, authenticated, service_role;

revoke all on function public.record_site_content_reconciliation_plan(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.record_site_content_reconciliation_plan(jsonb, uuid) to service_role;
revoke all on function public.site_content_reconciliation_sources_match(text) from public, anon, authenticated, service_role;
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
alter function public.site_content_compact_text(text, integer) owner to postgres;
alter function public.site_content_canonical_json(jsonb) owner to postgres;
alter function public.site_content_json_sha256(jsonb) owner to postgres;
alter function public.site_content_public_json_projection(text, jsonb, text[]) owner to postgres;
alter function public.site_content_json_text(jsonb) owner to postgres;
alter function public.site_content_normalize_search_text(text) owner to postgres;
alter function public.site_content_json_array_fields(jsonb, text[]) owner to postgres;
alter function public.site_content_source_projection(text, uuid) owner to postgres;
alter function public.site_content_record_governance_hash(jsonb) owner to postgres;
alter function public.guard_site_content_receipt_shape(jsonb, text, uuid, text) owner to postgres;
alter function public.record_site_content_reconciliation_plan(jsonb, uuid) owner to postgres;
alter function public.site_content_reconciliation_sources_match(text) owner to postgres;
alter function public.publish_site_content_record(text, uuid, text, bigint, text, uuid) owner to postgres;
alter function public.retire_site_content_record(text, uuid, text, bigint, text, uuid) owner to postgres;
alter function public.read_site_content_public_records(text, text) owner to postgres;
alter function public.claim_site_content_sync_events(uuid, integer, integer) owner to postgres;
alter function public.heartbeat_site_content_sync_event(bigint, uuid, uuid, bigint, integer) owner to postgres;
alter function public.record_site_content_sync_event_plan(bigint, bigint, text, jsonb) owner to postgres;
alter function public.read_site_content_sync_event_plan(bigint, uuid, uuid, bigint) owner to postgres;
alter function public.site_content_release_id(text, bigint, text) owner to postgres;
alter function public.site_content_dynamic_state_digest(uuid) owner to postgres;
alter function public.site_content_release_digest(uuid) owner to postgres;
alter function public.site_content_provider_free_checks_pass(uuid) owner to postgres;
alter function public.stage_site_content_sync_event(bigint, uuid, uuid, bigint, jsonb) owner to postgres;
alter function public.fail_site_content_sync_event(bigint, uuid, uuid, bigint, text) owner to postgres;
alter function public.activate_site_content_release(uuid, text, bigint, text, jsonb) owner to postgres;
alter function public.rollback_site_content_release(uuid, uuid, text, jsonb) owner to postgres;
