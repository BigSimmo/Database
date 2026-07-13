create table if not exists public.rag_answer_feedback (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique,
  owner_id uuid references auth.users(id) on delete set null,
  feedback_category text not null check (feedback_category in (
    'verified', 'needs_correction', 'source_insufficient', 'wrong_source',
    'missing_source', 'unsupported_answer', 'numeric_error', 'outdated_guidance'
  )),
  answer_hash text not null,
  cited_source_ids uuid[] not null default '{}',
  source_ids uuid[] not null default '{}',
  route text,
  model text,
  provider_request_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists rag_answer_feedback_owner_id_idx
  on public.rag_answer_feedback (owner_id);

alter table public.rag_answer_feedback enable row level security;
revoke all on table public.rag_answer_feedback from anon, authenticated;
grant select, insert, delete on table public.rag_answer_feedback to service_role;
drop policy if exists "rag answer feedback service role" on public.rag_answer_feedback;
create policy "rag answer feedback service role"
  on public.rag_answer_feedback for all to service_role using (true) with check (true);

create or replace function public.purge_expired_rag_response_cache(p_limit integer default 1000)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_deleted integer;
begin
  if p_limit < 1 or p_limit > 10000 then raise exception 'purge limit must be between 1 and 10000'; end if;
  with expired as (
    select id from public.rag_response_cache where expires_at <= now() order by expires_at asc limit p_limit
  )
  delete from public.rag_response_cache cache using expired where cache.id = expired.id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_rag_response_cache(integer) from public, anon, authenticated;
grant execute on function public.purge_expired_rag_response_cache(integer) to service_role;

do $cron$
begin
  if to_regnamespace('cron') is null then return; end if;
  perform cron.unschedule(j.jobid) from cron.job j where j.jobname = 'purge-rag-response-cache';
  perform cron.schedule(
    'purge-rag-response-cache',
    '15 * * * *',
    $job$select public.purge_expired_rag_response_cache(1000);$job$
  );
end
$cron$;
