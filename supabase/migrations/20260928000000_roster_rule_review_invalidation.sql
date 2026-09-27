-- A legacy settings write must not retain Maker's review date after changing
-- either reviewed staffing rule or its source.
create function public.roster_invalidate_rule_review() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.rules -> 'minBreakHours' is distinct from old.rules -> 'minBreakHours'
      or new.rules -> 'maxHours7d' is distinct from old.rules -> 'maxHours7d'
      or new.rules_source is distinct from old.rules_source)
     and new.rules_reviewed_on is not distinct from old.rules_reviewed_on then
    new.rules_reviewed_on := null;
  end if;
  return new;
end $$;

create trigger roster_team_settings_invalidate_rule_review
before update on public.roster_team_settings
for each row execute function public.roster_invalidate_rule_review();

revoke all on function public.roster_invalidate_rule_review() from public, anon, authenticated;
