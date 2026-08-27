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

rollback;

\echo 'PASS site-content invocation state-machine fixture'
