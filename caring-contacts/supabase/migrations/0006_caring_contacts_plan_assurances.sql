-- caring-contacts/supabase/migrations/0006_caring_contacts_plan_assurances.sql
--
-- Keep the coordinator's stage-1 confirmations as an attestation on the plan.
--
-- THIS DIRECTORY IS NOT THE REPOSITORY'S `supabase/migrations/`. That directory replays against the
-- live Clinical KB project and merging to `main` applies it there automatically; nothing here may
-- ever be placed in it, and both tests/caring-contacts-domain-isolation.test.ts and
-- tests/caring-contacts-migrations.test.ts fail if a caring-contact migration appears there.
--
-- WHAT THIS TABLE HOLDS: AN ATTESTATION THAT A CHECK HAPPENED. A row says WHO confirmed, WHAT they
-- confirmed and WHEN. Nothing else. Before this migration an activated plan carried no evidence
-- that anyone had confirmed the patient agreed to receive the messages -- the confirmations were
-- collected on screen, held in a browser tab, and dropped when the sign-up finished.
--
-- WHAT IT IS NOT: A CONSENT RECORD. This system is not where consent lives. The approved design
-- sources the agreement row as "Imported source record--not legal or treatment consent": the
-- hospital record holds what the patient agreed to, and the coordinator is confirming they checked
-- it. A row here supports "a coordinator confirmed the patient's agreement before this plan was
-- created" and CANNOT support "the patient consented". Anything reading this table must keep that
-- distinction; see src/lib/caring-contacts/assurances.ts, which carries it in the type names.
--
-- WHY A TABLE RATHER THAN TWO COLUMNS ON `plans` (Ruling [122]). The assurance set is not frozen --
-- the approved design shows five rows, some confirmations and the rest display -- so a fixed pair of
-- columns needs a migration the first time a third confirmation is added. A row per confirmation
-- needs a value in a check constraint. It also gives the actor and the instant somewhere they can
-- be typed, which an array column on the plan would not.
--
-- RETENTION MUST NOT CLEAR THIS TABLE, AND THAT INVERTS THE RULE 0005 INSTALLED. 0005's
-- `first_contact_reason` is cleared by `markRetentionCleared` because it is prose a clinician typed
-- about this patient. Apply the same test -- judge by what the value CONTAINS -- and an attestation
-- comes out the other way: a closed enum value, an actor id and an instant, with no patient content
-- at all. That is the same class as an audit event, which de-identification deliberately PRESERVES
-- (it removes patient fields and keeps actor, action, timestamp and object type). Clearing these
-- rows would destroy the evidence that a check happened while keeping the plan it belongs to, which
-- is the opposite of what retention is for. `markRetentionCleared` names its columns and this table
-- is not among them; the obligation is recorded on the table below so it travels with the schema,
-- and the shared contract suite asserts it in BOTH directions -- the attestation survives a
-- clearance, and the clearance still removes everything it is supposed to.
--
-- IF A FUTURE COLUMN HERE CARRIES FREE TEXT -- a note on what was checked -- THE RULE ABOVE FLIPS
-- FOR THAT COLUMN, because such a note would name patients, relatives and places exactly as 0005's
-- reason does. Do not add one without taking that decision; the domain type carries a compile-time
-- guard against a fourth field for the same reason.
--
-- WHAT IS DELIBERATELY NOT HERE:
--
--   * NO BACKFILL, AND NO DEFAULT ROW. Plans created before this migration hold no attestation and
--     keep none. That absence is a fact the interface states as its own, exactly as 0005's null
--     reason is. Writing a placeholder attestation would fabricate a clinical record -- a row
--     claiming somebody confirmed something, indistinguishable from one a coordinator really made.
--
--   * NO DEFAULT ON `attested_at`. A `default now()` would let a write that forgot the instant look
--     like one that recorded it. The instant comes from the domain clock, in the store, beside the
--     actor it is recorded with.
--
--   * NO UPDATE PATH. Nothing in the repository contract amends an attestation; it is written once,
--     inside the transaction that creates the plan, and read afterwards. The audit guard attached
--     below still covers UPDATE and DELETE, so a change made another way is refused unless it is
--     audited.
--
-- WHY THE FOREIGN KEY IS COMPOSITE. The same reason 0003 gives for `plan_assignments`: a bare
-- `plan_id references plans (id)` would accept a row written by TEAM-SOUTH against TEAM-NORTH's plan
-- while claiming `team_id = 'TEAM-SOUTH'`, because foreign-key checks bypass row-level security and
-- the policy's WITH CHECK validates only the team the writer CLAIMED. The row would then be visible
-- to the wrong team and invisible to the right one.
--
-- Transactional: one `begin`/`commit`, no `CREATE INDEX CONCURRENTLY`.
--
-- Replay-safe: `create table if not exists`, `create index if not exists`, and the policy loop drops
-- before it creates. The suites drop the schema and replay every migration from empty, so this file
-- is proved from nothing rather than only against an existing local database.

