-- caring-contacts/supabase/migrations/0010_caring_contacts_patient_name_not_blank.sql
--
-- Enforce that patient_name in caring_contacts.plans is non-blank on creation/storage (#V6CDEV).
--
-- Empty string '' remains reserved for the policy-cleared sentinel written by markRetentionCleared.
--
-- Replay-safe and transactional.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class t on t.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'caring_contacts' and t.relname = 'plans' and c.conname = 'check_patient_name_not_blank'
  ) then
    execute 'alter table caring_contacts.plans add constraint check_patient_name_not_blank check (length(trim(patient_name)) > 0)';
  end if;
end $$;

comment on constraint check_patient_name_not_blank on caring_contacts.plans is
  'Ensures patient_name cannot be blank or whitespace. Blank string remains reserved as the post-retention policy-cleared sentinel.';

commit;
