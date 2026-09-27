-- Forward R3 workflow. Merge only in the approved production window.
-- Doctor agreement belongs to an immutable proposal, never to client-supplied recipients.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.roster_drafts add column baseline_rows jsonb
  check (baseline_rows is null or jsonb_typeof(baseline_rows) = 'array');
alter table public.roster_team_settings add column rules_reviewed_on date;

create table public.roster_maker_proposals (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  draft_id uuid not null references public.roster_drafts(id) on delete cascade,
  draft_version bigint not null,
  scope text not null check(scope in ('full','change')),
  change_id bigint,
  history_through bigint not null default 0,
  period_start date not null,
  period_end date not null,
  live_token text not null,
  request_key text not null,
  before_rows jsonb not null,
  after_rows jsonb not null,
  draft_rows jsonb not null,
  next_baseline jsonb not null,
  publish_payload jsonb not null,
  blockers jsonb not null default '[]',
  protected_changes jsonb not null default '[]',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  receipt jsonb,
  unique(service_id,request_key)
);
create index roster_maker_proposals_draft_idx on public.roster_maker_proposals(draft_id,created_at desc);
create table public.roster_maker_consents (
  proposal_id uuid not null references public.roster_maker_proposals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  before_rows jsonb not null,
  after_rows jsonb not null,
  agreed_at timestamptz,
  primary key(proposal_id,user_id)
);
create index roster_maker_consents_user_idx on public.roster_maker_consents(user_id,proposal_id);
alter table public.roster_maker_proposals enable row level security;
alter table public.roster_maker_consents enable row level security;
revoke all on table public.roster_maker_proposals,public.roster_maker_consents from public,anon,authenticated;
grant all on table public.roster_maker_proposals,public.roster_maker_consents to service_role;

-- Exact normalized multisets preserve duplicate duties. No row identity is guessed.
create function public.roster_maker_row(p jsonb) returns jsonb language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
 select jsonb_build_object(
 'userId',coalesce(p->'userId',p->'user_id','null'),
 'rosterName',nullif(btrim(coalesce(p->>'rosterName',p->>'roster_name')),''),
 'siteId',coalesce(p->'siteId',p->'site_id','null'),
 'startsAt',coalesce(p->>'startsAt',p->>'starts_at')::timestamptz,
 'endsAt',coalesce(p->>'endsAt',p->>'ends_at')::timestamptz,
 'shiftCode',btrim(coalesce(p->>'shiftCode',p->>'shift_code')),
 'kind',p->>'kind','grade',p->>'grade')
$$;
create function public.roster_maker_minus(a jsonb,b jsonb) returns jsonb language sql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
 select coalesce(jsonb_agg(x order by x::text),'[]') from
 ((select value x from jsonb_array_elements(a)) except all (select value x from jsonb_array_elements(b))) rows
$$;
create function public.roster_maker_sort(a jsonb) returns jsonb language sql immutable security invoker set search_path = public, pg_catalog, pg_temp as $$
 select coalesce(jsonb_agg(value order by value::text),'[]') from jsonb_array_elements(a)
$$;
create function public.roster_maker_live_rows(p_service_id uuid,p_from date,p_to date) returns jsonb language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
 select public.roster_maker_sort(coalesce(jsonb_agg(row_value),'[]')) from (
 select public.roster_maker_row(to_jsonb(a)||jsonb_build_object('roster_name',case when a.user_id is null then coalesce(a.roster_name,'Unlinked published doctor') else a.roster_name end)) row_value from public.roster_assignments a where a.service_id=p_service_id and a.superseded_at is null
 and (a.starts_at at time zone 'Australia/Perth')::date between p_from and p_to
 union all select public.roster_maker_row(jsonb_build_object('userId',null,'rosterName',null,'siteId',o.site_id,'startsAt',o.starts_at,'endsAt',o.ends_at,'shiftCode',o.shift_code,'kind',o.kind,'grade',o.min_grade))
 from public.roster_open_shifts o where o.service_id=p_service_id and o.assignment_id is null and o.status='open'
 and (o.starts_at at time zone 'Australia/Perth')::date between p_from and p_to) current_rows
$$;
create function public.roster_maker_draft_rows(p_draft_id uuid) returns jsonb language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
 select public.roster_maker_sort(coalesce(jsonb_agg(public.roster_maker_row(to_jsonb(a))),'[]'))
 from public.roster_draft_assignments a where a.draft_id=p_draft_id
$$;
create function public.roster_maker_settings_token(p_service_id uuid) returns text language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
 select md5(jsonb_build_object('settings',(select to_jsonb(s) from public.roster_team_settings s where s.service_id=p_service_id),
 'needs',(select coalesce(jsonb_agg(to_jsonb(n) order by n.id),'[]') from public.roster_staffing_needs n where n.service_id=p_service_id))::text)
$$;

-- Called by the authoritative legacy command too: old API routes cannot bypass consent.
create function public.roster_maker_assert_publication(p_service_id uuid,p_payload jsonb)
returns void language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_before jsonb; v_after jsonb; v_proposal public.roster_maker_proposals; v_context text;
begin
 if coalesce(p_payload->>'kind','full')='full' then
   select coalesce(jsonb_agg(x),'[]') into v_before from jsonb_array_elements(public.roster_maker_live_rows(p_service_id,(p_payload->>'periodStart')::date,(p_payload->>'periodEnd')::date)) x where x->>'userId' is not null or x->>'rosterName' is not null;
 else
   select coalesce(jsonb_agg(public.roster_maker_row(to_jsonb(a))),'[]') into v_before
   from public.roster_assignments a where a.service_id=p_service_id and a.superseded_at is null
   and a.id in (select value::text::uuid from jsonb_array_elements_text(coalesce(p_payload->'replaceAssignmentIds','[]')));
 end if;
 select coalesce(jsonb_agg(public.roster_maker_row(x)),'[]') into v_after from jsonb_array_elements(p_payload->'assignments') x;
 if public.roster_maker_minus(v_before,v_after)='[]'::jsonb then return; end if;
 v_context:=nullif(current_setting('roster.approved_proposal',true),'');
 if v_context is null then raise exception 'roster_agreement_required'; end if;
 select * into v_proposal from public.roster_maker_proposals where id=v_context::uuid and service_id=p_service_id and receipt is null;
 if not found or v_proposal.publish_payload->'publication' is distinct from p_payload
   or jsonb_array_length(v_proposal.blockers)>0
   or exists(select 1 from public.roster_maker_consents c where c.proposal_id=v_proposal.id
     and (c.agreed_at is null or not public.service_member_active(p_service_id,c.user_id)))
 then raise exception 'roster_agreement_required'; end if;
end $$;

create function public.roster_maker_proposal_json(p_id uuid) returns jsonb
language sql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
 select jsonb_build_object('id',p.id,'draftId',p.draft_id,'draftVersion',p.draft_version,
 'periodStart',p.period_start,'periodEnd',p.period_end,'scope',p.scope,'changeId',p.change_id::text,'createdAt',p.created_at,
 'status',case when p.receipt is not null then 'published' when d.version<>p.draft_version
 or p.live_token<>public.roster_publish_fingerprint(p.service_id,p.period_start,p.period_end) then 'stale' else 'pending' end,
 'before',p.before_rows,'after',p.after_rows,'blockers',p.blockers,'protectedChanges',p.protected_changes,
 'affected',(select coalesce(jsonb_agg(jsonb_build_object('userId',c.user_id,
   'displayName',public.roster_person_name(p.service_id,c.user_id,null),'before',c.before_rows,'after',c.after_rows,'agreedAt',c.agreed_at) order by c.user_id),'[]')
   from public.roster_maker_consents c where c.proposal_id=p.id),
 'canPublish',p.receipt is null and d.version=p.draft_version and jsonb_array_length(p.blockers)=0
   and p.live_token=public.roster_publish_fingerprint(p.service_id,p.period_start,p.period_end)
   and not exists(select 1 from public.roster_maker_consents c where c.proposal_id=p.id
     and (c.agreed_at is null or not public.service_member_active(p.service_id,c.user_id))))
 from public.roster_maker_proposals p join public.roster_drafts d on d.id=p.draft_id where p.id=p_id
$$;

