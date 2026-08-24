-- caring-contacts/supabase/migrations/0005_caring_contacts_first_contact_reason.sql
--
-- Keep the reason a coordinator gave for moving a plan's first contact off the usual day.
--
-- THIS DIRECTORY IS NOT THE REPOSITORY'S `supabase/migrations/`. That directory replays against the
-- live Clinical KB project and merging to `main` applies it there automatically; nothing here may
-- ever be placed in it, and both tests/caring-contacts-domain-isolation.test.ts and
-- tests/caring-contacts-migrations.test.ts fail if a caring-contact migration appears there.
--
-- WHY THE COLUMN EXISTS. `buildApprovedSchedule` refuses any first-contact date other than
-- discharge + 1 unless a non-blank reason is supplied -- and then discarded the string. The system
-- demanded a reason, refused without one, and kept nothing, so nobody could later review why a
-- plan's dates were moved. The owner approved storing it on 2026-08-25.
--
-- WHAT IS DELIBERATELY NOT HERE:
--
--   * NO SECOND COPY OF THE DATE. The moved date is not lost: it is the first contact's own
--     `calendar_day` and `send_at` in `caring_contacts.contacts`. A date column here would be a
--     second answer to the same question, free to disagree with the schedule it came from.
--
--   * NO DEFAULT, AND NO BACKFILL. The column is nullable and every existing row keeps null. A plan
--     created before this migration genuinely holds no reason, and that is a fact the interface
--     states as its own. Writing a placeholder such as 'not recorded' would put a fabricated
--     sentence on a clinical record and make it indistinguishable from one a clinician typed --
--     far worse than an honest absence.
--
--   * NO `not null`. Same reason, plus: most plans are on the usual day and were never asked for a
--     reason. Null means "no reason is held", which is what an unmoved first contact should say.
--
-- THE LENGTH CHECK IS A BACKSTOP, NOT THE ENFORCEMENT. The rule is owned by
-- src/lib/caring-contacts/schedule.ts, where the input arrives and where an over-long reason can be
-- refused BY NAME (`first-contact-reason-too-long`) rather than by a constraint violation. This
-- check exists so a write that somehow reached the table another way cannot store unbounded free
-- text, exactly as the calendar-day pattern check backstops `isAwstCalendarDay`. Keep the number
-- equal to `FIRST_CONTACT_REASON_MAX_LENGTH`.
--
-- A blank string is refused as well as an over-long one: the domain trims before storing and writes
-- null when nothing was required, so '' and '   ' can only be a bug in a caller.
--
-- Row-level security needs nothing here. `caring_contacts.plans` already has it enabled and forced,
-- policies are per row rather than per column, and 0002's grants are table-wide -- so this column is
-- reachable exactly where the row is, and nowhere else.
--
-- Transactional: one `begin`/`commit`, no `CREATE INDEX CONCURRENTLY`.
--
-- Replay-safe: the column add is `if not exists`, and the constraint is added only when absent.

begin;

alter table caring_contacts.plans add column if not exists first_contact_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'caring_contacts'
      and t.relname = 'plans'
      and c.conname = 'plans_first_contact_reason_shape'
  ) then
    alter table caring_contacts.plans
      add constraint plans_first_contact_reason_shape
      check (
        first_contact_reason is null
        or (char_length(btrim(first_contact_reason)) between 1 and 500)
      );
  end if;
end;
$$;

comment on column caring_contacts.plans.first_contact_reason is
  'Free text a clinician wrote about this patient. Cleared by markRetentionCleared with the rest of the patient detail; never selected by a list read.';

commit;
