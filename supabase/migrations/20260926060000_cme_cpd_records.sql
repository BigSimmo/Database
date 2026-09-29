-- CPD records: trainee timeline, missed teaching, and saved drafts.
--
-- Four new tables, nothing changed in an existing one. None is tied to a CPD year, and none is
-- read by the requirement evaluation, year close, the export or the annual summary: nothing
-- here can add hours or change a requirement status. A missed session earns no credit; its
-- replacement is an ordinary activity in `cme_entries`, logged through the normal save path.
--
-- Same tenancy as every other CME table: RLS on, no grant to anon/authenticated, service_role
-- only, owner predicate in application code.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- A trainee's own record of their stages, rotations and breaks. Not the college's record.
create table public.cme_training_periods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('stage', 'rotation', 'break')),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  starts_on date not null,
  ends_on date check (ends_on is null or ends_on >= starts_on),
  fte numeric(3, 2) not null default 1 check (fte between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cme_training_periods_id_owner_key unique (id, owner_id),
  constraint cme_training_periods_fte_kind_check check (
    (kind = 'break' and fte = 0) or (kind = 'rotation' and fte > 0) or kind = 'stage'
  )
);
create index cme_training_periods_owner_idx on public.cme_training_periods (owner_id, starts_on);

create table public.cme_training_milestones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 3 and 200),
  due_kind text not null check (due_kind in ('fte-months', 'date')),
  due_fte_months numeric(5, 2) check (due_fte_months is null or due_fte_months between 0 and 600),
  due_on date,
  completed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cme_training_milestones_id_owner_key unique (id, owner_id),
  constraint cme_training_milestones_due_check check (
    (due_kind = 'fte-months' and due_fte_months is not null and due_on is null)
    or (due_kind = 'date' and due_on is not null and due_fte_months is null)
  )
);
create index cme_training_milestones_owner_idx on public.cme_training_milestones (owner_id);

-- A teaching or supervision session lost to clinical work. It never counts toward hours; the
-- session that replaced it is an ordinary activity linked here. Deleting that activity clears
-- only the link, never the record of the missed session.
create table public.cme_missed_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  occurred_on date not null,
  kind text not null check (kind in ('teaching', 'supervision')),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  minutes_lost integer not null check (minutes_lost between 1 and 600),
  reason text check (reason is null or char_length(reason) <= 200),
  replacement_entry_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cme_missed_sessions_id_owner_key unique (id, owner_id),
  constraint cme_missed_sessions_replacement_owner_fk foreign key (replacement_entry_id, owner_id)
    references public.cme_entries (id, owner_id) on delete set null (replacement_entry_id)
);
create index cme_missed_sessions_owner_idx on public.cme_missed_sessions (owner_id, occurred_on desc);
create index cme_missed_sessions_replacement_idx on public.cme_missed_sessions (replacement_entry_id)
  where replacement_entry_id is not null;

-- A half-finished activity saved to the account. It is only the form's own fields; it never
-- counts toward hours, and "waiting on" someone never turns into approved by itself.
create table public.cme_entry_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 16384),
  waiting_on text check (waiting_on is null or waiting_on in ('supervisor', 'workforce')),
  waiting_note text check (waiting_note is null or char_length(waiting_note) <= 200),
  follow_up_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cme_entry_drafts_id_owner_key unique (id, owner_id)
);
create index cme_entry_drafts_owner_idx on public.cme_entry_drafts (owner_id, updated_at desc);

do $$
declare
  t text;
begin
  foreach t in array array['cme_training_periods', 'cme_training_milestones', 'cme_missed_sessions', 'cme_entry_drafts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
    execute format(
      'create policy "%s service role all" on public.%I for all to service_role using (true) with check (true)',
      t, t
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      t || '_updated_at', t
    );
  end loop;
end
$$;
