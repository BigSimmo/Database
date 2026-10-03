-- Never edit an applied migration. Merging this applies it to the live database.
-- "Who can cover?" lists the whole team, not only colleagues who happen to have a shift in the
-- weeks read. Any active member of a confirmed team may read the names and grades of that
-- team's current members, and nothing else: no join date, role, rotation or contact detail,
-- which stay behind the manager-only 'people' read. Members who have left are never listed.
-- Owner approval for members seeing their own team's names and grades: 2026-10-03.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create function public.roster_team_members(p_actor_id uuid, p_service_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_result jsonb;
begin
  if p_actor_id is null then raise exception 'roster_auth_required'; end if;
  select * into v_service from public.on_call_services where id = p_service_id;
  if not found or not public.service_member_active(p_service_id, p_actor_id) then
    raise exception 'roster_access_denied';
  end if;
  if v_service.verified_at is null and not v_service.is_demo then raise exception 'roster_team_not_verified'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', m.user_id, 'name', coalesce(m.display_name, r.roster_name), 'grade', r.grade
  ) order by coalesce(m.display_name, r.roster_name), m.user_id), '[]') into v_result
  from public.on_call_service_members m
  left join public.roster_member_roles r on r.service_id = m.service_id and r.user_id = m.user_id and r.revoked_at is null
  where m.service_id = p_service_id and m.revoked_at is null;
  return jsonb_build_object('members', v_result);
end $$;

revoke all on function public.roster_team_members(uuid, uuid) from public, anon, authenticated;
grant execute on function public.roster_team_members(uuid, uuid) to service_role;
