-- Teaching: a health service's teaching programme, attendance, check-in codes, supervision and
-- feedback, built on the shared team tables (on_call_services and on_call_service_members).
--
-- Working file name only. Roster stamps this file when it assembles the combined DB PR, in the
-- order shared -> On Call -> Roster -> Admin -> Teaching, and it relies on every file before it:
-- on_call_services.verified_at and is_demo, on_call_service_members.display_name,
-- on_call_service_invitations.invited_email and issued_via_mode, on_call_service_member_events
-- and public.service_member_active(). It never replaces on_call_service_command.
--
-- Tenancy: every table is service_role only (RLS on, no policies, nothing granted to anon or
-- authenticated). Server routes call the security-invoker functions below with the actor id
-- taken from the signed-in session. No function reads auth.users. Nothing is seeded.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Link lists ({label, url}, https only, at most ten). Used by a table check and by the command.
create function public.teaching_valid_links(p_links jsonb) returns boolean
language sql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select case
    when p_links is null or jsonb_typeof(p_links) is distinct from 'array' then false
    when jsonb_array_length(p_links) > 10 then false
    else not exists (
      select 1 from jsonb_array_elements(p_links) as l(value)
      where jsonb_typeof(l.value) is distinct from 'object'
        or l.value - array['label','url'] <> '{}'::jsonb
        or jsonb_typeof(l.value->'label') is distinct from 'string'
        or char_length(btrim(l.value->>'label')) not between 1 and 120
        or jsonb_typeof(l.value->'url') is distinct from 'string'
        or char_length(l.value->>'url') > 2000
        or (l.value->>'url') !~ '^https://[^/@[:space:]]+(/|$)'
    )
  end
$$;

-- A supervision correction holds only the corrected field, never free text.
create function public.teaching_valid_correction(p_reason text, p_value jsonb) returns boolean
language sql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select case
    when p_value is null or jsonb_typeof(p_value) is distinct from 'object' then false
    when p_reason = 'entered_in_error' then p_value = '{}'::jsonb
    when p_reason = 'wrong_date' then
      p_value - 'date' = '{}'::jsonb and jsonb_typeof(p_value->'date') = 'string'
      and (p_value->>'date') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    when p_reason = 'wrong_length' then
      case
        when p_value - 'minutes' <> '{}'::jsonb or jsonb_typeof(p_value->'minutes') is distinct from 'number'
          or (p_value->>'minutes') !~ '^[0-9]{2,3}$' then false
        else (p_value->>'minutes')::integer between 15 and 240 and (p_value->>'minutes')::integer % 15 = 0
      end
    when p_reason = 'wrong_type' then
      p_value - 'type' = '{}'::jsonb and jsonb_typeof(p_value->'type') = 'string'
      and (p_value->>'type') in ('individual','group')
    when p_reason = 'wrong_topics' then
      case
        when p_value - 'topics' <> '{}'::jsonb or jsonb_typeof(p_value->'topics') is distinct from 'array' then false
        else jsonb_array_length(p_value->'topics') between 0 and 5
          and not exists (
            select 1 from jsonb_array_elements(p_value->'topics') as t(value)
            where jsonb_typeof(t.value) is distinct from 'string'
              or (t.value #>> '{}') not in ('case_review','risk','psychotherapy','formulation','medication','mha_legal','teaching_skills','career','exam_prep','wellbeing','other')
          )
      end
    else false
  end
$$;

-- Teaching roles are separate from the On Call role on on_call_service_members. An active member
-- with no active row here is a doctor.
create table public.teaching_member_roles (
  service_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('doctor','organiser','admin')),
  granted_by uuid null references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz null,
  primary key (service_id, user_id),
  foreign key (service_id, user_id) references public.on_call_service_members(service_id, user_id) on delete cascade
);

create table public.teaching_series (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  kind text not null check (kind in ('lecture','case','journal','grand_round','simulation','workshop','other')),
  group_ids uuid[] not null default '{}' check (cardinality(group_ids) <= 20),
  repeat text not null check (repeat in ('once','weekly','fortnightly','monthly_nth')),
  first_date date not null,
  start_time time not null,
  minutes integer not null check (minutes between 10 and 480),
  time_zone text not null default 'Australia/Perth' check (time_zone = 'Australia/Perth'),
  venue text check (venue is null or char_length(btrim(venue)) between 1 and 160),
  join_url text check (join_url is null or (char_length(join_url) <= 2000 and join_url ~ '^https://[^/@[:space:]]+(/|$)')),
  skip_dates date[] not null default '{}' check (cardinality(skip_dates) <= 60),
  end_date date not null,
  presenter_id uuid references auth.users(id) on delete set null,
  materials jsonb not null default '[]'::jsonb check (public.teaching_valid_links(materials)),
  last_confirmed_at timestamptz,
  -- What's on (spec §5a): team-only until an organiser opens it to the team's health service.
  -- Only a verified or demo team with a platform-set health service may open (series.set_open_to).
  open_to text not null default 'team' check (open_to in ('team','health_service')),
  -- "My level" (R4): who the series is aimed at. The viewer's own level stays on their device.
  audience text not null default 'all_doctors' check (audience in ('interns','residents','registrars','consultants','all_doctors')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, service_id),
  check (end_date >= first_date and end_date <= first_date + 366)
);
create index teaching_series_service on public.teaching_series(service_id);

