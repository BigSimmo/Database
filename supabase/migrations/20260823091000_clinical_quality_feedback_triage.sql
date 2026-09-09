-- Administrator-managed workflow metadata for privacy-safe clinical quality triage.
-- The table deliberately contains no query, answer, excerpt, or patient text.
create table if not exists public.clinical_quality_feedback_triage (
  signal_type text not null,
  signal_id uuid not null,
  status text not null default 'untriaged',
  owner_role text not null default 'unassigned',
  owner_user_id uuid references auth.users(id) on delete set null,
  resolution_code text,
  retest_reference text not null default '',
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (signal_type, signal_id),
  constraint clinical_quality_feedback_triage_signal_type_check
    check (signal_type in ('answer_feedback', 'unsupported_claim', 'source_conflict', 'retrieval_failure', 'evaluation_failure')),
  constraint clinical_quality_feedback_triage_status_check
    check (status in ('untriaged', 'in_review', 'awaiting_retest', 'resolved', 'dismissed')),
  constraint clinical_quality_feedback_triage_owner_role_check
    check (owner_role in ('clinical_governance', 'content_owner', 'engineering', 'privacy', 'unassigned')),
  constraint clinical_quality_feedback_triage_resolution_check
    check (resolution_code is null or resolution_code in ('content_corrected', 'source_updated', 'retrieval_retested', 'not_reproducible', 'expected_behaviour', 'duplicate', 'not_applicable')),
  constraint clinical_quality_feedback_triage_retest_check
    check (char_length(retest_reference) <= 120),
  constraint clinical_quality_feedback_triage_terminal_check
    check (status <> 'resolved' or resolution_code is not null),
  constraint clinical_quality_feedback_triage_awaiting_retest_check
    check (status <> 'awaiting_retest' or char_length(btrim(retest_reference)) > 0)
);

create table if not exists public.clinical_quality_feedback_triage_events (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null,
  signal_id uuid not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null,
  owner_role text not null,
  owner_user_id uuid references auth.users(id) on delete set null,
  resolution_code text,
  retest_reference text not null default '',
  created_at timestamptz not null default now(),
  constraint clinical_quality_feedback_triage_events_signal_type_check
    check (signal_type in ('answer_feedback', 'unsupported_claim', 'source_conflict', 'retrieval_failure', 'evaluation_failure')),
  constraint clinical_quality_feedback_triage_events_status_check
    check (status in ('untriaged', 'in_review', 'awaiting_retest', 'resolved', 'dismissed')),
  constraint clinical_quality_feedback_triage_events_owner_role_check
    check (owner_role in ('clinical_governance', 'content_owner', 'engineering', 'privacy', 'unassigned')),
  constraint clinical_quality_feedback_triage_events_resolution_check
    check (resolution_code is null or resolution_code in ('content_corrected', 'source_updated', 'retrieval_retested', 'not_reproducible', 'expected_behaviour', 'duplicate', 'not_applicable')),
  constraint clinical_quality_feedback_triage_events_retest_check
    check (char_length(retest_reference) <= 120),
  constraint clinical_quality_feedback_triage_events_terminal_check
    check (status <> 'resolved' or resolution_code is not null),
  constraint clinical_quality_feedback_triage_events_awaiting_retest_check
    check (status <> 'awaiting_retest' or char_length(btrim(retest_reference)) > 0)
);

create index if not exists clinical_quality_feedback_triage_work_queue_idx
  on public.clinical_quality_feedback_triage (status, owner_role, updated_at desc);
create index if not exists clinical_quality_feedback_triage_events_signal_created_idx
  on public.clinical_quality_feedback_triage_events (signal_type, signal_id, created_at desc, id desc);

alter table public.clinical_quality_feedback_triage enable row level security;
alter table public.clinical_quality_feedback_triage_events enable row level security;
revoke all on table public.clinical_quality_feedback_triage from public, anon, authenticated;
revoke all on table public.clinical_quality_feedback_triage_events from public, anon, authenticated;
grant select on table public.clinical_quality_feedback_triage to service_role;
grant select on table public.clinical_quality_feedback_triage_events to service_role;

comment on table public.clinical_quality_feedback_triage is
  'Service-role-only current workflow state for privacy-safe clinical quality signals.';
comment on table public.clinical_quality_feedback_triage_events is
  'Append-only actor-attributed history for clinical quality signal triage.';

create or replace function public.record_clinical_quality_feedback_triage(
  p_actor_user_id uuid,
  p_signal_type text,
  p_signal_id uuid,
  p_status text,
  p_owner_role text,
  p_owner_user_id uuid,
  p_resolution_code text,
  p_retest_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.clinical_quality_feedback_triage;
begin
  insert into public.clinical_quality_feedback_triage (
    signal_type,
    signal_id,
    status,
    owner_role,
    owner_user_id,
    resolution_code,
    retest_reference,
    updated_by,
    updated_at,
    resolved_at
  ) values (
    p_signal_type,
    p_signal_id,
    p_status,
    p_owner_role,
    p_owner_user_id,
    p_resolution_code,
    coalesce(p_retest_reference, ''),
    p_actor_user_id,
    now(),
    case when p_status = 'resolved' then now() else null end
  )
  on conflict (signal_type, signal_id) do update set
    status = excluded.status,
    owner_role = excluded.owner_role,
    owner_user_id = excluded.owner_user_id,
    resolution_code = excluded.resolution_code,
    retest_reference = excluded.retest_reference,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at,
    resolved_at = excluded.resolved_at
  returning * into v_state;

  insert into public.clinical_quality_feedback_triage_events (
    signal_type,
    signal_id,
    actor_user_id,
    status,
    owner_role,
    owner_user_id,
    resolution_code,
    retest_reference
  ) values (
    p_signal_type,
    p_signal_id,
    p_actor_user_id,
    p_status,
    p_owner_role,
    p_owner_user_id,
    p_resolution_code,
    coalesce(p_retest_reference, '')
  );

  return to_jsonb(v_state);
end;
$$;

revoke all on function public.record_clinical_quality_feedback_triage(uuid, text, uuid, text, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.record_clinical_quality_feedback_triage(uuid, text, uuid, text, text, uuid, text, text)
  to service_role;
