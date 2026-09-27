-- Disposable LOCAL replay only: psql -X -v ON_ERROR_STOP=1 -1. Synthetic data; rollback.
create temp table maker_ids(key text primary key,id uuid) on commit drop;
insert into maker_ids select key,gen_random_uuid() from unnest(array['manager','doctor','other','team']) key;
create function pg_temp.mid(key text) returns uuid language sql as $$ select id from maker_ids where maker_ids.key=$1 $$;
insert into auth.users(id,email) select id,key||'-maker@example.org' from maker_ids where key<>'team';
insert into public.on_call_services(id,name,created_by,is_demo) values(pg_temp.mid('team'),'Synthetic maker',pg_temp.mid('manager'),true);
insert into public.on_call_service_members(service_id,user_id,role) select pg_temp.mid('team'),id,'member' from maker_ids where key<>'team';
grant select on maker_ids to service_role;
grant execute on function pg_temp.mid(text) to service_role;
set local role service_role;
select public.roster_set_manager(pg_temp.mid('team'),pg_temp.mid('manager'),pg_temp.mid('manager'),true);
create function pg_temp.mc(actor text,action text,payload jsonb) returns jsonb language sql as $$
 select public.roster_maker_command(pg_temp.mid(actor),pg_temp.mid('team'),action,payload)
$$;
create function pg_temp.refuse(command text,wanted text) returns void language plpgsql as $$
begin execute command; raise exception 'Expected refusal %',wanted;
exception when others then if sqlerrm<>wanted then raise exception 'Wanted %, got %',wanted,sqlerrm; end if; end $$;
do $maker$
declare
  d uuid; row_id uuid; p jsonb; r jsonb; state jsonb; own jsonb; first_publication jsonb; proposal uuid;