create table public.teaching_occurrences (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  series_id uuid,
  -- The Perth date the series rule produced this occurrence for. It stays put when the session
  -- is moved, so saving the series again never recreates a moved or cancelled date.
  series_date date,
  title text not null check (char_length(btrim(title)) between 3 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text check (venue is null or char_length(btrim(venue)) between 1 and 160),
  join_url text check (join_url is null or (char_length(join_url) <= 2000 and join_url ~ '^https://[^/@[:space:]]+(/|$)')),
  presenter_id uuid references auth.users(id) on delete set null,
  status text not null default 'scheduled' check (status in ('scheduled','moved','cancelled')),
  change_reason text check (change_reason is null or change_reason in ('presenter_unavailable','room_change','clinical_pressure','public_holiday','rescheduled','other')),
  changed_at timestamptz,
  -- The start just before the latest move that changed the time ("Moved from 12:30"). A move of
  -- the venue only keeps it as it was. session.read returns it only while the status is moved.
  previous_starts_at timestamptz,
  -- Server-only. Never returned by any function (tests/teaching-migration-contract.test.ts).
  checkin_secret bytea not null default extensions.gen_random_bytes(32) check (octet_length(checkin_secret) = 32),
  created_at timestamptz not null default now(),
  unique (id, service_id),
  unique (series_id, series_date),
  foreign key (series_id, service_id) references public.teaching_series(id, service_id) on delete set null (series_id),
  check (ends_at > starts_at and ends_at <= starts_at + interval '8 hours'),
  check ((status = 'scheduled') = (change_reason is null)),
  check ((change_reason is null) = (changed_at is null)),
  check (previous_starts_at is null or status <> 'scheduled')
);
create index teaching_occurrences_service_starts on public.teaching_occurrences(service_id, starts_at);
create index teaching_occurrences_presenter on public.teaching_occurrences(presenter_id, starts_at) where presenter_id is not null;
-- What's on and the feed read one week across teams, so they range on starts_at alone.
create index teaching_occurrences_starts on public.teaching_occurrences(starts_at);

create table public.teaching_groups (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  unique (service_id, name),
  unique (id, service_id)
);
create table public.teaching_group_members (
  group_id uuid not null,
  service_id uuid not null,
  user_id uuid not null,
  primary key (group_id, user_id),
  foreign key (group_id, service_id) references public.teaching_groups(id, service_id) on delete cascade,
  foreign key (service_id, user_id) references public.on_call_service_members(service_id, user_id) on delete cascade
);
create index teaching_group_members_user on public.teaching_group_members(user_id, service_id);

-- Notice wording is built in TypeScript from the occurrence and kind. No free text is stored.
create table public.teaching_notices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  occurrence_id uuid not null,
  kind text not null check (kind in ('moved','cancelled')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  foreign key (occurrence_id, service_id) references public.teaching_occurrences(id, service_id) on delete cascade
);
create index teaching_notices_occurrence on public.teaching_notices(occurrence_id);
create index teaching_notices_service_created on public.teaching_notices(service_id, created_at desc);
create table public.teaching_notice_reads (
  notice_id uuid not null references public.teaching_notices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

-- A doctor's own attendance is their record, so it goes when their account is deleted.
create table public.teaching_attendance (
  occurrence_id uuid not null,
  service_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null check (method in ('code_room','code_teams','self')),
  recorded_at timestamptz not null default now(),
  upgraded_from text check (upgraded_from is null or (upgraded_from = 'self' and method <> 'self')),
  -- A visitor from another team in the same health service (spec §5a): always self-reported,
  -- visible only to the visitor, and counted (never named) for the host team.
  visitor boolean not null default false,
  primary key (occurrence_id, user_id),
  check (not visitor or method = 'self'),
  foreign key (occurrence_id, service_id) references public.teaching_occurrences(id, service_id) on delete cascade
);
create index teaching_attendance_user on public.teaching_attendance(user_id, recorded_at desc);

create table public.teaching_checkin_claims (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.teaching_occurrences(id) on delete cascade,
  stream text not null check (stream in ('room','teams')),
  claim_hash text not null unique check (claim_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  check (used_by is null or used_at is not null)
);
create index teaching_checkin_claims_occurrence on public.teaching_checkin_claims(occurrence_id, expires_at);

create table public.teaching_display_links (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references public.teaching_occurrences(id) on delete cascade,
  stream text not null check (stream in ('room','teams')),
  link_hash text not null unique check (link_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index teaching_display_links_occurrence on public.teaching_display_links(occurrence_id);

create table public.teaching_calendar_optins (
  service_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (service_id, user_id),
  foreign key (service_id, user_id) references public.on_call_service_members(service_id, user_id) on delete cascade
);

-- What's on and Resources (spec §5a), PR B. The team's health service is platform-only, like
-- on_call_services.verified_at: only teaching_platform_command writes it. A fixed list, the five
-- WA health service providers plus demo (demo only for is_demo teams).
create table public.teaching_team_settings (
  service_id uuid primary key references public.on_call_services(id) on delete cascade,
  health_service text not null check (health_service in ('nmhs','smhs','emhs','wachs','cahs','demo')),
  set_by uuid references auth.users(id) on delete set null,
  set_at timestamptz not null default now()
);
create index teaching_team_settings_health_service on public.teaching_team_settings(health_service);

-- A session or series from another team, added to a person's own week from What's on. It then
-- shows in Week and the calendar feed while the session stays open. Personal, so it goes with the account.
create table public.teaching_week_adds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_id uuid references public.teaching_occurrences(id) on delete cascade,
  series_id uuid references public.teaching_series(id) on delete cascade,
  added_at timestamptz not null default now(),
  check (num_nonnulls(occurrence_id, series_id) = 1),
  unique (user_id, occurrence_id),
  unique (user_id, series_id)
);
create index teaching_week_adds_occurrence on public.teaching_week_adds(occurrence_id) where occurrence_id is not null;
create index teaching_week_adds_series on public.teaching_week_adds(series_id) where series_id is not null;

-- Organiser-made collections (for example Exam prep) and their sections (for example Written exam).
create table public.teaching_collections (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (service_id, name),
  unique (id, service_id)
);
create table public.teaching_collection_sections (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null,
  service_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sort_order integer not null default 0 check (sort_order between 0 and 999),
  unique (collection_id, name),
  unique (id, collection_id),
  foreign key (collection_id, service_id) references public.teaching_collections(id, service_id) on delete cascade
);

-- Links only: slides and recordings stay where they live, and nothing is uploaded or copied. A
-- resource is an https link or a PsychSift library document id, never both. Who may see it is
-- derived, not stored: the team, plus the health service while its linked session is open.
-- Soft-deleted (removed_at) so saves and the audit trail keep their subject.
create table public.teaching_resources (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  kind text not null check (kind in ('slides','recording','reading','link','library')),
  url text check (url is null or (char_length(url) <= 2000 and url ~ '^https://[^/@[:space:]]+(/|$)')),
  library_document_id uuid,
  collection_id uuid,
  section_id uuid,
  occurrence_id uuid,
  series_id uuid,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  -- The adder ticked "No patient details in this file"; added_by records who.
  no_patient_details_confirmed_at timestamptz not null,
  removed_at timestamptz,
  removed_by uuid references auth.users(id) on delete set null,
  check ((url is null) <> (library_document_id is null)),
  check ((kind = 'library') = (library_document_id is not null)),
  check (removed_at is null or removed_at >= added_at),
  foreign key (collection_id, service_id) references public.teaching_collections(id, service_id) on delete set null (collection_id),
  foreign key (section_id, collection_id) references public.teaching_collection_sections(id, collection_id) on delete set null (section_id),
  foreign key (occurrence_id, service_id) references public.teaching_occurrences(id, service_id) on delete set null (occurrence_id),
  foreign key (series_id, service_id) references public.teaching_series(id, service_id) on delete set null (series_id)
);
create index teaching_resources_service on public.teaching_resources(service_id, added_at desc) where removed_at is null;
create index teaching_resources_occurrence on public.teaching_resources(occurrence_id) where occurrence_id is not null;
create index teaching_resources_series on public.teaching_resources(series_id) where series_id is not null;
create index teaching_resources_collection on public.teaching_resources(collection_id) where collection_id is not null;

create table public.teaching_resource_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  resource_id uuid not null references public.teaching_resources(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, resource_id)
);
create index teaching_resource_saves_resource on public.teaching_resource_saves(resource_id);

-- PR B tables, used by Plan 2. Created now so the database changes once.
create table public.teaching_readiness (
  occurrence_id uuid primary key,
  service_id uuid not null,
  -- The presenter's checklist (the four approved items) and the cases-checked confirmation. Until the
  -- presenter confirms the cases check, the occurrence's slides are hidden from everyone but the
  -- presenter and organisers (teaching_slides_released).
  items text[] not null default '{}' check (items <@ array['reading_list','aims','slides_link','room']::text[]),
  deid_confirmed_at timestamptz,
  deid_confirmed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (occurrence_id, service_id) references public.teaching_occurrences(id, service_id) on delete cascade
);

-- Feedback lives in two tables with no link between them. The answers carry no person, no
-- timestamp and no ordering column; the reply marker carries no answer, no timestamp and no user
-- id, only a one-way sha256 "already answered" marker for that occurrence (D4 feedback.submit).
create table public.teaching_feedback_answers (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null,
  service_id uuid not null,
  useful smallint not null check (useful between 1 and 5),
  pace text not null check (pace in ('slow','right','fast')),
  foreign key (occurrence_id, service_id) references public.teaching_occurrences(id, service_id) on delete cascade
);
create index teaching_feedback_answers_occurrence on public.teaching_feedback_answers(occurrence_id);
create table public.teaching_feedback_replied (
  occurrence_id uuid not null references public.teaching_occurrences(id) on delete cascade,
  reply_marker text not null check (reply_marker ~ '^[a-f0-9]{64}$'),
  primary key (occurrence_id, reply_marker)
);

create table public.teaching_supervision_pairings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  registrar_id uuid references auth.users(id) on delete set null,
  supervisor_id uuid references auth.users(id) on delete set null,
  starts_on date not null,
  ends_on date not null,
  -- The registrar's own hours target (supervision.target.set, registrar only). Nullable, no default.
  target_hours numeric(5,1) check (target_hours is null or target_hours between 1 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, service_id),
  check (registrar_id <> supervisor_id),
  check (ends_on >= starts_on and ends_on <= starts_on + 731)
);
create index teaching_supervision_pairings_registrar on public.teaching_supervision_pairings(registrar_id) where registrar_id is not null;
create index teaching_supervision_pairings_supervisor on public.teaching_supervision_pairings(supervisor_id) where supervisor_id is not null;
create index teaching_supervision_pairings_service on public.teaching_supervision_pairings(service_id);

create table public.teaching_supervision_entries (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null,
  service_id uuid not null,
  session_date date not null,
  minutes integer not null check (minutes between 15 and 240 and minutes % 15 = 0),
  type text not null check (type in ('individual','group')),
  -- Optional: none to five topics.
  topics text[] not null check (cardinality(topics) between 0 and 5 and topics <@ array['case_review','risk','psychotherapy','formulation','medication','mha_legal','teaching_skills','career','exam_prep','wellbeing','other']::text[]),
  status text not null default 'pending' check (status in ('pending','confirmed')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  locked boolean not null default false,
  logged_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, service_id),
  foreign key (pairing_id, service_id) references public.teaching_supervision_pairings(id, service_id) on delete cascade,
  check ((status = 'confirmed') = (confirmed_at is not null)),
  check (locked = (status = 'confirmed'))
);
create index teaching_supervision_entries_pairing on public.teaching_supervision_entries(pairing_id, session_date);

create table public.teaching_supervision_notes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  service_id uuid not null,
  reason text not null check (reason in ('wrong_date','wrong_length','wrong_type','wrong_topics','entered_in_error')),
  corrected_value jsonb not null default '{}'::jsonb check (public.teaching_valid_correction(reason, corrected_value)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  foreign key (entry_id, service_id) references public.teaching_supervision_entries(id, service_id) on delete cascade
);
create index teaching_supervision_notes_entry on public.teaching_supervision_notes(entry_id);

-- Fixed fields only. Kept when a team or account is deleted (no service foreign key; the actor
-- becomes null). subject_id has no foreign key (it can be a user id, for role.set), so it goes
-- with the row: rows older than 12 months are purged nightly, as the shared contract's
-- on_call_service_member_events are (the pg_cron job is registered in D3 Step 4).
create table public.teaching_audit_events (
  id bigint generated always as identity primary key,
  service_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action ~ '^[a-z_.]{3,48}$'),
  subject_id uuid,
  at timestamptz not null default now()
);
create index teaching_audit_events_service_at on public.teaching_audit_events(service_id, at desc, id desc);

-- A confirmed supervision entry is locked. Only a person column being cleared by an account
-- deletion (on delete set null) may still change it, so deleting an account is never blocked.
create function public.teaching_guard_supervision_entry() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if old.locked and (new.pairing_id, new.service_id, new.session_date, new.minutes, new.type, new.topics,
      new.status, new.confirmed_at, new.locked, new.created_at)
    is distinct from (old.pairing_id, old.service_id, old.session_date, old.minutes, old.type, old.topics,
      old.status, old.confirmed_at, old.locked, old.created_at) then
    raise exception 'teaching_invalid_request';
  end if;
  return new;
end $$;
create trigger teaching_supervision_entry_locked before update on public.teaching_supervision_entries
  for each row execute function public.teaching_guard_supervision_entry();

alter table public.teaching_member_roles enable row level security;
alter table public.teaching_series enable row level security;
alter table public.teaching_occurrences enable row level security;
alter table public.teaching_groups enable row level security;
alter table public.teaching_group_members enable row level security;
alter table public.teaching_notices enable row level security;
alter table public.teaching_notice_reads enable row level security;
alter table public.teaching_attendance enable row level security;
alter table public.teaching_checkin_claims enable row level security;
alter table public.teaching_display_links enable row level security;
alter table public.teaching_calendar_optins enable row level security;
alter table public.teaching_readiness enable row level security;
alter table public.teaching_feedback_answers enable row level security;
alter table public.teaching_feedback_replied enable row level security;
alter table public.teaching_supervision_pairings enable row level security;
alter table public.teaching_supervision_entries enable row level security;
alter table public.teaching_supervision_notes enable row level security;
alter table public.teaching_audit_events enable row level security;
alter table public.teaching_team_settings enable row level security;
alter table public.teaching_week_adds enable row level security;
alter table public.teaching_collections enable row level security;
alter table public.teaching_collection_sections enable row level security;
alter table public.teaching_resources enable row level security;
alter table public.teaching_resource_saves enable row level security;
revoke all on public.teaching_member_roles, public.teaching_series, public.teaching_occurrences, public.teaching_groups, public.teaching_group_members, public.teaching_notices, public.teaching_notice_reads, public.teaching_attendance, public.teaching_checkin_claims, public.teaching_display_links, public.teaching_calendar_optins, public.teaching_readiness, public.teaching_feedback_answers, public.teaching_feedback_replied, public.teaching_supervision_pairings, public.teaching_supervision_entries, public.teaching_supervision_notes, public.teaching_audit_events, public.teaching_team_settings, public.teaching_week_adds, public.teaching_collections, public.teaching_collection_sections, public.teaching_resources, public.teaching_resource_saves from public, anon, authenticated;
grant select, insert, update, delete on public.teaching_member_roles, public.teaching_series, public.teaching_occurrences, public.teaching_groups, public.teaching_group_members, public.teaching_notices, public.teaching_notice_reads, public.teaching_attendance, public.teaching_checkin_claims, public.teaching_display_links, public.teaching_calendar_optins, public.teaching_readiness, public.teaching_feedback_answers, public.teaching_feedback_replied, public.teaching_supervision_pairings, public.teaching_supervision_entries, public.teaching_supervision_notes, public.teaching_team_settings, public.teaching_week_adds, public.teaching_collections, public.teaching_collection_sections, public.teaching_resources, public.teaching_resource_saves to service_role;
-- The audit trail is append-only for the application: no update grant. Delete stays for retention.
grant select, insert, delete on public.teaching_audit_events to service_role;

revoke all on function public.teaching_valid_links(jsonb) from public, anon, authenticated;
grant execute on function public.teaching_valid_links(jsonb) to service_role;
revoke all on function public.teaching_valid_correction(text, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_valid_correction(text, jsonb) to service_role;
revoke all on function public.teaching_guard_supervision_entry() from public, anon, authenticated;
grant execute on function public.teaching_guard_supervision_entry() to service_role;

-- Payload readers. A malformed value raises teaching_invalid_request (400) instead of a raw cast
-- error, which the API would otherwise report as "Teaching is unavailable" (503).
create function public.teaching_text_arg(p_payload jsonb, p_key text) returns text
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_value jsonb := p_payload->p_key;
begin
  if v_value is null or v_value = 'null'::jsonb then return null; end if;
  if jsonb_typeof(v_value) <> 'string' then raise exception 'teaching_invalid_request'; end if;
  return v_value #>> '{}';
end $$;

create function public.teaching_uuid_arg(p_payload jsonb, p_key text) returns uuid
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_text text := public.teaching_text_arg(p_payload, p_key);
begin
  if v_text is null then return null; end if;
  if v_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'teaching_invalid_request';
  end if;
  return v_text::uuid;
end $$;

create function public.teaching_int_arg(p_payload jsonb, p_key text) returns integer
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_value jsonb := p_payload->p_key;
begin
  if v_value is null or v_value = 'null'::jsonb then return null; end if;
  if jsonb_typeof(v_value) <> 'number' or (v_value #>> '{}') !~ '^-?[0-9]{1,6}$' then
    raise exception 'teaching_invalid_request';
  end if;
  return (v_value #>> '{}')::integer;
end $$;

create function public.teaching_date_arg(p_payload jsonb, p_key text) returns date
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_text text := public.teaching_text_arg(p_payload, p_key); v_date date;
begin
  if v_text is null then return null; end if;
  if v_text !~ '^(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$' then raise exception 'teaching_invalid_request'; end if;
  begin
    v_date := v_text::date;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'teaching_invalid_request';
  end;
  return v_date;
end $$;

create function public.teaching_ts_arg(p_payload jsonb, p_key text) returns timestamptz
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_text text := public.teaching_text_arg(p_payload, p_key); v_at timestamptz;
begin
  if v_text is null then return null; end if;
  -- An explicit offset is required, so no value is read in the database session's time zone.
  if v_text !~ '^(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'teaching_invalid_request';
  end if;
  begin
    v_at := v_text::timestamptz;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'teaching_invalid_request';
  end;
  return v_at;
end $$;

create function public.teaching_uuid_array_arg(p_payload jsonb, p_key text, p_max integer) returns uuid[]
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_value jsonb := p_payload->p_key; v_item jsonb; v_out uuid[] := '{}';
begin
  if v_value is null or v_value = 'null'::jsonb then return '{}'; end if;
  if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) > p_max then raise exception 'teaching_invalid_request'; end if;
  for v_item in select value from jsonb_array_elements(v_value) loop
    v_out := v_out || public.teaching_uuid_arg(jsonb_build_object('v', v_item), 'v');
  end loop;
  if array_position(v_out, null) is not null then raise exception 'teaching_invalid_request'; end if;
  return array(select distinct u from unnest(v_out) as u order by u);
end $$;

create function public.teaching_date_array_arg(p_payload jsonb, p_key text, p_max integer) returns date[]
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_value jsonb := p_payload->p_key; v_item jsonb; v_out date[] := '{}';
begin
  if v_value is null or v_value = 'null'::jsonb then return '{}'; end if;
  if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) > p_max then raise exception 'teaching_invalid_request'; end if;
  for v_item in select value from jsonb_array_elements(v_value) loop
    v_out := v_out || public.teaching_date_arg(jsonb_build_object('v', v_item), 'v');
  end loop;
  if array_position(v_out, null) is not null then raise exception 'teaching_invalid_request'; end if;
  return array(select distinct d from unnest(v_out) as d order by d);
end $$;

create function public.teaching_text_array_arg(p_payload jsonb, p_key text, p_max integer) returns text[]
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_value jsonb := p_payload->p_key; v_item jsonb; v_out text[] := '{}';
begin
  if v_value is null or v_value = 'null'::jsonb then return '{}'; end if;
  if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) > p_max then raise exception 'teaching_invalid_request'; end if;
  for v_item in select value from jsonb_array_elements(v_value) loop
    if jsonb_typeof(v_item) <> 'string' then raise exception 'teaching_invalid_request'; end if;
    v_out := v_out || (v_item #>> '{}');
  end loop;
  return array(select distinct t from unnest(v_out) as t order by t);
end $$;

-- Constant-time comparison: xor-fold over every byte, no early exit on the first difference.
create function public.teaching_const_eq(p_left text, p_right text) returns boolean
language plpgsql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_left bytea;
  v_right bytea;
  v_diff integer := 0;
  v_index integer;
begin
  if p_left is null or p_right is null then return false; end if;
  v_left := convert_to(p_left, 'UTF8');
  v_right := convert_to(p_right, 'UTF8');
  if octet_length(v_left) = 0 or octet_length(v_left) <> octet_length(v_right) then return false; end if;
  for v_index in 0 .. octet_length(v_left) - 1 loop
    v_diff := v_diff | (get_byte(v_left, v_index) # get_byte(v_right, v_index));
  end loop;
  return v_diff = 0;
end $$;

-- 32 hex characters: the first 16 bytes of HMAC-SHA256(occurrence:stream:window, secret).
create function public.teaching_code_mac(p_secret bytea, p_occurrence uuid, p_stream text, p_window bigint) returns text
language sql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select encode(substring(extensions.hmac(convert_to(p_occurrence::text || ':' || p_stream || ':' || p_window::text, 'UTF8'), p_secret, 'sha256') from 1 for 16), 'hex')
$$;

-- Six digits for typing in when a camera cannot scan. A separate HMAC input from the scan code.
create function public.teaching_typed_code(p_secret bytea, p_occurrence uuid, p_stream text, p_window bigint) returns text
language sql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select lpad((((('x' || encode(substring(extensions.hmac(convert_to(p_occurrence::text || ':' || p_stream || ':' || p_window::text || ':typed', 'UTF8'), p_secret, 'sha256') from 1 for 4), 'hex'))::bit(32)::bigint) & 4294967295) % 1000000)::text, 6, '0')
$$;

-- The Teaching role of an active member, or null for anyone who is not an active member.
-- A role row granted before the member's latest join is stale and ignored. The revoke cascade
-- below already revokes the row at the shared revoke; this guard is the second layer, so a
-- rejoining member never regains organiser or admin.
create function public.teaching_member_role(p_service_id uuid, p_user_id uuid) returns text
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_role text;
begin
  if p_service_id is null or p_user_id is null or not public.service_member_active(p_service_id, p_user_id) then
    return null;
  end if;
  select r.role into v_role
  from public.teaching_member_roles r
  join public.on_call_service_members m on m.service_id = r.service_id and m.user_id = r.user_id
  where r.service_id = p_service_id and r.user_id = p_user_id
    and r.revoked_at is null and m.revoked_at is null and r.granted_at >= m.joined_at;
  return coalesce(v_role, 'doctor');
end $$;

-- Called at run time by On Call's shared join for an invitation with issued_via_mode = 'teaching'.
create function public.teaching_can_invite(p_service_id uuid, p_user_id uuid) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  return coalesce(public.teaching_member_role(p_service_id, p_user_id) in ('organiser','admin'), false);
end $$;

-- Active Teaching admins, by the same rule as teaching_member_role.
create function public.teaching_admin_count(p_service_id uuid) returns integer
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_count integer;
begin
  select count(*) into v_count
  from public.teaching_member_roles r
  join public.on_call_service_members m on m.service_id = r.service_id and m.user_id = r.user_id
  where r.service_id = p_service_id and r.role = 'admin'
    and r.revoked_at is null and m.revoked_at is null and r.granted_at >= m.joined_at;
  return v_count;
end $$;

-- Revoke cascade (shared contract v5 item 10). When a shared membership is revoked (revoked_at
-- goes from null to a time), the member's active Teaching role is revoked in the same transaction
-- and one shared member event is written. A rejoin clears revoked_at, which the when clause does
-- not match, so it never re-revokes; roles are not restored on rejoin and must be granted again.
-- A member with no active Teaching row (a doctor) had no role to change, so no event is written.
-- A trigger cannot see who revoked, so actor_id is null; On Call's own 'revoked' event names them.
create function public.teaching_cascade_member_revoke() returns trigger
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  update public.teaching_member_roles set revoked_at = now()
  where service_id = new.service_id and user_id = new.user_id and revoked_at is null;
  if found then
    insert into public.on_call_service_member_events(service_id, user_id, event, mode, actor_id)
    values (new.service_id, new.user_id, 'role_changed', 'teaching', null);
  end if;
  return null;
end $$;
create trigger teaching_member_revoke_cascade
  after update of revoked_at on public.on_call_service_members
  for each row when (old.revoked_at is null and new.revoked_at is not null)
  execute function public.teaching_cascade_member_revoke();

create function public.teaching_audit(p_service_id uuid, p_actor_id uuid, p_action text, p_subject_id uuid) returns void
language plpgsql volatile security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  insert into public.teaching_audit_events(service_id, actor_id, action, subject_id)
  values (p_service_id, p_actor_id, p_action, p_subject_id);
end $$;

-- One attendance row per person per session. A code check-in upgrades a self-declared row and
-- the upgrade is audited; nothing ever downgrades a code check-in.
create function public.teaching_record_attendance(p_actor_id uuid, p_service_id uuid, p_occurrence_id uuid, p_method text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_row public.teaching_attendance;
begin
  if p_method not in ('code_room','code_teams','self') then raise exception 'teaching_invalid_request'; end if;
  insert into public.teaching_attendance(occurrence_id, service_id, user_id, method)
  values (p_occurrence_id, p_service_id, p_actor_id, p_method)
  on conflict (occurrence_id, user_id) do nothing
  returning * into v_row;
  if found then
    perform public.teaching_audit(p_service_id, p_actor_id, 'attendance.' || p_method, p_occurrence_id);
  else
    select * into v_row from public.teaching_attendance
    where occurrence_id = p_occurrence_id and user_id = p_actor_id for update;
    if v_row.method = 'self' and p_method <> 'self' then
      update public.teaching_attendance set method = p_method, upgraded_from = 'self', visitor = false, recorded_at = now()
      where occurrence_id = p_occurrence_id and user_id = p_actor_id
      returning * into v_row;
      perform public.teaching_audit(p_service_id, p_actor_id, 'attendance.upgrade', p_occurrence_id);
    elsif v_row.visitor then
      -- A What's on visitor who has since joined this team: the row becomes a member's row.
      update public.teaching_attendance set visitor = false
      where occurrence_id = p_occurrence_id and user_id = p_actor_id
      returning * into v_row;
    end if;
  end if;
  return jsonb_build_object('occurrenceId', v_row.occurrence_id, 'method', v_row.method, 'recordedAt', v_row.recorded_at);
end $$;

-- Scan landing, before sign-in. Verifies the token and records a single-use 10-minute claim that
-- teaching_command('checkin.complete') redeems after sign-in. Returns only what the landing page
-- shows. The MAC is checked before anything about the session is revealed.
create function public.teaching_checkin_open(p_token text, p_claim_hash text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_parts text[];
  v_occ public.teaching_occurrences;
  v_service public.on_call_services;
  v_stream text;
  v_window bigint;
  v_now_window bigint := floor(extract(epoch from now()) / 30)::bigint;
  v_expected text;
begin
  if p_token is null or p_claim_hash is null or p_claim_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'teaching_code_invalid';
  end if;
  v_parts := regexp_match(p_token, '^([0-9a-f]{32})([rt])([0-9]{1,12})([0-9a-f]{32})$');
  if v_parts is null then raise exception 'teaching_code_invalid'; end if;
  v_stream := case v_parts[2] when 'r' then 'room' else 'teams' end;
  v_window := v_parts[3]::bigint;
  select * into v_occ from public.teaching_occurrences where id = v_parts[1]::uuid;
  if not found then raise exception 'teaching_code_invalid'; end if;
  v_expected := public.teaching_code_mac(v_occ.checkin_secret, v_occ.id, v_stream, v_window);
  if not public.teaching_const_eq(v_parts[4], v_expected) then raise exception 'teaching_code_invalid'; end if;
  select * into v_service from public.on_call_services where id = v_occ.service_id for share;
  if not (v_service.verified_at is not null or v_service.is_demo) then raise exception 'teaching_team_unverified'; end if;
  if v_occ.status = 'cancelled' or now() < v_occ.starts_at - interval '15 minutes' or now() > v_occ.ends_at + interval '15 minutes' then
    raise exception 'teaching_window_closed';
  end if;
  if v_window not in (v_now_window, v_now_window - 1) then raise exception 'teaching_code_expired'; end if;
  if (select count(*) from public.teaching_checkin_claims
      where occurrence_id = v_occ.id and used_at is null and expires_at > now()) >= 2000 then
    raise exception 'teaching_limit';
  end if;
  insert into public.teaching_checkin_claims(occurrence_id, stream, claim_hash, expires_at)
  values (v_occ.id, v_stream, p_claim_hash, now() + interval '10 minutes');
  perform public.teaching_audit(v_occ.service_id, null, 'checkin.open', v_occ.id);
  return jsonb_build_object('occurrenceId', v_occ.id, 'title', v_occ.title, 'startsAt', v_occ.starts_at, 'stream', v_stream);
end $$;

-- Display-only screen on a shared PC: shows the current codes for one session and nothing else.
-- The link dies when check-in closes, when it is revoked, or when its creator leaves the team.
create function public.teaching_display_code(p_link_hash text) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_link public.teaching_display_links;
  v_occ public.teaching_occurrences;
  v_service public.on_call_services;
  v_window bigint := floor(extract(epoch from now()) / 30)::bigint;
  v_mac text;
  v_typed text;
begin
  if p_link_hash is null or p_link_hash !~ '^[a-f0-9]{64}$' then raise exception 'teaching_link_expired'; end if;
  select * into v_link from public.teaching_display_links where link_hash = p_link_hash;
  if not found or v_link.revoked_at is not null or v_link.expires_at <= now() then raise exception 'teaching_link_expired'; end if;
  select * into v_occ from public.teaching_occurrences where id = v_link.occurrence_id;
  select * into v_service from public.on_call_services where id = v_occ.service_id for share;
  if not (v_service.verified_at is not null or v_service.is_demo)
    or v_link.created_by is null or not public.service_member_active(v_occ.service_id, v_link.created_by)
    or v_occ.status = 'cancelled' or now() > v_occ.ends_at + interval '15 minutes' then
    raise exception 'teaching_link_expired';
  end if;
  if now() < v_occ.starts_at - interval '15 minutes' then raise exception 'teaching_window_closed'; end if;
  v_mac := public.teaching_code_mac(v_occ.checkin_secret, v_occ.id, v_link.stream, v_window);
  v_typed := public.teaching_typed_code(v_occ.checkin_secret, v_occ.id, v_link.stream, v_window);
  return jsonb_build_object(
    'token', replace(v_occ.id::text, '-', '') || left(v_link.stream, 1) || v_window::text || v_mac,
    'typedCode', v_typed,
    'window', v_window,
    'title', v_occ.title,
    'venue', v_occ.venue,
    'closesAt', least(v_link.expires_at, v_occ.ends_at + interval '15 minutes')
  );
end $$;

revoke all on function public.teaching_text_arg(jsonb, text) from public, anon, authenticated;
grant execute on function public.teaching_text_arg(jsonb, text) to service_role;
revoke all on function public.teaching_uuid_arg(jsonb, text) from public, anon, authenticated;
grant execute on function public.teaching_uuid_arg(jsonb, text) to service_role;
revoke all on function public.teaching_int_arg(jsonb, text) from public, anon, authenticated;
grant execute on function public.teaching_int_arg(jsonb, text) to service_role;
revoke all on function public.teaching_date_arg(jsonb, text) from public, anon, authenticated;
grant execute on function public.teaching_date_arg(jsonb, text) to service_role;
revoke all on function public.teaching_ts_arg(jsonb, text) from public, anon, authenticated;
grant execute on function public.teaching_ts_arg(jsonb, text) to service_role;
revoke all on function public.teaching_uuid_array_arg(jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.teaching_uuid_array_arg(jsonb, text, integer) to service_role;
revoke all on function public.teaching_date_array_arg(jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.teaching_date_array_arg(jsonb, text, integer) to service_role;
revoke all on function public.teaching_text_array_arg(jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.teaching_text_array_arg(jsonb, text, integer) to service_role;
revoke all on function public.teaching_const_eq(text, text) from public, anon, authenticated;
grant execute on function public.teaching_const_eq(text, text) to service_role;
revoke all on function public.teaching_code_mac(bytea, uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.teaching_code_mac(bytea, uuid, text, bigint) to service_role;
revoke all on function public.teaching_typed_code(bytea, uuid, text, bigint) from public, anon, authenticated;
grant execute on function public.teaching_typed_code(bytea, uuid, text, bigint) to service_role;
revoke all on function public.teaching_member_role(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_member_role(uuid, uuid) to service_role;
revoke all on function public.teaching_can_invite(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_can_invite(uuid, uuid) to service_role;
revoke all on function public.teaching_admin_count(uuid) from public, anon, authenticated;
grant execute on function public.teaching_admin_count(uuid) to service_role;
revoke all on function public.teaching_cascade_member_revoke() from public, anon, authenticated;
grant execute on function public.teaching_cascade_member_revoke() to service_role;
revoke all on function public.teaching_audit(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.teaching_audit(uuid, uuid, text, uuid) to service_role;
revoke all on function public.teaching_record_attendance(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.teaching_record_attendance(uuid, uuid, uuid, text) to service_role;
revoke all on function public.teaching_checkin_open(text, text) from public, anon, authenticated;
grant execute on function public.teaching_checkin_open(text, text) to service_role;
revoke all on function public.teaching_display_code(text) from public, anon, authenticated;
grant execute on function public.teaching_display_code(text) to service_role;

-- Whether a session appears in a member's lists and notices. Organisers, admins and the presenter
-- see every session; a series aimed at groups shows to members of those groups; everything else
-- shows to the whole team. Any member may still open, check in to or self-declare any session.
create function public.teaching_occurrence_listed(p_occurrence_id uuid, p_actor_id uuid, p_role text) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_groups uuid[]; v_presenter uuid;
begin
  if p_role in ('organiser','admin') then return true; end if;
  select s.group_ids, o.presenter_id into v_groups, v_presenter
  from public.teaching_occurrences o left join public.teaching_series s on s.id = o.series_id
  where o.id = p_occurrence_id;
  if v_presenter = p_actor_id then return true; end if;
  if v_groups is null or cardinality(v_groups) = 0 then return true; end if;
  return exists (select 1 from public.teaching_group_members gm where gm.user_id = p_actor_id and gm.group_id = any(v_groups));
end $$;

-- What's on (spec §5a). A series is open to a person when its organiser opened it to the health
-- service, its own team is verified or demo and has a platform-set health service, and the person
-- is an active member of a verified or demo team with that same health service. Callers decide
-- separately whether the person is a member of the series' own team.
create function public.teaching_series_open_to(p_series_id uuid, p_actor_id uuid) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if p_series_id is null or p_actor_id is null then return false; end if;
  return exists (
    select 1
    from public.teaching_series s
    join public.on_call_services hs on hs.id = s.service_id and (hs.verified_at is not null or hs.is_demo)
    join public.teaching_team_settings ht on ht.service_id = s.service_id
    join public.teaching_team_settings vt on vt.health_service = ht.health_service
    join public.on_call_services vs on vs.id = vt.service_id and (vs.verified_at is not null or vs.is_demo)
    where s.id = p_series_id and s.open_to = 'health_service'
      and public.service_member_active(vt.service_id, p_actor_id)
  );
end $$;

-- An occurrence is open when its series is (a one-off with no series stays team-only).
create function public.teaching_occurrence_open_to(p_occurrence_id uuid, p_actor_id uuid) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_series uuid;
begin
  if p_occurrence_id is null then return false; end if;
  select o.series_id into v_series from public.teaching_occurrences o where o.id = p_occurrence_id;
  return public.teaching_series_open_to(v_series, p_actor_id);
end $$;

-- Whether a person added this occurrence, or its whole series, to their own week from What's on.
create function public.teaching_week_added(p_occurrence_id uuid, p_user_id uuid) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  return exists (
    select 1 from public.teaching_week_adds w
    join public.teaching_occurrences o on o.id = p_occurrence_id
    where w.user_id = p_user_id
      and (w.occurrence_id = o.id or (o.series_id is not null and w.series_id = o.series_id))
  );
end $$;

-- Brings a series' future occurrences into line with its rule, in Perth local time.
-- Only occurrences that are still scheduled, were never changed, start more than 15 minutes from
-- now and have nothing hanging off them (attendance, claims, display links, notices, readiness or
-- feedback) are updated in place or removed. Everything else is left exactly as it is.
create function public.teaching_series_generate(p_series_id uuid) returns integer
language plpgsql volatile security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_series public.teaching_series;
  v_dates date[];
  v_dow integer;
  v_nth integer;
  v_count integer;
begin
  select * into v_series from public.teaching_series where id = p_series_id for update;
  if not found then raise exception 'teaching_not_found'; end if;

  if v_series.repeat = 'once' then
    v_dates := array[v_series.first_date];
  elsif v_series.repeat in ('weekly','fortnightly') then
    v_dates := array(
      select g::date from generate_series(v_series.first_date::timestamp, v_series.end_date::timestamp,
        case v_series.repeat when 'weekly' then interval '7 days' else interval '14 days' end) as g
    );
  else
    -- monthly_nth: the same weekday and week of the month as first_date (for example the second
    -- Tuesday). A month without that day (a fifth Tuesday) is skipped, never moved.
    v_dow := extract(isodow from v_series.first_date)::integer;
    v_nth := ((extract(day from v_series.first_date)::integer - 1) / 7) + 1;
    v_dates := array(
      select c.d from (
        select m.month_start + ((v_dow - extract(isodow from m.month_start)::integer + 7) % 7) + (v_nth - 1) * 7 as d, m.month_start
        from (
          select g::date as month_start
          from generate_series(date_trunc('month', v_series.first_date::timestamp), v_series.end_date::timestamp, interval '1 month') as g
        ) as m
      ) as c
      where date_trunc('month', c.d::timestamp) = c.month_start::timestamp
        and c.d between v_series.first_date and v_series.end_date
      order by c.d
    );
  end if;
  v_dates := array(select d from unnest(v_dates) as d where not (d = any(v_series.skip_dates)) order by d);
  if cardinality(v_dates) > 60 then raise exception 'teaching_limit'; end if;

  update public.teaching_occurrences as o set
    title = v_series.title,
    starts_at = (o.series_date + v_series.start_time) at time zone 'Australia/Perth',
    ends_at = ((o.series_date + v_series.start_time) at time zone 'Australia/Perth') + make_interval(mins => v_series.minutes),
    venue = v_series.venue,
    join_url = v_series.join_url,
    presenter_id = v_series.presenter_id
  where o.series_id = v_series.id and o.series_date = any(v_dates)
    and o.status = 'scheduled' and o.changed_at is null
    and o.starts_at > now() + interval '15 minutes'
    and not exists (select 1 from public.teaching_attendance a where a.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_checkin_claims c where c.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_display_links l where l.occurrence_id = o.id);

  delete from public.teaching_occurrences as o
  where o.series_id = v_series.id and not (o.series_date = any(v_dates))
    and o.status = 'scheduled' and o.changed_at is null
    and o.starts_at > now() + interval '15 minutes'
    and not exists (select 1 from public.teaching_attendance a where a.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_checkin_claims c where c.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_display_links l where l.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_notices n where n.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_readiness r where r.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_feedback_answers f where f.occurrence_id = o.id)
    and not exists (select 1 from public.teaching_feedback_replied f where f.occurrence_id = o.id);

  insert into public.teaching_occurrences(service_id, series_id, series_date, title, starts_at, ends_at, venue, join_url, presenter_id)
  select v_series.service_id, v_series.id, d, v_series.title,
    (d + v_series.start_time) at time zone 'Australia/Perth',
    ((d + v_series.start_time) at time zone 'Australia/Perth') + make_interval(mins => v_series.minutes),
    v_series.venue, v_series.join_url, v_series.presenter_id
  from unnest(v_dates) as d
  where (d + v_series.start_time) at time zone 'Australia/Perth' > now()
    and not exists (select 1 from public.teaching_occurrences o where o.series_id = v_series.id and o.series_date = d);

  select count(*) into v_count from public.teaching_occurrences
  where series_id = v_series.id and starts_at > now() and status <> 'cancelled';
  return v_count;
end $$;

revoke all on function public.teaching_occurrence_listed(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.teaching_occurrence_listed(uuid, uuid, text) to service_role;
revoke all on function public.teaching_series_open_to(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_series_open_to(uuid, uuid) to service_role;
revoke all on function public.teaching_occurrence_open_to(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_occurrence_open_to(uuid, uuid) to service_role;
revoke all on function public.teaching_week_added(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_week_added(uuid, uuid) to service_role;
revoke all on function public.teaching_series_generate(uuid) from public, anon, authenticated;
grant execute on function public.teaching_series_generate(uuid) to service_role;

-- A series save: validates the payload, writes the series and brings its occurrences into line.
-- No role check, lock or audit here: series.save (organisers) and import.commit (organisers and
-- admins, spec §4) check the role, hold lock 74818 and write the audit rows themselves.
create function public.teaching_series_save(p_actor_id uuid, p_service_id uuid, p_payload jsonb) returns jsonb
language plpgsql volatile security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_series public.teaching_series;
  v_id uuid;
  v_user uuid;
  v_ids uuid[];
  v_dates date[];
  v_from date;
  v_to date;
  v_text text;
  v_venue text;
  v_code text;
  v_audience text;
  v_minutes integer;
  v_count integer;
begin
  if p_actor_id is null or p_service_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'teaching_invalid_request';
  end if;
  v_id := public.teaching_uuid_arg(p_payload, 'seriesId');
  v_text := public.teaching_text_arg(p_payload, 'startTime');
  v_minutes := public.teaching_int_arg(p_payload, 'minutes');
  v_from := public.teaching_date_arg(p_payload, 'firstDate');
  v_to := public.teaching_date_arg(p_payload, 'endDate');
  v_user := public.teaching_uuid_arg(p_payload, 'presenterId');
  v_ids := public.teaching_uuid_array_arg(p_payload, 'groupIds', 20);
  v_dates := public.teaching_date_array_arg(p_payload, 'skipDates', 60);
  v_venue := nullif(btrim(coalesce(public.teaching_text_arg(p_payload, 'venue'), '')), '');
  v_code := nullif(btrim(coalesce(public.teaching_text_arg(p_payload, 'joinUrl'), '')), '');
  -- Optional: a new series defaults to all doctors, and a save without it keeps the current value.
  v_audience := public.teaching_text_arg(p_payload, 'audience');
  if char_length(btrim(coalesce(public.teaching_text_arg(p_payload, 'title'), ''))) not between 3 and 160
    or (p_payload ? 'audience' and coalesce(v_audience, '') not in ('interns','residents','registrars','consultants','all_doctors'))
    or coalesce(public.teaching_text_arg(p_payload, 'kind'), '') not in ('lecture','case','journal','grand_round','simulation','workshop','other')
    or coalesce(public.teaching_text_arg(p_payload, 'repeat'), '') not in ('once','weekly','fortnightly','monthly_nth')
    or v_text is null or v_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or v_minutes is null or v_minutes not between 10 and 480
    or v_from is null or v_to is null or v_to < v_from or v_to > v_from + 366
    or (v_venue is not null and char_length(v_venue) > 160)
    or (v_code is not null and (char_length(v_code) > 2000 or v_code !~ '^https://[^/@[:space:]]+(/|$)'))
    or not public.teaching_valid_links(coalesce(p_payload->'materials', '[]'::jsonb))
    or (v_user is not null and not public.service_member_active(p_service_id, v_user))
    or exists (select 1 from unnest(v_ids) as g where not exists (
      select 1 from public.teaching_groups tg where tg.id = g and tg.service_id = p_service_id)) then
    raise exception 'teaching_invalid_request';
  end if;
  if v_id is null then
    if (select count(*) from public.teaching_series where service_id = p_service_id) >= 500 then raise exception 'teaching_limit'; end if;
    insert into public.teaching_series(service_id, title, kind, group_ids, repeat, first_date, start_time, minutes,
      venue, join_url, skip_dates, end_date, presenter_id, materials, audience, last_confirmed_at, created_by)
    values (p_service_id, btrim(public.teaching_text_arg(p_payload, 'title')), public.teaching_text_arg(p_payload, 'kind'),
      v_ids, public.teaching_text_arg(p_payload, 'repeat'), v_from, v_text::time, v_minutes,
      v_venue, v_code, v_dates, v_to, v_user, coalesce(p_payload->'materials', '[]'::jsonb),
      coalesce(v_audience, 'all_doctors'), now(), p_actor_id)
    returning * into v_series;
  else
    update public.teaching_series set
      title = btrim(public.teaching_text_arg(p_payload, 'title')), kind = public.teaching_text_arg(p_payload, 'kind'),
      group_ids = v_ids, repeat = public.teaching_text_arg(p_payload, 'repeat'), first_date = v_from,
      start_time = v_text::time, minutes = v_minutes, venue = v_venue, join_url = v_code, skip_dates = v_dates,
      end_date = v_to, presenter_id = v_user, materials = coalesce(p_payload->'materials', '[]'::jsonb),
      audience = coalesce(v_audience, audience), last_confirmed_at = now(), updated_at = now()
    where id = v_id and service_id = p_service_id
    returning * into v_series;
    if not found then raise exception 'teaching_not_found'; end if;
  end if;
  v_count := public.teaching_series_generate(v_series.id);
  return jsonb_build_object('seriesId', v_series.id, 'occurrences', v_count);
end $$;

revoke all on function public.teaching_series_save(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_series_save(uuid, uuid, jsonb) to service_role;

create function public.teaching_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role text;
  v_occ public.teaching_occurrences;
  v_series public.teaching_series;
  v_claim public.teaching_checkin_claims;
  v_link public.teaching_display_links;
  v_result jsonb;
  v_id uuid;
  v_user uuid;
  v_ids uuid[];
  v_from date;
  v_to date;
  v_starts timestamptz;
  v_ends timestamptz;
  v_before timestamptz;
  v_before_id bigint;
  v_text text;
  v_stream text;
  v_code text;
  v_mac text;
  v_typed text;
  v_typed_previous text;
  v_venue text;
  v_status text;
  v_reason text;
  v_count integer;
  v_window bigint;
  v_is_presenter boolean;
  v_visitor boolean;
  v_needs_lock boolean;
begin
  if p_actor_id is null then raise exception 'teaching_auth_required'; end if;
  if p_action is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'teaching_invalid_request';
  end if;

  -- Actions across all of the actor's own teams. The service id must be null.
  if p_action in ('week.read','logbook.read','checkin.complete','cpd.unlogged','session.next','supervision.pending','teach.read','feedback.open') then
    if p_service_id is not null then raise exception 'teaching_invalid_request'; end if;

    if p_action = 'week.read' then
      v_from := public.teaching_date_arg(p_payload, 'from');
      v_to := public.teaching_date_arg(p_payload, 'to');
      if v_from is null or v_to is null or v_to < v_from or v_to - v_from >= 42 then
        raise exception 'teaching_invalid_request';
      end if;
      perform 1 from public.on_call_services s
      where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null)
      order by s.id for share;
      with teams as (
        select s.id, s.name, s.verified_at, s.is_demo, public.teaching_member_role(s.id, p_actor_id) as role
        from public.on_call_services s
        join public.on_call_service_members m on m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null
      )
      select jsonb_build_object(
        'teams', coalesce((select jsonb_agg(jsonb_build_object(
            'id', t.id, 'name', t.name, 'role', t.role,
            'acceptsRealData', t.verified_at is not null or t.is_demo, 'isDemo', t.is_demo,
            -- The pages sheet shows Teach while the actor presents a session of this team that has not
            -- ended and starts in the next 90 days (teach.read's upcoming window), whatever week is loaded.
            'presenting', exists (select 1 from public.teaching_occurrences o
              where o.service_id = t.id and o.presenter_id = p_actor_id and o.status <> 'cancelled'
                and o.ends_at > now() and o.starts_at < now() + interval '90 days')) order by t.name, t.id)
          from teams t), '[]'::jsonb),
        'sessions', coalesce((select jsonb_agg(jsonb_build_object(
            'occurrenceId', o.id, 'serviceId', o.service_id, 'title', o.title, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
            'venue', o.venue, 'hasJoinLink', o.join_url is not null, 'status', o.status,
            'isPresenter', o.presenter_id is not distinct from p_actor_id, 'source', 'teaching') order by o.starts_at, o.id)
          from public.teaching_occurrences o left join teams t on t.id = o.service_id
          where o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
            and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth')
            -- Own teams by the listing rule; another team's session only while it is in the actor's
            -- week from What's on and still open to their health service (spec §5a).
            and case when t.id is not null then public.teaching_occurrence_listed(o.id, p_actor_id, t.role)
              else public.teaching_week_added(o.id, p_actor_id) and public.teaching_occurrence_open_to(o.id, p_actor_id) end), '[]'::jsonb),
        'notices', coalesce((select jsonb_agg(jsonb_build_object(
            'id', x.id, 'occurrenceId', x.occurrence_id, 'serviceId', x.service_id, 'kind', x.kind, 'createdAt', x.created_at) order by x.created_at desc)
          from (
            select n.id, n.occurrence_id, n.service_id, n.kind, n.created_at
            from public.teaching_notices n
            join teams t on t.id = n.service_id
            join public.teaching_occurrences o on o.id = n.occurrence_id
            where o.ends_at > now()
              and not exists (select 1 from public.teaching_notice_reads r where r.notice_id = n.id and r.user_id = p_actor_id)
              and public.teaching_occurrence_listed(o.id, p_actor_id, t.role)
            order by n.created_at desc
            limit 50
          ) as x), '[]'::jsonb),
        'attendance', coalesce((select jsonb_agg(jsonb_build_object(
            'occurrenceId', a.occurrence_id, 'method', a.method, 'recordedAt', a.recorded_at) order by a.recorded_at)
          from public.teaching_attendance a
          join public.teaching_occurrences o on o.id = a.occurrence_id
          left join teams t on t.id = a.service_id
          where a.user_id = p_actor_id and (t.id is not null or a.visitor)
            and o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
            and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth')), '[]'::jsonb)
      ) into v_result;
      return v_result;

    elsif p_action = 'logbook.read' then
      -- Own record only. A leaver keeps read-only access for 90 days from the shared revoke.
      perform 1 from public.on_call_services s
      where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id
        and (m.revoked_at is null or m.revoked_at > now() - interval '90 days'))
      order by s.id for share;
      select jsonb_build_object('attendance', coalesce(jsonb_agg(jsonb_build_object(
          'occurrenceId', a.occurrence_id, 'method', a.method, 'recordedAt', a.recorded_at,
          'title', o.title, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
          'serviceId', s.id, 'serviceName', s.name,
          'readOnlyUntil', case when m.revoked_at is null then null else m.revoked_at + interval '90 days' end,
          'cpdEntryId', (select e.id from public.cme_entries e where e.owner_id = p_actor_id
            and e.source_ref = 'teaching:' || a.occurrence_id::text and e.archived_at is null)
        ) order by o.starts_at desc, a.occurrence_id), '[]'::jsonb))
      into v_result
      from public.teaching_attendance a
      join public.teaching_occurrences o on o.id = a.occurrence_id
      join public.on_call_services s on s.id = a.service_id
      left join public.on_call_service_members m on m.service_id = a.service_id and m.user_id = p_actor_id
      -- A visitor row (What's on) is the visitor's own record and needs no membership of the host.
      where a.user_id = p_actor_id
        and (a.visitor or (m.user_id is not null and (m.revoked_at is null or m.revoked_at > now() - interval '90 days')));
      return v_result;

    elsif p_action = 'cpd.unlogged' then
      -- A count only, for CPD's Today. Nothing from CPD is returned or stored here.
      perform 1 from public.on_call_services s
      where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id
        and (m.revoked_at is null or m.revoked_at > now() - interval '90 days'))
      order by s.id for share;
      select count(*) into v_count
      from public.teaching_attendance a
      join public.teaching_occurrences o on o.id = a.occurrence_id
      left join public.on_call_service_members m on m.service_id = a.service_id and m.user_id = p_actor_id
      where a.user_id = p_actor_id
        and (a.visitor or (m.user_id is not null and (m.revoked_at is null or m.revoked_at > now() - interval '90 days')))
        and o.ends_at <= now()
        and not exists (select 1 from public.cme_entries e where e.owner_id = p_actor_id
          and e.source_ref = 'teaching:' || a.occurrence_id::text and e.archived_at is null);
      return jsonb_build_object('count', v_count);

    elsif p_action = 'session.next' then
      -- The quiet-day hero: the actor's next listed session in any active team, however far ahead
      -- (not limited to week.read's range), or null. A running session counts; cancelled ones do not.
      perform 1 from public.on_call_services s
      where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null)
      order by s.id for share;
      select jsonb_build_object('session', (select jsonb_build_object(
          'occurrenceId', o.id, 'serviceId', o.service_id, 'title', o.title, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
          'venue', o.venue, 'hasJoinLink', o.join_url is not null, 'status', o.status,
          'isPresenter', o.presenter_id is not distinct from p_actor_id, 'source', 'teaching')
        from public.teaching_occurrences o
        join public.on_call_service_members m on m.service_id = o.service_id and m.user_id = p_actor_id and m.revoked_at is null
        where o.ends_at > now() and o.status <> 'cancelled'
          and public.teaching_occurrence_listed(o.id, p_actor_id, public.teaching_member_role(o.service_id, p_actor_id))
        order by o.starts_at, o.id
        limit 1)) into v_result;
      return v_result;

    elsif p_action = 'supervision.pending' then
      -- Today's count of confirmations waiting for the actor as supervisor: pending entries and
      -- unconfirmed correction notes, in teams where the actor is still active. A count only.
      perform 1 from public.on_call_services s
      where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null)
      order by s.id for share;
      select (select count(*) from public.teaching_supervision_entries e
          join public.teaching_supervision_pairings p on p.id = e.pairing_id
          where p.supervisor_id = p_actor_id and e.status = 'pending' and public.service_member_active(p.service_id, p_actor_id))
        + (select count(*) from public.teaching_supervision_notes n
          join public.teaching_supervision_entries e on e.id = n.entry_id
          join public.teaching_supervision_pairings p on p.id = e.pairing_id
          where p.supervisor_id = p_actor_id and n.confirmed_at is null and public.service_member_active(p.service_id, p_actor_id))
      into v_count;
      return jsonb_build_object('count', v_count);

    elsif p_action in ('teach.read','feedback.open') then
      perform 1 from public.on_call_services s
      where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null)
      order by s.id for share;
      if p_action = 'teach.read' then
        -- The actor's own talks only (presenter_id = actor): the next 90 days with their checklist, and
        -- up to 50 ended talks from the last year.
        select jsonb_build_object(
          'upcoming', coalesce((select jsonb_agg(jsonb_build_object(
              'occurrenceId', o.id, 'serviceId', o.service_id, 'title', o.title, 'startsAt', o.starts_at,
              'endsAt', o.ends_at, 'venue', o.venue, 'status', o.status,
              'items', coalesce(to_jsonb(r.items), '[]'::jsonb), 'deidConfirmedAt', r.deid_confirmed_at)
              order by o.starts_at, o.id)
            from public.teaching_occurrences o
            left join public.teaching_readiness r on r.occurrence_id = o.id
            where o.presenter_id = p_actor_id and o.ends_at > now() and o.starts_at < now() + interval '90 days'
              and public.service_member_active(o.service_id, p_actor_id)), '[]'::jsonb),
          'taught', coalesce((select jsonb_agg(jsonb_build_object(
              'occurrenceId', t.id, 'serviceId', t.service_id, 'title', t.title, 'startsAt', t.starts_at,
              'endsAt', t.ends_at) order by t.starts_at desc, t.id)
            from (select o.id, o.service_id, o.title, o.starts_at, o.ends_at from public.teaching_occurrences o
              where o.presenter_id = p_actor_id and o.status <> 'cancelled' and o.ends_at <= now()
                and o.ends_at > now() - interval '365 days' and public.service_member_active(o.service_id, p_actor_id)
              order by o.starts_at desc, o.id limit 50) as t), '[]'::jsonb))
        into v_result;
      else
        -- Sessions the actor attended as a member, ended in the last 7 days and not yet answered. It checks
        -- the same one-way marker feedback.submit writes, so nothing new ties a person to an answer.
        select jsonb_build_object('sessions', coalesce(jsonb_agg(jsonb_build_object(
            'occurrenceId', o.id, 'serviceId', o.service_id, 'title', o.title, 'startsAt', o.starts_at,
            'endsAt', o.ends_at) order by o.ends_at desc, o.id), '[]'::jsonb))
        into v_result
        from public.teaching_attendance a
        join public.teaching_occurrences o on o.id = a.occurrence_id
        where a.user_id = p_actor_id and o.status <> 'cancelled'
          and o.ends_at <= now() and o.ends_at > now() - interval '7 days'
          and public.service_member_active(o.service_id, p_actor_id)
          and not exists (select 1 from public.teaching_feedback_replied f
            where f.occurrence_id = o.id and f.reply_marker = encode(extensions.digest(
              convert_to('teaching-feedback:' || o.id::text || ':' || p_actor_id::text, 'UTF8'), 'sha256'), 'hex'));
      end if;
      return v_result;

    elsif p_action = 'checkin.complete' then
      -- Redeem a claim recorded by teaching_checkin_open, after sign-in.
      v_code := public.teaching_text_arg(p_payload, 'claimHash');
      if v_code is null or v_code !~ '^[a-f0-9]{64}$' then raise exception 'teaching_invalid_request'; end if;
      select * into v_claim from public.teaching_checkin_claims where claim_hash = v_code for update;
      if not found then raise exception 'teaching_code_invalid'; end if;
      select * into v_occ from public.teaching_occurrences where id = v_claim.occurrence_id;
      select * into v_service from public.on_call_services where id = v_occ.service_id for share;
      if v_claim.used_at is not null then
        -- A retry by the same person returns the same mark; anyone else is refused.
        if v_claim.used_by is distinct from p_actor_id then raise exception 'teaching_code_expired'; end if;
        select jsonb_build_object('occurrenceId', a.occurrence_id, 'method', a.method, 'recordedAt', a.recorded_at)
        into v_result from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.user_id = p_actor_id;
        if v_result is null then raise exception 'teaching_code_expired'; end if;
        return v_result || jsonb_build_object('serviceId', v_occ.service_id, 'occurrenceId', v_occ.id);
      end if;
      if v_claim.expires_at <= now() then raise exception 'teaching_code_expired'; end if;
      if not public.service_member_active(v_occ.service_id, p_actor_id) then raise exception 'teaching_code_other_team'; end if;
      if not (v_service.verified_at is not null or v_service.is_demo) then raise exception 'teaching_team_unverified'; end if;
      if v_occ.status = 'cancelled' then raise exception 'teaching_window_closed'; end if;
      update public.teaching_checkin_claims set used_at = now(), used_by = p_actor_id where id = v_claim.id;
      v_result := public.teaching_record_attendance(p_actor_id, v_occ.service_id, v_occ.id,
        case v_claim.stream when 'room' then 'code_room' else 'code_teams' end);
      return v_result || jsonb_build_object('serviceId', v_occ.service_id, 'occurrenceId', v_occ.id);
    end if;
  end if;

  -- A calendar link knows only the occurrence, so session.read may come with a null team: take the
  -- occurrence's own team. The membership check below is unchanged.
  if p_action = 'session.read' and p_service_id is null then
    select o.service_id into p_service_id from public.teaching_occurrences o
    where o.id = public.teaching_uuid_arg(p_payload, 'occurrenceId');
    if p_service_id is null then raise exception 'teaching_not_found'; end if;
  end if;

  -- Everything else acts on one team.
  if p_service_id is null or p_action not in (
    'session.read','attendance.self','checkin.code','checkin.typed','display.create','display.revoke',
    'notice.read','calendar.set','series.save','occurrence.change','group.save','group.delete',
    'group.members.set','register.read','export.attendance','members.read','organise.read','invitation.create',
    'role.set','audit.read','attendance.remove'
  ) then
    raise exception 'teaching_invalid_request';
  end if;
  if p_action <> 'invitation.create' then
    -- Reads and check-ins share-lock the team row, so a revoke that commits first always wins.
    select * into v_service from public.on_call_services where id = p_service_id for share;
  else
    -- invitation.create does not: On Call's command, which it calls, locks the row itself, and
    -- upgrading a share lock held here would deadlock two concurrent invites.
    select * into v_service from public.on_call_services where id = p_service_id;
  end if;
  if not found then raise exception 'teaching_access_denied'; end if;
  v_role := public.teaching_member_role(p_service_id, p_actor_id);
  -- A What's on visitor (spec §5a) may read a session its team has opened to the visitor's health
  -- service, and nothing else: no codes, counts, register or writes. Every other action needs a member.
  if v_role is null and not (p_action = 'session.read'
      and public.teaching_occurrence_open_to(public.teaching_uuid_arg(p_payload, 'occurrenceId'), p_actor_id)) then
    raise exception 'teaching_access_denied';
  end if;
  if p_action not in ('session.read','checkin.code','register.read','export.attendance','members.read','organise.read','audit.read','role.set')
    and not (v_service.verified_at is not null or v_service.is_demo) then
    raise exception 'teaching_team_unverified';
  end if;
  -- 74818 guards Teaching's own tables only.
  v_needs_lock := p_action in ('display.create','display.revoke','series.save','occurrence.change','group.save',
    'group.delete','group.members.set','role.set','attendance.remove');
  if v_needs_lock then perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74818)); end if;

  if p_action in ('session.read','attendance.self','checkin.code','checkin.typed','display.create','register.read') then
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    v_is_presenter := coalesce(v_occ.presenter_id = p_actor_id, false);
  end if;
  if p_action in ('checkin.code','checkin.typed','display.create') then
    v_stream := public.teaching_text_arg(p_payload, 'stream');
    if v_stream is null or v_stream not in ('room','teams') then raise exception 'teaching_invalid_request'; end if;
  end if;

  if p_action = 'session.read' then
    select * into v_series from public.teaching_series where id = v_occ.series_id;
    -- A health-service visitor (R5, R15) has no Teaching role here and got past the gate above only
    -- for an open series. They see time, place, join link and materials: no presenter name, and no
    -- code or counts (so no register), even if they once presented here and have since left.
    v_visitor := v_role is null;
    if v_visitor then v_is_presenter := false; end if;
    return jsonb_build_object(
      'occurrenceId', v_occ.id, 'serviceId', v_occ.service_id, 'seriesId', v_occ.series_id, 'title', v_occ.title,
      'startsAt', v_occ.starts_at, 'endsAt', v_occ.ends_at, 'venue', v_occ.venue,
      'hasJoinLink', v_occ.join_url is not null, 'status', v_occ.status,
      'previousStartsAt', case when v_occ.status = 'moved' then v_occ.previous_starts_at end,
      'isPresenter', v_is_presenter, 'source', 'teaching', 'visitor', v_visitor,
      'joinUrl', v_occ.join_url,
      'presenterName', case when v_visitor or v_occ.presenter_id is null then null else coalesce(
        (select coalesce(m.display_name, 'Member') from public.on_call_service_members m
         where m.service_id = p_service_id and m.user_id = v_occ.presenter_id and m.revoked_at is null),
        'Former member') end,
      'materials', coalesce(v_series.materials, '[]'::jsonb),
      'changeReason', v_occ.change_reason,
      -- The caller's own mark only, or null.
      'myAttendance', (select jsonb_build_object('method', a.method, 'recordedAt', a.recorded_at)
        from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.user_id = p_actor_id),
      'inCalendar', public.teaching_week_added(v_occ.id, p_actor_id),
      'canShowCode', v_is_presenter or coalesce(v_role = 'organiser', false),
      'counts', case when v_is_presenter or v_role in ('organiser','admin') then jsonb_build_object(
        -- Expected: active members of the series' groups, or every active member when it has none.
        'expected', case when cardinality(coalesce(v_series.group_ids, '{}')) > 0 then
            (select count(distinct gm.user_id) from public.teaching_group_members gm
             join public.on_call_service_members m on m.service_id = gm.service_id and m.user_id = gm.user_id and m.revoked_at is null
             where gm.service_id = p_service_id and gm.group_id = any(v_series.group_ids))
          else (select count(*) from public.on_call_service_members m where m.service_id = p_service_id and m.revoked_at is null) end,
        'code', (select count(*) from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.method <> 'self'),
        'self', (select count(*) from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.method = 'self' and not a.visitor),
        'visitors', (select count(*) from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.visitor))
        else null end
    );

  elsif p_action = 'attendance.self' then
    if v_occ.status = 'cancelled' or now() < v_occ.starts_at or now() > v_occ.ends_at + interval '7 days' then
      raise exception 'teaching_window_closed';
    end if;
    return public.teaching_record_attendance(p_actor_id, p_service_id, v_occ.id, 'self');

  elsif p_action = 'checkin.code' then
    -- Spec role table: the presenter and organisers show codes; an admin does not.
    if not (v_is_presenter or v_role = 'organiser') then raise exception 'teaching_role_denied'; end if;
    if v_occ.status = 'cancelled' or now() < v_occ.starts_at - interval '15 minutes' or now() > v_occ.ends_at + interval '15 minutes' then
      raise exception 'teaching_window_closed';
    end if;
    v_window := floor(extract(epoch from now()) / 30)::bigint;
    v_mac := public.teaching_code_mac(v_occ.checkin_secret, v_occ.id, v_stream, v_window);
    v_typed := public.teaching_typed_code(v_occ.checkin_secret, v_occ.id, v_stream, v_window);
    return jsonb_build_object(
      'token', replace(v_occ.id::text, '-', '') || left(v_stream, 1) || v_window::text || v_mac,
      'typedCode', v_typed,
      'window', v_window,
      'validUntil', to_timestamp((v_window + 1) * 30)
    );

  elsif p_action = 'checkin.typed' then
    v_code := public.teaching_text_arg(p_payload, 'code');
    if v_code is null or v_code !~ '^[0-9]{6}$' then raise exception 'teaching_invalid_request'; end if;
    if v_occ.status = 'cancelled' or now() < v_occ.starts_at - interval '15 minutes' or now() > v_occ.ends_at + interval '15 minutes' then
      raise exception 'teaching_window_closed';
    end if;
    v_window := floor(extract(epoch from now()) / 30)::bigint;
    v_typed := public.teaching_typed_code(v_occ.checkin_secret, v_occ.id, v_stream, v_window);
    v_typed_previous := public.teaching_typed_code(v_occ.checkin_secret, v_occ.id, v_stream, v_window - 1);
    if not (public.teaching_const_eq(v_code, v_typed) or public.teaching_const_eq(v_code, v_typed_previous)) then
      raise exception 'teaching_code_invalid';
    end if;
    return public.teaching_record_attendance(p_actor_id, p_service_id, v_occ.id,
      case v_stream when 'room' then 'code_room' else 'code_teams' end);

  elsif p_action = 'display.create' then
    if not (v_is_presenter or v_role = 'organiser') then raise exception 'teaching_role_denied'; end if;
    v_code := public.teaching_text_arg(p_payload, 'linkHash');
    if v_code is null or v_code !~ '^[a-f0-9]{64}$' then raise exception 'teaching_invalid_request'; end if;
    if v_occ.status = 'cancelled' or now() > v_occ.ends_at + interval '15 minutes' then raise exception 'teaching_window_closed'; end if;
    if (select count(*) from public.teaching_display_links
        where occurrence_id = v_occ.id and revoked_at is null and expires_at > now()) >= 10 then
      raise exception 'teaching_limit';
    end if;
    insert into public.teaching_display_links(occurrence_id, stream, link_hash, created_by, expires_at)
    values (v_occ.id, v_stream, v_code, p_actor_id, v_occ.ends_at + interval '15 minutes')
    returning * into v_link;
    perform public.teaching_audit(p_service_id, p_actor_id, 'display.create', v_occ.id);
    return jsonb_build_object('expiresAt', v_link.expires_at);

  elsif p_action = 'display.revoke' then
    v_code := public.teaching_text_arg(p_payload, 'linkHash');
    if v_code is null or v_code !~ '^[a-f0-9]{64}$' then raise exception 'teaching_invalid_request'; end if;
    select l.* into v_link from public.teaching_display_links l
    join public.teaching_occurrences o on o.id = l.occurrence_id
    where l.link_hash = v_code and o.service_id = p_service_id
    for update of l;
    if not found then raise exception 'teaching_not_found'; end if;
    if not (v_link.created_by = p_actor_id or v_role = 'organiser') then raise exception 'teaching_role_denied'; end if;
    update public.teaching_display_links set revoked_at = coalesce(revoked_at, now()) where id = v_link.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'display.revoke', v_link.occurrence_id);
    return '{}'::jsonb;

  elsif p_action = 'notice.read' then
    v_id := public.teaching_uuid_arg(p_payload, 'noticeId');
    if v_id is null or not exists (select 1 from public.teaching_notices where id = v_id and service_id = p_service_id) then
      raise exception 'teaching_not_found';
    end if;
    insert into public.teaching_notice_reads(notice_id, user_id) values (v_id, p_actor_id)
    on conflict (notice_id, user_id) do nothing;
    perform public.teaching_audit(p_service_id, p_actor_id, 'notice.read', v_id);
    return '{}'::jsonb;

  elsif p_action = 'calendar.set' then
    if jsonb_typeof(p_payload->'enabled') is distinct from 'boolean' then raise exception 'teaching_invalid_request'; end if;
    if (p_payload->>'enabled')::boolean then
      insert into public.teaching_calendar_optins(service_id, user_id) values (p_service_id, p_actor_id)
      on conflict (service_id, user_id) do nothing;
    else
      delete from public.teaching_calendar_optins where service_id = p_service_id and user_id = p_actor_id;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'calendar.set', null);
    return jsonb_build_object('enabled', (p_payload->>'enabled')::boolean);

  elsif p_action = 'series.save' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_result := public.teaching_series_save(p_actor_id, p_service_id, p_payload);
    perform public.teaching_audit(p_service_id, p_actor_id, 'series.save', public.teaching_uuid_arg(v_result, 'seriesId'));
    return v_result;

  elsif p_action = 'occurrence.change' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    v_status := public.teaching_text_arg(p_payload, 'status');
    v_reason := public.teaching_text_arg(p_payload, 'reason');
    if v_status is null or v_status not in ('moved','cancelled')
      or v_reason is null or v_reason not in ('presenter_unavailable','room_change','clinical_pressure','public_holiday','rescheduled','other') then
      raise exception 'teaching_invalid_request';
    end if;
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_occ.status = 'cancelled' then raise exception 'teaching_invalid_request'; end if;
    if v_occ.ends_at <= now() then raise exception 'teaching_window_closed'; end if;
    if v_status = 'moved' then
      v_starts := coalesce(public.teaching_ts_arg(p_payload, 'startsAt'), v_occ.starts_at);
      v_ends := coalesce(public.teaching_ts_arg(p_payload, 'endsAt'), v_starts + (v_occ.ends_at - v_occ.starts_at));
      v_venue := case when p_payload ? 'venue' then nullif(btrim(coalesce(public.teaching_text_arg(p_payload, 'venue'), '')), '') else v_occ.venue end;
      if v_ends <= v_starts or v_ends > v_starts + interval '8 hours' or v_ends <= now()
        or (v_venue is not null and char_length(v_venue) > 160)
        or (v_starts = v_occ.starts_at and v_ends = v_occ.ends_at and v_venue is not distinct from v_occ.venue) then
        raise exception 'teaching_invalid_request';
      end if;
      update public.teaching_occurrences set status = 'moved', starts_at = v_starts, ends_at = v_ends, venue = v_venue,
        change_reason = v_reason, changed_at = now(),
        previous_starts_at = case when v_starts <> v_occ.starts_at then v_occ.starts_at else v_occ.previous_starts_at end
      where id = v_occ.id;
      update public.teaching_display_links set expires_at = greatest(v_ends + interval '15 minutes', created_at + interval '1 second')
      where occurrence_id = v_occ.id and revoked_at is null;
    else
      update public.teaching_occurrences set status = 'cancelled', change_reason = v_reason, changed_at = now()
      where id = v_occ.id;
      update public.teaching_display_links set revoked_at = now() where occurrence_id = v_occ.id and revoked_at is null;
    end if;
    insert into public.teaching_notices(service_id, occurrence_id, kind, created_by)
    values (p_service_id, v_occ.id, v_status, p_actor_id);
    perform public.teaching_audit(p_service_id, p_actor_id, 'occurrence.change', v_occ.id);
    return '{}'::jsonb;

  elsif p_action = 'group.save' then
    -- Spec §4: groups are for organisers and admins.
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    v_id := public.teaching_uuid_arg(p_payload, 'groupId');
    v_text := btrim(coalesce(public.teaching_text_arg(p_payload, 'name'), ''));
    if char_length(v_text) not between 1 and 80 then raise exception 'teaching_invalid_request'; end if;
    if v_id is null then
      if (select count(*) from public.teaching_groups where service_id = p_service_id) >= 200 then raise exception 'teaching_limit'; end if;
      insert into public.teaching_groups(service_id, name) values (p_service_id, v_text) returning id into v_id;
    else
      update public.teaching_groups set name = v_text where id = v_id and service_id = p_service_id;
      if not found then raise exception 'teaching_not_found'; end if;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'group.save', v_id);
    return jsonb_build_object('groupId', v_id);

  elsif p_action = 'group.delete' then
    -- Spec §4: groups are for organisers and admins.
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    v_id := public.teaching_uuid_arg(p_payload, 'groupId');
    delete from public.teaching_groups where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    -- A series left with no groups shows to the whole team again.
    update public.teaching_series set group_ids = array_remove(group_ids, v_id), updated_at = now()
    where service_id = p_service_id and v_id = any(group_ids);
    perform public.teaching_audit(p_service_id, p_actor_id, 'group.delete', v_id);
    return jsonb_build_object('groupId', v_id);

  elsif p_action = 'group.members.set' then
    -- Spec §4: groups are for organisers and admins.
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    v_id := public.teaching_uuid_arg(p_payload, 'groupId');
    if v_id is null or not exists (select 1 from public.teaching_groups where id = v_id and service_id = p_service_id) then
      raise exception 'teaching_not_found';
    end if;
    v_ids := public.teaching_uuid_array_arg(p_payload, 'userIds', 500);
    if exists (select 1 from unnest(v_ids) as u where not public.service_member_active(p_service_id, u)) then
      raise exception 'teaching_invalid_request';
    end if;
    delete from public.teaching_group_members where group_id = v_id and not (user_id = any(v_ids));
    insert into public.teaching_group_members(group_id, service_id, user_id)
    select v_id, p_service_id, u from unnest(v_ids) as u
    on conflict (group_id, user_id) do nothing;
    perform public.teaching_audit(p_service_id, p_actor_id, 'group.members.set', v_id);
    return jsonb_build_object('groupId', v_id);

  elsif p_action = 'attendance.remove' then
    -- Self-reported check-ins count straight away (no approval queue); an organiser may remove one.
    -- Code check-ins are never removed. Audited, with the removed person as the subject.
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    v_user := public.teaching_uuid_arg(p_payload, 'userId');
    if v_id is null or v_user is null then raise exception 'teaching_invalid_request'; end if;
    delete from public.teaching_attendance a
    where a.occurrence_id = v_id and a.service_id = p_service_id and a.user_id = v_user and a.method = 'self';
    if not found then raise exception 'teaching_not_found'; end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'attendance.remove', v_user);
    return '{}'::jsonb;

  elsif p_action = 'register.read' then
    if v_role = 'organiser' then
      perform public.teaching_audit(p_service_id, p_actor_id, 'register.read', v_occ.id);
      return jsonb_build_object('rows', coalesce((select jsonb_agg(jsonb_build_object(
          'userId', a.user_id, 'name', coalesce(m.display_name, 'Member'), 'method', a.method,
          'recordedAt', a.recorded_at, 'upgradedFrom', a.upgraded_from)
          order by lower(coalesce(m.display_name, 'Member')), a.recorded_at)
        from public.teaching_attendance a
        left join public.on_call_service_members m on m.service_id = a.service_id and m.user_id = a.user_id
        where a.occurrence_id = v_occ.id and not a.visitor), '[]'::jsonb),
        -- Visitors from other teams are counted, never named (spec §5a).
        'visitors', (select count(*) from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.visitor));
    elsif v_is_presenter then
      return jsonb_build_object('counts', jsonb_build_object(
        'code', (select count(*) from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.method <> 'self'),
        'self', (select count(*) from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.method = 'self' and not a.visitor),
        'visitors', (select count(*) from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.visitor)));
    end if;
    raise exception 'teaching_role_denied';

  elsif p_action = 'export.attendance' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_from := public.teaching_date_arg(p_payload, 'from');
    v_to := public.teaching_date_arg(p_payload, 'to');
    if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 366 then raise exception 'teaching_invalid_request'; end if;
    select count(*) into v_count
    from public.teaching_attendance a join public.teaching_occurrences o on o.id = a.occurrence_id
    where a.service_id = p_service_id and not a.visitor
      and o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
      and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth');
    if v_count > 50000 then raise exception 'teaching_limit'; end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'export.attendance', null);
    return jsonb_build_object('rows', coalesce((select jsonb_agg(jsonb_build_object(
        'occurrenceId', o.id, 'title', o.title, 'startsAt', o.starts_at, 'endsAt', o.ends_at, 'status', o.status,
        'userId', a.user_id, 'name', coalesce(m.display_name, 'Member'), 'method', a.method, 'recordedAt', a.recorded_at)
        order by o.starts_at, o.id, lower(coalesce(m.display_name, 'Member')))
      from public.teaching_attendance a
      join public.teaching_occurrences o on o.id = a.occurrence_id
      left join public.on_call_service_members m on m.service_id = a.service_id and m.user_id = a.user_id
      where a.service_id = p_service_id and not a.visitor
        and o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
        and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth')), '[]'::jsonb));

  elsif p_action = 'members.read' then
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'members.read', null);
    return jsonb_build_object('members', coalesce((select jsonb_agg(jsonb_build_object(
        'userId', m.user_id, 'name', coalesce(m.display_name, 'Member'),
        'role', public.teaching_member_role(p_service_id, m.user_id), 'joinedAt', m.joined_at)
        order by lower(coalesce(m.display_name, 'Member')), m.user_id)
      from public.on_call_service_members m
      where m.service_id = p_service_id and m.revoked_at is null), '[]'::jsonb));

  elsif p_action = 'organise.read' then
    -- The Organise page's editors: every series of the team, the groups with their member ids, and
    -- the active members. One audited read; no attendance and nothing from the check-in secret.
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'organise.read', null);
    return jsonb_build_object(
      'series', coalesce((select jsonb_agg(jsonb_build_object(
          'seriesId', s.id, 'title', s.title, 'kind', s.kind, 'groupIds', to_jsonb(s.group_ids), 'repeat', s.repeat,
          'firstDate', s.first_date, 'startTime', to_char(s.start_time, 'HH24:MI'), 'minutes', s.minutes,
          'venue', s.venue, 'joinUrl', s.join_url, 'skipDates', to_jsonb(s.skip_dates), 'endDate', s.end_date,
          'presenterId', s.presenter_id, 'materials', s.materials, 'audience', s.audience, 'openTo', s.open_to,
          'lastConfirmedAt', s.last_confirmed_at)
          order by s.first_date desc, s.id)
        from public.teaching_series s where s.service_id = p_service_id), '[]'::jsonb),
      'groups', coalesce((select jsonb_agg(jsonb_build_object(
          'groupId', g.id, 'name', g.name,
          'userIds', coalesce((select jsonb_agg(gm.user_id order by gm.user_id)
            from public.teaching_group_members gm where gm.group_id = g.id), '[]'::jsonb))
          order by lower(g.name), g.id)
        from public.teaching_groups g where g.service_id = p_service_id), '[]'::jsonb),
      'members', coalesce((select jsonb_agg(jsonb_build_object(
          'userId', m.user_id, 'name', coalesce(m.display_name, 'Member'),
          'role', public.teaching_member_role(p_service_id, m.user_id), 'joinedAt', m.joined_at)
          order by lower(coalesce(m.display_name, 'Member')), m.user_id)
        from public.on_call_service_members m
        where m.service_id = p_service_id and m.revoked_at is null), '[]'::jsonb));

  elsif p_action = 'invitation.create' then
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    v_text := lower(btrim(coalesce(public.teaching_text_arg(p_payload, 'email'), '')));
    v_code := public.teaching_text_arg(p_payload, 'tokenHash');
    if char_length(v_text) not between 3 and 254 or v_text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
      or v_code is null or v_code !~ '^[a-f0-9]{64}$' then
      raise exception 'teaching_invalid_request';
    end if;
    -- On Call's command is the single writer of invitations (shared contract v6): it locks the
    -- service row, enforces the shared caps, checks teaching_can_invite for the actor, forces the
    -- member role and stores the email and issued_via_mode. Teaching never writes the table.
    begin
      v_result := public.on_call_service_command(p_actor_id, p_service_id, 'invitation.create', jsonb_build_object(
        'tokenHash', v_code, 'invitedEmail', v_text, 'expiresInDays', 7, 'role', 'member', 'issuedViaMode', 'teaching'));
    exception when raise_exception then
      if sqlerrm = 'service_limit' then raise exception 'teaching_limit'; end if;
      if sqlerrm = 'service_role_denied' then raise exception 'teaching_role_denied'; end if;
      if sqlerrm = 'service_invalid_request' then raise exception 'teaching_invalid_request'; end if;
      raise;
    end;
    v_id := public.teaching_uuid_arg(v_result, 'invitationId');
    v_ends := public.teaching_ts_arg(v_result, 'expiresAt');
    if v_id is null or v_ends is null then raise exception 'teaching_invalid_request'; end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'invitation.create', v_id);
    return jsonb_build_object('invitationId', v_id, 'expiresAt', v_ends);

  elsif p_action = 'role.set' then
    v_user := public.teaching_uuid_arg(p_payload, 'userId');
    v_text := public.teaching_text_arg(p_payload, 'role');
    if v_user is null or v_text is null or v_text not in ('doctor','organiser','admin') then raise exception 'teaching_invalid_request'; end if;
    -- A Teaching admin, or an On Call service admin while the team has no active Teaching admin.
    if not (v_role = 'admin' or (public.teaching_admin_count(p_service_id) = 0 and exists (
        select 1 from public.on_call_service_members m
        where m.service_id = p_service_id and m.user_id = p_actor_id and m.revoked_at is null and m.role = 'admin'))) then
      raise exception 'teaching_role_denied';
    end if;
    if not public.service_member_active(p_service_id, v_user) then raise exception 'teaching_not_found'; end if;
    if public.teaching_member_role(p_service_id, v_user) = 'admin' and v_text <> 'admin'
      and public.teaching_admin_count(p_service_id) <= 1 then
      raise exception 'teaching_last_admin';
    end if;
    if v_text = 'doctor' then
      update public.teaching_member_roles set revoked_at = now()
      where service_id = p_service_id and user_id = v_user and revoked_at is null;
    else
      insert into public.teaching_member_roles(service_id, user_id, role, granted_by)
      values (p_service_id, v_user, v_text, p_actor_id)
      on conflict (service_id, user_id) do update
        set role = excluded.role, granted_by = excluded.granted_by, granted_at = now(), revoked_at = null;
    end if;
    insert into public.on_call_service_member_events(service_id, user_id, event, mode, actor_id)
    values (p_service_id, v_user, 'role_changed', 'teaching', p_actor_id);
    perform public.teaching_audit(p_service_id, p_actor_id, 'role.set', v_user);
    return '{}'::jsonb;

  elsif p_action = 'audit.read' then
    if v_role <> 'admin' then raise exception 'teaching_role_denied'; end if;
    -- Keyset paging by (at, id): pass the last row's at as before and its id as beforeId, so rows
    -- that share a timestamp are never skipped or repeated.
    v_before := public.teaching_ts_arg(p_payload, 'before');
    v_text := p_payload->'beforeId' #>> '{}';
    if (v_before is null) <> (v_text is null)
      or (v_text is not null and (jsonb_typeof(p_payload->'beforeId') <> 'number' or v_text !~ '^[0-9]{1,18}$')) then
      raise exception 'teaching_invalid_request';
    end if;
    v_before := coalesce(v_before, 'infinity'::timestamptz);
    v_before_id := coalesce(v_text::bigint, 9223372036854775807);
    perform public.teaching_audit(p_service_id, p_actor_id, 'audit.read', null);
    return jsonb_build_object('events', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'actorId', x.actor_id, 'actorName', x.actor_name, 'action', x.action, 'subjectId', x.subject_id, 'at', x.at)
        order by x.at desc, x.id desc)
      from (
        select e.id, e.actor_id, e.action, e.subject_id, e.at,
          case when e.actor_id is null then null else coalesce(
            (select coalesce(m.display_name, 'Member') from public.on_call_service_members m
             where m.service_id = e.service_id and m.user_id = e.actor_id), 'Former member') end as actor_name
        from public.teaching_audit_events e
        where e.service_id = p_service_id and (e.at, e.id) < (v_before, v_before_id)
        order by e.at desc, e.id desc
        limit 50
      ) as x), '[]'::jsonb));
  end if;

  raise exception 'teaching_invalid_request';
end $$;

revoke all on function public.teaching_command(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_command(uuid, uuid, text, jsonb) to service_role;

-- Calendar feed read (part 2 S6). The feed runs with no signed-in session, so it is not a
-- teaching_command action. It returns SessionSummary rows for occurrences that belong to a team
-- where the owner is an active member and has a calendar opt-in, that week.read would list for
-- them (group-targeted series only to those groups, the presenter, organisers and admins), and
-- that start on a Perth date from p_from to p_to. Cancelled occurrences are included, with
-- status 'cancelled', so calendars can mark them. A non-member gets an empty list, never an
-- error, so a feed never reveals membership. No audit row (it runs every few hours per
-- subscriber). No join link, presenter name, notes or attendance, ever.
create function public.teaching_feed_events(p_owner_id uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
begin
  if p_owner_id is null or p_from is null or p_to is null or p_to < p_from or p_to - p_from > 120 then
    raise exception 'teaching_invalid_request';
  end if;
  return jsonb_build_object('sessions', coalesce((select jsonb_agg(jsonb_build_object(
      'occurrenceId', o.id, 'serviceId', o.service_id, 'title', o.title, 'startsAt', o.starts_at, 'endsAt', o.ends_at,
      'venue', o.venue, 'hasJoinLink', o.join_url is not null, 'status', o.status,
      'isPresenter', o.presenter_id is not distinct from p_owner_id, 'source', 'teaching') order by o.starts_at, o.id)
    from public.teaching_occurrences o
    where o.starts_at >= (p_from::timestamp at time zone 'Australia/Perth')
      and o.starts_at < ((p_to + 1)::timestamp at time zone 'Australia/Perth')
      and (
        -- the owner's own opted-in teams, by week.read's listing rule
        exists (select 1 from public.teaching_calendar_optins c
          where c.user_id = p_owner_id and c.service_id = o.service_id
            and public.service_member_active(c.service_id, p_owner_id)
            and public.teaching_occurrence_listed(o.id, p_owner_id, public.teaching_member_role(c.service_id, p_owner_id)))
        -- another team's session the owner added from What's on (spec §5a), while it stays open,
        -- for an owner who uses the Teaching feed at all (at least one opt-in in an active team)
        or (not public.service_member_active(o.service_id, p_owner_id)
          and exists (select 1 from public.teaching_calendar_optins c
            where c.user_id = p_owner_id and public.service_member_active(c.service_id, p_owner_id))
          and public.teaching_week_added(o.id, p_owner_id) and public.teaching_occurrence_open_to(o.id, p_owner_id))
      )), '[]'::jsonb));
end $$;

revoke all on function public.teaching_feed_events(uuid, date, date) from public, anon, authenticated;
grant execute on function public.teaching_feed_events(uuid, date, date) to service_role;

-- Audit retention: rows (and so their subject ids) older than 12 months are purged nightly, as
-- the shared contract's on_call_service_member_events are. Registered only when pg_cron exists,
-- like the repository's other retention jobs (for example 20260702120000).
comment on table public.teaching_audit_events is
  'Teaching audit trail, fixed fields only. Rows older than 12 months are purged nightly by the
   pg_cron job "purge-teaching-audit-events".';
do $cron$
begin
  if to_regnamespace('cron') is null then
    return;
  end if;
  perform cron.schedule(
    'purge-teaching-audit-events',
    '15 3 * * *',
    $job$
      delete from public.teaching_audit_events where at < now() - interval '12 months';
    $job$
  );
end
$cron$;

-- PR B's actions (supervision, presenter readiness, feedback, and the term import). Same shape and
-- rules as teaching_command; created in this migration so the database changes once.
create function public.teaching_depth_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role text;
  v_occ public.teaching_occurrences;
  v_pairing public.teaching_supervision_pairings;
  v_entry public.teaching_supervision_entries;
  v_note public.teaching_supervision_notes;
  v_readiness public.teaching_readiness;
  v_id uuid;
  v_registrar uuid;
  v_supervisor uuid;
  v_ids uuid[];
  v_topics text[];
  v_starts date;
  v_ends date;
  v_date date;
  v_target numeric;
  v_text text;
  v_minutes integer;
  v_useful integer;
  v_count integer;
  v_result jsonb;
  v_row jsonb;
  v_leaver boolean := false;
begin
  if p_actor_id is null then raise exception 'teaching_auth_required'; end if;
  if p_action is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_service_id is null
    or p_action not in ('pairing.save','pairing.reassign','supervision.log','supervision.confirm','supervision.note',
      'supervision.note.confirm','supervision.read','supervision.target.set','readiness.set','readiness.deid.confirm',
      'feedback.submit','feedback.totals','import.commit') then
    raise exception 'teaching_invalid_request';
  end if;
  select * into v_service from public.on_call_services where id = p_service_id for share;
  if not found then raise exception 'teaching_access_denied'; end if;
  v_role := public.teaching_member_role(p_service_id, p_actor_id);
  if v_role is null then
    -- A leaver keeps read-only access to their own supervision entries (as registrar) for 90 days
    -- from the shared revoke, as logbook.read keeps their attendance (spec §9). Nothing else.
    v_leaver := p_action = 'supervision.read' and exists (select 1 from public.on_call_service_members m
      where m.service_id = p_service_id and m.user_id = p_actor_id
        and m.revoked_at is not null and m.revoked_at > now() - interval '90 days');
    if not v_leaver then raise exception 'teaching_access_denied'; end if;
  end if;
  if p_action not in ('supervision.read','feedback.totals') and not (v_service.verified_at is not null or v_service.is_demo) then
    raise exception 'teaching_team_unverified';
  end if;
  if p_action in ('pairing.save','pairing.reassign','import.commit') then
    perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74818));
  end if;

  if p_action = 'pairing.save' then
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    v_registrar := public.teaching_uuid_arg(p_payload, 'registrarId');
    v_supervisor := public.teaching_uuid_arg(p_payload, 'supervisorId');
    v_starts := public.teaching_date_arg(p_payload, 'startsOn');
    v_ends := public.teaching_date_arg(p_payload, 'endsOn');
    -- The hours target is the registrar's own (supervision.target.set); an organiser never sets it.
    if p_payload ? 'targetHours' then raise exception 'teaching_invalid_request'; end if;
    -- Organisers pair other people. A pairing that includes the actor needs a Teaching admin.
    if not (v_role = 'admin' or (v_role = 'organiser' and p_actor_id <> v_registrar and p_actor_id <> v_supervisor)) then
      raise exception 'teaching_role_denied';
    end if;
    if v_registrar is null or v_supervisor is null or v_registrar = v_supervisor
      or v_starts is null or v_ends is null or v_ends < v_starts or v_ends > v_starts + 731
      or not public.service_member_active(p_service_id, v_registrar)
      or not public.service_member_active(p_service_id, v_supervisor) then
      raise exception 'teaching_invalid_request';
    end if;
    if v_id is null then
      if (select count(*) from public.teaching_supervision_pairings where service_id = p_service_id) >= 5000 then
        raise exception 'teaching_limit';
      end if;
      insert into public.teaching_supervision_pairings(service_id, registrar_id, supervisor_id, starts_on, ends_on, created_by)
      values (p_service_id, v_registrar, v_supervisor, v_starts, v_ends, p_actor_id)
      returning * into v_pairing;
    else
      select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id for update;
      if not found then raise exception 'teaching_not_found'; end if;
      -- Once a pairing has entries, only its end date and target can change; the supervisor
      -- changes through pairing.reassign.
      if exists (select 1 from public.teaching_supervision_entries e where e.pairing_id = v_pairing.id)
        and (v_pairing.registrar_id is distinct from v_registrar or v_pairing.supervisor_id is distinct from v_supervisor
          or v_pairing.starts_on <> v_starts) then
        raise exception 'teaching_invalid_request';
      end if;
      update public.teaching_supervision_pairings set registrar_id = v_registrar, supervisor_id = v_supervisor,
        starts_on = v_starts, ends_on = v_ends, updated_at = now()
      where id = v_pairing.id returning * into v_pairing;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'pairing.save', v_pairing.id);
    return jsonb_build_object('pairingId', v_pairing.id);

  elsif p_action = 'pairing.reassign' then
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    v_supervisor := public.teaching_uuid_arg(p_payload, 'supervisorId');
    select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if not (v_role = 'admin' or (v_role = 'organiser' and p_actor_id is distinct from v_pairing.registrar_id and p_actor_id <> v_supervisor)) then
      raise exception 'teaching_role_denied';
    end if;
    if v_supervisor is null or v_supervisor is not distinct from v_pairing.registrar_id
      or not public.service_member_active(p_service_id, v_supervisor) then
      raise exception 'teaching_invalid_request';
    end if;
    -- Confirmed entries keep who confirmed them; pending entries and notes now wait for the new
    -- supervisor, because confirmation always checks the pairing's current supervisor.
    update public.teaching_supervision_pairings set supervisor_id = v_supervisor, updated_at = now() where id = v_pairing.id;
    select count(*) into v_count from public.teaching_supervision_entries where pairing_id = v_pairing.id and status = 'pending';
    perform public.teaching_audit(p_service_id, p_actor_id, 'pairing.reassign', v_pairing.id);
    return jsonb_build_object('pairingId', v_pairing.id, 'pendingMoved', v_count);

  elsif p_action = 'supervision.target.set' then
    -- The registrar's own hours target for this pairing: nullable, no default, and progress is shown
    -- only once it is set. Only the pairing's registrar sets or clears it (targetHours null).
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_pairing.registrar_id is distinct from p_actor_id then raise exception 'teaching_role_denied'; end if;
    if not (p_payload ? 'targetHours') then raise exception 'teaching_invalid_request'; end if;
    if p_payload->'targetHours' <> 'null'::jsonb then
      if jsonb_typeof(p_payload->'targetHours') <> 'number' or (p_payload->>'targetHours') !~ '^[0-9]{1,3}(\.[0-9])?$' then
        raise exception 'teaching_invalid_request';
      end if;
      v_target := (p_payload->>'targetHours')::numeric;
      if v_target not between 1 and 500 then raise exception 'teaching_invalid_request'; end if;
    end if;
    update public.teaching_supervision_pairings set target_hours = v_target, updated_at = now() where id = v_pairing.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.target.set', v_pairing.id);
    return jsonb_build_object('pairingId', v_pairing.id, 'targetHours', v_target);

  elsif p_action = 'supervision.log' then
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_pairing.registrar_id is distinct from p_actor_id then raise exception 'teaching_role_denied'; end if;
    v_date := public.teaching_date_arg(p_payload, 'date');
    v_minutes := public.teaching_int_arg(p_payload, 'minutes');
    v_text := public.teaching_text_arg(p_payload, 'type');
    v_topics := public.teaching_text_array_arg(p_payload, 'topics', 5);
    if v_date is null or v_date < v_pairing.starts_on or v_date > v_pairing.ends_on
      or v_date > (now() at time zone 'Australia/Perth')::date
      or v_minutes is null or v_minutes not between 15 and 240 or v_minutes % 15 <> 0
      or v_text is null or v_text not in ('individual','group')
      -- Topics are optional: none to five.
      or cardinality(v_topics) not between 0 and 5
      or not (v_topics <@ array['case_review','risk','psychotherapy','formulation','medication','mha_legal','teaching_skills','career','exam_prep','wellbeing','other']::text[]) then
      raise exception 'teaching_invalid_request';
    end if;
    if (select count(*) from public.teaching_supervision_entries where pairing_id = v_pairing.id) >= 1000 then
      raise exception 'teaching_limit';
    end if;
    insert into public.teaching_supervision_entries(pairing_id, service_id, session_date, minutes, type, topics, logged_by)
    values (v_pairing.id, p_service_id, v_date, v_minutes, v_text, v_topics, p_actor_id)
    returning * into v_entry;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.log', v_entry.id);
    return jsonb_build_object('entryId', v_entry.id);

  elsif p_action = 'supervision.confirm' then
    v_ids := public.teaching_uuid_array_arg(p_payload, 'entryIds', 20);
    if cardinality(v_ids) = 0 then raise exception 'teaching_invalid_request'; end if;
    -- All or nothing: every entry must be pending and belong to a pairing the actor now supervises.
    if (select count(*) from public.teaching_supervision_entries e
        join public.teaching_supervision_pairings p on p.id = e.pairing_id
        where e.id = any(v_ids) and e.service_id = p_service_id and e.status = 'pending' and p.supervisor_id = p_actor_id)
      <> cardinality(v_ids) then
      raise exception 'teaching_not_found';
    end if;
    update public.teaching_supervision_entries set status = 'confirmed', confirmed_by = p_actor_id, confirmed_at = now(), locked = true
    where id = any(v_ids);
    insert into public.teaching_audit_events(service_id, actor_id, action, subject_id)
    select p_service_id, p_actor_id, 'supervision.confirm', u from unnest(v_ids) as u;
    return jsonb_build_object('confirmed', cardinality(v_ids));

  elsif p_action = 'supervision.note' then
    v_id := public.teaching_uuid_arg(p_payload, 'entryId');
    select e.* into v_entry from public.teaching_supervision_entries e
    join public.teaching_supervision_pairings p on p.id = e.pairing_id
    where e.id = v_id and e.service_id = p_service_id and p.registrar_id = p_actor_id;
    if not found then raise exception 'teaching_not_found'; end if;
    v_text := public.teaching_text_arg(p_payload, 'reason');
    if v_text is null or not public.teaching_valid_correction(v_text, p_payload->'correctedValue') then
      raise exception 'teaching_invalid_request';
    end if;
    if v_text = 'wrong_date' then
      perform public.teaching_date_arg(p_payload->'correctedValue', 'date');
    end if;
    if (select count(*) from public.teaching_supervision_notes where entry_id = v_entry.id and confirmed_at is null) >= 5 then
      raise exception 'teaching_limit';
    end if;
    insert into public.teaching_supervision_notes(entry_id, service_id, reason, corrected_value, created_by)
    values (v_entry.id, p_service_id, v_text, p_payload->'correctedValue', p_actor_id)
    returning * into v_note;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.note', v_note.id);
    return jsonb_build_object('noteId', v_note.id);

  elsif p_action = 'supervision.note.confirm' then
    v_id := public.teaching_uuid_arg(p_payload, 'noteId');
    select n.* into v_note from public.teaching_supervision_notes n
    join public.teaching_supervision_entries e on e.id = n.entry_id
    join public.teaching_supervision_pairings p on p.id = e.pairing_id
    where n.id = v_id and n.service_id = p_service_id and p.supervisor_id = p_actor_id and n.confirmed_at is null
    for update of n;
    if not found then raise exception 'teaching_not_found'; end if;
    update public.teaching_supervision_notes set confirmed_by = p_actor_id, confirmed_at = now() where id = v_note.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.note.confirm', v_note.id);
    return jsonb_build_object('noteId', v_note.id);

  elsif p_action = 'supervision.read' then
    -- The registrar and supervisor of a pairing see its entries; an organiser sees totals and
    -- status only (never topics). Reading anyone else's pairing is audited. A leaver (v_leaver)
    -- sees only the pairings where they are the registrar, and reads their own record unaudited.
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    if v_id is not null and not exists (
      select 1 from public.teaching_supervision_pairings p where p.id = v_id and p.service_id = p_service_id
        and (p.registrar_id = p_actor_id or (not v_leaver and (p.supervisor_id = p_actor_id or v_role = 'organiser')))) then
      raise exception 'teaching_not_found';
    end if;
    if v_id is null and v_role = 'organiser' then
      -- An organiser's whole-team read (Logbook, Today): one service-level row per call.
      perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.read', null);
    elsif not v_leaver then
      insert into public.teaching_audit_events(service_id, actor_id, action, subject_id)
      select p_service_id, p_actor_id, 'supervision.read', p.id
      from public.teaching_supervision_pairings p
      where p.service_id = p_service_id and (v_id is null or p.id = v_id)
        and p.registrar_id is distinct from p_actor_id
        and (p.supervisor_id = p_actor_id or v_role = 'organiser');
    end if;
    select jsonb_build_object('pairings', coalesce(jsonb_agg(jsonb_build_object(
        'pairingId', p.id,
        'access', case when p.registrar_id = p_actor_id then 'registrar' when p.supervisor_id = p_actor_id then 'supervisor' else 'organiser' end,
        'registrarName', case when p.registrar_id is null then 'Former member' else coalesce((select coalesce(m.display_name, 'Member')
          from public.on_call_service_members m where m.service_id = p.service_id and m.user_id = p.registrar_id), 'Former member') end,
        'supervisorName', case when p.supervisor_id is null then 'Former member' else coalesce((select coalesce(m.display_name, 'Member')
          from public.on_call_service_members m where m.service_id = p.service_id and m.user_id = p.supervisor_id), 'Former member') end,
        'startsOn', p.starts_on, 'endsOn', p.ends_on,
        'targetHours', case when p.registrar_id = p_actor_id or p.supervisor_id = p_actor_id then p.target_hours else null end,
        'confirmedMinutes', (select coalesce(sum(e.minutes), 0) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'confirmed'),
        'pendingMinutes', (select coalesce(sum(e.minutes), 0) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'pending'),
        'pendingCount', (select count(*) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'pending'),
        'oldestPendingAt', (select min(e.created_at) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'pending'),
        'entries', case when p.registrar_id = p_actor_id or p.supervisor_id = p_actor_id then coalesce((select jsonb_agg(jsonb_build_object(
            'entryId', e.id, 'date', e.session_date, 'minutes', e.minutes, 'type', e.type, 'topics', to_jsonb(e.topics),
            'status', e.status, 'confirmedAt', e.confirmed_at,
            'confirmedByName', case when e.confirmed_at is null then null when e.confirmed_by is null then 'Former member' else coalesce(
              (select coalesce(m.display_name, 'Member') from public.on_call_service_members m where m.service_id = e.service_id and m.user_id = e.confirmed_by),
              'Former member') end,
            'notes', coalesce((select jsonb_agg(jsonb_build_object('noteId', n.id, 'reason', n.reason, 'correctedValue', n.corrected_value,
                'createdAt', n.created_at, 'confirmedAt', n.confirmed_at) order by n.created_at)
              from public.teaching_supervision_notes n where n.entry_id = e.id), '[]'::jsonb)
          ) order by e.session_date desc, e.created_at desc) from public.teaching_supervision_entries e where e.pairing_id = p.id), '[]'::jsonb)
          else null end
      ) order by p.starts_on desc, p.id), '[]'::jsonb))
    into v_result
    from public.teaching_supervision_pairings p
    where p.service_id = p_service_id and (v_id is null or p.id = v_id)
      and (p.registrar_id = p_actor_id or (not v_leaver and (p.supervisor_id = p_actor_id or v_role = 'organiser')));
    return v_result;

  elsif p_action in ('readiness.set','readiness.deid.confirm') then
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_occ.presenter_id is distinct from p_actor_id then raise exception 'teaching_role_denied'; end if;
    insert into public.teaching_readiness(occurrence_id, service_id) values (v_occ.id, p_service_id)
    on conflict (occurrence_id) do nothing;
    if p_action = 'readiness.set' then
      v_text := public.teaching_text_arg(p_payload, 'item');
      if v_text is null or v_text not in ('reading_list','aims','slides_link','room')
        or jsonb_typeof(p_payload->'done') is distinct from 'boolean' then
        raise exception 'teaching_invalid_request';
      end if;
      update public.teaching_readiness set
        items = case when (p_payload->>'done')::boolean
          then array(select distinct i from unnest(array_append(items, v_text)) as i order by i)
          else array_remove(items, v_text) end,
        updated_at = now()
      where occurrence_id = v_occ.id returning * into v_readiness;
    else
      update public.teaching_readiness set deid_confirmed_at = now(), deid_confirmed_by = p_actor_id, updated_at = now()
      where occurrence_id = v_occ.id returning * into v_readiness;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, p_action, v_occ.id);
    return jsonb_build_object('items', to_jsonb(v_readiness.items), 'deidConfirmedAt', v_readiness.deid_confirmed_at);

  elsif p_action = 'feedback.submit' then
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if not exists (select 1 from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.user_id = p_actor_id) then
      raise exception 'teaching_not_attended';
    end if;
    if v_occ.status = 'cancelled' or now() < v_occ.ends_at or now() > v_occ.ends_at + interval '7 days' then
      raise exception 'teaching_window_closed';
    end if;
    v_useful := public.teaching_int_arg(p_payload, 'useful');
    v_text := public.teaching_text_arg(p_payload, 'pace');
    if v_useful is null or v_useful not between 1 and 5 or v_text is null or v_text not in ('slow','right','fast') then
      raise exception 'teaching_invalid_request';
    end if;
    -- One-way "already answered" marker. No responder id is stored with feedback anywhere.
    insert into public.teaching_feedback_replied(occurrence_id, reply_marker)
    values (v_occ.id, encode(extensions.digest(convert_to('teaching-feedback:' || v_occ.id::text || ':' || p_actor_id::text, 'UTF8'), 'sha256'), 'hex'))
    on conflict (occurrence_id, reply_marker) do nothing;
    if not found then raise exception 'teaching_limit'; end if;
    insert into public.teaching_feedback_answers(occurrence_id, service_id, useful, pace)
    values (v_occ.id, p_service_id, v_useful, v_text);
    -- No actor on this audit row: nothing may tie a person to the moment an answer was written.
    perform public.teaching_audit(p_service_id, null, 'feedback.submit', v_occ.id);
    return '{}'::jsonb;

  elsif p_action = 'import.commit' then
    -- A term from a spreadsheet, all or nothing: every row is a new series through the same save as
    -- series.save, inside this one transaction, so one refused row rolls back every row before it.
    -- Spec §4 gives import to organisers and admins.
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    if jsonb_typeof(p_payload->'rows') is distinct from 'array'
      or jsonb_array_length(p_payload->'rows') not between 1 and 200 then
      raise exception 'teaching_invalid_request';
    end if;
    v_count := 0;
    for v_row in select r.value from jsonb_array_elements(p_payload->'rows') as r(value) loop
      if jsonb_typeof(v_row) is distinct from 'object' or v_row ? 'seriesId' then
        raise exception 'teaching_invalid_request';
      end if;
      v_result := public.teaching_series_save(p_actor_id, p_service_id, v_row);
      perform public.teaching_audit(p_service_id, p_actor_id, 'series.save', public.teaching_uuid_arg(v_result, 'seriesId'));
      v_count := v_count + public.teaching_int_arg(v_result, 'occurrences');
    end loop;
    perform public.teaching_audit(p_service_id, p_actor_id, 'import.commit', null);
    return jsonb_build_object('series', jsonb_array_length(p_payload->'rows'), 'occurrences', v_count);

  elsif p_action = 'feedback.totals' then
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if not (v_occ.presenter_id = p_actor_id or v_role = 'organiser') then raise exception 'teaching_role_denied'; end if;
    select count(*) into v_count from public.teaching_feedback_answers where occurrence_id = v_occ.id;
    if now() < v_occ.ends_at + interval '7 days' or v_count < 3 then
      return jsonb_build_object('released', false);
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'feedback.totals', v_occ.id);
    return jsonb_build_object(
      'released', true,
      'replies', v_count,
      'useful', (select jsonb_build_object('1', count(*) filter (where useful = 1), '2', count(*) filter (where useful = 2),
          '3', count(*) filter (where useful = 3), '4', count(*) filter (where useful = 4), '5', count(*) filter (where useful = 5))
        from public.teaching_feedback_answers where occurrence_id = v_occ.id),
      'pace', (select jsonb_build_object('slow', count(*) filter (where pace = 'slow'), 'right', count(*) filter (where pace = 'right'),
          'fast', count(*) filter (where pace = 'fast'))
        from public.teaching_feedback_answers where occurrence_id = v_occ.id)
    );
  end if;

  raise exception 'teaching_invalid_request';
end $$;

revoke all on function public.teaching_depth_command(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_depth_command(uuid, uuid, text, jsonb) to service_role;

-- Slides stay hidden until cases are checked: a session's slides are released to attendees once its
-- presenter has confirmed the cases check (readiness.deid.confirm). The presenter and the team's
-- organisers see them before that; everyone else, admins and visitors included, does not.
create function public.teaching_slides_released(p_occurrence_id uuid, p_actor_id uuid) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_occ public.teaching_occurrences;
begin
  select * into v_occ from public.teaching_occurrences where id = p_occurrence_id;
  if not found then return false; end if;
  return exists (select 1 from public.teaching_readiness r where r.occurrence_id = v_occ.id and r.deid_confirmed_at is not null)
    or (p_actor_id is not null and v_occ.presenter_id is not distinct from p_actor_id)
    or coalesce(public.teaching_member_role(v_occ.service_id, p_actor_id) = 'organiser', false);
end $$;

-- What's on and Resources (spec §5a). A resource is seen by its own team, and by the team's health
-- service while the session or series it is linked to is open. Removed resources are seen by no one,
-- and a session's slides by no one but its presenter and organisers until its cases are checked.
create function public.teaching_resource_visible(p_resource_id uuid, p_actor_id uuid) returns boolean
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_resource public.teaching_resources;
begin
  select * into v_resource from public.teaching_resources where id = p_resource_id;
  if not found or v_resource.removed_at is not null then return false; end if;
  if v_resource.kind = 'slides' and v_resource.occurrence_id is not null
    and not public.teaching_slides_released(v_resource.occurrence_id, p_actor_id) then
    return false;
  end if;
  if public.service_member_active(v_resource.service_id, p_actor_id) then return true; end if;
  if v_resource.occurrence_id is not null then
    return public.teaching_occurrence_open_to(v_resource.occurrence_id, p_actor_id);
  end if;
  if v_resource.series_id is not null then
    return public.teaching_series_open_to(v_resource.series_id, p_actor_id);
  end if;
  return false;
end $$;

-- One resource as the app shows it. No names: who added it is never returned.
create function public.teaching_resource_row(p_resource_id uuid, p_actor_id uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
  select jsonb_build_object(
    'resourceId', r.id, 'serviceId', r.service_id, 'title', r.title, 'kind', r.kind,
    'url', r.url, 'libraryDocumentId', r.library_document_id,
    'collectionId', r.collection_id, 'sectionId', r.section_id,
    'occurrenceId', r.occurrence_id, 'seriesId', r.series_id, 'addedAt', r.added_at,
    'saved', exists (select 1 from public.teaching_resource_saves v where v.resource_id = r.id and v.user_id = p_actor_id))
  from public.teaching_resources r where r.id = p_resource_id
$$;

create function public.teaching_whats_on_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role text;
  v_occ public.teaching_occurrences;
  v_series public.teaching_series;
  v_resource public.teaching_resources;
  v_collection public.teaching_collections;
  v_attendance public.teaching_attendance;
  v_host uuid;
  v_id uuid;
  v_series_id uuid;
  v_collection_id uuid;
  v_section_id uuid;
  v_doc uuid;
  v_from date;
  v_to date;
  v_text text;
  v_kind text;
  v_url text;
  v_sort integer;
  v_count integer;
  v_result jsonb;
begin
  if p_actor_id is null then raise exception 'teaching_auth_required'; end if;
  if p_action is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'teaching_invalid_request';
  end if;

  -- The viewer's own actions, across teams. The service id must be null.
  if p_action in ('whats_on.read','week_add.set','week_add.unset','whats_on.attend','resources.read','collection.read',
    'resource_save.set','resource_save.unset') then
    if p_service_id is not null then raise exception 'teaching_invalid_request'; end if;
    perform 1 from public.on_call_services s
    where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null)
    order by s.id for share;

    if p_action = 'whats_on.read' then
      v_from := public.teaching_date_arg(p_payload, 'weekStart');
      if v_from is null then raise exception 'teaching_invalid_request'; end if;
      v_to := v_from + 6;
      select jsonb_build_object(
        'healthServices', coalesce((select jsonb_agg(distinct ts.health_service order by ts.health_service)
          from public.teaching_team_settings ts
          join public.on_call_services s on s.id = ts.service_id and (s.verified_at is not null or s.is_demo)
          where public.service_member_active(ts.service_id, p_actor_id)), '[]'::jsonb),
        'sessions', coalesce((select jsonb_agg(jsonb_build_object(
            'occurrenceId', o.id, 'serviceId', o.service_id, 'teamName', s.name, 'title', o.title,
            'startsAt', o.starts_at, 'endsAt', o.ends_at, 'venue', o.venue, 'hasJoinLink', o.join_url is not null,
            'joinUrl', o.join_url, 'status', o.status, 'isPresenter', o.presenter_id is not distinct from p_actor_id,
            'source', 'teaching', 'own', x.own, 'inMyWeek', x.own or public.teaching_week_added(o.id, p_actor_id),
            -- A one-off with no series is for everyone. The client filters "For my level" (R4).
            'audience', coalesce(ser.audience, 'all_doctors'))
            order by o.starts_at, o.id)
          from public.teaching_occurrences o
          join public.on_call_services s on s.id = o.service_id
          left join public.teaching_series ser on ser.id = o.series_id
          cross join lateral (select public.service_member_active(o.service_id, p_actor_id) as own) as x
          where o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
            and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth')
            and case when x.own
              then public.teaching_occurrence_listed(o.id, p_actor_id, public.teaching_member_role(o.service_id, p_actor_id))
              else public.teaching_occurrence_open_to(o.id, p_actor_id) end), '[]'::jsonb)
      ) into v_result;
      return v_result;

    elsif p_action in ('week_add.set','week_add.unset') then
      v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
      v_series_id := public.teaching_uuid_arg(p_payload, 'seriesId');
      if num_nonnulls(v_id, v_series_id) <> 1 then raise exception 'teaching_invalid_request'; end if;
      if v_id is not null then
        select o.service_id into v_host from public.teaching_occurrences o where o.id = v_id;
      else
        select s.service_id into v_host from public.teaching_series s where s.id = v_series_id;
      end if;
      if v_host is null then raise exception 'teaching_not_found'; end if;
      if p_action = 'week_add.set' then
        -- Only another team's session or series that is open to the viewer's health service. The
        -- viewer's own team's sessions are already in their week.
        if public.service_member_active(v_host, p_actor_id) then raise exception 'teaching_invalid_request'; end if;
        if not (case when v_id is not null then public.teaching_occurrence_open_to(v_id, p_actor_id)
            else public.teaching_series_open_to(v_series_id, p_actor_id) end) then
          raise exception 'teaching_not_found';
        end if;
        if (select count(*) from public.teaching_week_adds where user_id = p_actor_id) >= 500 then raise exception 'teaching_limit'; end if;
        insert into public.teaching_week_adds(user_id, occurrence_id, series_id) values (p_actor_id, v_id, v_series_id)
        on conflict do nothing;
      else
        delete from public.teaching_week_adds
        where user_id = p_actor_id and (occurrence_id = v_id or series_id = v_series_id);
      end if;
      -- No actor: the host team never learns who added its session.
      perform public.teaching_audit(v_host, null, p_action, coalesce(v_id, v_series_id));
      return jsonb_build_object('inMyWeek', p_action = 'week_add.set');

    elsif p_action = 'whats_on.attend' then
      -- A visitor's "I was there": self-reported, visible only to the visitor, counted for the host.
      v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
      select * into v_occ from public.teaching_occurrences where id = v_id;
      if not found then raise exception 'teaching_not_found'; end if;
      v_host := v_occ.service_id;
      if public.service_member_active(v_occ.service_id, p_actor_id) then raise exception 'teaching_invalid_request'; end if;
      if not public.teaching_occurrence_open_to(v_occ.id, p_actor_id) then raise exception 'teaching_not_found'; end if;
      if v_occ.status = 'cancelled' or now() < v_occ.starts_at or now() > v_occ.ends_at + interval '7 days' then
        raise exception 'teaching_window_closed';
      end if;
      insert into public.teaching_attendance(occurrence_id, service_id, user_id, method, visitor)
      values (v_occ.id, v_occ.service_id, p_actor_id, 'self', true)
      on conflict (occurrence_id, user_id) do nothing
      returning * into v_attendance;
      if not found then
        select * into v_attendance from public.teaching_attendance where occurrence_id = v_occ.id and user_id = p_actor_id;
      else
        perform public.teaching_audit(v_host, null, 'attendance.visitor', v_occ.id);
      end if;
      return jsonb_build_object('occurrenceId', v_attendance.occurrence_id, 'method', v_attendance.method, 'recordedAt', v_attendance.recorded_at);

    elsif p_action = 'resources.read' then
      v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
      v_from := public.teaching_date_arg(p_payload, 'weekStart');
      if num_nonnulls(v_id, v_from) <> 1 then raise exception 'teaching_invalid_request'; end if;
      if v_id is not null then
        -- A session page's materials: the session's own and its series'.
        select * into v_occ from public.teaching_occurrences where id = v_id;
        if not found or not (public.service_member_active(v_occ.service_id, p_actor_id)
            or public.teaching_occurrence_open_to(v_occ.id, p_actor_id)) then
          raise exception 'teaching_not_found';
        end if;
        return jsonb_build_object('items', coalesce((select jsonb_agg(public.teaching_resource_row(r.id, p_actor_id)
            order by r.kind, lower(r.title), r.id)
          from public.teaching_resources r
          where r.removed_at is null
            and (r.occurrence_id = v_occ.id or (r.occurrence_id is null and r.series_id is not null and r.series_id = v_occ.series_id))
            and public.teaching_resource_visible(r.id, p_actor_id)), '[]'::jsonb));
      end if;
      v_to := v_from + 6;
      select jsonb_build_object(
        -- Materials of the sessions in the viewer's week; catch-up marks a recording or slides for a
        -- session of their own team they were expected at, that has ended, with no attendance.
        'forThisWeek', coalesce((select jsonb_agg(public.teaching_resource_row(w.id, p_actor_id) || jsonb_build_object('catchUp', w.catch_up)
            order by w.first_start, w.id)
          from (
            select r.id, min(o.starts_at) as first_start,
              bool_or(r.kind in ('recording','slides') and o.ends_at <= now() and o.status <> 'cancelled'
                and public.service_member_active(o.service_id, p_actor_id)
                and not exists (select 1 from public.teaching_attendance a where a.occurrence_id = o.id and a.user_id = p_actor_id)) as catch_up
            from public.teaching_resources r
            join public.teaching_occurrences o on o.id = r.occurrence_id or (r.occurrence_id is null and r.series_id = o.series_id)
            where r.removed_at is null
              and o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
              and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth')
              and case when public.service_member_active(o.service_id, p_actor_id)
                then public.teaching_occurrence_listed(o.id, p_actor_id, public.teaching_member_role(o.service_id, p_actor_id))
                else public.teaching_week_added(o.id, p_actor_id) and public.teaching_occurrence_open_to(o.id, p_actor_id) end
              and public.teaching_resource_visible(r.id, p_actor_id)
            group by r.id
          ) as w), '[]'::jsonb),
        'collections', coalesce((select jsonb_agg(jsonb_build_object(
            'collectionId', c.id, 'serviceId', c.service_id, 'name', c.name,
            'count', (select count(*) from public.teaching_resources r where r.collection_id = c.id and r.removed_at is null
              and public.teaching_resource_visible(r.id, p_actor_id)))
            order by c.sort_order, lower(c.name), c.id)
          from public.teaching_collections c
          where public.service_member_active(c.service_id, p_actor_id)), '[]'::jsonb),
        'recordingsCount', (select count(*) from public.teaching_resources r
          where r.kind = 'recording' and r.removed_at is null and public.teaching_resource_visible(r.id, p_actor_id)),
        'savedCount', (select count(*) from public.teaching_resource_saves v
          where v.user_id = p_actor_id and public.teaching_resource_visible(v.resource_id, p_actor_id))
      ) into v_result;
      return v_result;

    elsif p_action = 'collection.read' then
      v_id := public.teaching_uuid_arg(p_payload, 'collectionId');
      v_text := public.teaching_text_arg(p_payload, 'builtIn');
      if num_nonnulls(v_id, v_text) <> 1 or (v_text is not null and v_text not in ('recordings','saved')) then
        raise exception 'teaching_invalid_request';
      end if;
      if v_id is not null then
        select * into v_collection from public.teaching_collections where id = v_id;
        if not found or not public.service_member_active(v_collection.service_id, p_actor_id) then raise exception 'teaching_not_found'; end if;
        return jsonb_build_object(
          'collection', jsonb_build_object('collectionId', v_collection.id, 'serviceId', v_collection.service_id, 'name', v_collection.name),
          'sections', coalesce((select jsonb_agg(jsonb_build_object('sectionId', cs.id, 'name', cs.name, 'sortOrder', cs.sort_order)
              order by cs.sort_order, lower(cs.name), cs.id)
            from public.teaching_collection_sections cs where cs.collection_id = v_collection.id), '[]'::jsonb),
          'items', coalesce((select jsonb_agg(public.teaching_resource_row(r.id, p_actor_id) order by lower(r.title), r.id)
            from public.teaching_resources r where r.collection_id = v_collection.id and r.removed_at is null
              and public.teaching_resource_visible(r.id, p_actor_id)), '[]'::jsonb));
      elsif v_text = 'recordings' then
        return jsonb_build_object('collection', null, 'sections', '[]'::jsonb,
          'items', coalesce((select jsonb_agg(public.teaching_resource_row(x.id, p_actor_id) order by x.added_at desc, x.id)
            from (select r.id, r.added_at from public.teaching_resources r
              where r.kind = 'recording' and r.removed_at is null and public.teaching_resource_visible(r.id, p_actor_id)
              order by r.added_at desc, r.id limit 500) as x), '[]'::jsonb));
      end if;
      return jsonb_build_object('collection', null, 'sections', '[]'::jsonb,
        'items', coalesce((select jsonb_agg(public.teaching_resource_row(v.resource_id, p_actor_id) order by v.saved_at desc, v.resource_id)
          from public.teaching_resource_saves v
          where v.user_id = p_actor_id and public.teaching_resource_visible(v.resource_id, p_actor_id)), '[]'::jsonb));

    elsif p_action in ('resource_save.set','resource_save.unset') then
      v_id := public.teaching_uuid_arg(p_payload, 'resourceId');
      select * into v_resource from public.teaching_resources where id = v_id;
      if not found then raise exception 'teaching_not_found'; end if;
      v_host := v_resource.service_id;
      if p_action = 'resource_save.set' then
        if not public.teaching_resource_visible(v_resource.id, p_actor_id) then raise exception 'teaching_not_found'; end if;
        if (select count(*) from public.teaching_resource_saves where user_id = p_actor_id) >= 1000 then raise exception 'teaching_limit'; end if;
        insert into public.teaching_resource_saves(user_id, resource_id) values (p_actor_id, v_resource.id)
        on conflict (user_id, resource_id) do nothing;
      else
        delete from public.teaching_resource_saves where user_id = p_actor_id and resource_id = v_resource.id;
      end if;
      -- No actor: a bookmark is the viewer's own, and the host team never learns who saved.
      perform public.teaching_audit(v_host, null, p_action, v_resource.id);
      return jsonb_build_object('saved', p_action = 'resource_save.set');
    end if;
  end if;

  -- Team writes. Organisers and presenters in a verified or demo team; lock key 74818 only.
  if p_service_id is null or p_action not in ('resource.add','resource.remove','series.set_open_to','collection.save',
    'collection.section.save') then
    raise exception 'teaching_invalid_request';
  end if;
  select * into v_service from public.on_call_services where id = p_service_id for share;
  if not found then raise exception 'teaching_access_denied'; end if;
  v_role := public.teaching_member_role(p_service_id, p_actor_id);
  if v_role is null then raise exception 'teaching_access_denied'; end if;
  if not (v_service.verified_at is not null or v_service.is_demo) then raise exception 'teaching_team_unverified'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74818));

  if p_action = 'resource.add' then
    if jsonb_typeof(p_payload->'noPatientDetails') is distinct from 'boolean' or not (p_payload->>'noPatientDetails')::boolean then
      raise exception 'teaching_invalid_request';
    end if;
    v_text := btrim(coalesce(public.teaching_text_arg(p_payload, 'title'), ''));
    v_kind := public.teaching_text_arg(p_payload, 'kind');
    v_url := nullif(btrim(coalesce(public.teaching_text_arg(p_payload, 'url'), '')), '');
    v_doc := public.teaching_uuid_arg(p_payload, 'libraryDocumentId');
    v_collection_id := public.teaching_uuid_arg(p_payload, 'collectionId');
    v_section_id := public.teaching_uuid_arg(p_payload, 'sectionId');
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    v_series_id := public.teaching_uuid_arg(p_payload, 'seriesId');
    if char_length(v_text) not between 1 and 160
      or v_kind is null or v_kind not in ('slides','recording','reading','link','library')
      or (v_kind = 'library') <> (v_doc is not null)
      or (v_url is null) = (v_doc is null)
      or (v_url is not null and (char_length(v_url) > 2000 or v_url !~ '^https://[^/@[:space:]]+(/|$)'))
      or (v_section_id is not null and v_collection_id is null)
      or (v_id is not null and v_series_id is not null) then
      raise exception 'teaching_invalid_request';
    end if;
    -- An organiser adds anywhere. Anyone else adds only to a session or series they present, and
    -- never into a collection.
    if v_role <> 'organiser' then
      if v_collection_id is not null or num_nonnulls(v_id, v_series_id) = 0
        or (v_id is not null and not exists (select 1 from public.teaching_occurrences o
          where o.id = v_id and o.service_id = p_service_id and o.presenter_id = p_actor_id))
        or (v_series_id is not null and not exists (select 1 from public.teaching_series s
          where s.id = v_series_id and s.service_id = p_service_id and s.presenter_id = p_actor_id)) then
        raise exception 'teaching_role_denied';
      end if;
    end if;
    if (v_collection_id is not null and not exists (select 1 from public.teaching_collections c where c.id = v_collection_id and c.service_id = p_service_id))
      or (v_section_id is not null and not exists (select 1 from public.teaching_collection_sections cs where cs.id = v_section_id and cs.collection_id = v_collection_id))
      or (v_id is not null and not exists (select 1 from public.teaching_occurrences o where o.id = v_id and o.service_id = p_service_id))
      or (v_series_id is not null and not exists (select 1 from public.teaching_series s where s.id = v_series_id and s.service_id = p_service_id)) then
      raise exception 'teaching_not_found';
    end if;
    if (select count(*) from public.teaching_resources where service_id = p_service_id and removed_at is null) >= 5000 then
      raise exception 'teaching_limit';
    end if;
    insert into public.teaching_resources(service_id, title, kind, url, library_document_id, collection_id, section_id,
      occurrence_id, series_id, no_patient_details_confirmed_at, added_by)
    values (p_service_id, v_text, v_kind, v_url, v_doc, v_collection_id, v_section_id, v_id, v_series_id, now(), p_actor_id)
    returning id into v_id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'resource.add', v_id);
    return jsonb_build_object('resourceId', v_id);

  elsif p_action = 'resource.remove' then
    v_id := public.teaching_uuid_arg(p_payload, 'resourceId');
    select * into v_resource from public.teaching_resources
    where id = v_id and service_id = p_service_id and removed_at is null for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if not (v_role = 'organiser' or v_resource.added_by = p_actor_id) then raise exception 'teaching_role_denied'; end if;
    update public.teaching_resources set removed_at = now(), removed_by = p_actor_id where id = v_resource.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'resource.remove', v_resource.id);
    return '{}'::jsonb;

  elsif p_action = 'series.set_open_to' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_series_id := public.teaching_uuid_arg(p_payload, 'seriesId');
    v_text := public.teaching_text_arg(p_payload, 'openTo');
    if v_series_id is null or v_text is null or v_text not in ('team','health_service') then raise exception 'teaching_invalid_request'; end if;
    select * into v_series from public.teaching_series where id = v_series_id and service_id = p_service_id for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_text = 'health_service' and not exists (select 1 from public.teaching_team_settings ts where ts.service_id = p_service_id) then
      raise exception 'teaching_no_health_service';
    end if;
    update public.teaching_series set open_to = v_text, updated_at = now() where id = v_series.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'series.set_open_to', v_series.id);
    return jsonb_build_object('seriesId', v_series.id, 'openTo', v_text);

  elsif p_action = 'collection.save' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_id := public.teaching_uuid_arg(p_payload, 'collectionId');
    v_text := btrim(coalesce(public.teaching_text_arg(p_payload, 'name'), ''));
    v_sort := coalesce(public.teaching_int_arg(p_payload, 'sortOrder'), 0);
    if char_length(v_text) not between 1 and 80 or v_sort not between 0 and 999 then raise exception 'teaching_invalid_request'; end if;
    if v_id is null then
      if (select count(*) from public.teaching_collections where service_id = p_service_id) >= 100 then raise exception 'teaching_limit'; end if;
      insert into public.teaching_collections(service_id, name, sort_order, created_by)
      values (p_service_id, v_text, v_sort, p_actor_id) returning id into v_id;
    else
      update public.teaching_collections set name = v_text, sort_order = v_sort where id = v_id and service_id = p_service_id;
      if not found then raise exception 'teaching_not_found'; end if;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'collection.save', v_id);
    return jsonb_build_object('collectionId', v_id);

  elsif p_action = 'collection.section.save' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_collection_id := public.teaching_uuid_arg(p_payload, 'collectionId');
    v_id := public.teaching_uuid_arg(p_payload, 'sectionId');
    v_text := btrim(coalesce(public.teaching_text_arg(p_payload, 'name'), ''));
    v_sort := coalesce(public.teaching_int_arg(p_payload, 'sortOrder'), 0);
    if char_length(v_text) not between 1 and 80 or v_sort not between 0 and 999 then raise exception 'teaching_invalid_request'; end if;
    if v_collection_id is null or not exists (select 1 from public.teaching_collections c where c.id = v_collection_id and c.service_id = p_service_id) then
      raise exception 'teaching_not_found';
    end if;
    if v_id is null then
      if (select count(*) from public.teaching_collection_sections where collection_id = v_collection_id) >= 50 then raise exception 'teaching_limit'; end if;
      insert into public.teaching_collection_sections(collection_id, service_id, name, sort_order)
      values (v_collection_id, p_service_id, v_text, v_sort) returning id into v_id;
    else
      update public.teaching_collection_sections set name = v_text, sort_order = v_sort where id = v_id and collection_id = v_collection_id;
      if not found then raise exception 'teaching_not_found'; end if;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'collection.section.save', v_id);
    return jsonb_build_object('sectionId', v_id);
  end if;

  raise exception 'teaching_invalid_request';
