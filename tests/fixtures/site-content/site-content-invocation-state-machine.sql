\set ON_ERROR_STOP on

begin;

create temporary table task4_invocation_results (
  case_name text primary key,
  result boolean not null
);
grant select, insert on task4_invocation_results to service_role;

set local role service_role;
insert into task4_invocation_results values (
  'started-null-outcome',
  public.record_site_content_sync_worker_invocation(
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'started',
    null
  )
);
reset role;

create temporary table task4_invocation_before as
select * from public.site_content_sync_worker_invocations
where invocation_id = '22222222-2222-4222-8222-222222222222'::uuid;

set local role service_role;
insert into task4_invocation_results values
  (
    'null-phase',
    public.record_site_content_sync_worker_invocation(
      '11111111-1111-4111-8111-111111111111'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      p_phase => null,
      p_outcome_code => null
    )
  ),
  (
    'succeeded-null-outcome',
    public.record_site_content_sync_worker_invocation(
      '11111111-1111-4111-8111-111111111111'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      p_phase => 'succeeded',
      p_outcome_code => null
    )
  ),
  (
    'failed-null-outcome',
    public.record_site_content_sync_worker_invocation(
      '11111111-1111-4111-8111-111111111111'::uuid,
      '22222222-2222-4222-8222-222222222222'::uuid,
      p_phase => 'failed',
      p_outcome_code => null
    )
  );
reset role;

do $$
begin
  if (select result from task4_invocation_results where case_name = 'started-null-outcome') is distinct from true then
    raise exception 'started with null outcome was not admitted';
  end if;
  if exists (
    select 1 from task4_invocation_results
    where case_name <> 'started-null-outcome' and result is distinct from false
  ) then
    raise exception 'nullable terminal input did not return false';
  end if;
  if exists (
    select 1
    from public.site_content_sync_worker_invocations current
    full join task4_invocation_before before using (invocation_id)
    where row(current.*) is distinct from row(before.*)
  ) then
    raise exception 'nullable invocation input changed durable evidence';
  end if;
  if exists (
    select 1 from public.site_content_sync_worker_invocations
    where invocation_id = '22222222-2222-4222-8222-222222222222'::uuid
      and (terminal_phase is not null or terminal_at is not null or outcome_code is not null)
  ) then
    raise exception 'nullable terminal input caused a terminal transition';
  end if;
end;
$$;

set local role service_role;
do $$
begin
  begin
    perform count(*) from public.site_content_sync_worker_invocations;
    raise exception 'service_role unexpectedly bypassed forced RLS table denial';
  exception
    when insufficient_privilege then null;
  end;
  if public.read_site_content_health() is null then
    raise exception 'service_role health RPC returned null';
  end if;
end;
$$;
reset role;

set local role service_role;
insert into task4_invocation_results values (
  'terminal-success-before-history',
  public.record_site_content_sync_worker_invocation(
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid,
    'succeeded',
    'idle'
  )
);
reset role;

with historical as (
  select
    pg_catalog.gen_random_uuid() invocation_id,
    pg_catalog.gen_random_uuid() worker_id,
    pg_catalog.clock_timestamp() - (g * interval '1 second') started_at,
    g
  from generate_series(1, 4096) g
)
insert into public.site_content_sync_worker_invocations (
  invocation_id,
  worker_id,
  started_at,
  admission_expires_at,
  terminal_phase,
  terminal_at,
  outcome_code
)
select
  invocation_id,
  worker_id,
  started_at,
  started_at + interval '5 minutes',
  'succeeded',
  started_at + interval '100 milliseconds',
  case when g % 2 = 0 then 'idle' else 'ready' end
from historical;

do $$
declare
  v_health jsonb;
  v_latest_plan json;
  v_success_plan json;
begin
  v_health := public.read_site_content_health();
  if (v_health->>'synchronizerSeen')::boolean is distinct from true
    or (v_health->>'latestInvocationSucceeded')::boolean is distinct from true
    or v_health->'lastInvocationAt' = 'null'::jsonb
    or v_health->'lastSuccessfulInvocationAt' = 'null'::jsonb
  then
    raise exception 'populated invocation history did not produce successful health evidence: %', v_health;
  end if;

  perform pg_catalog.set_config('enable_seqscan', 'off', true);
  execute $plan$
    explain (format json)
    select i.* from public.site_content_sync_worker_invocations i
    order by i.started_at desc, i.invocation_id desc limit 1
  $plan$ into v_latest_plan;
  execute $plan$
    explain (format json)
    select max(terminal_at) from public.site_content_sync_worker_invocations
    where terminal_phase = 'succeeded' and outcome_code in ('idle','ready')
  $plan$ into v_success_plan;

  if v_latest_plan::text not like '%site_content_sync_worker_invocations_started_at_idx%' then
    raise exception 'latest invocation query did not use its supporting index: %', v_latest_plan;
  end if;
  if v_success_plan::text not like '%site_content_sync_worker_invocations_successful_terminal_at_idx%' then
    raise exception 'successful terminal query did not use its supporting partial index: %', v_success_plan;
  end if;
end;
$$;

rollback;

create table public.task4_invocation_concurrency_results (
  case_name text primary key,
  result boolean not null,
  observed_terminal_phase text,
  observed_outcome_code text
);
grant insert on public.task4_invocation_concurrency_results to service_role;

