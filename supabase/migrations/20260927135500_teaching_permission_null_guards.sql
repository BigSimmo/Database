-- Fail closed when Teaching presenter or resource author is NULL.
-- Preserve the existing command bodies and executable grants; only the two permission predicates change.
set local statement_timeout = '60s';

create or replace function public.teaching_depth_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role text;
  v_occ public.teaching_occurrences;
  v_pairing public.teaching_supervision_pairings;
  v_entry public.teaching_supervision_entries;
  v_note public.teaching_supervision_notes;
  v_readiness public.teaching_readiness;
  v_id uuid;
  v_registrar uuid;
  v_supervisor uuid;
  v_ids uuid[];
  v_topics text[];
  v_starts date;
  v_ends date;
  v_date date;
  v_target numeric;
  v_text text;
  v_minutes integer;
  v_useful integer;
  v_count integer;
  v_result jsonb;
  v_row jsonb;
  v_leaver boolean := false;
begin
  if p_actor_id is null then raise exception 'teaching_auth_required'; end if;
  if p_action is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_service_id is null
    or p_action not in ('pairing.save','pairing.reassign','supervision.log','supervision.confirm','supervision.note',
      'supervision.note.confirm','supervision.read','supervision.target.set','readiness.set','readiness.deid.confirm',
      'feedback.submit','feedback.totals','import.commit') then
    raise exception 'teaching_invalid_request';
  end if;
  select * into v_service from public.on_call_services where id = p_service_id for share;
  if not found then raise exception 'teaching_access_denied'; end if;
  v_role := public.teaching_member_role(p_service_id, p_actor_id);
  if v_role is null then
    -- A leaver keeps read-only access to their own supervision entries (as registrar) for 90 days
    -- from the shared revoke, as logbook.read keeps their attendance (spec §9). Nothing else.
    v_leaver := p_action = 'supervision.read' and exists (select 1 from public.on_call_service_members m
      where m.service_id = p_service_id and m.user_id = p_actor_id
        and m.revoked_at is not null and m.revoked_at > now() - interval '90 days');
    if not v_leaver then raise exception 'teaching_access_denied'; end if;
  end if;
  if p_action not in ('supervision.read','feedback.totals') and not (v_service.verified_at is not null or v_service.is_demo) then
    raise exception 'teaching_team_unverified';
  end if;
  if p_action in ('pairing.save','pairing.reassign','import.commit') then
    perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74818));
  end if;

  if p_action = 'pairing.save' then
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    v_registrar := public.teaching_uuid_arg(p_payload, 'registrarId');
    v_supervisor := public.teaching_uuid_arg(p_payload, 'supervisorId');
    v_starts := public.teaching_date_arg(p_payload, 'startsOn');
    v_ends := public.teaching_date_arg(p_payload, 'endsOn');
    -- The hours target is the registrar's own (supervision.target.set); an organiser never sets it.
    if p_payload ? 'targetHours' then raise exception 'teaching_invalid_request'; end if;
    -- Organisers pair other people. A pairing that includes the actor needs a Teaching admin.
    if not (v_role = 'admin' or (v_role = 'organiser' and p_actor_id <> v_registrar and p_actor_id <> v_supervisor)) then
      raise exception 'teaching_role_denied';
    end if;
    if v_registrar is null or v_supervisor is null or v_registrar = v_supervisor
      or v_starts is null or v_ends is null or v_ends < v_starts or v_ends > v_starts + 731
      or not public.service_member_active(p_service_id, v_registrar)
      or not public.service_member_active(p_service_id, v_supervisor) then
      raise exception 'teaching_invalid_request';
    end if;
    if v_id is null then
      if (select count(*) from public.teaching_supervision_pairings where service_id = p_service_id) >= 5000 then
        raise exception 'teaching_limit';
      end if;
      insert into public.teaching_supervision_pairings(service_id, registrar_id, supervisor_id, starts_on, ends_on, created_by)
      values (p_service_id, v_registrar, v_supervisor, v_starts, v_ends, p_actor_id)
      returning * into v_pairing;
    else
      select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id for update;
      if not found then raise exception 'teaching_not_found'; end if;
      -- Once a pairing has entries, only its end date and target can change; the supervisor
      -- changes through pairing.reassign.
      if exists (select 1 from public.teaching_supervision_entries e where e.pairing_id = v_pairing.id)
        and (v_pairing.registrar_id is distinct from v_registrar or v_pairing.supervisor_id is distinct from v_supervisor
          or v_pairing.starts_on <> v_starts) then
        raise exception 'teaching_invalid_request';
      end if;
      update public.teaching_supervision_pairings set registrar_id = v_registrar, supervisor_id = v_supervisor,
        starts_on = v_starts, ends_on = v_ends, updated_at = now()
      where id = v_pairing.id returning * into v_pairing;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'pairing.save', v_pairing.id);
    return jsonb_build_object('pairingId', v_pairing.id);

  elsif p_action = 'pairing.reassign' then
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    v_supervisor := public.teaching_uuid_arg(p_payload, 'supervisorId');
    select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if not (v_role = 'admin' or (v_role = 'organiser' and p_actor_id is distinct from v_pairing.registrar_id and p_actor_id <> v_supervisor)) then
      raise exception 'teaching_role_denied';
    end if;
    if v_supervisor is null or v_supervisor is not distinct from v_pairing.registrar_id
      or not public.service_member_active(p_service_id, v_supervisor) then
      raise exception 'teaching_invalid_request';
    end if;
    -- Confirmed entries keep who confirmed them; pending entries and notes now wait for the new
    -- supervisor, because confirmation always checks the pairing's current supervisor.
    update public.teaching_supervision_pairings set supervisor_id = v_supervisor, updated_at = now() where id = v_pairing.id;
    select count(*) into v_count from public.teaching_supervision_entries where pairing_id = v_pairing.id and status = 'pending';
    perform public.teaching_audit(p_service_id, p_actor_id, 'pairing.reassign', v_pairing.id);
    return jsonb_build_object('pairingId', v_pairing.id, 'pendingMoved', v_count);

  elsif p_action = 'supervision.target.set' then
    -- The registrar's own hours target for this pairing: nullable, no default, and progress is shown
    -- only once it is set. Only the pairing's registrar sets or clears it (targetHours null).
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_pairing.registrar_id is distinct from p_actor_id then raise exception 'teaching_role_denied'; end if;
    if not (p_payload ? 'targetHours') then raise exception 'teaching_invalid_request'; end if;
    if p_payload->'targetHours' <> 'null'::jsonb then
      if jsonb_typeof(p_payload->'targetHours') <> 'number' or (p_payload->>'targetHours') !~ '^[0-9]{1,3}(\.[0-9])?$' then
        raise exception 'teaching_invalid_request';
      end if;
      v_target := (p_payload->>'targetHours')::numeric;
      if v_target not between 1 and 500 then raise exception 'teaching_invalid_request'; end if;
    end if;
    update public.teaching_supervision_pairings set target_hours = v_target, updated_at = now() where id = v_pairing.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.target.set', v_pairing.id);
    return jsonb_build_object('pairingId', v_pairing.id, 'targetHours', v_target);

  elsif p_action = 'supervision.log' then
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    select * into v_pairing from public.teaching_supervision_pairings where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_pairing.registrar_id is distinct from p_actor_id then raise exception 'teaching_role_denied'; end if;
    v_date := public.teaching_date_arg(p_payload, 'date');
    v_minutes := public.teaching_int_arg(p_payload, 'minutes');
    v_text := public.teaching_text_arg(p_payload, 'type');
    v_topics := public.teaching_text_array_arg(p_payload, 'topics', 5);
    if v_date is null or v_date < v_pairing.starts_on or v_date > v_pairing.ends_on
      or v_date > (now() at time zone 'Australia/Perth')::date
      or v_minutes is null or v_minutes not between 15 and 240 or v_minutes % 15 <> 0
      or v_text is null or v_text not in ('individual','group')
      -- Topics are optional: none to five.
      or cardinality(v_topics) not between 0 and 5
      or not (v_topics <@ array['case_review','risk','psychotherapy','formulation','medication','mha_legal','teaching_skills','career','exam_prep','wellbeing','other']::text[]) then
      raise exception 'teaching_invalid_request';
    end if;
    if (select count(*) from public.teaching_supervision_entries where pairing_id = v_pairing.id) >= 1000 then
      raise exception 'teaching_limit';
    end if;
    insert into public.teaching_supervision_entries(pairing_id, service_id, session_date, minutes, type, topics, logged_by)
    values (v_pairing.id, p_service_id, v_date, v_minutes, v_text, v_topics, p_actor_id)
    returning * into v_entry;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.log', v_entry.id);
    return jsonb_build_object('entryId', v_entry.id);

  elsif p_action = 'supervision.confirm' then
    v_ids := public.teaching_uuid_array_arg(p_payload, 'entryIds', 20);
    if cardinality(v_ids) = 0 then raise exception 'teaching_invalid_request'; end if;
    -- All or nothing: every entry must be pending and belong to a pairing the actor now supervises.
    if (select count(*) from public.teaching_supervision_entries e
        join public.teaching_supervision_pairings p on p.id = e.pairing_id
        where e.id = any(v_ids) and e.service_id = p_service_id and e.status = 'pending' and p.supervisor_id = p_actor_id)
      <> cardinality(v_ids) then
      raise exception 'teaching_not_found';
    end if;
    update public.teaching_supervision_entries set status = 'confirmed', confirmed_by = p_actor_id, confirmed_at = now(), locked = true
    where id = any(v_ids);
    insert into public.teaching_audit_events(service_id, actor_id, action, subject_id)
    select p_service_id, p_actor_id, 'supervision.confirm', u from unnest(v_ids) as u;
    return jsonb_build_object('confirmed', cardinality(v_ids));

  elsif p_action = 'supervision.note' then
    v_id := public.teaching_uuid_arg(p_payload, 'entryId');
    select e.* into v_entry from public.teaching_supervision_entries e
    join public.teaching_supervision_pairings p on p.id = e.pairing_id
    where e.id = v_id and e.service_id = p_service_id and p.registrar_id = p_actor_id;
    if not found then raise exception 'teaching_not_found'; end if;
    v_text := public.teaching_text_arg(p_payload, 'reason');
    if v_text is null or not public.teaching_valid_correction(v_text, p_payload->'correctedValue') then
      raise exception 'teaching_invalid_request';
    end if;
    if v_text = 'wrong_date' then
      perform public.teaching_date_arg(p_payload->'correctedValue', 'date');
    end if;
    if (select count(*) from public.teaching_supervision_notes where entry_id = v_entry.id and confirmed_at is null) >= 5 then
      raise exception 'teaching_limit';
    end if;
    insert into public.teaching_supervision_notes(entry_id, service_id, reason, corrected_value, created_by)
    values (v_entry.id, p_service_id, v_text, p_payload->'correctedValue', p_actor_id)
    returning * into v_note;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.note', v_note.id);
    return jsonb_build_object('noteId', v_note.id);

  elsif p_action = 'supervision.note.confirm' then
    v_id := public.teaching_uuid_arg(p_payload, 'noteId');
    select n.* into v_note from public.teaching_supervision_notes n
    join public.teaching_supervision_entries e on e.id = n.entry_id
    join public.teaching_supervision_pairings p on p.id = e.pairing_id
    where n.id = v_id and n.service_id = p_service_id and p.supervisor_id = p_actor_id and n.confirmed_at is null
    for update of n;
    if not found then raise exception 'teaching_not_found'; end if;
    update public.teaching_supervision_notes set confirmed_by = p_actor_id, confirmed_at = now() where id = v_note.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.note.confirm', v_note.id);
    return jsonb_build_object('noteId', v_note.id);

  elsif p_action = 'supervision.read' then
    -- The registrar and supervisor of a pairing see its entries; an organiser sees totals and
    -- status only (never topics). Reading anyone else's pairing is audited. A leaver (v_leaver)
    -- sees only the pairings where they are the registrar, and reads their own record unaudited.
    v_id := public.teaching_uuid_arg(p_payload, 'pairingId');
    if v_id is not null and not exists (
      select 1 from public.teaching_supervision_pairings p where p.id = v_id and p.service_id = p_service_id
        and (p.registrar_id = p_actor_id or (not v_leaver and (p.supervisor_id = p_actor_id or v_role = 'organiser')))) then
      raise exception 'teaching_not_found';
    end if;
    if v_id is null and v_role = 'organiser' then
      -- An organiser's whole-team read (Logbook, Today): one service-level row per call.
      perform public.teaching_audit(p_service_id, p_actor_id, 'supervision.read', null);
    elsif not v_leaver then
      insert into public.teaching_audit_events(service_id, actor_id, action, subject_id)
      select p_service_id, p_actor_id, 'supervision.read', p.id
      from public.teaching_supervision_pairings p
      where p.service_id = p_service_id and (v_id is null or p.id = v_id)
        and p.registrar_id is distinct from p_actor_id
        and (p.supervisor_id = p_actor_id or v_role = 'organiser');
    end if;
    select jsonb_build_object('pairings', coalesce(jsonb_agg(jsonb_build_object(
        'pairingId', p.id,
        'access', case when p.registrar_id = p_actor_id then 'registrar' when p.supervisor_id = p_actor_id then 'supervisor' else 'organiser' end,
        'registrarName', case when p.registrar_id is null then 'Former member' else coalesce((select coalesce(m.display_name, 'Member')
          from public.on_call_service_members m where m.service_id = p.service_id and m.user_id = p.registrar_id), 'Former member') end,
        'supervisorName', case when p.supervisor_id is null then 'Former member' else coalesce((select coalesce(m.display_name, 'Member')
          from public.on_call_service_members m where m.service_id = p.service_id and m.user_id = p.supervisor_id), 'Former member') end,
        'startsOn', p.starts_on, 'endsOn', p.ends_on,
        'targetHours', case when p.registrar_id = p_actor_id or p.supervisor_id = p_actor_id then p.target_hours else null end,
        'confirmedMinutes', (select coalesce(sum(e.minutes), 0) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'confirmed'),
        'pendingMinutes', (select coalesce(sum(e.minutes), 0) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'pending'),
        'pendingCount', (select count(*) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'pending'),
        'oldestPendingAt', (select min(e.created_at) from public.teaching_supervision_entries e where e.pairing_id = p.id and e.status = 'pending'),
        'entries', case when p.registrar_id = p_actor_id or p.supervisor_id = p_actor_id then coalesce((select jsonb_agg(jsonb_build_object(
            'entryId', e.id, 'date', e.session_date, 'minutes', e.minutes, 'type', e.type, 'topics', to_jsonb(e.topics),
            'status', e.status, 'confirmedAt', e.confirmed_at,
            'confirmedByName', case when e.confirmed_at is null then null when e.confirmed_by is null then 'Former member' else coalesce(
              (select coalesce(m.display_name, 'Member') from public.on_call_service_members m where m.service_id = e.service_id and m.user_id = e.confirmed_by),
              'Former member') end,
            'notes', coalesce((select jsonb_agg(jsonb_build_object('noteId', n.id, 'reason', n.reason, 'correctedValue', n.corrected_value,
                'createdAt', n.created_at, 'confirmedAt', n.confirmed_at) order by n.created_at)
              from public.teaching_supervision_notes n where n.entry_id = e.id), '[]'::jsonb)
          ) order by e.session_date desc, e.created_at desc) from public.teaching_supervision_entries e where e.pairing_id = p.id), '[]'::jsonb)
          else null end
      ) order by p.starts_on desc, p.id), '[]'::jsonb))
    into v_result
    from public.teaching_supervision_pairings p
    where p.service_id = p_service_id and (v_id is null or p.id = v_id)
      and (p.registrar_id = p_actor_id or (not v_leaver and (p.supervisor_id = p_actor_id or v_role = 'organiser')));
    return v_result;

  elsif p_action in ('readiness.set','readiness.deid.confirm') then
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_occ.presenter_id is distinct from p_actor_id then raise exception 'teaching_role_denied'; end if;
    insert into public.teaching_readiness(occurrence_id, service_id) values (v_occ.id, p_service_id)
    on conflict (occurrence_id) do nothing;
    if p_action = 'readiness.set' then
      v_text := public.teaching_text_arg(p_payload, 'item');
      if v_text is null or v_text not in ('reading_list','aims','slides_link','room')
        or jsonb_typeof(p_payload->'done') is distinct from 'boolean' then
        raise exception 'teaching_invalid_request';
      end if;
      update public.teaching_readiness set
        items = case when (p_payload->>'done')::boolean
          then array(select distinct i from unnest(array_append(items, v_text)) as i order by i)
          else array_remove(items, v_text) end,
        updated_at = now()
      where occurrence_id = v_occ.id returning * into v_readiness;
    else
      update public.teaching_readiness set deid_confirmed_at = now(), deid_confirmed_by = p_actor_id, updated_at = now()
      where occurrence_id = v_occ.id returning * into v_readiness;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, p_action, v_occ.id);
    return jsonb_build_object('items', to_jsonb(v_readiness.items), 'deidConfirmedAt', v_readiness.deid_confirmed_at);

  elsif p_action = 'feedback.submit' then
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if not exists (select 1 from public.teaching_attendance a where a.occurrence_id = v_occ.id and a.user_id = p_actor_id) then
      raise exception 'teaching_not_attended';
    end if;
    if v_occ.status = 'cancelled' or now() < v_occ.ends_at or now() > v_occ.ends_at + interval '7 days' then
      raise exception 'teaching_window_closed';
    end if;
    v_useful := public.teaching_int_arg(p_payload, 'useful');
    v_text := public.teaching_text_arg(p_payload, 'pace');
    if v_useful is null or v_useful not between 1 and 5 or v_text is null or v_text not in ('slow','right','fast') then
      raise exception 'teaching_invalid_request';
    end if;
    -- One-way "already answered" marker. No responder id is stored with feedback anywhere.
    insert into public.teaching_feedback_replied(occurrence_id, reply_marker)
    values (v_occ.id, encode(extensions.digest(convert_to('teaching-feedback:' || v_occ.id::text || ':' || p_actor_id::text, 'UTF8'), 'sha256'), 'hex'))
    on conflict (occurrence_id, reply_marker) do nothing;
    if not found then raise exception 'teaching_limit'; end if;
    insert into public.teaching_feedback_answers(occurrence_id, service_id, useful, pace)
    values (v_occ.id, p_service_id, v_useful, v_text);
    -- No actor on this audit row: nothing may tie a person to the moment an answer was written.
    perform public.teaching_audit(p_service_id, null, 'feedback.submit', v_occ.id);
    return '{}'::jsonb;

  elsif p_action = 'import.commit' then
    -- A term from a spreadsheet, all or nothing: every row is a new series through the same save as
    -- series.save, inside this one transaction, so one refused row rolls back every row before it.
    -- Spec §4 gives import to organisers and admins.
    if v_role not in ('organiser','admin') then raise exception 'teaching_role_denied'; end if;
    if jsonb_typeof(p_payload->'rows') is distinct from 'array'
      or jsonb_array_length(p_payload->'rows') not between 1 and 200 then
      raise exception 'teaching_invalid_request';
    end if;
    v_count := 0;
    for v_row in select r.value from jsonb_array_elements(p_payload->'rows') as r(value) loop
      if jsonb_typeof(v_row) is distinct from 'object' or v_row ? 'seriesId' then
        raise exception 'teaching_invalid_request';
      end if;
      v_result := public.teaching_series_save(p_actor_id, p_service_id, v_row);
      perform public.teaching_audit(p_service_id, p_actor_id, 'series.save', public.teaching_uuid_arg(v_result, 'seriesId'));
      v_count := v_count + public.teaching_int_arg(v_result, 'occurrences');
    end loop;
    perform public.teaching_audit(p_service_id, p_actor_id, 'import.commit', null);
    return jsonb_build_object('series', jsonb_array_length(p_payload->'rows'), 'occurrences', v_count);

  elsif p_action = 'feedback.totals' then
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    select * into v_occ from public.teaching_occurrences where id = v_id and service_id = p_service_id;
    if not found then raise exception 'teaching_not_found'; end if;
    if (v_occ.presenter_id = p_actor_id or v_role = 'organiser') is not true then raise exception 'teaching_role_denied'; end if;
    select count(*) into v_count from public.teaching_feedback_answers where occurrence_id = v_occ.id;
    if now() < v_occ.ends_at + interval '7 days' or v_count < 3 then
      return jsonb_build_object('released', false);
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'feedback.totals', v_occ.id);
    return jsonb_build_object(
      'released', true,
      'replies', v_count,
      'useful', (select jsonb_build_object('1', count(*) filter (where useful = 1), '2', count(*) filter (where useful = 2),
          '3', count(*) filter (where useful = 3), '4', count(*) filter (where useful = 4), '5', count(*) filter (where useful = 5))
        from public.teaching_feedback_answers where occurrence_id = v_occ.id),
      'pace', (select jsonb_build_object('slow', count(*) filter (where pace = 'slow'), 'right', count(*) filter (where pace = 'right'),
          'fast', count(*) filter (where pace = 'fast'))
        from public.teaching_feedback_answers where occurrence_id = v_occ.id)
    );
  end if;

  raise exception 'teaching_invalid_request';