end $$;

-- Platform only. The owner-panel route calls this after its platform-owner check, exactly as for
-- on_call_services.verified_at; no team route reaches it. demo only for a demo team, and a real
-- health service only for a verified, non-demo team, so real teams are never shown to demo teams.
create function public.teaching_platform_command(p_platform_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_code text;
begin
  if p_service_id is null or p_action is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'teaching_invalid_request';
  end if;
  select * into v_service from public.on_call_services where id = p_service_id for share;
  if not found then raise exception 'teaching_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74818));

  if p_action = 'team_settings.set_health_service' then
    if not (p_payload ? 'healthService') then raise exception 'teaching_invalid_request'; end if;
    v_code := public.teaching_text_arg(p_payload, 'healthService');
    if v_code is null then
      delete from public.teaching_team_settings where service_id = p_service_id;
    else
      if v_code not in ('nmhs','smhs','emhs','wachs','cahs','demo') then raise exception 'teaching_invalid_request'; end if;
      if (v_code = 'demo') <> v_service.is_demo or (v_code <> 'demo' and v_service.verified_at is null) then
        raise exception 'teaching_invalid_request';
      end if;
      insert into public.teaching_team_settings(service_id, health_service, set_by)
      values (p_service_id, v_code, p_platform_actor_id)
      on conflict (service_id) do update set health_service = excluded.health_service, set_by = excluded.set_by, set_at = now();
    end if;
    -- No actor: the platform owner is not a member of the team. set_by records who.
    perform public.teaching_audit(p_service_id, null, 'team_settings.set_health_service', null);
    return jsonb_build_object('healthService', v_code);
  end if;

  raise exception 'teaching_invalid_request';
end $$;

revoke all on function public.teaching_slides_released(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_slides_released(uuid, uuid) to service_role;
revoke all on function public.teaching_resource_visible(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_resource_visible(uuid, uuid) to service_role;
revoke all on function public.teaching_resource_row(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teaching_resource_row(uuid, uuid) to service_role;
revoke all on function public.teaching_whats_on_command(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_whats_on_command(uuid, uuid, text, jsonb) to service_role;
revoke all on function public.teaching_platform_command(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_platform_command(uuid, uuid, text, jsonb) to service_role;

-- CPD handoff key. One CPD activity per attended session per person; a hard-deleted activity
-- frees the key, so the session can be logged again.
alter table public.cme_entries add column source_ref text;
alter table public.cme_entries add constraint cme_entries_source_ref_format
  check (source_ref is null or source_ref ~ '^teaching:[0-9a-f-]{36}$');
create unique index cme_entries_owner_source_ref on public.cme_entries(owner_id, source_ref) where source_ref is not null;

-- One attended session -> one CPD activity, owned by the doctor. Takes the same owner lock as
-- every CPD writer, needs an attendance row and an open CPD year for the session's Perth date,
-- restores an archived activity instead of making a second one, and is idempotent by request id
-- and by source_ref. It writes nothing into any Teaching table: no audit row, no CPD title,
-- hours or reflection ever reach a service-visible record.
create function public.cme_save_teaching_entry(p_owner_id uuid, p_occurrence_id uuid, p_hours numeric, p_request_id uuid) returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_occ public.teaching_occurrences;
  v_year public.cme_years;
  v_entry public.cme_entries;
  v_date date;
  v_hours numeric(5,2);
  v_ref text;
begin
  if p_owner_id is null or p_occurrence_id is null or p_hours is null or p_request_id is null then
    raise exception 'teaching_invalid_request';
  end if;
  v_hours := round(p_hours * 4) / 4;
  if v_hours < 0.25 or v_hours > 8 then raise exception 'teaching_invalid_request'; end if;
  v_ref := 'teaching:' || p_occurrence_id::text;
  perform pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 23092026));

  select * into v_entry from public.cme_entries where owner_id = p_owner_id and request_id = p_request_id;
  if found then
    if v_entry.source_ref is distinct from v_ref then raise exception 'teaching_invalid_request'; end if;
    return jsonb_build_object('entryId', v_entry.id, 'created', false);
  end if;

  select o.* into v_occ from public.teaching_occurrences o
  join public.teaching_attendance a on a.occurrence_id = o.id and a.user_id = p_owner_id
  where o.id = p_occurrence_id;
  if not found then raise exception 'teaching_not_attended'; end if;
  if v_occ.ends_at > now() then raise exception 'teaching_window_closed'; end if;

  v_date := (v_occ.starts_at at time zone 'Australia/Perth')::date;
  select * into v_year from public.cme_years
  where owner_id = p_owner_id and year = extract(year from v_date)::smallint for update;
  if not found then raise exception 'cme_year_missing'; end if;
  if v_year.closed_at is not null then raise exception 'cme_year_closed'; end if;

  select * into v_entry from public.cme_entries where owner_id = p_owner_id and source_ref = v_ref for update;
  if found then
    if v_entry.archived_at is not null then
      update public.cme_entries set archived_at = null where owner_id = p_owner_id and id = v_entry.id;
    end if;
    return jsonb_build_object('entryId', v_entry.id, 'created', false);
  end if;

  insert into public.cme_entries(owner_id, year_id, activity_date, title, reflection, buckets, request_id, request_payload, source_ref)
  values (p_owner_id, v_year.id, v_date, v_occ.title, '', '{}', p_request_id,
    jsonb_build_object('source', 'teaching', 'occurrenceId', p_occurrence_id, 'hours', v_hours), v_ref)
  returning * into v_entry;
  insert into public.cme_allocations(owner_id, entry_id, category, hours)
  values (p_owner_id, v_entry.id, 'educational', v_hours);
  return jsonb_build_object('entryId', v_entry.id, 'created', true);
end $$;

revoke all on function public.cme_save_teaching_entry(uuid, uuid, numeric, uuid) from public, anon, authenticated;
grant execute on function public.cme_save_teaching_entry(uuid, uuid, numeric, uuid) to service_role;
