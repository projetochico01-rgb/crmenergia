begin;

do $$
declare
  config_id uuid;
  test_lead_id uuid;
  completion_lead_id uuid;
  human_lead_id uuid;
  closed_lead_id uuid;
  cycle_id uuid;
  completion_cycle_id uuid;
  attempt_id uuid;
  result jsonb;
  row_status text;
  attempts_count integer;
  first_claim_count integer;
  second_claim_count integer;
  duplicate_cycle_blocked boolean := false;
  human_handoff_blocked boolean := false;
  closed_lead_blocked boolean := false;
begin
  select id into config_id
  from public.cadence_config
  order by created_at
  limit 1;

  if config_id is null then
    raise exception 'Acceptance test requires a cadence configuration';
  end if;

  update public.cadence_config
  set active = true, auto_start_enabled = true
  where id = config_id;

  insert into public.leads_pipeline (name, phone, status)
  values ('TESTE CADENCIA - REMOVIDO PELO ROLLBACK', '+559999990001', 'novo')
  returning id into test_lead_id;

  result := public.cadence_start_for_lead(test_lead_id, now());
  cycle_id := (result ->> 'cycle_id')::uuid;

  if cycle_id is null then
    raise exception 'Cadence did not create the first cycle';
  end if;

  begin
    perform public.cadence_start_for_lead(test_lead_id, now());
  exception when others then
    duplicate_cycle_blocked := true;
  end;

  if not duplicate_cycle_blocked then
    raise exception 'A simultaneous cadence cycle was allowed';
  end if;

  update public.cadence_attempts
  set scheduled_for = now() - interval '1 minute'
  where lead_cadence_id = cycle_id and status = 'scheduled';

  select count(*) into first_claim_count
  from public.cadence_claim_due('acceptance-worker-1', 10)
  where lead_id = test_lead_id;

  select count(*) into second_claim_count
  from public.cadence_claim_due('acceptance-worker-2', 10)
  where lead_id = test_lead_id;

  if first_claim_count <> 1 or second_claim_count <> 0 then
    raise exception 'Atomic claim failed: first %, second %', first_claim_count, second_claim_count;
  end if;

  select id into attempt_id
  from public.cadence_attempts
  where lead_cadence_id = cycle_id and status = 'claimed';

  perform public.cadence_fail_attempt(attempt_id, 'acceptance failure 1', now());
  select status into row_status from public.cadence_attempts where id = attempt_id;
  if row_status <> 'scheduled' then raise exception 'First failure did not schedule a retry'; end if;

  update public.cadence_attempts set status = 'claimed' where id = attempt_id;
  perform public.cadence_fail_attempt(attempt_id, 'acceptance failure 2', now());
  select status into row_status from public.cadence_attempts where id = attempt_id;
  if row_status <> 'scheduled' then raise exception 'Second failure did not schedule a retry'; end if;

  update public.cadence_attempts set status = 'claimed' where id = attempt_id;
  perform public.cadence_fail_attempt(attempt_id, 'acceptance failure 3', now());
  select status into row_status from public.cadence_attempts where id = attempt_id;
  if row_status <> 'error' then raise exception 'Third failure was not persisted as an error'; end if;

  perform public.cadence_register_inbound(test_lead_id, now());
  select status into row_status from public.lead_cadences where id = cycle_id;
  if row_status <> 'responded' then raise exception 'Inbound response did not finish the cycle'; end if;

  result := public.cadence_start_for_lead(test_lead_id, now());
  if (result ->> 'cycle_id')::uuid = cycle_id then
    raise exception 'A new outbound question did not create a new cycle';
  end if;

  perform public.cadence_apply_opt_out(test_lead_id, 'acceptance opt-out', now());
  if not exists (
    select 1 from public.leads_pipeline
    where id = test_lead_id
      and not automation_contact_allowed
      and not ai_enabled
      and cadence_status = 'blocked'
  ) then
    raise exception 'Opt-out did not block AI and cadence';
  end if;

  insert into public.leads_pipeline (name, phone, status, human_handoff)
  values ('TESTE HANDOFF - REMOVIDO PELO ROLLBACK', '+559999990002', 'novo', true)
  returning id into human_lead_id;

  begin
    perform public.cadence_start_for_lead(human_lead_id, now());
  exception when others then
    human_handoff_blocked := true;
  end;

  if not human_handoff_blocked then
    raise exception 'Human handoff lead was eligible for cadence';
  end if;

  insert into public.leads_pipeline (name, phone, status)
  values ('TESTE FECHADO - REMOVIDO PELO ROLLBACK', '+559999990003', 'fechado')
  returning id into closed_lead_id;

  begin
    perform public.cadence_start_for_lead(closed_lead_id, now());
  exception when others then
    closed_lead_blocked := true;
  end;

  if not closed_lead_blocked then
    raise exception 'Closed lead was eligible for cadence';
  end if;

  insert into public.leads_pipeline (name, phone, status)
  values ('TESTE CONCLUSAO - REMOVIDO PELO ROLLBACK', '+559999990004', 'novo')
  returning id into completion_lead_id;

  result := public.cadence_start_for_lead(completion_lead_id, now());
  completion_cycle_id := (result ->> 'cycle_id')::uuid;

  loop
    select id into attempt_id
    from public.cadence_attempts
    where lead_cadence_id = completion_cycle_id and status = 'scheduled'
    order by scheduled_for
    limit 1;

    exit when not found;

    update public.cadence_attempts
    set status = 'claimed', claimed_at = now(), claimed_by = 'acceptance-completion'
    where id = attempt_id;

    perform public.cadence_complete_attempt(attempt_id, 'acceptance-message-' || attempt_id, now());
  end loop;

  select status into row_status
  from public.lead_cadences
  where id = completion_cycle_id;

  select count(*) into attempts_count
  from public.cadence_attempts
  where lead_cadence_id = completion_cycle_id and status = 'sent';

  if row_status <> 'completed' or attempts_count <> 3 then
    raise exception 'Finite sequence did not complete: status %, sent %', row_status, attempts_count;
  end if;

  raise notice 'CADENCE_ACCEPTANCE_OK';
end;
$$;

rollback;