insert into public.site_content_sync_worker_invocations (
  invocation_id, worker_id, started_at, admission_expires_at
)
select
  '30000000-0000-4000-8000-000000000001'::uuid,
  '30000000-0000-4000-8000-000000000002'::uuid,
  sampled.now - interval '4 minutes 55 seconds',
  sampled.now + interval '5 seconds'
from (select pg_catalog.clock_timestamp() as now) sampled;

begin;
select pg_catalog.pg_advisory_xact_lock(93206432);
\! psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "set role service_role; insert into public.task4_invocation_concurrency_results(case_name, result) select 'retry-after-lock-expiry', public.record_site_content_sync_worker_invocation('30000000-0000-4000-8000-000000000002'::uuid, '30000000-0000-4000-8000-000000000001'::uuid, 'started', null);" >/tmp/task4-invocation-retry.log 2>&1 &
do $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '10 seconds';
begin
  while not exists (select 1 from pg_catalog.pg_locks where locktype = 'advisory' and not granted) loop
    if pg_catalog.clock_timestamp() >= v_deadline then
      raise exception 'retry session did not wait on the advisory lock';
    end if;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
end;
$$;
select pg_catalog.pg_sleep(
  greatest(
    0,
    extract(epoch from (
      (select admission_expires_at from public.site_content_sync_worker_invocations
       where invocation_id = '30000000-0000-4000-8000-000000000001'::uuid)
      - pg_catalog.clock_timestamp()
    ))
  ) + 0.25
);
commit;

do $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '10 seconds';
begin
  while not exists (
    select 1 from public.task4_invocation_concurrency_results where case_name = 'retry-after-lock-expiry'
  ) loop
    if pg_catalog.clock_timestamp() >= v_deadline then
      raise exception 'retry session did not publish its result';
    end if;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
end;
$$;

update public.task4_invocation_concurrency_results result
set observed_terminal_phase = invocation.terminal_phase,
  observed_outcome_code = invocation.outcome_code
from public.site_content_sync_worker_invocations invocation
where result.case_name = 'retry-after-lock-expiry'
  and invocation.invocation_id = '30000000-0000-4000-8000-000000000001'::uuid;

update public.site_content_sync_worker_invocations
set terminal_phase = 'failed',
  terminal_at = pg_catalog.clock_timestamp(),
  outcome_code = 'invocation_expired'
where invocation_id = '30000000-0000-4000-8000-000000000001'::uuid
  and terminal_phase is null;

insert into public.site_content_sync_worker_invocations (
  invocation_id, worker_id, started_at, admission_expires_at
)
select
  '30000000-0000-4000-8000-000000000003'::uuid,
  '30000000-0000-4000-8000-000000000004'::uuid,
  sampled.now - interval '4 minutes 55 seconds',
  sampled.now + interval '5 seconds'
from (select pg_catalog.clock_timestamp() as now) sampled;

begin;
select pg_catalog.pg_advisory_xact_lock(93206432);
\! psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "set role service_role; insert into public.task4_invocation_concurrency_results(case_name, result) select 'terminal-after-lock-expiry', public.record_site_content_sync_worker_invocation('30000000-0000-4000-8000-000000000004'::uuid, '30000000-0000-4000-8000-000000000003'::uuid, 'succeeded', 'ready');" >/tmp/task4-invocation-terminal.log 2>&1 &
do $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '10 seconds';
begin
  while not exists (select 1 from pg_catalog.pg_locks where locktype = 'advisory' and not granted) loop
    if pg_catalog.clock_timestamp() >= v_deadline then
      raise exception 'terminal session did not wait on the advisory lock';
    end if;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
end;
$$;
select pg_catalog.pg_sleep(
  greatest(
    0,
    extract(epoch from (
      (select admission_expires_at from public.site_content_sync_worker_invocations
       where invocation_id = '30000000-0000-4000-8000-000000000003'::uuid)
      - pg_catalog.clock_timestamp()
    ))
  ) + 0.25
);
commit;

do $$
declare
  v_deadline timestamptz := pg_catalog.clock_timestamp() + interval '10 seconds';
begin
  while not exists (
    select 1 from public.task4_invocation_concurrency_results where case_name = 'terminal-after-lock-expiry'
  ) loop
    if pg_catalog.clock_timestamp() >= v_deadline then
      raise exception 'terminal session did not publish its result';
    end if;
    perform pg_catalog.pg_sleep(0.05);
  end loop;
end;
$$;

update public.task4_invocation_concurrency_results result
set observed_terminal_phase = invocation.terminal_phase,
  observed_outcome_code = invocation.outcome_code
from public.site_content_sync_worker_invocations invocation
where result.case_name = 'terminal-after-lock-expiry'
  and invocation.invocation_id = '30000000-0000-4000-8000-000000000003'::uuid;

do $$
begin
  if exists (
    select 1 from public.task4_invocation_concurrency_results
    where result is distinct from false
      or observed_terminal_phase is distinct from 'failed'
      or observed_outcome_code is distinct from 'invocation_expired'
  ) then
    raise exception 'serialized expiry admitted a waiting retry/terminal call: %',
      (select jsonb_agg(to_jsonb(result) order by case_name) from public.task4_invocation_concurrency_results result);
  end if;
end;
$$;

drop table public.task4_invocation_concurrency_results;

\echo 'PASS site-content invocation state-machine fixture'
