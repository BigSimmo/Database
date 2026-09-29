-- Optional named On Call cover. Existing role-only cover remains valid.
-- Replaces the command in full so all authorization and review behavior stays in place.
-- MERGING THIS MIGRATION APPLIES IT TO THE LIVE CLINICAL DATABASE WITHIN SECONDS.

create or replace function public.on_call_service_command(p_actor_id uuid,p_service_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_member public.on_call_service_members;
  v_target public.on_call_service_members;
  v_invite public.on_call_service_invitations;
  v_entry public.on_call_service_entries;
  v_report public.on_call_service_reports;
  v_content jsonb;
  v_result jsonb;
  v_id uuid;
  v_site uuid;
  v_revision integer;
  v_status text;
  v_can_edit boolean;
  v_can_draft boolean;
  v_source jsonb;
  v_step jsonb;
  v_email text;
  v_via text;
  v_rejoin boolean;
  v_confirmed_at timestamptz;
  v_issuer_ok boolean;
  v_name text;
begin
  -- API authentication verifies the actor; do not require service_role access to
  -- auth.users. Membership checks below authorize every service operation.
  if p_actor_id is null then raise exception 'service_auth_required'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'service_invalid_request'; end if;

  if p_action='list' then
    select jsonb_build_object('services',coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,'name',s.name,'role',m.role,'clinicalReviewer',m.clinical_reviewer,
      'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.name),'[]') from public.on_call_service_sites t where t.service_id=s.id)
    ) order by s.name),'[]')) into v_result
    from public.on_call_services s join public.on_call_service_members m on m.service_id=s.id
    where m.user_id=p_actor_id and m.revoked_at is null;
    return v_result;
  end if;

  if p_action='create' then
    perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text, 74816));
    if (select count(*) from public.on_call_service_members where user_id=p_actor_id and revoked_at is null) >= 50 then raise exception 'service_limit'; end if;
    insert into public.on_call_services(name,created_by) values(p_payload->>'name',p_actor_id) returning * into v_service;
    insert into public.on_call_service_sites(service_id,name) values(v_service.id,p_payload->>'siteName') returning id into v_site;
    insert into public.on_call_service_members(service_id,user_id,role) values(v_service.id,p_actor_id,'admin');
    -- [contract §4] one audit row per join; creating a service is the creator's join.
    insert into public.on_call_service_member_events(service_id,user_id,event,mode,actor_id) values(v_service.id,p_actor_id,'joined',null,p_actor_id);
    return jsonb_build_object('serviceId',v_service.id,'siteId',v_site);
  end if;

  if p_action='join' then
    select service_id into p_service_id from public.on_call_service_invitations where token_hash=p_payload->>'tokenHash';
    if p_service_id is null then raise exception 'service_invitation_invalid'; end if;
  end if;
  -- Shared lock order for reads and writes: service, membership, then target.
  -- A read starting after revocation commits cannot return the removed service.
  -- [contract §7, ruling 4] Read-only actions and the personal orientation check-in take
  -- FOR SHARE; anything changing membership, invitations or content keeps FOR UPDATE.
  -- One call takes exactly one of the two, so there is no lock upgrade.
  if p_action in ('read','orientation.set') then
    select * into v_service from public.on_call_services where id=p_service_id for share;
  else
    select * into v_service from public.on_call_services where id=p_service_id for update;
  end if;
  if not found then raise exception 'service_access_denied'; end if;

  if p_action='join' then
    select * into v_invite from public.on_call_service_invitations
      where service_id=p_service_id and token_hash=p_payload->>'tokenHash' for update;
    if not found or v_invite.revoked_at is not null or v_invite.used_at is not null or v_invite.expires_at <= now()
      then raise exception 'service_invitation_invalid'; end if;
    -- [contract §8, ruling 2] Re-check that the issuer is still entitled to this invite.
    -- A null issuer, an inactive issuer, an unknown mode or a missing mode function all
    -- fail closed. Mode functions are created by later files, so they are called only
    -- here, at run time; plpgsql plans each statement when it first runs.
    v_issuer_ok := false;
    if public.service_member_active(p_service_id, v_invite.issued_by) then
      if v_invite.issued_via_mode is null then
        -- On Call's own rule: an admin may issue any role, an editor a member invite only.
        v_issuer_ok := exists(select 1 from public.on_call_service_members where service_id=p_service_id and user_id=v_invite.issued_by and revoked_at is null
                              and (role='admin' or (role='editor' and v_invite.role='member')));
      else
        begin
          case v_invite.issued_via_mode
            when 'roster' then
              v_issuer_ok := v_invite.role='member' and coalesce(public.roster_can_invite(p_service_id, v_invite.issued_by), false);
            when 'teaching' then
              v_issuer_ok := v_invite.role='member' and coalesce(public.teaching_can_invite(p_service_id, v_invite.issued_by), false);
            else
              v_issuer_ok := false;
          end case;
        exception when undefined_function then
          v_issuer_ok := false;
        end;
      end if;
    end if;
    if not v_issuer_ok then raise exception 'service_invitation_invalid'; end if;
    -- [contract §3] Email-bound invites. The route supplies the session's confirmed email;
    -- a missing email never matches. Legacy rows (invited_email null) expire within 7 days.
    if v_invite.invited_email is not null
      and lower(btrim(coalesce(p_payload->>'actorEmail',''))) is distinct from v_invite.invited_email then
      raise exception 'service_invite_email_mismatch';
    end if;
    -- An already-active member consumes nothing: the invitation stays usable for whoever it
    -- was actually issued to reach, and no membership row changes. Reject before the invite
    -- is marked used, not after — marking it used unconditionally here was Codex P2 (a
    -- redeemable invite silently being burned by a no-op join).
    if exists(select 1 from public.on_call_service_members where service_id=p_service_id and user_id=p_actor_id and revoked_at is null) then
      raise exception 'service_already_member';
    end if;
    -- [contract §6] member cap raised from 500 to 5,000.
    if (select count(*) from public.on_call_service_members where service_id=p_service_id and revoked_at is null) >= 5000 then raise exception 'service_limit'; end if;
    v_rejoin := exists(select 1 from public.on_call_service_members where service_id=p_service_id and user_id=p_actor_id);
    insert into public.on_call_service_members(service_id,user_id,role) values(p_service_id,p_actor_id,v_invite.role)
      on conflict(service_id,user_id) do update set role=excluded.role,clinical_reviewer=false,revoked_at=null,joined_at=now();
    update public.on_call_service_invitations set used_at=now(),used_by=p_actor_id where id=v_invite.id;
    insert into public.on_call_service_member_events(service_id,user_id,event,mode,actor_id)
      values(p_service_id,p_actor_id,case when v_rejoin then 'rejoined' else 'joined' end,null,p_actor_id);
    return jsonb_build_object('serviceId',p_service_id);
  end if;

  -- [contract, shared permission helper] Every mode's command RPC checks this first.
  if not public.service_member_active(p_service_id,p_actor_id) then raise exception 'service_access_denied'; end if;
  select * into v_member from public.on_call_service_members where service_id=p_service_id and user_id=p_actor_id and revoked_at is null;
  if not found then raise exception 'service_access_denied'; end if;
  v_can_edit := v_member.role in ('editor','admin');
  v_can_draft := v_can_edit or v_member.clinical_reviewer;
  v_site := nullif(p_payload->>'siteId','')::uuid;
  if v_site is not null and not exists(select 1 from public.on_call_service_sites where id=v_site and service_id=p_service_id) then raise exception 'service_invalid_site'; end if;

  if p_action='read' then
    return jsonb_build_object(
      'service',jsonb_build_object('id',v_service.id,'name',v_service.name),
      'membership',jsonb_build_object('role',v_member.role,'clinicalReviewer',v_member.clinical_reviewer,'displayName',v_member.display_name),
      'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'afterHoursStart',to_char(s.after_hours_start,'HH24:MI'),'afterHoursEnd',to_char(s.after_hours_end,'HH24:MI')) order by s.name),'[]') from public.on_call_service_sites s where service_id=p_service_id),
      'entries',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',e.id,'revision',case when v_can_draft then e.revision else e.published_revision end,
        'publishedRevision',e.published_revision,
        'content',case when v_can_draft then e.content else e.published_content end,
        'publishedContent',e.published_content,
        'status',case when v_can_draft then e.status else 'published' end,
        'authorId',case when v_can_draft then e.author_id else e.published_author_id end,
        'reviewedBy',e.published_reviewed_by,'reviewedAt',e.published_reviewed_at,'reviewComment',case when v_can_draft then e.review_comment else '' end,
        'updatedAt',e.updated_at,
        'publishedAt',e.published_at,'lastConfirmedAt',e.last_confirmed_at
      ) order by e.updated_at desc),'[]') from public.on_call_service_entries e
        where e.service_id=p_service_id and (v_can_draft or e.published_content is not null)
        and (v_site is null or (case when v_can_draft then e.content else e.published_content end)->>'siteId' is null or (case when v_can_draft then e.content else e.published_content end)->>'siteId'=v_site::text)),
      'members',case when v_member.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,'clinicalReviewer',m.clinical_reviewer,'joinedAt',m.joined_at,'displayName',m.display_name) order by m.joined_at),'[]') from public.on_call_service_members m where m.service_id=p_service_id and m.revoked_at is null) else '[]'::jsonb end,
      'invitations',case when v_member.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'role',i.role,'expiresAt',i.expires_at,'revokedAt',i.revoked_at,'usedAt',i.used_at,'invitedEmail',i.invited_email,'issuedViaMode',i.issued_via_mode) order by i.created_at desc),'[]') from public.on_call_service_invitations i where i.service_id=p_service_id) else '[]'::jsonb end,
      'reports',case when v_can_edit then (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'entryId',r.entry_id,'reason',r.reason,'status',r.status,'resolution',r.resolution,'createdAt',r.created_at) order by r.created_at desc),'[]') from public.on_call_service_reports r where r.service_id=p_service_id) else '[]'::jsonb end,
      'orientation',(select coalesce(jsonb_agg(jsonb_build_object('entryId',o.entry_id,'siteId',o.site_id,'rotation',o.rotation,'revision',o.revision,'completedAt',o.completed_at)),'[]') from public.on_call_service_orientation o where o.service_id=p_service_id and o.user_id=p_actor_id and o.site_id=v_site and o.rotation=p_payload->>'rotation')
    );
  end if;

  if p_action in ('site.create','invitation.revoke','member.update','member.revoke') and v_member.role <> 'admin' then raise exception 'service_role_denied'; end if;
  -- [contract §8] Editors may invite as member only; only an admin invites editors/admins.
  -- [contract v6, Roster replay] Mode invites: a Roster or Teaching manager is an ordinary
  -- service member, so the mode's own can-invite function decides, never the On Call role.
  -- Mode invites are member-only and record issued_via_mode. The mode functions are created
  -- by later files and are called only here, at run time; a missing one fails closed.
  if p_action='invitation.create' then
    v_via := nullif(p_payload->>'issuedViaMode','');
    if v_via is null then
      if not (v_member.role='admin' or (v_member.role='editor' and p_payload->>'role'='member')) then raise exception 'service_role_denied'; end if;
    else
      v_issuer_ok := false;
      if p_payload->>'role' = 'member' then
        begin
          case v_via
            when 'roster' then
              v_issuer_ok := coalesce(public.roster_can_invite(p_service_id, p_actor_id), false);
            when 'teaching' then
              v_issuer_ok := coalesce(public.teaching_can_invite(p_service_id, p_actor_id), false);
            else
              v_issuer_ok := false;
          end case;
        exception when undefined_function then
          v_issuer_ok := false;
        end;
      end if;
      if not v_issuer_ok then raise exception 'service_role_denied'; end if;
    end if;
  end if;
  if p_action='site.create' then
    if (select count(*) from public.on_call_service_sites where service_id=p_service_id) >= 100 then raise exception 'service_limit'; end if;
    insert into public.on_call_service_sites(service_id,name) values(p_service_id,p_payload->>'name') returning id into v_id;
    return jsonb_build_object('siteId',v_id);
  elsif p_action='site.update' then
    -- After-hours times only; editors and admins. Both "HH:MM", or both null to clear.
    if not v_can_edit then raise exception 'service_role_denied'; end if;
    -- Both keys must be present (explicit JSON null clears), so a partial payload never wipes the times.
    if v_site is null or not (p_payload ?& array['afterHoursStart','afterHoursEnd']) then raise exception 'service_invalid_request'; end if;
    if (jsonb_typeof(p_payload->'afterHoursStart') = 'null') <> (jsonb_typeof(p_payload->'afterHoursEnd') = 'null') then raise exception 'service_invalid_request'; end if;
    if jsonb_typeof(p_payload->'afterHoursStart') <> 'null' and (
         jsonb_typeof(p_payload->'afterHoursStart') is distinct from 'string' or jsonb_typeof(p_payload->'afterHoursEnd') is distinct from 'string'
      or p_payload->>'afterHoursStart' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or p_payload->>'afterHoursEnd' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or p_payload->>'afterHoursStart' = p_payload->>'afterHoursEnd') then raise exception 'service_invalid_request'; end if;
    update public.on_call_service_sites
       set after_hours_start = (p_payload->>'afterHoursStart')::time,
           after_hours_end = (p_payload->>'afterHoursEnd')::time
     where id = v_site and service_id = p_service_id;
    return jsonb_build_object('siteId',v_site);
  elsif p_action='invitation.create' then
    if (p_payload->>'expiresInDays')::integer not between 1 and 7 then raise exception 'service_invalid_request'; end if;
    -- [contract §3] invited_email is required on every new invite, stored normalised.
    v_email := lower(btrim(coalesce(p_payload->>'invitedEmail','')));
    if jsonb_typeof(p_payload->'invitedEmail') is distinct from 'string' or length(v_email) > 320
      or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'service_invalid_request'; end if;
    -- [contract §6] open-invite cap raised from 100 to 1,000.
    if (select count(*) from public.on_call_service_invitations where service_id=p_service_id and used_at is null and revoked_at is null and expires_at>now()) >= 1000 then raise exception 'service_limit'; end if;
    insert into public.on_call_service_invitations(service_id,token_hash,role,issued_by,expires_at,invited_email,issued_via_mode)
      values(p_service_id,p_payload->>'tokenHash',case when v_via is null then p_payload->>'role' else 'member' end,p_actor_id,now()+make_interval(days=>(p_payload->>'expiresInDays')::integer),v_email,v_via) returning * into v_invite;
    return jsonb_build_object('invitationId',v_invite.id,'expiresAt',v_invite.expires_at);
  elsif p_action='invitation.revoke' then
    update public.on_call_service_invitations set revoked_at=now() where service_id=p_service_id and id=(p_payload->>'invitationId')::uuid;
    if not found then raise exception 'service_not_found'; end if;
    return jsonb_build_object('ok',true);
  elsif p_action='member.display_name' then
    -- [contract §5, ruling 3] The member themselves or a service admin. Trimmed, 1-80
    -- characters, or JSON null to clear. Not an audit event (not in the event list).
    v_id := coalesce(nullif(p_payload->>'memberId','')::uuid, p_actor_id);
    if v_id <> p_actor_id and v_member.role <> 'admin' then raise exception 'service_role_denied'; end if;
    if not (p_payload ? 'displayName') then raise exception 'service_invalid_request'; end if;
    if jsonb_typeof(p_payload->'displayName') = 'null' then
      v_name := null;
    elsif jsonb_typeof(p_payload->'displayName') = 'string' and length(btrim(p_payload->>'displayName')) between 1 and 80 then
      v_name := btrim(p_payload->>'displayName');
    else
      raise exception 'service_invalid_request';
    end if;
    update public.on_call_service_members set display_name=v_name where service_id=p_service_id and user_id=v_id and revoked_at is null;
    if not found then raise exception 'service_not_found'; end if;
    return jsonb_build_object('ok',true,'displayName',v_name);
  elsif p_action in ('member.update','member.revoke') then
    select * into v_target from public.on_call_service_members where service_id=p_service_id and user_id=(p_payload->>'memberId')::uuid and revoked_at is null for update;
    if not found then raise exception 'service_not_found'; end if;
    if v_target.role='admin' and (p_action='member.revoke' or p_payload->>'role'<>'admin')
      and (select count(*) from public.on_call_service_members where service_id=p_service_id and role='admin' and revoked_at is null)<=1 then raise exception 'service_last_admin'; end if;
    if p_action='member.revoke' then
      update public.on_call_service_members set revoked_at=now(),clinical_reviewer=false where service_id=p_service_id and user_id=v_target.user_id;
      update public.on_call_service_invitations set revoked_at=now() where service_id=p_service_id and issued_by=v_target.user_id and used_at is null;
      insert into public.on_call_service_member_events(service_id,user_id,event,mode,actor_id) values(p_service_id,v_target.user_id,'revoked',null,p_actor_id);
    else
      update public.on_call_service_members set role=p_payload->>'role',clinical_reviewer=(p_payload->>'clinicalReviewer')::boolean where service_id=p_service_id and user_id=v_target.user_id;
      if v_target.role is distinct from p_payload->>'role' then
        insert into public.on_call_service_member_events(service_id,user_id,event,mode,actor_id) values(p_service_id,v_target.user_id,'role_changed',null,p_actor_id);
      end if;
    end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action in ('entry.save','entry.withdraw','report.resolve') and not v_can_edit then raise exception 'service_role_denied'; end if;
  if p_action='entry.save' then
    v_content := p_payload - array['action','entryId','expectedRevision','publish'];
    if v_content - array['siteId','section','kind','title','body','phone','sources','orientationPhase','steps','cover'] <> '{}'::jsonb
      or not (v_content ?& array['siteId','section','kind','title','body','phone','sources','orientationPhase'])
      or coalesce(v_content->>'section','') not in ('contacts','referrals','resources','documentation','orientation','teaching','admin','playbook','cover')
      or coalesce(v_content->>'kind','') not in ('operational','clinical','legal')
      or coalesce(v_content->>'orientationPhase','') not in ('before_start','first_shift','first_week','ongoing','leaving')
      or jsonb_typeof(v_content->'title') is distinct from 'string' or length(btrim(v_content->>'title')) not between 1 and 160
      or jsonb_typeof(v_content->'body') is distinct from 'string' or length(v_content->>'body')>6000
      or jsonb_typeof(v_content->'phone') is distinct from 'string' or length(v_content->>'phone')>80
      or jsonb_typeof(v_content->'sources') is distinct from 'array'
      or jsonb_typeof(p_payload->'publish') is distinct from 'boolean' then raise exception 'service_invalid_request'; end if;
    if jsonb_array_length(v_content->'sources')>12 then raise exception 'service_invalid_request'; end if;
    for v_source in select value from jsonb_array_elements(v_content->'sources') loop
      if jsonb_typeof(v_source) is distinct from 'object' or v_source - array['label','url'] <> '{}'::jsonb
        or jsonb_typeof(v_source->'label') is distinct from 'string' or length(btrim(v_source->>'label')) not between 1 and 160
        or jsonb_typeof(v_source->'url') is distinct from 'string' or length(v_source->>'url')>2000
        or coalesce(v_source->>'url','') !~ '^https://[^/@[:space:]]+(/|$)' then raise exception 'service_invalid_request'; end if;
    end loop;
    if v_content->>'kind'<>'operational' and jsonb_array_length(v_content->'sources')=0 then raise exception 'service_source_required'; end if;
    -- A. Playbook and cover are always clinical or legal: source link plus second-person review.
    if v_content->>'section' in ('playbook','cover') and v_content->>'kind' not in ('clinical','legal') then raise exception 'service_review_required'; end if;
    -- `steps` belongs to playbook and is required there; `cover` likewise for cover.
    if (v_content ? 'steps') is distinct from (v_content->>'section'='playbook')
      or (v_content ? 'cover') is distinct from (v_content->>'section'='cover') then raise exception 'service_invalid_request'; end if;
    if v_content ? 'steps' then
      -- Shape of entry-model.ts playbookDetails.escalationSteps: who, number, when; no criteria.
      if jsonb_typeof(v_content->'steps') is distinct from 'array' then raise exception 'service_invalid_request'; end if;
      if jsonb_array_length(v_content->'steps') not between 1 and 20 then raise exception 'service_invalid_request'; end if;
      for v_step in select value from jsonb_array_elements(v_content->'steps') loop
        if jsonb_typeof(v_step) is distinct from 'object' then raise exception 'service_invalid_request'; end if;
        if v_step - array['order','whoToCall','when','phone','hours','waitMinutes'] <> '{}'::jsonb
          or not (v_step ?& array['order','whoToCall','when'])
          or jsonb_typeof(v_step->'order') is distinct from 'number' or coalesce(v_step->>'order','') !~ '^([1-9]|1[0-9]|20)$'
          or jsonb_typeof(v_step->'whoToCall') is distinct from 'string' or length(btrim(v_step->>'whoToCall')) not between 1 and 160
          or jsonb_typeof(v_step->'when') is distinct from 'string' or length(btrim(v_step->>'when')) not between 1 and 160
          or (v_step ? 'phone' and (jsonb_typeof(v_step->'phone') is distinct from 'string' or length(btrim(v_step->>'phone')) not between 1 and 80))
          or (v_step ? 'hours' and (jsonb_typeof(v_step->'hours') is distinct from 'string' or v_step->>'hours' not in ('any','in-hours','after-hours')))
          -- Optional hospital-set wait before the next step (Josh card 2026-09-26 19:06Z).
          or (v_step ? 'waitMinutes' and (jsonb_typeof(v_step->'waitMinutes') is distinct from 'number' or coalesce(v_step->>'waitMinutes','') !~ '^([1-9]|[1-9][0-9]|1[01][0-9]|120)$'))
          then raise exception 'service_invalid_request'; end if;
      end loop;
      if (select count(distinct value->>'order') from jsonb_array_elements(v_content->'steps')) <> jsonb_array_length(v_content->'steps') then raise exception 'service_invalid_request'; end if;
    end if;
    if v_content ? 'cover' then
      -- Role and shift window, with an optional staff name. `grade` uses the contract's roster_member_roles.grade
      -- values; times are local wall-clock "HH:MM", and end < start means overnight.
      if jsonb_typeof(v_content->'cover') is distinct from 'object' then raise exception 'service_invalid_request'; end if;
      if (v_content->'cover') - array['grade','team','window','staffName'] <> '{}'::jsonb
        or not (v_content->'cover' ?& array['grade','window'])
        or jsonb_typeof(v_content->'cover'->'grade') is distinct from 'string'
        or v_content->'cover'->>'grade' not in ('intern','resident','registrar','fellow','consultant','other')
        or (v_content->'cover' ? 'team' and (jsonb_typeof(v_content->'cover'->'team') is distinct from 'string' or length(btrim(v_content->'cover'->>'team')) not between 1 and 80))
        or (v_content->'cover' ? 'staffName' and (jsonb_typeof(v_content->'cover'->'staffName') is distinct from 'string' or length(btrim(v_content->'cover'->>'staffName', U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) not between 1 and 80))
        or jsonb_typeof(v_content->'cover'->'window') is distinct from 'object' then raise exception 'service_invalid_request'; end if;
      if (v_content->'cover'->'window') - array['start','end'] <> '{}'::jsonb
        or not (v_content->'cover'->'window' ?& array['start','end'])
        or jsonb_typeof(v_content->'cover'->'window'->'start') is distinct from 'string'
        or jsonb_typeof(v_content->'cover'->'window'->'end') is distinct from 'string'
        or v_content->'cover'->'window'->>'start' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_content->'cover'->'window'->>'end' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or v_content->'cover'->'window'->>'start' = v_content->'cover'->'window'->>'end' then raise exception 'service_invalid_request'; end if;
    end if;
    v_id := nullif(p_payload->>'entryId','')::uuid;
    if v_id is null then
      if (select count(*) from public.on_call_service_entries where service_id=p_service_id)>=1000 then raise exception 'service_limit'; end if;
      if p_payload ? 'expectedRevision' then raise exception 'service_revision_conflict'; end if;
      v_revision := 1;
    else
      select * into v_entry from public.on_call_service_entries where id=v_id and service_id=p_service_id for update;
      if not found then raise exception 'service_not_found'; end if;
      if v_entry.revision is distinct from (p_payload->>'expectedRevision')::integer then raise exception 'service_revision_conflict'; end if;
      v_revision := v_entry.revision+1;
    end if;
    v_status := case when (p_payload->>'publish')::boolean then case when v_content->>'kind'='operational' then 'published' else 'pending_review' end else 'draft' end;
    -- Reclassification cannot evade independent review of an existing clinical/legal entry.
    if v_entry.id is not null and (v_entry.content->>'kind'<>'operational' or v_entry.published_content->>'kind'<>'operational') and v_content->>'kind'='operational' then raise exception 'service_review_required'; end if;
    if v_id is null then
      insert into public.on_call_service_entries(service_id,site_id,content,author_id,status)
        values(p_service_id,v_site,v_content,p_actor_id,v_status) returning id into v_id;
    else
      update public.on_call_service_entries set site_id=v_site,content=v_content,author_id=p_actor_id,status=v_status,revision=v_revision,review_comment='',updated_at=now() where id=v_id;
    end if;
    if v_status='published' then
      update public.on_call_service_entries set published_content=v_content,published_revision=v_revision,published_author_id=p_actor_id,published_reviewed_by=null,published_reviewed_at=null,
        published_at=now(),last_confirmed_at=null,last_confirmed_by=null where id=v_id;
    end if;
    return jsonb_build_object('entryId',v_id,'revision',v_revision,'status',v_status);
  elsif p_action in ('entry.review','entry.withdraw','entry.confirm','report.create','orientation.set') then
    select * into v_entry from public.on_call_service_entries where id=(p_payload->>'entryId')::uuid and service_id=p_service_id for update;
    if not found then raise exception 'service_not_found'; end if;
    if p_action in ('entry.review','entry.withdraw') then
      if v_entry.revision is distinct from (p_payload->>'expectedRevision')::integer then raise exception 'service_revision_conflict'; end if;
      if p_action='entry.withdraw' then
        update public.on_call_service_entries set status='withdrawn',revision=revision+1,published_content=null,published_revision=null,published_author_id=null,published_reviewed_by=null,published_reviewed_at=null,
          published_at=null,last_confirmed_at=null,last_confirmed_by=null,updated_at=now() where id=v_entry.id;
      else
        if not v_member.clinical_reviewer or v_entry.author_id=p_actor_id then raise exception 'service_review_denied'; end if;
        if v_entry.status<>'pending_review' or v_entry.content->>'kind'='operational' then raise exception 'service_review_required'; end if;
        if p_payload->>'decision'='approve' then
          update public.on_call_service_entries set status='published',revision=revision+1,published_content=content,published_revision=revision+1,published_author_id=author_id,published_reviewed_by=p_actor_id,published_reviewed_at=now(),
            published_at=now(),last_confirmed_at=null,last_confirmed_by=null,review_comment=p_payload->>'comment',updated_at=now() where id=v_entry.id;
        elsif p_payload->>'decision'='return' then
          update public.on_call_service_entries set status='draft',revision=revision+1,review_comment=p_payload->>'comment',updated_at=now() where id=v_entry.id;
        else raise exception 'service_invalid_request'; end if;
      end if;
      return jsonb_build_object('ok',true);
    elsif p_action='entry.confirm' then
      -- B. "Still correct" for the published revision the caller actually saw. Stamps
      -- last_confirmed_* only: no revision, status, content or updated_at change.
      if v_entry.published_content is null then raise exception 'service_not_found'; end if;
      if v_entry.published_content->>'kind'='operational' then
        if not v_can_edit then raise exception 'service_role_denied'; end if;
      elsif not v_member.clinical_reviewer then
        raise exception 'service_review_denied';
      end if;
      if jsonb_typeof(p_payload->'publishedRevision') is distinct from 'number'
        or (p_payload->>'publishedRevision') is distinct from v_entry.published_revision::text then raise exception 'service_revision_conflict'; end if;
      update public.on_call_service_entries set last_confirmed_at=now(),last_confirmed_by=p_actor_id where id=v_entry.id
        returning last_confirmed_at into v_confirmed_at;
      return jsonb_build_object('ok',true,'lastConfirmedAt',v_confirmed_at);
    elsif p_action='report.create' then
      if v_entry.published_content is null then raise exception 'service_not_found'; end if;
      if (select count(*) from public.on_call_service_reports where service_id=p_service_id and status='open')>=1000 then raise exception 'service_limit'; end if;
      insert into public.on_call_service_reports(service_id,entry_id,reported_by,reason) values(p_service_id,v_entry.id,p_actor_id,p_payload->>'reason') returning id into v_id;
      return jsonb_build_object('reportId',v_id);
    else
      if v_site is null or v_entry.published_content is null or v_entry.published_content->>'section'<>'orientation'
        or (v_entry.published_content->>'siteId' is not null and v_entry.published_content->>'siteId'<>v_site::text) then raise exception 'service_invalid_orientation'; end if;
      if (p_payload->>'completed')::boolean then
        insert into public.on_call_service_orientation(service_id,user_id,site_id,entry_id,rotation,revision)
          values(p_service_id,p_actor_id,v_site,v_entry.id,p_payload->>'rotation',v_entry.published_revision)
          on conflict(service_id,user_id,site_id,entry_id,rotation) do update set revision=excluded.revision,completed_at=now();
      else
        delete from public.on_call_service_orientation where service_id=p_service_id and user_id=p_actor_id and site_id=v_site and entry_id=v_entry.id and rotation=p_payload->>'rotation';
      end if;
      return jsonb_build_object('ok',true);
    end if;
  elsif p_action='report.resolve' then
    update public.on_call_service_reports set status='resolved',resolution=p_payload->>'resolution',resolved_by=p_actor_id,resolved_at=now()
      where service_id=p_service_id and id=(p_payload->>'reportId')::uuid;
    if not found then raise exception 'service_not_found'; end if;
    return jsonb_build_object('ok',true);
  end if;
  raise exception 'service_invalid_request';
end $$;
revoke all on function public.on_call_service_command(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.on_call_service_command(uuid,uuid,text,jsonb) to service_role;