end $$;
revoke all on function public.teaching_depth_command(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_depth_command(uuid, uuid, text, jsonb) to service_role;

create or replace function public.teaching_whats_on_command(p_actor_id uuid, p_service_id uuid, p_action text, p_payload jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path = public, pg_catalog, pg_temp as $$
declare
  v_service public.on_call_services;
  v_role text;
  v_occ public.teaching_occurrences;
  v_series public.teaching_series;
  v_resource public.teaching_resources;
  v_collection public.teaching_collections;
  v_attendance public.teaching_attendance;
  v_host uuid;
  v_id uuid;
  v_series_id uuid;
  v_collection_id uuid;
  v_section_id uuid;
  v_doc uuid;
  v_from date;
  v_to date;
  v_text text;
  v_kind text;
  v_url text;
  v_sort integer;
  v_count integer;
  v_result jsonb;
begin
  if p_actor_id is null then raise exception 'teaching_auth_required'; end if;
  if p_action is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'teaching_invalid_request';
  end if;

  -- The viewer's own actions, across teams. The service id must be null.
  if p_action in ('whats_on.read','week_add.set','week_add.unset','whats_on.attend','resources.read','collection.read',
    'resource_save.set','resource_save.unset') then
    if p_service_id is not null then raise exception 'teaching_invalid_request'; end if;
    perform 1 from public.on_call_services s
    where exists (select 1 from public.on_call_service_members m where m.service_id = s.id and m.user_id = p_actor_id and m.revoked_at is null)
    order by s.id for share;

    if p_action = 'whats_on.read' then
      v_from := public.teaching_date_arg(p_payload, 'weekStart');
      if v_from is null then raise exception 'teaching_invalid_request'; end if;
      v_to := v_from + 6;
      select jsonb_build_object(
        'healthServices', coalesce((select jsonb_agg(distinct ts.health_service order by ts.health_service)
          from public.teaching_team_settings ts
          join public.on_call_services s on s.id = ts.service_id and (s.verified_at is not null or s.is_demo)
          where public.service_member_active(ts.service_id, p_actor_id)), '[]'::jsonb),
        'sessions', coalesce((select jsonb_agg(jsonb_build_object(
            'occurrenceId', o.id, 'serviceId', o.service_id, 'teamName', s.name, 'title', o.title,
            'startsAt', o.starts_at, 'endsAt', o.ends_at, 'venue', o.venue, 'hasJoinLink', o.join_url is not null,
            'joinUrl', o.join_url, 'status', o.status, 'isPresenter', o.presenter_id is not distinct from p_actor_id,
            'source', 'teaching', 'own', x.own, 'inMyWeek', x.own or public.teaching_week_added(o.id, p_actor_id),
            -- A one-off with no series is for everyone. The client filters "For my level" (R4).
            'audience', coalesce(ser.audience, 'all_doctors'))
            order by o.starts_at, o.id)
          from public.teaching_occurrences o
          join public.on_call_services s on s.id = o.service_id
          left join public.teaching_series ser on ser.id = o.series_id
          cross join lateral (select public.service_member_active(o.service_id, p_actor_id) as own) as x
          where o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
            and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth')
            and case when x.own
              then public.teaching_occurrence_listed(o.id, p_actor_id, public.teaching_member_role(o.service_id, p_actor_id))
              else public.teaching_occurrence_open_to(o.id, p_actor_id) end), '[]'::jsonb)
      ) into v_result;
      return v_result;

    elsif p_action in ('week_add.set','week_add.unset') then
      v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
      v_series_id := public.teaching_uuid_arg(p_payload, 'seriesId');
      if num_nonnulls(v_id, v_series_id) <> 1 then raise exception 'teaching_invalid_request'; end if;
      if v_id is not null then
        select o.service_id into v_host from public.teaching_occurrences o where o.id = v_id;
      else
        select s.service_id into v_host from public.teaching_series s where s.id = v_series_id;
      end if;
      if v_host is null then raise exception 'teaching_not_found'; end if;
      if p_action = 'week_add.set' then
        -- Only another team's session or series that is open to the viewer's health service. The
        -- viewer's own team's sessions are already in their week.
        if public.service_member_active(v_host, p_actor_id) then raise exception 'teaching_invalid_request'; end if;
        if not (case when v_id is not null then public.teaching_occurrence_open_to(v_id, p_actor_id)
            else public.teaching_series_open_to(v_series_id, p_actor_id) end) then
          raise exception 'teaching_not_found';
        end if;
        if (select count(*) from public.teaching_week_adds where user_id = p_actor_id) >= 500 then raise exception 'teaching_limit'; end if;
        insert into public.teaching_week_adds(user_id, occurrence_id, series_id) values (p_actor_id, v_id, v_series_id)
        on conflict do nothing;
      else
        delete from public.teaching_week_adds
        where user_id = p_actor_id and (occurrence_id = v_id or series_id = v_series_id);
      end if;
      -- No actor: the host team never learns who added its session.
      perform public.teaching_audit(v_host, null, p_action, coalesce(v_id, v_series_id));
      return jsonb_build_object('inMyWeek', p_action = 'week_add.set');

    elsif p_action = 'whats_on.attend' then
      -- A visitor's "I was there": self-reported, visible only to the visitor, counted for the host.
      v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
      select * into v_occ from public.teaching_occurrences where id = v_id;
      if not found then raise exception 'teaching_not_found'; end if;
      v_host := v_occ.service_id;
      if public.service_member_active(v_occ.service_id, p_actor_id) then raise exception 'teaching_invalid_request'; end if;
      if not public.teaching_occurrence_open_to(v_occ.id, p_actor_id) then raise exception 'teaching_not_found'; end if;
      if v_occ.status = 'cancelled' or now() < v_occ.starts_at or now() > v_occ.ends_at + interval '7 days' then
        raise exception 'teaching_window_closed';
      end if;
      insert into public.teaching_attendance(occurrence_id, service_id, user_id, method, visitor)
      values (v_occ.id, v_occ.service_id, p_actor_id, 'self', true)
      on conflict (occurrence_id, user_id) do nothing
      returning * into v_attendance;
      if not found then
        select * into v_attendance from public.teaching_attendance where occurrence_id = v_occ.id and user_id = p_actor_id;
      else
        perform public.teaching_audit(v_host, null, 'attendance.visitor', v_occ.id);
      end if;
      return jsonb_build_object('occurrenceId', v_attendance.occurrence_id, 'method', v_attendance.method, 'recordedAt', v_attendance.recorded_at);

    elsif p_action = 'resources.read' then
      v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
      v_from := public.teaching_date_arg(p_payload, 'weekStart');
      if num_nonnulls(v_id, v_from) <> 1 then raise exception 'teaching_invalid_request'; end if;
      if v_id is not null then
        -- A session page's materials: the session's own and its series'.
        select * into v_occ from public.teaching_occurrences where id = v_id;
        if not found or not (public.service_member_active(v_occ.service_id, p_actor_id)
            or public.teaching_occurrence_open_to(v_occ.id, p_actor_id)) then
          raise exception 'teaching_not_found';
        end if;
        return jsonb_build_object('items', coalesce((select jsonb_agg(public.teaching_resource_row(r.id, p_actor_id)
            order by r.kind, lower(r.title), r.id)
          from public.teaching_resources r
          where r.removed_at is null
            and (r.occurrence_id = v_occ.id or (r.occurrence_id is null and r.series_id is not null and r.series_id = v_occ.series_id))
            and public.teaching_resource_visible(r.id, p_actor_id)), '[]'::jsonb));
      end if;
      v_to := v_from + 6;
      select jsonb_build_object(
        -- Materials of the sessions in the viewer's week; catch-up marks a recording or slides for a
        -- session of their own team they were expected at, that has ended, with no attendance.
        'forThisWeek', coalesce((select jsonb_agg(public.teaching_resource_row(w.id, p_actor_id) || jsonb_build_object('catchUp', w.catch_up)
            order by w.first_start, w.id)
          from (
            select r.id, min(o.starts_at) as first_start,
              bool_or(r.kind in ('recording','slides') and o.ends_at <= now() and o.status <> 'cancelled'
                and public.service_member_active(o.service_id, p_actor_id)
                and not exists (select 1 from public.teaching_attendance a where a.occurrence_id = o.id and a.user_id = p_actor_id)) as catch_up
            from public.teaching_resources r
            join public.teaching_occurrences o on o.id = r.occurrence_id or (r.occurrence_id is null and r.series_id = o.series_id)
            where r.removed_at is null
              and o.starts_at >= (v_from::timestamp at time zone 'Australia/Perth')
              and o.starts_at < ((v_to + 1)::timestamp at time zone 'Australia/Perth')
              and case when public.service_member_active(o.service_id, p_actor_id)
                then public.teaching_occurrence_listed(o.id, p_actor_id, public.teaching_member_role(o.service_id, p_actor_id))
                else public.teaching_week_added(o.id, p_actor_id) and public.teaching_occurrence_open_to(o.id, p_actor_id) end
              and public.teaching_resource_visible(r.id, p_actor_id)
            group by r.id
          ) as w), '[]'::jsonb),
        'collections', coalesce((select jsonb_agg(jsonb_build_object(
            'collectionId', c.id, 'serviceId', c.service_id, 'name', c.name,
            'count', (select count(*) from public.teaching_resources r where r.collection_id = c.id and r.removed_at is null
              and public.teaching_resource_visible(r.id, p_actor_id)))
            order by c.sort_order, lower(c.name), c.id)
          from public.teaching_collections c
          where public.service_member_active(c.service_id, p_actor_id)), '[]'::jsonb),
        'recordingsCount', (select count(*) from public.teaching_resources r
          where r.kind = 'recording' and r.removed_at is null and public.teaching_resource_visible(r.id, p_actor_id)),
        'savedCount', (select count(*) from public.teaching_resource_saves v
          where v.user_id = p_actor_id and public.teaching_resource_visible(v.resource_id, p_actor_id))
      ) into v_result;
      return v_result;

    elsif p_action = 'collection.read' then
      v_id := public.teaching_uuid_arg(p_payload, 'collectionId');
      v_text := public.teaching_text_arg(p_payload, 'builtIn');
      if num_nonnulls(v_id, v_text) <> 1 or (v_text is not null and v_text not in ('recordings','saved')) then
        raise exception 'teaching_invalid_request';
      end if;
      if v_id is not null then
        select * into v_collection from public.teaching_collections where id = v_id;
        if not found or not public.service_member_active(v_collection.service_id, p_actor_id) then raise exception 'teaching_not_found'; end if;
        return jsonb_build_object(
          'collection', jsonb_build_object('collectionId', v_collection.id, 'serviceId', v_collection.service_id, 'name', v_collection.name),
          'sections', coalesce((select jsonb_agg(jsonb_build_object('sectionId', cs.id, 'name', cs.name, 'sortOrder', cs.sort_order)
              order by cs.sort_order, lower(cs.name), cs.id)
            from public.teaching_collection_sections cs where cs.collection_id = v_collection.id), '[]'::jsonb),
          'items', coalesce((select jsonb_agg(public.teaching_resource_row(r.id, p_actor_id) order by lower(r.title), r.id)
            from public.teaching_resources r where r.collection_id = v_collection.id and r.removed_at is null
              and public.teaching_resource_visible(r.id, p_actor_id)), '[]'::jsonb));
      elsif v_text = 'recordings' then
        return jsonb_build_object('collection', null, 'sections', '[]'::jsonb,
          'items', coalesce((select jsonb_agg(public.teaching_resource_row(x.id, p_actor_id) order by x.added_at desc, x.id)
            from (select r.id, r.added_at from public.teaching_resources r
              where r.kind = 'recording' and r.removed_at is null and public.teaching_resource_visible(r.id, p_actor_id)
              order by r.added_at desc, r.id limit 500) as x), '[]'::jsonb));
      end if;
      return jsonb_build_object('collection', null, 'sections', '[]'::jsonb,
        'items', coalesce((select jsonb_agg(public.teaching_resource_row(v.resource_id, p_actor_id) order by v.saved_at desc, v.resource_id)
          from public.teaching_resource_saves v
          where v.user_id = p_actor_id and public.teaching_resource_visible(v.resource_id, p_actor_id)), '[]'::jsonb));

    elsif p_action in ('resource_save.set','resource_save.unset') then
      v_id := public.teaching_uuid_arg(p_payload, 'resourceId');
      select * into v_resource from public.teaching_resources where id = v_id;
      if not found then raise exception 'teaching_not_found'; end if;
      v_host := v_resource.service_id;
      if p_action = 'resource_save.set' then
        if not public.teaching_resource_visible(v_resource.id, p_actor_id) then raise exception 'teaching_not_found'; end if;
        if (select count(*) from public.teaching_resource_saves where user_id = p_actor_id) >= 1000 then raise exception 'teaching_limit'; end if;
        insert into public.teaching_resource_saves(user_id, resource_id) values (p_actor_id, v_resource.id)
        on conflict (user_id, resource_id) do nothing;
      else
        delete from public.teaching_resource_saves where user_id = p_actor_id and resource_id = v_resource.id;
      end if;
      -- No actor: a bookmark is the viewer's own, and the host team never learns who saved.
      perform public.teaching_audit(v_host, null, p_action, v_resource.id);
      return jsonb_build_object('saved', p_action = 'resource_save.set');
    end if;
  end if;

  -- Team writes. Organisers and presenters in a verified or demo team; lock key 74818 only.
  if p_service_id is null or p_action not in ('resource.add','resource.remove','series.set_open_to','collection.save',
    'collection.section.save') then
    raise exception 'teaching_invalid_request';
  end if;
  select * into v_service from public.on_call_services where id = p_service_id for share;
  if not found then raise exception 'teaching_access_denied'; end if;
  v_role := public.teaching_member_role(p_service_id, p_actor_id);
  if v_role is null then raise exception 'teaching_access_denied'; end if;
  if not (v_service.verified_at is not null or v_service.is_demo) then raise exception 'teaching_team_unverified'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_service_id::text, 74818));

  if p_action = 'resource.add' then
    if jsonb_typeof(p_payload->'noPatientDetails') is distinct from 'boolean' or not (p_payload->>'noPatientDetails')::boolean then
      raise exception 'teaching_invalid_request';
    end if;
    v_text := btrim(coalesce(public.teaching_text_arg(p_payload, 'title'), ''));
    v_kind := public.teaching_text_arg(p_payload, 'kind');
    v_url := nullif(btrim(coalesce(public.teaching_text_arg(p_payload, 'url'), '')), '');
    v_doc := public.teaching_uuid_arg(p_payload, 'libraryDocumentId');
    v_collection_id := public.teaching_uuid_arg(p_payload, 'collectionId');
    v_section_id := public.teaching_uuid_arg(p_payload, 'sectionId');
    v_id := public.teaching_uuid_arg(p_payload, 'occurrenceId');
    v_series_id := public.teaching_uuid_arg(p_payload, 'seriesId');
    if char_length(v_text) not between 1 and 160
      or v_kind is null or v_kind not in ('slides','recording','reading','link','library')
      or (v_kind = 'library') <> (v_doc is not null)
      or (v_url is null) = (v_doc is null)
      or (v_url is not null and (char_length(v_url) > 2000 or v_url !~ '^https://[^/@[:space:]]+(/|$)'))
      or (v_section_id is not null and v_collection_id is null)
      or (v_id is not null and v_series_id is not null) then
      raise exception 'teaching_invalid_request';
    end if;
    -- An organiser adds anywhere. Anyone else adds only to a session or series they present, and
    -- never into a collection.
    if v_role <> 'organiser' then
      if v_collection_id is not null or num_nonnulls(v_id, v_series_id) = 0
        or (v_id is not null and not exists (select 1 from public.teaching_occurrences o
          where o.id = v_id and o.service_id = p_service_id and o.presenter_id = p_actor_id))
        or (v_series_id is not null and not exists (select 1 from public.teaching_series s
          where s.id = v_series_id and s.service_id = p_service_id and s.presenter_id = p_actor_id)) then
        raise exception 'teaching_role_denied';
      end if;
    end if;
    if (v_collection_id is not null and not exists (select 1 from public.teaching_collections c where c.id = v_collection_id and c.service_id = p_service_id))
      or (v_section_id is not null and not exists (select 1 from public.teaching_collection_sections cs where cs.id = v_section_id and cs.collection_id = v_collection_id))
      or (v_id is not null and not exists (select 1 from public.teaching_occurrences o where o.id = v_id and o.service_id = p_service_id))
      or (v_series_id is not null and not exists (select 1 from public.teaching_series s where s.id = v_series_id and s.service_id = p_service_id)) then
      raise exception 'teaching_not_found';
    end if;
    if (select count(*) from public.teaching_resources where service_id = p_service_id and removed_at is null) >= 5000 then
      raise exception 'teaching_limit';
    end if;
    insert into public.teaching_resources(service_id, title, kind, url, library_document_id, collection_id, section_id,
      occurrence_id, series_id, no_patient_details_confirmed_at, added_by)
    values (p_service_id, v_text, v_kind, v_url, v_doc, v_collection_id, v_section_id, v_id, v_series_id, now(), p_actor_id)
    returning id into v_id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'resource.add', v_id);
    return jsonb_build_object('resourceId', v_id);

  elsif p_action = 'resource.remove' then
    v_id := public.teaching_uuid_arg(p_payload, 'resourceId');
    select * into v_resource from public.teaching_resources
    where id = v_id and service_id = p_service_id and removed_at is null for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if (v_role = 'organiser' or v_resource.added_by = p_actor_id) is not true then raise exception 'teaching_role_denied'; end if;
    update public.teaching_resources set removed_at = now(), removed_by = p_actor_id where id = v_resource.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'resource.remove', v_resource.id);
    return '{}'::jsonb;

  elsif p_action = 'series.set_open_to' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_series_id := public.teaching_uuid_arg(p_payload, 'seriesId');
    v_text := public.teaching_text_arg(p_payload, 'openTo');
    if v_series_id is null or v_text is null or v_text not in ('team','health_service') then raise exception 'teaching_invalid_request'; end if;
    select * into v_series from public.teaching_series where id = v_series_id and service_id = p_service_id for update;
    if not found then raise exception 'teaching_not_found'; end if;
    if v_text = 'health_service' and not exists (select 1 from public.teaching_team_settings ts where ts.service_id = p_service_id) then
      raise exception 'teaching_no_health_service';
    end if;
    update public.teaching_series set open_to = v_text, updated_at = now() where id = v_series.id;
    perform public.teaching_audit(p_service_id, p_actor_id, 'series.set_open_to', v_series.id);
    return jsonb_build_object('seriesId', v_series.id, 'openTo', v_text);

  elsif p_action = 'collection.save' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_id := public.teaching_uuid_arg(p_payload, 'collectionId');
    v_text := btrim(coalesce(public.teaching_text_arg(p_payload, 'name'), ''));
    v_sort := coalesce(public.teaching_int_arg(p_payload, 'sortOrder'), 0);
    if char_length(v_text) not between 1 and 80 or v_sort not between 0 and 999 then raise exception 'teaching_invalid_request'; end if;
    if v_id is null then
      if (select count(*) from public.teaching_collections where service_id = p_service_id) >= 100 then raise exception 'teaching_limit'; end if;
      insert into public.teaching_collections(service_id, name, sort_order, created_by)
      values (p_service_id, v_text, v_sort, p_actor_id) returning id into v_id;
    else
      update public.teaching_collections set name = v_text, sort_order = v_sort where id = v_id and service_id = p_service_id;
      if not found then raise exception 'teaching_not_found'; end if;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'collection.save', v_id);
    return jsonb_build_object('collectionId', v_id);

  elsif p_action = 'collection.section.save' then
    if v_role <> 'organiser' then raise exception 'teaching_role_denied'; end if;
    v_collection_id := public.teaching_uuid_arg(p_payload, 'collectionId');
    v_id := public.teaching_uuid_arg(p_payload, 'sectionId');
    v_text := btrim(coalesce(public.teaching_text_arg(p_payload, 'name'), ''));
    v_sort := coalesce(public.teaching_int_arg(p_payload, 'sortOrder'), 0);
    if char_length(v_text) not between 1 and 80 or v_sort not between 0 and 999 then raise exception 'teaching_invalid_request'; end if;
    if v_collection_id is null or not exists (select 1 from public.teaching_collections c where c.id = v_collection_id and c.service_id = p_service_id) then
      raise exception 'teaching_not_found';
    end if;
    if v_id is null then
      if (select count(*) from public.teaching_collection_sections where collection_id = v_collection_id) >= 50 then raise exception 'teaching_limit'; end if;
      insert into public.teaching_collection_sections(collection_id, service_id, name, sort_order)
      values (v_collection_id, p_service_id, v_text, v_sort) returning id into v_id;
    else
      update public.teaching_collection_sections set name = v_text, sort_order = v_sort where id = v_id and collection_id = v_collection_id;
      if not found then raise exception 'teaching_not_found'; end if;
    end if;
    perform public.teaching_audit(p_service_id, p_actor_id, 'collection.section.save', v_id);
    return jsonb_build_object('sectionId', v_id);
  end if;

  raise exception 'teaching_invalid_request';
end $$;
revoke all on function public.teaching_whats_on_command(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.teaching_whats_on_command(uuid, uuid, text, jsonb) to service_role;