begin
 first_publication:=public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'publish',jsonb_build_object(
   'kind','full','periodStart','2026-11-02','periodEnd','2026-11-08','assignments',jsonb_build_array(jsonb_build_object(
   'userId',pg_temp.mid('doctor'),'rosterName','Synthetic Doctor','startsAt','2026-11-03T00:00:00Z','endsAt','2026-11-03T08:00:00Z','shiftCode','D','kind','day'))));
 d:=(public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.open','{"periodStart":"2026-11-02","periodEnd":"2026-11-08"}')->>'draftId')::uuid;
 select id into strict row_id from public.roster_draft_assignments where draft_id=d;
 perform public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.change',jsonb_build_object(
   'draftId',d,'expectedVersion',1,'source','grid','ops',jsonb_build_array(jsonb_build_object('op','update','id',row_id,'row',jsonb_build_object('shiftCode','E')))));
 p:=pg_temp.mc('manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',2,'scope','full'));
 proposal:=(p#>>'{proposal,id}')::uuid;
 if jsonb_array_length(p#>'{proposal,affected}')<>1 or (p#>>'{proposal,canPublish}')::boolean then raise exception 'Missing required agreement'; end if;
 perform pg_temp.refuse(format('select pg_temp.mc(%L,%L,%L)','manager','proposal.publish',jsonb_build_object('proposalId',proposal)),'roster_agreement_required');
 perform pg_temp.refuse(format('select pg_temp.mc(%L,%L,%L)','other','agreement.record',jsonb_build_object('proposalId',proposal)),'roster_not_found');
 own:=public.roster_maker_read(pg_temp.mid('other'),pg_temp.mid('team'),null,true);
 if own->'proposals'<>'[]'::jsonb then raise exception 'Unrelated doctor saw agreements'; end if;
 own:=public.roster_maker_read(pg_temp.mid('doctor'),pg_temp.mid('team'),null,true);
 if own#>>'{proposals,0,before,0,shiftCode}'<>'D' or own#>>'{proposals,0,after,0,shiftCode}'<>'E' then raise exception 'Own trusted comparison missing'; end if;
 perform pg_temp.mc('doctor','agreement.record',jsonb_build_object('proposalId',proposal));
 -- Legacy direct publication cannot bypass the same consent gate.
 perform pg_temp.refuse(format('select public.roster_command(%L,%L,%L,%L)',pg_temp.mid('manager'),pg_temp.mid('team'),'publish',
   jsonb_build_object('kind','full','periodStart','2026-11-02','periodEnd','2026-11-08','assignments','[]'::jsonb)), 'roster_agreement_required');
 r:=pg_temp.mc('manager','proposal.publish',jsonb_build_object('proposalId',proposal));
 if r->>'publicationId' is null or (r->>'replayed')::boolean then raise exception 'Publication receipt missing'; end if;
 if (pg_temp.mc('manager','proposal.publish',jsonb_build_object('proposalId',proposal))->>'replayed')::boolean is distinct from true then raise exception 'Retry must reuse receipt'; end if;
 if (select count(*) from public.roster_publications where service_id=pg_temp.mid('team'))<>2 then raise exception 'Retry published twice'; end if;
 if (select shift_code from public.roster_assignments where service_id=pg_temp.mid('team') and superseded_at is null)<>'E' then raise exception 'Duty not published'; end if;
 state:=public.roster_maker_read(pg_temp.mid('manager'),pg_temp.mid('team'),d,false);
 r:=pg_temp.mc('manager','settings.save',jsonb_build_object('expectedToken',state->>'settingsToken','needs','[]'::jsonb,
   'rules',jsonb_build_object('minBreakHours',10,'maxHours7d',60,'source','Approved synthetic policy','reviewedOn','2026-09-27')));
 perform pg_temp.refuse(format('select pg_temp.mc(%L,%L,%L)','manager','settings.save',jsonb_build_object('expectedToken',state->>'settingsToken','needs','[]'::jsonb,
   'rules',jsonb_build_object('minBreakHours',10,'maxHours7d',60,'source','Approved synthetic policy','reviewedOn','2026-09-27'))),'roster_conflict');
end $maker$;

do $single_and_freshness$
declare d uuid; rid uuid; change_id bigint; p jsonb; r jsonb; pid uuid; v bigint; row_data jsonb;
begin
 select id,version into d,v from public.roster_drafts where service_id=pg_temp.mid('team');
 select id into strict rid from public.roster_draft_assignments where draft_id=d;
 r:=public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.change',jsonb_build_object('draftId',d,'expectedVersion',v,'source','grid',
   'ops',jsonb_build_array(jsonb_build_object('op','update','id',rid,'row',jsonb_build_object('shiftCode','N')))));
 change_id:=(r->>'lastChangeId')::bigint; v:=(r->>'version')::bigint;
 row_data:=jsonb_build_object('userId',pg_temp.mid('other'),'rosterName','Synthetic Other','startsAt','2026-11-04T00:00:00Z','endsAt','2026-11-04T08:00:00Z','shiftCode','D','kind','day');
 r:=public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.change',jsonb_build_object('draftId',d,'expectedVersion',v,'source','grid',
   'ops',jsonb_build_array(jsonb_build_object('op','add','row',row_data)))); v:=(r->>'version')::bigint;
 p:=pg_temp.mc('manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',v,'scope','change','changeId',change_id)); pid:=(p#>>'{proposal,id}')::uuid;
 if jsonb_array_length(p#>'{proposal,after}')<>1 then raise exception 'Single proposal included unrelated draft edit'; end if;
 perform pg_temp.mc('doctor','agreement.record',jsonb_build_object('proposalId',pid));
 r:=pg_temp.mc('manager','proposal.publish',jsonb_build_object('proposalId',pid)); v:=(r->>'draftVersion')::bigint;
 if (select count(*) from public.roster_assignments where service_id=pg_temp.mid('team') and superseded_at is null)<>1 then raise exception 'Single publication changed unrelated duties'; end if;
 if (select count(*) from public.roster_draft_assignments where draft_id=d)<>2 then raise exception 'Single publication discarded remaining draft'; end if;

 -- New live work after the draft baseline survives the subsequent full draft publication.
 perform public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'publish',jsonb_build_object('kind','single_change','periodStart','2026-11-02','periodEnd','2026-11-08',
   'assignments',jsonb_build_array(row_data||jsonb_build_object('startsAt','2026-11-05T00:00:00Z','endsAt','2026-11-05T08:00:00Z'))));
 p:=pg_temp.mc('manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',v,'scope','full')); pid:=(p#>>'{proposal,id}')::uuid;
 if jsonb_array_length(p#>'{proposal,after}')<>3 then raise exception 'Full comparison lost post-baseline live duty'; end if;
 r:=pg_temp.mc('manager','proposal.publish',jsonb_build_object('proposalId',pid)); v:=(r->>'draftVersion')::bigint;
 if (select count(*) from public.roster_draft_assignments where draft_id=d)<>3 then raise exception 'Published live preservation missing from draft'; end if;

 r:=public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.change',jsonb_build_object('draftId',d,'expectedVersion',v,'source','grid',
   'ops',jsonb_build_array(jsonb_build_object('op','update','id',rid,'row',jsonb_build_object('shiftCode','D'))))); v:=(r->>'version')::bigint;
 p:=pg_temp.mc('manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',v,'scope','full')); pid:=(p#>>'{proposal,id}')::uuid;
 perform pg_temp.mc('doctor','agreement.record',jsonb_build_object('proposalId',pid));
 perform public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.change',jsonb_build_object('draftId',d,'expectedVersion',v,'source','grid',
   'ops',jsonb_build_array(jsonb_build_object('op','update','id',rid,'row',jsonb_build_object('shiftCode','E')))));
 perform pg_temp.refuse(format('select pg_temp.mc(%L,%L,%L)','manager','proposal.publish',jsonb_build_object('proposalId',pid)),'roster_conflict');
 perform pg_temp.refuse(format('select pg_temp.mc(%L,%L,%L)','doctor','agreement.record',jsonb_build_object('proposalId',pid)),'roster_conflict');
 perform public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'member.remove',jsonb_build_object('userId',pg_temp.mid('doctor')));
 perform pg_temp.refuse(format('select pg_temp.mc(%L,%L,%L)','doctor','agreement.record',jsonb_build_object('proposalId',pid)),'roster_access_denied');