create function public.roster_maker_read(p_actor_id uuid,p_service_id uuid,p_draft_id uuid default null,p_mine boolean default false)
returns jsonb language plpgsql stable security invoker set search_path = public, pg_catalog, pg_temp as $$
declare v_result jsonb; v_draft public.roster_drafts;
begin
 if p_actor_id is null then raise exception 'roster_auth_required'; end if;
 if not public.service_member_active(p_service_id,p_actor_id) then raise exception 'roster_access_denied'; end if;
 if not exists(select 1 from public.on_call_services where id=p_service_id and (verified_at is not null or is_demo)) then raise exception 'roster_team_not_verified'; end if;
 if p_mine then
   select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'draftId',p.draft_id,'draftVersion',p.draft_version,
    'periodStart',p.period_start,'periodEnd',p.period_end,'scope',p.scope,'createdAt',p.created_at,
    'status',case when p.receipt is not null then 'published' when d.version<>p.draft_version or p.live_token<>public.roster_publish_fingerprint(p.service_id,p.period_start,p.period_end) then 'stale' else 'pending' end,
    'before',c.before_rows,'after',c.after_rows,'agreedAt',c.agreed_at) order by p.created_at desc),'[]') into v_result
   from (select p.* from public.roster_maker_proposals p join public.roster_maker_consents c on c.proposal_id=p.id
     where p.service_id=p_service_id and c.user_id=p_actor_id order by p.created_at desc limit 50) p
   join public.roster_maker_consents c on c.proposal_id=p.id and c.user_id=p_actor_id join public.roster_drafts d on d.id=p.draft_id;
   return jsonb_build_object('proposals',v_result);
 end if;
 if not exists(select 1 from public.roster_member_roles where service_id=p_service_id and user_id=p_actor_id and role='manager' and revoked_at is null) then raise exception 'roster_role_denied'; end if;
 if p_draft_id is not null then
   select * into v_draft from public.roster_drafts where id=p_draft_id and service_id=p_service_id;
   if not found then raise exception 'roster_not_found'; end if;
 end if;
 return jsonb_build_object('settingsToken',public.roster_maker_settings_token(p_service_id),
 'needs',(public.roster_read(p_actor_id,p_service_id,'maker','{}')->'needs'),
 'rules',coalesce((select jsonb_build_object('minBreakHours',s.rules->'minBreakHours','maxHours7d',s.rules->'maxHours7d','source',s.rules_source,'reviewedOn',s.rules_reviewed_on)
   from public.roster_team_settings s where s.service_id=p_service_id),jsonb_build_object('minBreakHours',null,'maxHours7d',null,'source',null,'reviewedOn',null)),
 'proposals',(select coalesce(jsonb_agg(public.roster_maker_proposal_json(p.id) order by p.created_at desc),'[]') from
   (select * from public.roster_maker_proposals where service_id=p_service_id and (p_draft_id is null or draft_id=p_draft_id) order by created_at desc limit 30) p),
 'reconciliation',case when p_draft_id is not null and (v_draft.baseline_rows is null or
   public.roster_maker_minus(public.roster_maker_minus(v_draft.baseline_rows,public.roster_maker_draft_rows(v_draft.id)),
     public.roster_maker_live_rows(p_service_id,v_draft.period_start,v_draft.period_end))<>'[]'::jsonb) then jsonb_build_object(
   'draftId',v_draft.id,'draftVersion',v_draft.version,'liveToken',public.roster_publish_fingerprint(p_service_id,v_draft.period_start,v_draft.period_end),
   'before',public.roster_maker_live_rows(p_service_id,v_draft.period_start,v_draft.period_end),'after',public.roster_maker_draft_rows(v_draft.id)) else null end);
end $$;

