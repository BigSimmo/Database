-- Local preparation. This is a new invited-service store, never a republication
-- of public on_call_entries, private compliance, CME, or patient records.
set search_path = public, pg_catalog, pg_temp;
set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.on_call_services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.on_call_service_sites (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 160),
  unique (id, service_id), unique(service_id, name)
);
create table public.on_call_service_members (
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check(role in ('member','editor','admin')),
  clinical_reviewer boolean not null default false,
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(service_id,user_id)
);
create index on_call_service_members_actor on public.on_call_service_members(user_id,service_id) where revoked_at is null;
create table public.on_call_service_invitations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
  role text not null check(role in ('member','editor','admin')),
  issued_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null,
  check(expires_at > created_at and expires_at <= created_at + interval '7 days')
);
create table public.on_call_service_entries (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  site_id uuid,
  revision integer not null default 1 check(revision > 0),
  content jsonb not null check(jsonb_typeof(content)='object'),
  author_id uuid references auth.users(id) on delete set null,
  status text not null check(status in ('draft','pending_review','published','withdrawn')),
  published_content jsonb,
  published_revision integer,
  published_author_id uuid references auth.users(id) on delete set null,
  published_reviewed_by uuid references auth.users(id) on delete set null,
  published_reviewed_at timestamptz,
  review_comment text not null default '',
  updated_at timestamptz not null default now(),
  unique(id,service_id),
  foreign key(site_id,service_id) references public.on_call_service_sites(id,service_id),
  check((published_content is null) = (published_revision is null)),
  check(published_revision is null or published_revision <= revision)
);
create index on_call_service_entries_service on public.on_call_service_entries(service_id,site_id);
create table public.on_call_service_reports (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  entry_id uuid not null,
  reported_by uuid references auth.users(id) on delete set null,
  reason text not null check(length(btrim(reason)) between 1 and 1500),
  status text not null default 'open' check(status in ('open','resolved')),
  resolution text not null default '',
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  foreign key(entry_id,service_id) references public.on_call_service_entries(id,service_id) on delete cascade
);
create table public.on_call_service_orientation (
  service_id uuid not null references public.on_call_services(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_id uuid not null,
  entry_id uuid not null,
  rotation text not null check(length(btrim(rotation)) between 1 and 100),
  revision integer not null check(revision > 0),
  completed_at timestamptz not null default now(),
  primary key(service_id,user_id,site_id,entry_id,rotation),
  foreign key(site_id,service_id) references public.on_call_service_sites(id,service_id),
  foreign key(entry_id,service_id) references public.on_call_service_entries(id,service_id) on delete cascade
);

-- Browser JWT roles have no direct table access. The invoker RPC is called only
-- by authenticated server routes using service_role and session-derived actor ID.
alter table public.on_call_services enable row level security;
alter table public.on_call_service_sites enable row level security;
alter table public.on_call_service_members enable row level security;
alter table public.on_call_service_invitations enable row level security;
alter table public.on_call_service_entries enable row level security;
alter table public.on_call_service_reports enable row level security;
alter table public.on_call_service_orientation enable row level security;
revoke all on public.on_call_services,public.on_call_service_sites,public.on_call_service_members,public.on_call_service_invitations,public.on_call_service_entries,public.on_call_service_reports,public.on_call_service_orientation from public,anon,authenticated;
grant select,insert,update,delete on public.on_call_services,public.on_call_service_sites,public.on_call_service_members,public.on_call_service_invitations,public.on_call_service_entries,public.on_call_service_reports,public.on_call_service_orientation to service_role;

create function public.on_call_service_command(p_actor_id uuid,p_service_id uuid,p_action text,p_payload jsonb default '{}') returns jsonb
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
    return jsonb_build_object('serviceId',v_service.id,'siteId',v_site);
  end if;

  if p_action='join' then
    select service_id into p_service_id from public.on_call_service_invitations where token_hash=p_payload->>'tokenHash';
    if p_service_id is null then raise exception 'service_invitation_invalid'; end if;
  end if;
  -- Shared lock order for reads and writes: service, membership, then target.
  -- A read starting after revocation commits cannot return the removed service.
  select * into v_service from public.on_call_services where id=p_service_id for update;
  if not found then raise exception 'service_access_denied'; end if;

  if p_action='join' then
    select * into v_invite from public.on_call_service_invitations
      where service_id=p_service_id and token_hash=p_payload->>'tokenHash' for update;
    if not found or v_invite.revoked_at is not null or v_invite.used_at is not null or v_invite.expires_at <= now()
      or not exists(select 1 from public.on_call_service_members where service_id=p_service_id and user_id=v_invite.issued_by and role='admin' and revoked_at is null)
      then raise exception 'service_invitation_invalid'; end if;
    if not exists(select 1 from public.on_call_service_members where service_id=p_service_id and user_id=p_actor_id and revoked_at is null) then
      if (select count(*) from public.on_call_service_members where service_id=p_service_id and revoked_at is null) >= 500 then raise exception 'service_limit'; end if;
      insert into public.on_call_service_members(service_id,user_id,role) values(p_service_id,p_actor_id,v_invite.role)
        on conflict(service_id,user_id) do update set role=excluded.role,clinical_reviewer=false,revoked_at=null,joined_at=now();
    end if;
    update public.on_call_service_invitations set used_at=now(),used_by=p_actor_id where id=v_invite.id;
    return jsonb_build_object('serviceId',p_service_id);
  end if;

  select * into v_member from public.on_call_service_members where service_id=p_service_id and user_id=p_actor_id and revoked_at is null;
  if not found then raise exception 'service_access_denied'; end if;
  v_can_edit := v_member.role in ('editor','admin');
  v_can_draft := v_can_edit or v_member.clinical_reviewer;
  v_site := nullif(p_payload->>'siteId','')::uuid;
  if v_site is not null and not exists(select 1 from public.on_call_service_sites where id=v_site and service_id=p_service_id) then raise exception 'service_invalid_site'; end if;

  if p_action='read' then
    return jsonb_build_object(
      'service',jsonb_build_object('id',v_service.id,'name',v_service.name),
      'membership',jsonb_build_object('role',v_member.role,'clinicalReviewer',v_member.clinical_reviewer),
      'sites',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name) order by s.name),'[]') from public.on_call_service_sites s where service_id=p_service_id),
      'entries',(select coalesce(jsonb_agg(jsonb_build_object(
        'id',e.id,'revision',case when v_can_draft then e.revision else e.published_revision end,
        'publishedRevision',e.published_revision,
        'content',case when v_can_draft then e.content else e.published_content end,
        'publishedContent',e.published_content,
        'status',case when v_can_draft then e.status else 'published' end,
        'authorId',case when v_can_draft then e.author_id else e.published_author_id end,
        'reviewedBy',e.published_reviewed_by,'reviewedAt',e.published_reviewed_at,'reviewComment',case when v_can_draft then e.review_comment else '' end,
        'updatedAt',e.updated_at
      ) order by e.updated_at desc),'[]') from public.on_call_service_entries e
        where e.service_id=p_service_id and (v_can_draft or e.published_content is not null)
        and (v_site is null or (case when v_can_draft then e.content else e.published_content end)->>'siteId' is null or (case when v_can_draft then e.content else e.published_content end)->>'siteId'=v_site::text)),
      'members',case when v_member.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,'clinicalReviewer',m.clinical_reviewer,'joinedAt',m.joined_at) order by m.joined_at),'[]') from public.on_call_service_members m where m.service_id=p_service_id and m.revoked_at is null) else '[]'::jsonb end,
      'invitations',case when v_member.role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'role',i.role,'expiresAt',i.expires_at,'revokedAt',i.revoked_at,'usedAt',i.used_at) order by i.created_at desc),'[]') from public.on_call_service_invitations i where i.service_id=p_service_id) else '[]'::jsonb end,
      'reports',case when v_can_edit then (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'entryId',r.entry_id,'reason',r.reason,'status',r.status,'resolution',r.resolution,'createdAt',r.created_at) order by r.created_at desc),'[]') from public.on_call_service_reports r where r.service_id=p_service_id) else '[]'::jsonb end,
      'orientation',(select coalesce(jsonb_agg(jsonb_build_object('entryId',o.entry_id,'siteId',o.site_id,'rotation',o.rotation,'revision',o.revision,'completedAt',o.completed_at)),'[]') from public.on_call_service_orientation o where o.service_id=p_service_id and o.user_id=p_actor_id and o.site_id=v_site and o.rotation=p_payload->>'rotation')
    );
  end if;

  if p_action in ('site.create','invitation.create','invitation.revoke','member.update','member.revoke') and v_member.role <> 'admin' then raise exception 'service_role_denied'; end if;
  if p_action='site.create' then
    if (select count(*) from public.on_call_service_sites where service_id=p_service_id) >= 100 then raise exception 'service_limit'; end if;
    insert into public.on_call_service_sites(service_id,name) values(p_service_id,p_payload->>'name') returning id into v_id;
    return jsonb_build_object('siteId',v_id);
  elsif p_action='invitation.create' then
    if (p_payload->>'expiresInDays')::integer not between 1 and 7 then raise exception 'service_invalid_request'; end if;
    if (select count(*) from public.on_call_service_invitations where service_id=p_service_id and used_at is null and revoked_at is null and expires_at>now()) >= 100 then raise exception 'service_limit'; end if;
    insert into public.on_call_service_invitations(service_id,token_hash,role,issued_by,expires_at)
      values(p_service_id,p_payload->>'tokenHash',p_payload->>'role',p_actor_id,now()+make_interval(days=>(p_payload->>'expiresInDays')::integer)) returning * into v_invite;
    return jsonb_build_object('invitationId',v_invite.id,'expiresAt',v_invite.expires_at);
  elsif p_action='invitation.revoke' then
    update public.on_call_service_invitations set revoked_at=now() where service_id=p_service_id and id=(p_payload->>'invitationId')::uuid;
    if not found then raise exception 'service_not_found'; end if;
    return jsonb_build_object('ok',true);
  elsif p_action in ('member.update','member.revoke') then
    select * into v_target from public.on_call_service_members where service_id=p_service_id and user_id=(p_payload->>'memberId')::uuid and revoked_at is null for update;
    if not found then raise exception 'service_not_found'; end if;
    if v_target.role='admin' and (p_action='member.revoke' or p_payload->>'role'<>'admin')
      and (select count(*) from public.on_call_service_members where service_id=p_service_id and role='admin' and revoked_at is null)<=1 then raise exception 'service_last_admin'; end if;
    if p_action='member.revoke' then
      update public.on_call_service_members set revoked_at=now(),clinical_reviewer=false where service_id=p_service_id and user_id=v_target.user_id;
      update public.on_call_service_invitations set revoked_at=now() where service_id=p_service_id and issued_by=v_target.user_id and used_at is null;
    else
      update public.on_call_service_members set role=p_payload->>'role',clinical_reviewer=(p_payload->>'clinicalReviewer')::boolean where service_id=p_service_id and user_id=v_target.user_id;
    end if;
    return jsonb_build_object('ok',true);
  end if;

  if p_action in ('entry.save','entry.withdraw','report.resolve') and not v_can_edit then raise exception 'service_role_denied'; end if;
  if p_action='entry.save' then
    v_content := p_payload - array['action','entryId','expectedRevision','publish'];
    if v_content - array['siteId','section','kind','title','body','phone','sources','orientationPhase'] <> '{}'::jsonb
      or not (v_content ?& array['siteId','section','kind','title','body','phone','sources','orientationPhase'])
      or coalesce(v_content->>'section','') not in ('contacts','referrals','resources','documentation','orientation','teaching','admin')
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
      update public.on_call_service_entries set published_content=v_content,published_revision=v_revision,published_author_id=p_actor_id,published_reviewed_by=null,published_reviewed_at=null where id=v_id;
    end if;
    return jsonb_build_object('entryId',v_id,'revision',v_revision,'status',v_status);
  elsif p_action in ('entry.review','entry.withdraw','report.create','orientation.set') then
    select * into v_entry from public.on_call_service_entries where id=(p_payload->>'entryId')::uuid and service_id=p_service_id for update;
    if not found then raise exception 'service_not_found'; end if;
    if p_action in ('entry.review','entry.withdraw') then
      if v_entry.revision is distinct from (p_payload->>'expectedRevision')::integer then raise exception 'service_revision_conflict'; end if;
      if p_action='entry.withdraw' then
        update public.on_call_service_entries set status='withdrawn',revision=revision+1,published_content=null,published_revision=null,published_author_id=null,published_reviewed_by=null,published_reviewed_at=null,updated_at=now() where id=v_entry.id;
      else
        if not v_member.clinical_reviewer or v_entry.author_id=p_actor_id then raise exception 'service_review_denied'; end if;
        if v_entry.status<>'pending_review' or v_entry.content->>'kind'='operational' then raise exception 'service_review_required'; end if;
        if p_payload->>'decision'='approve' then
          update public.on_call_service_entries set status='published',revision=revision+1,published_content=content,published_revision=revision+1,published_author_id=author_id,published_reviewed_by=p_actor_id,published_reviewed_at=now(),review_comment=p_payload->>'comment',updated_at=now() where id=v_entry.id;
        elsif p_payload->>'decision'='return' then
          update public.on_call_service_entries set status='draft',revision=revision+1,review_comment=p_payload->>'comment',updated_at=now() where id=v_entry.id;
        else raise exception 'service_invalid_request'; end if;
      end if;
      return jsonb_build_object('ok',true);
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