end $single_and_freshness$;

do $consumed_add$
declare d uuid; c bigint; r jsonb; p jsonb; pid uuid;
begin
 d:=(public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.open','{"periodStart":"2026-11-09","periodEnd":"2026-11-15"}')->>'draftId')::uuid;
 r:=public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.change',jsonb_build_object('draftId',d,'expectedVersion',1,'source','grid','ops',jsonb_build_array(
   jsonb_build_object('op','add','row',jsonb_build_object('userId',pg_temp.mid('other'),'startsAt','2026-11-10T00:00:00Z','endsAt','2026-11-10T08:00:00Z','shiftCode','D','kind','day')))));
 c:=(r->>'lastChangeId')::bigint;
 p:=pg_temp.mc('manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',2,'scope','change','changeId',c)); pid:=(p#>>'{proposal,id}')::uuid;
 r:=pg_temp.mc('manager','proposal.publish',jsonb_build_object('proposalId',pid));
 perform pg_temp.refuse(format('select pg_temp.mc(%L,%L,%L)','manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',(r->>'draftVersion')::bigint,'scope','change','changeId',c)),'roster_conflict');
 if (select count(*) from public.roster_assignments where service_id=pg_temp.mid('team') and superseded_at is null and starts_at='2026-11-10T00:00:00Z')<>1 then raise exception 'Reused add published duplicate'; end if;
end $consumed_add$;

do $vacancies$
declare d uuid; rid uuid; r jsonb; p jsonb; pid uuid; v bigint;
begin
 perform public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'open.post',jsonb_build_object('startsAt','2026-11-17T00:00:00Z','endsAt','2026-11-17T08:00:00Z','shiftCode','D','kind','day','minGrade','intern'));
 d:=(public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.open','{"periodStart":"2026-11-16","periodEnd":"2026-11-22"}')->>'draftId')::uuid;
 select id into strict rid from public.roster_draft_assignments where draft_id=d;
 r:=public.roster_command(pg_temp.mid('manager'),pg_temp.mid('team'),'draft.change',jsonb_build_object('draftId',d,'expectedVersion',1,'source','grid','ops',jsonb_build_array(
   jsonb_build_object('op','update','id',rid,'row',jsonb_build_object('grade','resident')),
   jsonb_build_object('op','add','row',jsonb_build_object('startsAt','2026-11-17T00:00:00Z','endsAt','2026-11-17T08:00:00Z','shiftCode','D','kind','day','grade','resident')))));
 p:=pg_temp.mc('manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',2,'scope','full')); pid:=(p#>>'{proposal,id}')::uuid;
 r:=pg_temp.mc('manager','proposal.publish',jsonb_build_object('proposalId',pid)); v:=(r->>'draftVersion')::bigint;
 if (select count(*) from public.roster_open_shifts where service_id=pg_temp.mid('team') and status='open' and starts_at='2026-11-17T00:00:00Z' and min_grade='resident')<>2 then raise exception 'Vacancy grade edit or multiplicity lost'; end if;
 if exists(select 1 from public.roster_assignments where service_id=pg_temp.mid('team') and starts_at='2026-11-17T00:00:00Z') then raise exception 'Vacancy became named assignment'; end if;
 p:=pg_temp.mc('manager','proposal.create',jsonb_build_object('draftId',d,'expectedVersion',v,'scope','full'));
 perform pg_temp.mc('manager','proposal.publish',jsonb_build_object('proposalId',p#>>'{proposal,id}'));
 if (select count(*) from public.roster_open_shifts where service_id=pg_temp.mid('team') and status='open' and starts_at='2026-11-17T00:00:00Z')<>2 then raise exception 'Repeated publication duplicated vacancies'; end if;
end $vacancies$;

-- Privileged transport does not confer manager authority, nor direct browser table access.
select pg_temp.refuse(format('select public.roster_maker_read(%L,%L,null,false)',pg_temp.mid('other'),pg_temp.mid('team')),'roster_role_denied');
reset role;
set local role authenticated;
do $acl$ begin
 begin perform public.roster_maker_command(null,null,'proposal.publish','{}'); raise exception 'Browser executed maker RPC'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.roster_maker_consents; raise exception 'Browser read other consents'; exception when insufficient_privilege then null; end;
end $acl$;
rollback;
\echo Roster maker: own consent, legacy bypass refusal, atomic publication and replay, settings freshness passed.