create function public.roster_maker_command(p_actor_id uuid,p_service_id uuid,p_action text,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
 v_draft public.roster_drafts; v_proposal public.roster_maker_proposals;
 v_before jsonb; v_after jsonb; v_rows jsonb; v_removed jsonb; v_added jsonb; v_next jsonb; v_change jsonb;
 v_payload jsonb; v_codes jsonb; v_snapshot jsonb; v_protected jsonb:='[]'; v_blockers jsonb:='[]';
 v_overrides jsonb:=coalesce(p_payload->'overrideChanges','[]'); v_row jsonb; v_need jsonb; v_result jsonb;
 v_token text; v_key text; v_id uuid; v_ids uuid[]:='{}'; v_user uuid; v_rules jsonb; v_change_id bigint;
begin
 if p_actor_id is null then raise exception 'roster_auth_required'; end if;
 if p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'roster_invalid_request'; end if;
 -- Same service -> team lock order as membership changes, drafts and R2 publication.
 perform 1 from public.on_call_services where id=p_service_id for share;
 if not found or not public.service_member_active(p_service_id,p_actor_id) then raise exception 'roster_access_denied'; end if;
 if not exists(select 1 from public.on_call_services where id=p_service_id and (verified_at is not null or is_demo)) then raise exception 'roster_team_not_verified'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_service_id::text,74817));
 if p_action='agreement.record' then
   if (p_payload-array['proposalId'])<>'{}' then raise exception 'roster_invalid_request'; end if;
   select p.* into v_proposal from public.roster_maker_proposals p join public.roster_maker_consents c on c.proposal_id=p.id
     where p.id=(p_payload->>'proposalId')::uuid and p.service_id=p_service_id and c.user_id=p_actor_id for update of p;
   if not found then raise exception 'roster_not_found'; end if;
   if v_proposal.receipt is not null then raise exception 'roster_conflict'; end if;
   select * into v_draft from public.roster_drafts where id=v_proposal.draft_id for update;
   if v_draft.version<>v_proposal.draft_version or v_proposal.live_token<>public.roster_publish_fingerprint(p_service_id,v_proposal.period_start,v_proposal.period_end) then raise exception 'roster_conflict'; end if;
   update public.roster_maker_consents set agreed_at=coalesce(agreed_at,now()) where proposal_id=v_proposal.id and user_id=p_actor_id;
   return public.roster_maker_read(p_actor_id,p_service_id,null,true);
 end if;
 perform public.roster_lock_manager(p_actor_id,p_service_id);
 if p_action='settings.save' then
   if (p_payload-array['expectedToken','needs','rules'])<>'{}' or p_payload->>'expectedToken' is distinct from public.roster_maker_settings_token(p_service_id) then raise exception 'roster_conflict'; end if;
   v_rules:=p_payload->'rules';
   if jsonb_typeof(p_payload->'needs') is distinct from 'array' or jsonb_typeof(v_rules) is distinct from 'object'
     or (v_rules-array['minBreakHours','maxHours7d','source','reviewedOn'])<>'{}' then raise exception 'roster_invalid_request'; end if;
   if jsonb_array_length(p_payload->'needs')>2000 then raise exception 'roster_limit'; end if;
   if (v_rules->>'minBreakHours' is not null and ((v_rules->>'minBreakHours')::numeric not between 0 and 48 or jsonb_typeof(v_rules->'minBreakHours')<>'number'))
     or (v_rules->>'maxHours7d' is not null and ((v_rules->>'maxHours7d')::numeric not between 1 and 168 or jsonb_typeof(v_rules->'maxHours7d')<>'number'))
     or ((v_rules->>'minBreakHours' is not null or v_rules->>'maxHours7d' is not null)
       and (nullif(btrim(v_rules->>'source'),'') is null or v_rules->>'reviewedOn' is null))
     or (v_rules->>'reviewedOn')::date>(now() at time zone 'Australia/Perth')::date then raise exception 'roster_invalid_request'; end if;
   for v_need in select value from jsonb_array_elements(p_payload->'needs') loop
     if jsonb_typeof(v_need)<>'object' or (v_need-array['weekday','date','kind','grade','siteId','needed'])<>'{}'
       or (v_need->>'siteId' is not null and not exists(select 1 from public.on_call_service_sites where id=(v_need->>'siteId')::uuid and service_id=p_service_id)) then raise exception 'roster_invalid_request'; end if;
   end loop;
   if exists(select 1 from jsonb_array_elements(p_payload->'needs') n group by n->>'weekday',n->>'date',n->>'kind',n->>'grade',n->>'siteId' having count(*)>1) then raise exception 'roster_invalid_request'; end if;
   perform public.roster_command(p_actor_id,p_service_id,'needs.set',jsonb_build_object('needs',p_payload->'needs'));
   insert into public.roster_team_settings(service_id,rules,rules_source,rules_reviewed_on,updated_by)
   values(p_service_id,jsonb_strip_nulls(jsonb_build_object('minBreakHours',v_rules->'minBreakHours','maxHours7d',v_rules->'maxHours7d')),nullif(btrim(v_rules->>'source'),''),(v_rules->>'reviewedOn')::date,p_actor_id)
   on conflict(service_id) do update set rules=(public.roster_team_settings.rules-array['minBreakHours','maxHours7d'])||excluded.rules,
    rules_source=excluded.rules_source,rules_reviewed_on=excluded.rules_reviewed_on,updated_by=p_actor_id;
   return public.roster_maker_read(p_actor_id,p_service_id,null,false);
 elsif p_action in ('proposal.create','draft.reconcile') then
   select * into v_draft from public.roster_drafts where id=(p_payload->>'draftId')::uuid and service_id=p_service_id for update;
   if not found then raise exception 'roster_not_found'; end if;
   if jsonb_typeof(p_payload->'expectedVersion') is distinct from 'number' or v_draft.version is distinct from (p_payload->>'expectedVersion')::bigint then raise exception 'roster_conflict'; end if;
   v_before:=public.roster_maker_live_rows(p_service_id,v_draft.period_start,v_draft.period_end);
   v_rows:=public.roster_maker_draft_rows(v_draft.id);
   v_token:=public.roster_publish_fingerprint(p_service_id,v_draft.period_start,v_draft.period_end);
   if p_action='draft.reconcile' then
     if (p_payload-array['draftId','expectedVersion','expectedLiveToken'])<>'{}' or p_payload->>'expectedLiveToken' is distinct from v_token then raise exception 'roster_conflict'; end if;
     update public.roster_drafts set baseline_rows=v_before,version=version+1 where id=v_draft.id returning version into v_draft.version;
     return jsonb_build_object('draftId',v_draft.id,'version',v_draft.version);
   end if;
   if (p_payload-array['draftId','expectedVersion','scope','changeId','overrideChanges'])<>'{}' or p_payload->>'scope' not in ('full','change')
     or jsonb_typeof(v_overrides)<>'array' then raise exception 'roster_invalid_request'; end if;
   if v_draft.baseline_rows is null then raise exception 'roster_conflict'; end if;
   if p_payload->>'scope'='full' then
     if p_payload ? 'changeId' then raise exception 'roster_invalid_request'; end if;
     v_removed:=public.roster_maker_minus(v_draft.baseline_rows,v_rows);
     v_added:=public.roster_maker_minus(v_rows,v_draft.baseline_rows);
   else
     v_change_id:=(p_payload->>'changeId')::bigint;
     if exists(select 1 from public.roster_maker_proposals p where p.draft_id=v_draft.id and p.receipt is not null
       and (p.change_id=v_change_id or (p.scope='full' and p.history_through>=v_change_id))) then raise exception 'roster_conflict'; end if;
     select change into v_change from public.roster_changes where id=v_change_id and service_id=p_service_id and draft_id=v_draft.id and undone_at is null;
     if not found or not(v_change ? 'before' and v_change ? 'after') then raise exception 'roster_not_found'; end if;
     select coalesce(to_jsonb(a)-'draft_id','null') into v_row from public.roster_draft_assignments a where id=(v_change->>'id')::uuid and draft_id=v_draft.id;
     if coalesce(v_row,'null') is distinct from v_change->'after' then raise exception 'roster_conflict'; end if;
     v_removed:=case when v_change->'before'='null' then '[]'::jsonb else jsonb_build_array(public.roster_maker_row(v_change->'before')) end;
     v_added:=case when v_change->'after'='null' then '[]'::jsonb else jsonb_build_array(public.roster_maker_row(v_change->'after')) end;
     if public.roster_maker_minus(v_removed,v_draft.baseline_rows)<>'[]'::jsonb then raise exception 'roster_conflict'; end if;
   end if;
   -- Preserve live work untouched by this draft. Overlapping edits need explicit reconciliation.
   if public.roster_maker_minus(v_removed,v_before)<>'[]'::jsonb then raise exception 'roster_conflict'; end if;
   if exists(select 1 from jsonb_array_elements(v_added) x where x->>'userId' is null and x->>'rosterName' is null
     and (x->>'startsAt')::timestamptz<=now()) then raise exception 'roster_invalid_request'; end if;
   v_after:=public.roster_maker_sort(public.roster_maker_minus(v_before,v_removed)||v_added);
   v_next:=case when p_payload->>'scope'='full' then v_after else public.roster_maker_sort(public.roster_maker_minus(v_draft.baseline_rows,v_removed)||v_added) end;
   if jsonb_array_length(v_after)>5000 then raise exception 'roster_limit'; end if;
   if exists(select 1 from jsonb_array_elements(v_removed) x where x->>'userId' is null and x->>'rosterName' is not null) then v_blockers:=v_blockers||'"unlinked_duty"'::jsonb; end if;
   if exists(select 1 from jsonb_array_elements(v_removed||v_added) x where x->>'userId' is not null and not public.service_member_active(p_service_id,(x->>'userId')::uuid)) then v_blockers:=v_blockers||'"inactive_doctor"'::jsonb; end if;
   v_snapshot:=public.roster_publish_preview(p_actor_id,p_service_id,v_draft.period_start,v_draft.period_end);
   for v_row in select jsonb_build_object('kind','swap','id',x->'swapId','ids',jsonb_build_array(x->'giveAssignmentId',x->'takeAssignmentId')) from jsonb_array_elements(v_snapshot#>'{changes,swaps}') x
     union all select jsonb_build_object('kind','open','id',x->'openShiftId','ids',jsonb_build_array(x->'assignmentId')) from jsonb_array_elements(v_snapshot#>'{changes,openShifts}') x loop
     if exists(select 1 from public.roster_assignments a where a.service_id=p_service_id and a.id in(select value::text::uuid from jsonb_array_elements_text(v_row->'ids'))
       and public.roster_maker_row(to_jsonb(a)) in(select value from jsonb_array_elements(v_removed))) then
       v_protected:=v_protected||jsonb_build_array((v_row-array['ids'])||jsonb_build_object('before',
         (select coalesce(jsonb_agg(public.roster_maker_row(to_jsonb(a))),'[]') from public.roster_assignments a
          where a.service_id=p_service_id and a.id in(select value::text::uuid from jsonb_array_elements_text(v_row->'ids')))));
     end if;
   end loop;
   for v_row in select value from jsonb_array_elements(v_overrides) loop
     if not v_protected @> jsonb_build_array(v_row) then raise exception 'roster_invalid_request'; end if;
   end loop;
   if exists(select 1 from jsonb_array_elements(v_protected) p where not v_overrides @> jsonb_build_array(p-'before')) then v_blockers:=v_blockers||'"protected_change"'::jsonb; end if;
   select coalesce(jsonb_agg(jsonb_build_object('code',code,'kind',kind,'starts',starts,'ends',ends,'label',label) order by code),'[]') into v_codes from public.roster_shift_codes where service_id=p_service_id;
   v_payload:=jsonb_build_object('roles','[]'::jsonb,'codes',v_codes,'publication',jsonb_build_object('kind','full','periodStart',v_draft.period_start,'periodEnd',v_draft.period_end,'sourceName','Reviewed roster draft','assignments',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(v_after) x where x->>'userId' is not null or x->>'rosterName' is not null)),
     'openShifts',(select coalesce(jsonb_agg(jsonb_build_object('startsAt',x->'startsAt','endsAt',x->'endsAt','shiftCode',x->'shiftCode','kind',x->'kind','siteId',x->'siteId','minGrade',x->'grade','urgent',coalesce((select o.urgent from public.roster_open_shifts o where o.service_id=p_service_id and o.assignment_id is null and o.status='open'
       and o.starts_at=(x->>'startsAt')::timestamptz and o.ends_at=(x->>'endsAt')::timestamptz and o.site_id is not distinct from (x->>'siteId')::uuid
       and o.kind=x->>'kind' and o.shift_code=x->>'shiftCode' and o.min_grade is not distinct from x->>'grade' order by o.id limit 1),false))),'[]') from jsonb_array_elements(v_after) x where x->>'userId' is null and x->>'rosterName' is null and (x->>'startsAt')::timestamptz>now()),'overrideChanges',v_overrides);
   v_key:=md5(jsonb_build_object('draft',v_draft.id,'version',v_draft.version,'token',v_token,'scope',p_payload->>'scope','changeId',v_change_id,'payload',v_payload)::text);
   select * into v_proposal from public.roster_maker_proposals where service_id=p_service_id and request_key=v_key;
   if found then return jsonb_build_object('proposal',public.roster_maker_proposal_json(v_proposal.id)); end if;
   insert into public.roster_maker_proposals(service_id,draft_id,draft_version,scope,change_id,history_through,period_start,period_end,live_token,request_key,before_rows,after_rows,draft_rows,next_baseline,publish_payload,blockers,protected_changes,created_by)
   values(p_service_id,v_draft.id,v_draft.version,p_payload->>'scope',v_change_id,(select coalesce(max(id),0) from public.roster_changes where draft_id=v_draft.id),v_draft.period_start,v_draft.period_end,v_token,v_key,v_before,v_after,v_rows,v_next,v_payload,v_blockers,v_protected,p_actor_id) returning * into v_proposal;
   -- Add-only/initial publications need no consent; every changed/removed duty does.
   if exists(select 1 from jsonb_array_elements(v_removed) x where x->>'userId' is not null or x->>'rosterName' is not null) then
     for v_user in select distinct (x->>'userId')::uuid from jsonb_array_elements(v_removed||v_added) x where x->>'userId' is not null loop
       insert into public.roster_maker_consents(proposal_id,user_id,before_rows,after_rows)
       values(v_proposal.id,v_user,(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(v_before) x where x->>'userId'=v_user::text),
       (select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(v_after) x where x->>'userId'=v_user::text));
     end loop;
   end if;
   return jsonb_build_object('proposal',public.roster_maker_proposal_json(v_proposal.id));
 elsif p_action='proposal.publish' then
   if (p_payload-array['proposalId'])<>'{}' then raise exception 'roster_invalid_request'; end if;
   select * into v_proposal from public.roster_maker_proposals where id=(p_payload->>'proposalId')::uuid and service_id=p_service_id for update;
   if not found then raise exception 'roster_not_found'; end if;
   if v_proposal.receipt is not null then return v_proposal.receipt||jsonb_build_object('replayed',true); end if;
   select * into v_draft from public.roster_drafts where id=v_proposal.draft_id for update;
   if v_draft.version<>v_proposal.draft_version or v_proposal.live_token<>public.roster_publish_fingerprint(p_service_id,v_proposal.period_start,v_proposal.period_end) then raise exception 'roster_conflict'; end if;
   if jsonb_array_length(v_proposal.blockers)>0 or exists(select 1 from public.roster_maker_consents where proposal_id=v_proposal.id and (agreed_at is null or not public.service_member_active(p_service_id,user_id))) then raise exception 'roster_agreement_required'; end if;
   -- Retire only reviewed old vacancy instances before R2's same-slot reuse check.
   -- Original freshness was verified above; all changes still share this transaction/lock.
   for v_row in select value from jsonb_array_elements(public.roster_maker_minus(v_proposal.before_rows,v_proposal.after_rows))
     where value->>'userId' is null and value->>'rosterName' is null loop
     select id into v_id from public.roster_open_shifts o where o.service_id=p_service_id and o.assignment_id is null and o.status='open'
       and o.starts_at=(v_row->>'startsAt')::timestamptz and o.ends_at=(v_row->>'endsAt')::timestamptz
       and o.site_id is not distinct from (v_row->>'siteId')::uuid and o.min_grade is not distinct from v_row->>'grade'
       and o.kind=v_row->>'kind' and o.shift_code=v_row->>'shiftCode' order by id limit 1 for update;
     if not found then raise exception 'roster_conflict'; end if;
     update public.roster_open_shifts set status='cancelled',decided_at=now() where id=v_id;
   end loop;
   v_token:=public.roster_publish_fingerprint(p_service_id,v_proposal.period_start,v_proposal.period_end);
   perform set_config('roster.approved_proposal',v_proposal.id::text,true);
   v_result:=public.roster_publish(p_actor_id,p_service_id,v_token,v_proposal.publish_payload);
   perform set_config('roster.approved_proposal','',true);
   if v_proposal.scope='full' then
     -- Reconcile preserved live changes into the draft, retaining matching draft row IDs.
     for v_row in select value from jsonb_array_elements(v_proposal.after_rows) loop
       select id into v_id from public.roster_draft_assignments a where draft_id=v_draft.id and not(a.id=any(v_ids)) and public.roster_maker_row(to_jsonb(a))=v_row order by id limit 1;
       if v_id is null then
         insert into public.roster_draft_assignments(draft_id,user_id,roster_name,site_id,starts_at,ends_at,shift_code,kind,grade)
         values(v_draft.id,(v_row->>'userId')::uuid,v_row->>'rosterName',(v_row->>'siteId')::uuid,(v_row->>'startsAt')::timestamptz,(v_row->>'endsAt')::timestamptz,v_row->>'shiftCode',v_row->>'kind',v_row->>'grade') returning id into v_id;
       end if;
       v_ids:=array_append(v_ids,v_id);
     end loop;
     delete from public.roster_draft_assignments where draft_id=v_draft.id and not(id=any(v_ids));
   end if;
   update public.roster_drafts set baseline_rows=v_proposal.next_baseline,based_on_publication_id=(v_result->>'publicationId')::uuid,version=version+1 where id=v_draft.id returning version into v_draft.version;
   v_result:=v_result||jsonb_build_object('draftVersion',v_draft.version,'replayed',false);
   update public.roster_maker_proposals set receipt=v_result,published_at=now() where id=v_proposal.id;
   return v_result;
 end if;
 raise exception 'roster_invalid_request';
end $$;

-- Retain existing commands and grants; enforce consent at their common publication boundary.
create or replace function public.roster_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}')
returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role public.roster_member_roles;
  v_is_manager boolean;
  v_settings public.roster_team_settings;
  v_min_break numeric;
  v_pub public.roster_publications;
  v_swap public.roster_swaps;
  v_open public.roster_open_shifts;
  v_give public.roster_assignments;
  v_take public.roster_assignments;
  v_draft public.roster_drafts;
  v_assignment public.roster_draft_assignments;
  v_before jsonb;
  v_after jsonb;
  v_current jsonb;
  v_row jsonb;
  v_id uuid;
  v_change_id bigint;
  v_count integer;
  v_ids uuid[];
  v_problem text;
  v_reason text;
  v_giver_rank integer;
  v_taker_rank integer;
  v_result jsonb;
  v_from date;
  v_to date;