begin;

create table if not exists caring_contacts.plan_assurances (
  plan_id text not null,
  team_id text not null references caring_contacts.teams (id),
  -- The closed set. Keep these values equal to PLAN_ASSURANCES in
  -- src/lib/caring-contacts/assurances.ts; tests/caring-contacts-migrations.test.ts fails if the
  -- two ever disagree. A closed value gets an explicit check rather than a free-text column, so a
  -- write that bypassed the domain cannot invent an assurance nobody has defined.
  assurance text not null check (
    assurance in ('patient-agreement-confirmed', 'patient-controls-mobile-confirmed')
  ),
  -- Who confirmed. Not null: an attestation that cannot say who made it is not evidence of
  -- anything, and an anonymous row would be worse than an absent one because it looks like proof.
  actor_id text not null,
  -- When. Not null, and undefaulted -- see the header.
  attested_at timestamptz not null,
  -- One row per assurance per plan. A repeat is refused by the domain BY NAME
  -- (`plan-assurance-repeated`) before it reaches here; this key is what stops a second route
  -- writing the same confirmation twice and making one check look like two.
  primary key (plan_id, assurance),
  constraint plan_assurances_plan_fk
    foreign key (plan_id, team_id) references caring_contacts.plans (id, team_id) on delete cascade
);

create index if not exists plan_assurances_plan_id_idx on caring_contacts.plan_assurances (plan_id);

comment on table caring_contacts.plan_assurances is
  'Attestation that a coordinator confirmed a check before the plan was created: who, what, when. Not a consent record. Deliberately NOT cleared by markRetentionCleared -- it holds no patient content and is preserved for the same reason an audit event is.';

-- ---------------------------------------------------------------------------
-- Privileges
--
-- 0002's `grant ... on all tables in schema` is a snapshot of the tables that existed when it ran,
-- so a table created afterwards is unreachable by the application role until this runs again. The
-- anonymous role keeps SELECT with no policy, so its denial stays row-level security's doing rather
-- than a missing GRANT.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on all tables in schema caring_contacts to caring_contacts_app;
grant select on all tables in schema caring_contacts to caring_contacts_anon;

-- ---------------------------------------------------------------------------
-- Row-level security
--
-- Team-scoped exactly as every plan-bearing table is, so an attestation on another team's plan is
-- as unobtainable as the plan. Driven from a list and dropping before creating, matching 0002 and
-- 0003, so a replay produces one policy rather than two permissive ones ORed together.
-- ---------------------------------------------------------------------------
do $$
declare
  scoped_table text;
begin
  foreach scoped_table in array array['plan_assurances']
  loop
    execute format('alter table caring_contacts.%I enable row level security', scoped_table);
    execute format('alter table caring_contacts.%I force row level security', scoped_table);
    execute format('drop policy if exists %I on caring_contacts.%I', scoped_table || '_team_scope', scoped_table);
    execute format(
      'create policy %I on caring_contacts.%I
         for all to caring_contacts_app
         using (team_id = caring_contacts.current_team_id())
         with check (team_id = caring_contacts.current_team_id())',
      scoped_table || '_team_scope',
      scoped_table
    );
  end loop;
end
$$;

-- The transactional audit guard, through 0001's own helper rather than a hand-written trigger.
-- These rows are written inside `createPlan`, which already records its audit event in the same
-- transaction, so the guard is satisfied by the write that exists and refuses one that arrives
-- another way.
select caring_contacts.attach_audit_guard(array['plan_assurances']);

commit;