begin
  if p_actor_id is null then raise exception 'roster_auth_required'; end if;
  if p_service_id is null or p_action is null then raise exception 'roster_invalid_request'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'roster_invalid_request'; end if;

  -- Removing a member changes membership, so it takes the service row FOR UPDATE, as On Call
  -- does; every other action takes it FOR SHARE. Never upgrade a lock mid-call.
  if p_action = 'member.remove' then
    select * into v_service from public.on_call_services where id = p_service_id for update;
  else
    select * into v_service from public.on_call_services where id = p_service_id for share;
  end if;
  if not found or not public.service_member_active(p_service_id, p_actor_id) then
    raise exception 'roster_access_denied';
  end if;
  if v_service.verified_at is null and not v_service.is_demo then raise exception 'roster_team_not_verified'; end if;

  -- Seen receipts are a check-in: the share lock is enough, and they never wait on other writes.
  if p_action = 'seen.mark' then
    select * into v_pub from public.roster_publications
     where service_id = p_service_id and id = (p_payload ->> 'publicationId')::uuid;
    if not found then raise exception 'roster_not_found'; end if;
    insert into public.roster_publication_seen (publication_id, user_id) values (v_pub.id, p_actor_id)
      on conflict do nothing;
    return jsonb_build_object('ok', true);
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74817));

  select * into v_role from public.roster_member_roles
   where service_id = p_service_id and user_id = p_actor_id and revoked_at is null;
  v_is_manager := found and v_role.role = 'manager';
  select * into v_settings from public.roster_team_settings where service_id = p_service_id;
  v_min_break := nullif(v_settings.rules ->> 'minBreakHours', '')::numeric;

  -- ---------------------------------------------------------------- people and settings
  if p_action = 'role.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_id := (p_payload ->> 'userId')::uuid;
    if v_id is null or not public.service_member_active(p_service_id, v_id) then raise exception 'roster_not_found'; end if;
    if p_payload ? 'grade' and p_payload ->> 'grade' is not null
       and p_payload ->> 'grade' not in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other') then
      raise exception 'roster_invalid_request';
    end if;
    insert into public.roster_member_roles (service_id, user_id, role, grade, roster_name, rotation_ends_on, granted_by)
    values (p_service_id, v_id, 'member', p_payload ->> 'grade', nullif(btrim(p_payload ->> 'rosterName'), ''),
            (p_payload ->> 'rotationEndsOn')::date, p_actor_id)
    on conflict (service_id, user_id) do update set
      grade = case when p_payload ? 'grade' then excluded.grade else public.roster_member_roles.grade end,
      roster_name = case when p_payload ? 'rosterName' then excluded.roster_name else public.roster_member_roles.roster_name end,
      rotation_ends_on = case when p_payload ? 'rotationEndsOn' then excluded.rotation_ends_on else public.roster_member_roles.rotation_ends_on end,
      role = case when public.roster_member_roles.revoked_at is null then public.roster_member_roles.role else 'member' end,
      revoked_at = null;
    return jsonb_build_object('ok', true);

  elsif p_action = 'member.remove' then
    -- Someone who leaves the team. Only ordinary service members; editors and admins are
    -- removed in On Call by a service admin. Revoking fires every mode's cascade trigger.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_id := (p_payload ->> 'userId')::uuid;
    if v_id is null or v_id = p_actor_id then raise exception 'roster_invalid_request'; end if;
    update public.on_call_service_members set revoked_at = now(), clinical_reviewer = false
     where service_id = p_service_id and user_id = v_id and revoked_at is null and role = 'member';
    if not found then raise exception 'roster_not_found'; end if;
    insert into public.on_call_service_member_events (service_id, user_id, event, mode, actor_id)
    values (p_service_id, v_id, 'revoked', null, p_actor_id);
    return jsonb_build_object('ok', true);

  elsif p_action = 'settings.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    insert into public.roster_team_settings (service_id, swap_approval, rules, rules_source, pay_fortnight_anchor, updated_by)
    values (p_service_id,
            coalesce(p_payload ->> 'swapApproval', 'auto_same_grade'),
            coalesce(p_payload -> 'rules', '{}'::jsonb),
            nullif(btrim(p_payload ->> 'rulesSource'), ''),
            (p_payload ->> 'payFortnightAnchor')::date,
            p_actor_id)
    on conflict (service_id) do update set
      swap_approval = excluded.swap_approval, rules = excluded.rules, rules_source = excluded.rules_source,
      pay_fortnight_anchor = excluded.pay_fortnight_anchor, updated_by = excluded.updated_by;
    return jsonb_build_object('ok', true);

  elsif p_action = 'unavailability.set' then
    -- payload {set: [{date, kind}], clear: [date]} for the actor only, future dates only.
    delete from public.roster_unavailability
     where service_id = p_service_id and user_id = p_actor_id
       and on_date in (select (value #>> '{}')::date from jsonb_array_elements(coalesce(p_payload -> 'clear', '[]')));
    insert into public.roster_unavailability (service_id, user_id, on_date, kind)
    select p_service_id, p_actor_id, (value ->> 'date')::date, value ->> 'kind'
    from jsonb_array_elements(coalesce(p_payload -> 'set', '[]'))
    where (value ->> 'date')::date > (now() at time zone 'Australia/Perth')::date
    on conflict (service_id, user_id, on_date) do update set kind = excluded.kind;
    if (select count(*) from public.roster_unavailability where service_id = p_service_id and user_id = p_actor_id) > 120 then
      raise exception 'roster_limit';
    end if;
    return jsonb_build_object('ok', true);

  -- ---------------------------------------------------------------- publishing
  elsif p_action = 'publish' then
    -- payload {kind, periodStart, periodEnd, sourceName?, replaceAssignmentIds?[], assignments[], draftId?}
    -- The app has already settled rows it couldn't match and approved swaps the file would undo;
    -- this step is all or nothing.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_from := (p_payload ->> 'periodStart')::date;
    v_to := (p_payload ->> 'periodEnd')::date;
    if v_from is null or v_to is null or jsonb_typeof(p_payload -> 'assignments') is distinct from 'array'
       or jsonb_array_length(p_payload -> 'assignments') > 5000
       or coalesce(p_payload ->> 'kind', 'full') not in ('full', 'single_change') then
      raise exception 'roster_invalid_request';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where (x ->> 'userId') is not null
        and not public.service_member_active(p_service_id, (x ->> 'userId')::uuid)
    ) or exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where (x ->> 'userId') is null and nullif(btrim(x ->> 'rosterName'), '') is null
    ) or exists (
      select 1 from jsonb_array_elements(p_payload -> 'assignments') x
      where ((x ->> 'startsAt')::timestamptz at time zone 'Australia/Perth')::date not between v_from and v_to
    ) then
      raise exception 'roster_invalid_request';
    end if;

    perform public.roster_maker_assert_publication(p_service_id, p_payload);
    insert into public.roster_publications (service_id, version, kind, period_start, period_end, source_name, published_by)
    values (p_service_id,
            coalesce((select max(version) from public.roster_publications where service_id = p_service_id), 0) + 1,
            coalesce(p_payload ->> 'kind', 'full'), v_from, v_to, nullif(btrim(p_payload ->> 'sourceName'), ''), p_actor_id)
    returning * into v_pub;

    if v_pub.kind = 'full' then
      with replaced as (
        update public.roster_assignments set superseded_at = now()
         where service_id = p_service_id and superseded_at is null
           and (starts_at at time zone 'Australia/Perth')::date between v_from and v_to
        returning id
      )
      select coalesce(array_agg(id), '{}') into v_ids from replaced;
    else
      select coalesce(array_agg((value #>> '{}')::uuid), '{}') into v_ids
        from jsonb_array_elements(coalesce(p_payload -> 'replaceAssignmentIds', '[]'));
      update public.roster_assignments set superseded_at = now()
       where service_id = p_service_id and superseded_at is null and id = any (v_ids);
      get diagnostics v_count = row_count;
      if v_count <> coalesce(array_length(v_ids, 1), 0) then raise exception 'roster_conflict'; end if;
    end if;

    insert into public.roster_assignments (service_id, publication_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
    select p_service_id, v_pub.id, (x ->> 'userId')::uuid, nullif(btrim(x ->> 'rosterName'), ''), (x ->> 'siteId')::uuid,
           (x ->> 'startsAt')::timestamptz, (x ->> 'endsAt')::timestamptz, btrim(x ->> 'shiftCode'), x ->> 'kind', x ->> 'grade'
    from jsonb_array_elements(p_payload -> 'assignments') x;

    -- Pending requests on replaced shifts cancel themselves and say why.
    with cancelled as (
      update public.roster_swaps set status = 'cancelled', cancel_reason = 'roster_changed', decided_at = now()
       where service_id = p_service_id and status in ('requested', 'accepted')
         and (give_assignment_id = any (v_ids) or take_assignment_id = any (v_ids))
      returning id, requester_id, counterparty_id
    )
    select jsonb_build_object('swapsCancelled', coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'requesterId', requester_id, 'counterpartyId', counterparty_id)), '[]')) into v_result from cancelled;
    update public.roster_open_shifts set status = 'cancelled', decided_at = now()
     where service_id = p_service_id and status in ('reported', 'open', 'claimed') and assignment_id = any (v_ids);

    insert into public.roster_changes (service_id, target, source, change, actor_id)
    values (p_service_id, 'live', 'publish',
            jsonb_build_object('kind', 'publish', 'publicationId', v_pub.id, 'version', v_pub.version,
                               'replaced', coalesce(array_length(v_ids, 1), 0),
                               'rows', jsonb_array_length(p_payload -> 'assignments')),
            p_actor_id);
    -- The manager has seen their own roster.
    insert into public.roster_publication_seen (publication_id, user_id) values (v_pub.id, p_actor_id);
    if p_payload ? 'draftId' then
      delete from public.roster_drafts where id = (p_payload ->> 'draftId')::uuid and service_id = p_service_id;
    end if;
    return v_result || jsonb_build_object('publicationId', v_pub.id, 'version', v_pub.version);

  -- ---------------------------------------------------------------- swaps
  elsif p_action in ('swap.create', 'swap.accept', 'swap.approve') then
    if p_action = 'swap.create' then
      select * into v_give from public.roster_assignments
       where id = (p_payload ->> 'giveAssignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
      if not found or v_give.user_id is distinct from p_actor_id or v_give.starts_at <= now() or v_give.kind = 'leave' then
        raise exception 'roster_not_found';
      end if;
      v_id := (p_payload ->> 'counterpartyId')::uuid;
      if v_id is null or v_id = p_actor_id or not public.service_member_active(p_service_id, v_id) then
        raise exception 'roster_not_found';
      end if;
      if p_payload ->> 'takeAssignmentId' is not null then
        select * into v_take from public.roster_assignments
         where id = (p_payload ->> 'takeAssignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
        if not found or v_take.user_id is distinct from v_id or v_take.starts_at <= now() or v_take.kind = 'leave' then
          raise exception 'roster_not_found';
        end if;
      end if;
      if exists (select 1 from public.roster_swaps w where w.status in ('requested', 'accepted')
                 and (w.give_assignment_id in (v_give.id, v_take.id) or w.take_assignment_id in (v_give.id, v_take.id)))
         or exists (select 1 from public.roster_open_shifts o where o.status in ('reported', 'open', 'claimed')
                 and o.assignment_id in (v_give.id, v_take.id)) then
        raise exception 'roster_request_exists';
      end if;
      insert into public.roster_swaps (service_id, requester_id, counterparty_id, give_assignment_id, take_assignment_id, expires_at)
      values (p_service_id, p_actor_id, v_id, v_give.id, v_take.id,
              least(v_give.starts_at, coalesce(v_take.starts_at, v_give.starts_at), now() + interval '7 days'))
      returning * into v_swap;
    else
      select * into v_swap from public.roster_swaps
       where id = (p_payload ->> 'swapId')::uuid and service_id = p_service_id for update;
      if not found then raise exception 'roster_not_found'; end if;
      if p_action = 'swap.accept' and (v_swap.counterparty_id <> p_actor_id or v_swap.status <> 'requested') then
        raise exception 'roster_not_found';
      end if;
      if p_action = 'swap.approve' and (not v_is_manager or v_swap.status <> 'accepted') then
        raise exception 'roster_role_denied';
      end if;
      -- A manager never approves a swap they are part of.
      if p_action = 'swap.approve' and p_actor_id in (v_swap.requester_id, v_swap.counterparty_id) then
        raise exception 'roster_role_denied';
      end if;
      if v_swap.expires_at <= now() then
        update public.roster_swaps set status = 'expired', decided_at = now() where id = v_swap.id;
        return jsonb_build_object('swapId', v_swap.id, 'status', 'expired');
      end if;
      select * into v_give from public.roster_assignments where id = v_swap.give_assignment_id for update;
      select * into v_take from public.roster_assignments where id = v_swap.take_assignment_id for update;
    end if;

    -- Recheck at every step: still live, still theirs, still eligible, still fits.
    v_reason := null;
    if v_give.superseded_at is not null or v_give.user_id is distinct from v_swap.requester_id
       or (v_swap.take_assignment_id is not null
           and (v_take.superseded_at is not null or v_take.user_id is distinct from v_swap.counterparty_id)) then
      v_reason := 'roster_changed';
    else
      v_giver_rank := public.roster_grade_rank(coalesce(v_give.grade,
        (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null)));
      v_taker_rank := public.roster_grade_rank(
        (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.counterparty_id and revoked_at is null));
      if v_giver_rank is null or v_taker_rank is null or v_taker_rank < v_giver_rank then
        v_reason := 'no_longer_fits';
      elsif v_swap.take_assignment_id is not null and (
          public.roster_grade_rank(coalesce(v_take.grade,
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.counterparty_id and revoked_at is null)))
          > public.roster_grade_rank(
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null))
          or public.roster_grade_rank(
            (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_swap.requester_id and revoked_at is null)) is null) then
        v_reason := 'no_longer_fits';
      elsif public.roster_placement_problem(p_service_id, v_swap.counterparty_id, v_give.starts_at, v_give.ends_at,
              array[v_take.id], null) = 'clash'
         or (v_swap.take_assignment_id is not null and public.roster_placement_problem(p_service_id, v_swap.requester_id,
              v_take.starts_at, v_take.ends_at, array[v_give.id], null) = 'clash') then
        v_reason := 'no_longer_fits';
      end if;
    end if;
    if v_reason is not null then
      if p_action = 'swap.create' then raise exception 'roster_swap_not_eligible'; end if;
      update public.roster_swaps set status = 'cancelled', cancel_reason = v_reason, decided_at = now() where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'cancelled', 'cancelReason', v_reason);
    end if;
    if p_action = 'swap.create' then
      return jsonb_build_object('swapId', v_swap.id, 'status', 'requested');
    end if;

    if p_action = 'swap.accept' then
      -- Does it need the manager? Team setting, then within 7 days, then grade, then team rule.
      v_reason := case
        when coalesce(v_settings.swap_approval, 'auto_same_grade') = 'manager' then 'team_setting'
        when least(v_give.starts_at, coalesce(v_take.starts_at, v_give.starts_at)) < now() + interval '7 days' then 'within_7_days'
        when v_taker_rank <> v_giver_rank then 'different_grade'
        when public.roster_placement_problem(p_service_id, v_swap.counterparty_id, v_give.starts_at, v_give.ends_at, array[v_take.id], v_min_break) is not null
          or (v_swap.take_assignment_id is not null and public.roster_placement_problem(p_service_id, v_swap.requester_id,
                v_take.starts_at, v_take.ends_at, array[v_give.id], v_min_break) is not null) then 'team_rule'
        else null end;
      if v_reason is not null then
        update public.roster_swaps set status = 'accepted', accepted_at = now(), needs_manager_because = v_reason
         where id = v_swap.id;
        return jsonb_build_object('swapId', v_swap.id, 'status', 'accepted', 'needsManagerBecause', v_reason);
      end if;
    end if;

    -- Apply: both shifts change hands together, with the undo saved in the same step.
    update public.roster_assignments set user_id = v_swap.counterparty_id, roster_name = null where id = v_give.id;
    if v_swap.take_assignment_id is not null then
      update public.roster_assignments set user_id = v_swap.requester_id, roster_name = null where id = v_take.id;
    end if;
    update public.roster_swaps
       set status = 'approved', auto_approved = (p_action = 'swap.accept'),
           accepted_at = coalesce(accepted_at, now()), decided_at = now(),
           decided_by = case when p_action = 'swap.approve' then p_actor_id else null end
     where id = v_swap.id;
    insert into public.roster_changes (service_id, target, source, change, undo, actor_id)
    values (p_service_id, 'live', 'swap',
            jsonb_build_object('kind', 'swap', 'swapId', v_swap.id),
            jsonb_build_object('assignments', jsonb_build_array(
              jsonb_build_object('id', v_give.id, 'userId', v_give.user_id, 'rosterName', v_give.roster_name))
              || case when v_take.id is null then '[]'::jsonb else jsonb_build_array(
              jsonb_build_object('id', v_take.id, 'userId', v_take.user_id, 'rosterName', v_take.roster_name)) end),
            p_actor_id);
    -- Any other request that relied on these shifts no longer fits.
    update public.roster_swaps set status = 'cancelled', cancel_reason = 'roster_changed', decided_at = now()
     where service_id = p_service_id and id <> v_swap.id and status in ('requested', 'accepted')
       and (give_assignment_id in (v_give.id, v_take.id) or take_assignment_id in (v_give.id, v_take.id));
    return jsonb_build_object('swapId', v_swap.id, 'status', 'approved', 'autoApproved', p_action = 'swap.accept');

  elsif p_action in ('swap.decline', 'swap.cancel', 'swap.undo') then
    select * into v_swap from public.roster_swaps
     where id = (p_payload ->> 'swapId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;
    if p_action = 'swap.decline' then
      if not ((v_swap.status = 'requested' and v_swap.counterparty_id = p_actor_id)
              or (v_swap.status = 'accepted' and v_is_manager and p_actor_id not in (v_swap.requester_id, v_swap.counterparty_id))) then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_swaps set status = 'declined', decided_at = now(),
             decided_by = case when v_swap.status = 'accepted' then p_actor_id else null end
       where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'declined');
    elsif p_action = 'swap.cancel' then
      if v_swap.requester_id <> p_actor_id or v_swap.status not in ('requested', 'accepted') then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_swaps set status = 'cancelled', cancel_reason = 'withdrawn', decided_at = now() where id = v_swap.id;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'cancelled');
    else
      -- "Undo for 10 min" after a swap approved itself, by either doctor, if nothing moved since.
      if not v_swap.auto_approved or v_swap.status <> 'approved' or v_swap.decided_at < now() - interval '10 minutes'
         or p_actor_id not in (v_swap.requester_id, v_swap.counterparty_id) then
        raise exception 'roster_role_denied';
      end if;
      select * into v_give from public.roster_assignments where id = v_swap.give_assignment_id for update;
      select * into v_take from public.roster_assignments where id = v_swap.take_assignment_id for update;
      if v_give.superseded_at is not null or v_give.user_id is distinct from v_swap.counterparty_id
         or (v_take.id is not null and (v_take.superseded_at is not null or v_take.user_id is distinct from v_swap.requester_id)) then
        raise exception 'roster_conflict';
      end if;
      update public.roster_assignments set user_id = v_swap.requester_id where id = v_give.id;
      if v_take.id is not null then
        update public.roster_assignments set user_id = v_swap.counterparty_id where id = v_take.id;
      end if;
      update public.roster_swaps set status = 'undone', decided_at = now() where id = v_swap.id;
      update public.roster_changes set undone_at = now(), undone_by = p_actor_id
       where service_id = p_service_id and source = 'swap' and change ->> 'swapId' = v_swap.id::text and undone_at is null;
      return jsonb_build_object('swapId', v_swap.id, 'status', 'undone');
    end if;

  -- ---------------------------------------------------------------- open shifts
  elsif p_action in ('open.post', 'open.report') then
    -- open.post: a member gives away their own shift, or a manager posts any live shift or a gap.
    -- open.report: "I can't make my shift": waits as 'reported' for the manager to release it.
    if p_payload ->> 'assignmentId' is not null then
      select * into v_give from public.roster_assignments
       where id = (p_payload ->> 'assignmentId')::uuid and service_id = p_service_id and superseded_at is null for update;
      if not found or v_give.ends_at <= now() or v_give.kind = 'leave'
         or (not v_is_manager and v_give.user_id is distinct from p_actor_id) then
        raise exception 'roster_not_found';
      end if;
      if exists (select 1 from public.roster_swaps w where w.status in ('requested', 'accepted')
                 and (w.give_assignment_id = v_give.id or w.take_assignment_id = v_give.id)) then
        raise exception 'roster_request_exists';
      end if;
      insert into public.roster_open_shifts (service_id, assignment_id, starts_at, ends_at, shift_code, kind, site_id,
                                             min_grade, urgent, status, posted_by)
      values (p_service_id, v_give.id, v_give.starts_at, v_give.ends_at, v_give.shift_code, v_give.kind, v_give.site_id,
              coalesce(nullif(v_give.grade, 'other'),
                       nullif((select grade from public.roster_member_roles where service_id = p_service_id
                               and user_id = v_give.user_id and revoked_at is null), 'other')),
              case when p_action = 'open.report' then true else coalesce((p_payload ->> 'urgent')::boolean, false) and v_is_manager end,
              case when p_action = 'open.report' then 'reported' else 'open' end, p_actor_id)
      returning * into v_open;
    else
      if p_action = 'open.report' or not v_is_manager then raise exception 'roster_role_denied'; end if;
      insert into public.roster_open_shifts (service_id, starts_at, ends_at, shift_code, kind, site_id, min_grade, urgent, posted_by)
      values (p_service_id, (p_payload ->> 'startsAt')::timestamptz, (p_payload ->> 'endsAt')::timestamptz,
              btrim(p_payload ->> 'shiftCode'), p_payload ->> 'kind', (p_payload ->> 'siteId')::uuid,
              p_payload ->> 'minGrade', coalesce((p_payload ->> 'urgent')::boolean, false), p_actor_id)
      returning * into v_open;
      if v_open.starts_at <= now() then raise exception 'roster_invalid_request'; end if;
    end if;
    if (select count(*) from public.roster_open_shifts where service_id = p_service_id and status in ('reported', 'open', 'claimed')) > 1000 then
      raise exception 'roster_limit';
    end if;
    return jsonb_build_object('openShiftId', v_open.id, 'status', v_open.status);

  elsif p_action in ('open.claim', 'open.approve', 'open.decline', 'open.cancel', 'open.release') then
    select * into v_open from public.roster_open_shifts
     where id = (p_payload ->> 'openShiftId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;

    if p_action = 'open.release' then
      if not v_is_manager or v_open.status <> 'reported' then raise exception 'roster_role_denied'; end if;
      update public.roster_open_shifts set status = 'open', urgent = coalesce((p_payload ->> 'urgent')::boolean, true)
       where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'open');
    elsif p_action = 'open.cancel' then
      if v_open.status not in ('reported', 'open', 'claimed') or not (v_is_manager or v_open.posted_by = p_actor_id) then
        raise exception 'roster_role_denied';
      end if;
      update public.roster_open_shifts set status = 'cancelled', decided_at = now(), decided_by = p_actor_id where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'cancelled');
    elsif p_action = 'open.decline' then
      if not v_is_manager or v_open.status <> 'claimed' or v_open.claimed_by = p_actor_id then raise exception 'roster_role_denied'; end if;
      update public.roster_open_shifts set status = 'open', claimed_by = null, claimed_at = null where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'open');
    end if;

    if p_action = 'open.claim' then
      if v_open.status <> 'open' then raise exception 'roster_open_shift_taken'; end if;
      if v_open.starts_at <= now() or v_open.posted_by = p_actor_id then raise exception 'roster_not_found'; end if;
      v_id := p_actor_id;
    else
      if not v_is_manager or v_open.status <> 'claimed' or v_open.claimed_by = p_actor_id then raise exception 'roster_role_denied'; end if;
      v_id := v_open.claimed_by;
    end if;
    v_taker_rank := public.roster_grade_rank(
      (select grade from public.roster_member_roles where service_id = p_service_id and user_id = v_id and revoked_at is null));
    if v_taker_rank is null or (v_open.min_grade is not null and v_taker_rank < public.roster_grade_rank(v_open.min_grade))
       or public.roster_placement_problem(p_service_id, v_id, v_open.starts_at, v_open.ends_at,
            array[v_open.assignment_id], null) is not null then
      raise exception 'roster_swap_not_eligible';
    end if;
    if p_action = 'open.claim' and (
         coalesce(v_settings.swap_approval, 'auto_same_grade') = 'manager'
         or v_open.starts_at < now() + interval '7 days'
         or v_open.min_grade is null or v_taker_rank <> public.roster_grade_rank(v_open.min_grade)
         or public.roster_placement_problem(p_service_id, v_id, v_open.starts_at, v_open.ends_at,
              array[v_open.assignment_id], v_min_break) is not null) then
      update public.roster_open_shifts set status = 'claimed', claimed_by = v_id, claimed_at = now() where id = v_open.id;
      return jsonb_build_object('openShiftId', v_open.id, 'status', 'claimed');
    end if;

    -- Apply: the shift moves to the taker (or a gap becomes their shift), with its undo.
    if v_open.assignment_id is not null then
      select * into v_give from public.roster_assignments where id = v_open.assignment_id for update;
      if v_give.superseded_at is not null then raise exception 'roster_conflict'; end if;
      update public.roster_assignments set user_id = v_id, roster_name = null where id = v_give.id;
      v_row := jsonb_build_object('id', v_give.id, 'userId', v_give.user_id, 'rosterName', v_give.roster_name);
    else
      select * into v_pub from public.roster_publications where service_id = p_service_id order by version desc limit 1;
      if not found then raise exception 'roster_conflict'; end if;
      insert into public.roster_assignments (service_id, publication_id, user_id, site_id, starts_at, ends_at, shift_code, kind, grade)
      values (p_service_id, v_pub.id, v_id, v_open.site_id, v_open.starts_at, v_open.ends_at, v_open.shift_code, v_open.kind, v_open.min_grade)
      returning * into v_give;
      v_row := jsonb_build_object('id', v_give.id, 'delete', true);
    end if;
    update public.roster_open_shifts
       set status = 'approved', claimed_by = v_id, claimed_at = coalesce(claimed_at, now()), decided_at = now(),
           decided_by = case when p_action = 'open.approve' then p_actor_id else null end
     where id = v_open.id;
    insert into public.roster_changes (service_id, target, source, change, undo, actor_id)
    values (p_service_id, 'live', 'open_shift', jsonb_build_object('kind', 'open_shift', 'openShiftId', v_open.id),
            jsonb_build_object('assignments', jsonb_build_array(v_row)), p_actor_id);
    return jsonb_build_object('openShiftId', v_open.id, 'status', 'approved', 'assignmentId', v_give.id);

  -- ---------------------------------------------------------------- roster maker (Release 3)
  elsif p_action = 'codes.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    delete from public.roster_shift_codes where service_id = p_service_id;
    insert into public.roster_shift_codes (service_id, code, kind, starts, ends, label)
    select p_service_id, btrim(x ->> 'code'), x ->> 'kind', (x ->> 'starts')::time, (x ->> 'ends')::time, nullif(btrim(x ->> 'label'), '')
    from jsonb_array_elements(coalesce(p_payload -> 'codes', '[]')) x;
    if (select count(*) from public.roster_shift_codes where service_id = p_service_id) > 100 then raise exception 'roster_limit'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'needs.set' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    delete from public.roster_staffing_needs where service_id = p_service_id;
    insert into public.roster_staffing_needs (service_id, weekday, on_date, kind, grade, site_id, needed)
    select p_service_id, (x ->> 'weekday')::smallint, (x ->> 'date')::date, x ->> 'kind', x ->> 'grade',
           (x ->> 'siteId')::uuid, (x ->> 'needed')::smallint
    from jsonb_array_elements(coalesce(p_payload -> 'needs', '[]')) x;
    if (select count(*) from public.roster_staffing_needs where service_id = p_service_id) > 2000 then raise exception 'roster_limit'; end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'draft.open' then
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    v_from := (p_payload ->> 'periodStart')::date;
    v_to := (p_payload ->> 'periodEnd')::date;
    if v_from is null or v_to is null or v_to < v_from or v_to - v_from > 186 then
      raise exception 'roster_invalid_request';
    end if;
    select * into v_draft from public.roster_drafts
     where service_id = p_service_id and period_start = v_from and period_end = v_to for update;
    if found then return jsonb_build_object('draftId', v_draft.id, 'created', false, 'version', v_draft.version); end if;
    if (select count(*) from public.roster_drafts where service_id = p_service_id) >= 12 then raise exception 'roster_limit'; end if;
    insert into public.roster_drafts (service_id, period_start, period_end, based_on_publication_id, created_by)
    values (p_service_id, v_from, v_to,
            (select id from public.roster_publications where service_id = p_service_id order by version desc limit 1), p_actor_id)
    returning * into v_draft;
    insert into public.roster_draft_assignments (draft_id, user_id, roster_name, site_id, starts_at, ends_at, shift_code, kind, grade)
    select v_draft.id, a.user_id, case when a.user_id is null then coalesce(a.roster_name,'Unlinked published doctor') else a.roster_name end, a.site_id, a.starts_at, a.ends_at, a.shift_code, a.kind, a.grade
    from public.roster_assignments a
    where a.service_id = p_service_id and a.superseded_at is null
      and (a.starts_at at time zone 'Australia/Perth')::date between v_from and v_to;
    if (select count(*) from public.roster_draft_assignments where draft_id = v_draft.id) > 5000 then raise exception 'roster_limit'; end if;
    insert into public.roster_draft_assignments(draft_id,site_id,starts_at,ends_at,shift_code,kind,grade)
    select v_draft.id,o.site_id,o.starts_at,o.ends_at,o.shift_code,o.kind,o.min_grade from public.roster_open_shifts o
    where o.service_id=p_service_id and o.assignment_id is null and o.status='open'
      and (o.starts_at at time zone 'Australia/Perth')::date between v_from and v_to;
    if (select count(*) from public.roster_draft_assignments where draft_id=v_draft.id)>5000 then raise exception 'roster_limit'; end if;
    update public.roster_drafts set baseline_rows=public.roster_maker_draft_rows(v_draft.id) where id=v_draft.id;
    return jsonb_build_object('draftId', v_draft.id, 'created', true, 'version', v_draft.version);

  elsif p_action in ('draft.change', 'draft.undo') then
    -- The service SHARE and team advisory locks above serialize edits and role removal.
    if not v_is_manager then raise exception 'roster_role_denied'; end if;
    if jsonb_typeof(p_payload -> 'expectedVersion') is distinct from 'number'
       or (p_payload ->> 'expectedVersion') !~ '^[1-9][0-9]{0,15}$'
       or (p_payload ->> 'expectedVersion')::numeric > 9007199254740991 then
      raise exception 'roster_invalid_request';
    end if;
    select * into v_draft from public.roster_drafts
     where id = (p_payload ->> 'draftId')::uuid and service_id = p_service_id for update;
    if not found then raise exception 'roster_not_found'; end if;
    if v_draft.version <> (p_payload ->> 'expectedVersion')::bigint then raise exception 'roster_conflict'; end if;

    if p_action = 'draft.change' then
      if coalesce(p_payload ->> 'source', '') not in ('typed', 'grid', 'upload')
         or jsonb_typeof(p_payload -> 'ops') is distinct from 'array' then
        raise exception 'roster_invalid_request';
      end if;
      if jsonb_array_length(p_payload -> 'ops') not between 1 and 500 then raise exception 'roster_invalid_request'; end if;
      for v_row in select value from jsonb_array_elements(p_payload -> 'ops') loop
        if jsonb_typeof(v_row) <> 'object' or coalesce(v_row ->> 'op', '') not in ('add', 'update', 'remove') then
          raise exception 'roster_invalid_request';
        end if;
        v_before := null;
        v_after := null;
        if v_row ->> 'op' = 'add' then
          v_assignment := null;
          v_assignment.id := gen_random_uuid();
          v_assignment.draft_id := v_draft.id;
        else
          select * into v_assignment from public.roster_draft_assignments
           where id = (v_row ->> 'id')::uuid and draft_id = v_draft.id for update;
          if not found then raise exception 'roster_conflict'; end if;
          v_before := to_jsonb(v_assignment) - 'draft_id';
        end if;
        v_id := v_assignment.id;
        if v_row ->> 'op' = 'remove' then
          delete from public.roster_draft_assignments where id = v_id and draft_id = v_draft.id;
        else
          if jsonb_typeof(v_row -> 'row') is distinct from 'object' then raise exception 'roster_invalid_request'; end if;
          -- Only structured, normalized fields enter history; never the submitted text.
          if v_row -> 'row' ? 'userId' then v_assignment.user_id := (v_row #>> '{row,userId}')::uuid; end if;
          if v_row -> 'row' ? 'rosterName' then v_assignment.roster_name := nullif(btrim(v_row #>> '{row,rosterName}'), ''); end if;
          if v_row -> 'row' ? 'siteId' then v_assignment.site_id := (v_row #>> '{row,siteId}')::uuid; end if;
          if v_row -> 'row' ? 'startsAt' then v_assignment.starts_at := (v_row #>> '{row,startsAt}')::timestamptz; end if;
          if v_row -> 'row' ? 'endsAt' then v_assignment.ends_at := (v_row #>> '{row,endsAt}')::timestamptz; end if;
          if v_row -> 'row' ? 'shiftCode' then v_assignment.shift_code := btrim(v_row #>> '{row,shiftCode}'); end if;
          if v_row -> 'row' ? 'kind' then v_assignment.kind := v_row #>> '{row,kind}'; end if;
          if v_row -> 'row' ? 'grade' then v_assignment.grade := v_row #>> '{row,grade}'; end if;
          if v_assignment.starts_at is null or v_assignment.ends_at is null
           or not isfinite(v_assignment.starts_at) or not isfinite(v_assignment.ends_at)
           or v_assignment.ends_at <= v_assignment.starts_at
           or v_assignment.ends_at - v_assignment.starts_at > interval '36 hours'
           or (v_assignment.starts_at at time zone 'Australia/Perth')::date not between v_draft.period_start and v_draft.period_end
           or v_assignment.shift_code is null or char_length(v_assignment.shift_code) not between 1 and 12
           or v_assignment.kind is null or v_assignment.kind not in ('day', 'evening', 'night', 'on_call', 'leave', 'other')
           or (v_assignment.grade is not null and v_assignment.grade not in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other'))
           or char_length(v_assignment.roster_name) > 80
           or (v_assignment.user_id is not null and not public.service_member_active(p_service_id, v_assignment.user_id))
           or (v_assignment.site_id is not null and not exists (
             select 1 from public.on_call_service_sites s where s.id = v_assignment.site_id and s.service_id = p_service_id)) then
          raise exception 'roster_invalid_request';
        end if;
          if v_row ->> 'op' = 'add' then
            insert into public.roster_draft_assignments select v_assignment.*;
          else
            update public.roster_draft_assignments set
              user_id = v_assignment.user_id, roster_name = v_assignment.roster_name, site_id = v_assignment.site_id,
              starts_at = v_assignment.starts_at, ends_at = v_assignment.ends_at, shift_code = v_assignment.shift_code,
              kind = v_assignment.kind, grade = v_assignment.grade
            where id = v_id and draft_id = v_draft.id;
          end if;
          v_after := to_jsonb(v_assignment) - 'draft_id';
        end if;
        insert into public.roster_changes (service_id, draft_id, target, source, change, undo, actor_id)
        values (p_service_id, v_draft.id, 'draft', p_payload ->> 'source',
                jsonb_build_object('op', v_row ->> 'op', 'id', v_id, 'before', v_before, 'after', v_after),
                jsonb_build_object('op', 'restore', 'id', v_id, 'row', v_before), p_actor_id)
        returning id into v_change_id;
      end loop;
    else
      select c.change into v_row from public.roster_changes c
       where c.id = (p_payload ->> 'changeId')::bigint and c.service_id = p_service_id
         and c.draft_id = v_draft.id and c.target = 'draft' and c.undone_at is null for update;
      if not found then raise exception 'roster_not_found'; end if;
      -- Historical changes without exact after-images cannot be undone safely.
      if not (v_row ? 'before' and v_row ? 'after' and v_row ? 'id') then raise exception 'roster_conflict'; end if;
      v_id := (v_row ->> 'id')::uuid;
      select to_jsonb(a) - 'draft_id' into v_current from public.roster_draft_assignments a
       where a.id = v_id and a.draft_id = v_draft.id for update;
      v_current := coalesce(v_current, 'null'::jsonb);
      if v_current is distinct from v_row -> 'after' then raise exception 'roster_conflict'; end if;
      if v_row -> 'before' = 'null'::jsonb then
        delete from public.roster_draft_assignments where id = v_id and draft_id = v_draft.id;
      else
        v_assignment := jsonb_populate_record(null::public.roster_draft_assignments,
          (v_row -> 'before') || jsonb_build_object('draft_id', v_draft.id));
        if v_assignment.starts_at is null or v_assignment.ends_at is null
           or not isfinite(v_assignment.starts_at) or not isfinite(v_assignment.ends_at)
           or v_assignment.ends_at <= v_assignment.starts_at
           or v_assignment.ends_at - v_assignment.starts_at > interval '36 hours'
           or (v_assignment.starts_at at time zone 'Australia/Perth')::date not between v_draft.period_start and v_draft.period_end
           or v_assignment.shift_code is null or char_length(v_assignment.shift_code) not between 1 and 12
           or v_assignment.kind is null or v_assignment.kind not in ('day', 'evening', 'night', 'on_call', 'leave', 'other')
           or (v_assignment.grade is not null and v_assignment.grade not in ('intern', 'resident', 'registrar', 'fellow', 'consultant', 'other'))
           or char_length(v_assignment.roster_name) > 80
           or (v_assignment.user_id is not null and not public.service_member_active(p_service_id, v_assignment.user_id))
           or (v_assignment.site_id is not null and not exists (
             select 1 from public.on_call_service_sites s where s.id = v_assignment.site_id and s.service_id = p_service_id)) then
          raise exception 'roster_invalid_request';
        end if;
        if v_row -> 'after' = 'null'::jsonb then
          insert into public.roster_draft_assignments select v_assignment.*;
        else
          update public.roster_draft_assignments set
            user_id = v_assignment.user_id, roster_name = v_assignment.roster_name, site_id = v_assignment.site_id,
            starts_at = v_assignment.starts_at, ends_at = v_assignment.ends_at, shift_code = v_assignment.shift_code,
            kind = v_assignment.kind, grade = v_assignment.grade
          where id = v_id and draft_id = v_draft.id;
        end if;
      end if;
      update public.roster_changes set undone_at = now(), undone_by = p_actor_id
       where id = (p_payload ->> 'changeId')::bigint and service_id = p_service_id and draft_id = v_draft.id;
    end if;
    if (select count(*) from public.roster_draft_assignments where draft_id = v_draft.id) > 5000 then raise exception 'roster_limit'; end if;
    update public.roster_drafts set version = version + 1, updated_at = now()
     where id = v_draft.id returning version into v_draft.version;
    return jsonb_build_object('ok', true, 'draftId', v_draft.id, 'version', v_draft.version, 'lastChangeId', v_change_id::text);

  elsif p_action = 'agreement.record' then
    -- Superseded by immutable, affected-doctor-only roster_maker_command.
    raise exception 'roster_invalid_request';
  end if;

  raise exception 'roster_invalid_request';
end $$;
revoke all on function public.roster_maker_row(jsonb) from public, anon, authenticated;
grant execute on function public.roster_maker_row(jsonb) to service_role;
revoke all on function public.roster_maker_minus(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.roster_maker_minus(jsonb, jsonb) to service_role;
revoke all on function public.roster_maker_sort(jsonb) from public, anon, authenticated;
grant execute on function public.roster_maker_sort(jsonb) to service_role;
revoke all on function public.roster_maker_live_rows(uuid, date, date) from public, anon, authenticated;
grant execute on function public.roster_maker_live_rows(uuid, date, date) to service_role;
revoke all on function public.roster_maker_draft_rows(uuid) from public, anon, authenticated;
grant execute on function public.roster_maker_draft_rows(uuid) to service_role;
revoke all on function public.roster_maker_settings_token(uuid) from public, anon, authenticated;
grant execute on function public.roster_maker_settings_token(uuid) to service_role;
revoke all on function public.roster_maker_assert_publication(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.roster_maker_assert_publication(uuid, jsonb) to service_role;
revoke all on function public.roster_maker_proposal_json(uuid) from public, anon, authenticated;
grant execute on function public.roster_maker_proposal_json(uuid) to service_role;
revoke all on function public.roster_maker_read(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.roster_maker_read(uuid, uuid, uuid, boolean) to service_role;
revoke all on function public.roster_maker_command(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.roster_maker_command(uuid, uuid, text, jsonb) to service_role;
