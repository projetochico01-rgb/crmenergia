begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.crm_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'atendente' check (role in ('admin', 'atendente')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.crm_user_profiles (user_id, display_name, role, active)
select id,
  case email
    when 'josimar.riskoski@gmail.com' then 'Josimar Riskoski'
    when 'projetochico01@gmail.com' then 'Projeto Chico'
    else coalesce(raw_user_meta_data ->> 'name', split_part(email, '@', 1))
  end,
  'admin', true
from auth.users
where email in ('josimar.riskoski@gmail.com', 'projetochico01@gmail.com')
on conflict (user_id) do update
set display_name = excluded.display_name, role = 'admin', active = true, updated_at = now();

create or replace function public.crm_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.crm_user_profiles
    where user_id = auth.uid() and role = 'admin' and active
  );
$$;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta',
  external_id text,
  name text not null,
  source text,
  medium text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, external_id)
);

create table if not exists public.campaign_ads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  external_adset_id text,
  external_ad_id text,
  name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (campaign_id, external_ad_id)
);

alter table public.leads_pipeline
  add column if not exists assigned_user_id uuid references auth.users(id) on delete set null,
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null,
  add column if not exists ad_id uuid references public.campaign_ads(id) on delete set null,
  add column if not exists first_source text,
  add column if not exists first_medium text,
  add column if not exists first_campaign text,
  add column if not exists last_source text,
  add column if not exists last_medium text,
  add column if not exists last_campaign text,
  add column if not exists fbclid text,
  add column if not exists fbc text,
  add column if not exists fbp text,
  add column if not exists meta_lead_id text,
  add column if not exists consent_status text not null default 'unknown' check (consent_status in ('unknown', 'granted', 'denied')),
  add column if not exists consent_at timestamptz,
  add column if not exists ip_address inet,
  add column if not exists user_agent text,
  add column if not exists last_inbound_at timestamptz,
  add column if not exists last_outbound_at timestamptz,
  add column if not exists awaiting_response boolean not null default false,
  add column if not exists cadence_status text not null default 'inactive' check (cadence_status in ('inactive','waiting','active','responded','completed','paused','cancelled','blocked')),
  add column if not exists automation_contact_allowed boolean not null default true,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists do_not_contact_reason text,
  add column if not exists ai_enabled boolean not null default true,
  add column if not exists human_handoff boolean not null default false,
  add column if not exists stage_entered_at timestamptz not null default now(),
  add column if not exists closed_value numeric(14,2),
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  status_attribute smallint;
  constraint_name text;
begin
  select attnum into status_attribute
  from pg_attribute
  where attrelid = 'public.leads_pipeline'::regclass and attname = 'status' and not attisdropped;

  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.leads_pipeline'::regclass
      and contype = 'c'
      and status_attribute = any(conkey)
  loop
    execute format('alter table public.leads_pipeline drop constraint %I', constraint_name);
  end loop;
end $$;

update public.leads_pipeline
set phone = case
  when regexp_replace(phone, '\D', '', 'g') ~ '^55\d{10,11}$'
    then '+' || regexp_replace(phone, '\D', '', 'g')
  when regexp_replace(phone, '\D', '', 'g') ~ '^\d{10,11}$'
    then '+55' || regexp_replace(phone, '\D', '', 'g')
  else phone
end
where phone is not null and phone <> '';

update public.leads_pipeline
set status = case status
  when 'em_atendimento_ia' then 'contato'
  when 'atendimento_humano' then 'contato'
  when 'analise_fatura' then 'qualificado'
  when 'contrato_enviado' then 'proposta'
  else status
end
where status in ('em_atendimento_ia','atendimento_humano','analise_fatura','contrato_enviado');

alter table public.leads_pipeline
  add constraint leads_pipeline_status_check
  check (status in ('novo','contato','qualificado','proposta','negociacao','fechado','perdido'));

update public.leads_pipeline
set first_source = coalesce(first_source, utm_source, origem),
    first_medium = coalesce(first_medium, utm_medium),
    first_campaign = coalesce(first_campaign, utm_campaign),
    last_source = coalesce(last_source, utm_source, origem),
    last_medium = coalesce(last_medium, utm_medium),
    last_campaign = coalesce(last_campaign, utm_campaign),
    human_handoff = coalesce(intervencao_humana, false)
where first_source is null or last_source is null;

create unique index if not exists leads_pipeline_phone_unique
  on public.leads_pipeline (phone) where phone is not null and phone <> '';
create unique index if not exists leads_pipeline_meta_lead_id_unique
  on public.leads_pipeline (meta_lead_id) where meta_lead_id is not null;
create index if not exists leads_pipeline_status_idx on public.leads_pipeline(status);
create index if not exists leads_pipeline_assigned_idx on public.leads_pipeline(assigned_user_id);
create index if not exists leads_pipeline_cadence_idx on public.leads_pipeline(cadence_status, automation_contact_allowed);

create or replace function public.crm_can_access_lead(target_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.crm_is_admin() or exists (
    select 1 from public.leads_pipeline
    where id = target_lead_id
      and (assigned_user_id is null or assigned_user_id = auth.uid())
  );
$$;

create table if not exists public.lead_touchpoints (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads_pipeline(id) on delete cascade,
  channel text not null,
  direction text not null check (direction in ('inbound', 'outbound', 'system')),
  source text,
  medium text,
  campaign text,
  external_event_id text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (channel, external_event_id)
);

create table if not exists public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads_pipeline(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  version integer not null default 1 check (version > 0),
  approved boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, version)
);

insert into public.message_templates (name, body, version, approved, active)
values
  ('Retomada curta', 'Oi, {{nome}}! Passando para saber se conseguiu ver minha última mensagem. Posso continuar sua análise de economia?', 1, true, true),
  ('Lembrete de análise', 'Olá, {{nome}}! Ainda consigo preparar sua análise de economia de energia. Quer que eu siga por aqui?', 1, true, true),
  ('Encerramento gentil', 'Oi, {{nome}}! Vou encerrar este acompanhamento por enquanto para não incomodar. Se quiser retomar sua análise, é só responder esta mensagem.', 1, true, true)
on conflict (name, version) do nothing;

create table if not exists public.cadence_config (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Cadencia global BeHub',
  active boolean not null default false,
  timezone text not null default 'America/Sao_Paulo',
  allowed_weekdays smallint[] not null default array[1,2,3,4,5]::smallint[],
  window_start time not null default '08:00',
  window_end time not null default '18:00',
  auto_start_enabled boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cadence_config_single_active
  on public.cadence_config ((active)) where active;

create table if not exists public.cadence_steps (
  id uuid primary key default gen_random_uuid(),
  cadence_config_id uuid not null references public.cadence_config(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  interval_value integer not null check (interval_value > 0),
  interval_unit text not null check (interval_unit in ('hours', 'days')),
  template_id uuid not null references public.message_templates(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cadence_config_id, step_order)
);

create table if not exists public.lead_cadences (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads_pipeline(id) on delete cascade,
  cadence_config_id uuid not null references public.cadence_config(id) on delete restrict,
  status text not null default 'waiting' check (status in ('waiting','active','responded','completed','paused','cancelled','blocked')),
  current_step integer not null default 0,
  next_run_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  started_by text not null default 'diana' check (started_by = 'diana'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists lead_cadences_one_open_cycle
  on public.lead_cadences(lead_id)
  where status in ('waiting','active','paused');
create index if not exists lead_cadences_due_idx on public.lead_cadences(next_run_at)
  where status in ('waiting','active');

create table if not exists public.cadence_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_cadence_id uuid not null references public.lead_cadences(id) on delete cascade,
  cadence_step_id uuid not null references public.cadence_steps(id) on delete restrict,
  status text not null default 'scheduled' check (status in ('scheduled','claimed','sent','cancelled','error')),
  scheduled_for timestamptz not null,
  claimed_at timestamptz,
  claimed_by text,
  sent_at timestamptz,
  evolution_message_id text,
  template_snapshot text not null,
  technical_attempts integer not null default 0 check (technical_attempts between 0 and 3),
  error_message text,
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key),
  unique (lead_cadence_id, cadence_step_id)
);

create index if not exists cadence_attempts_due_idx
  on public.cadence_attempts(scheduled_for) where status = 'scheduled';

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads_pipeline(id) on delete cascade,
  external_message_id text,
  channel text not null default 'whatsapp',
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('lead','diana','human','system')),
  body text,
  media_url text,
  media_type text,
  sent_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (channel, external_message_id)
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user',
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table if not exists public.conversion_outbox (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads_pipeline(id) on delete cascade,
  event_name text not null,
  event_id uuid not null default gen_random_uuid(),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','cancelled','error')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (event_id)
);

create table if not exists public.integration_idempotency (
  idempotency_key text primary key,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.cadence_next_allowed_at(
  base_at timestamptz,
  target_timezone text,
  allowed_days smallint[],
  start_time time,
  end_time time
)
returns timestamptz
language plpgsql
stable
as $$
declare
  base_local timestamp := base_at at time zone target_timezone;
  window_start_at timestamp;
  window_end_at timestamp;
  candidate_at timestamp;
  day_offset integer;
begin
  if coalesce(array_length(allowed_days, 1), 0) = 0 then
    raise exception 'Cadence must have at least one allowed weekday';
  end if;

  for day_offset in 0..14 loop
    window_start_at := date_trunc('day', base_local) + day_offset * interval '1 day' + start_time;
    window_end_at := date_trunc('day', base_local) + day_offset * interval '1 day' + end_time;
    if end_time < start_time then
      window_end_at := window_end_at + interval '1 day';
    end if;

    if extract(dow from window_start_at)::smallint = any(allowed_days) then
      candidate_at := greatest(base_local, window_start_at);
      if candidate_at <= window_end_at then
        return candidate_at at time zone target_timezone;
      end if;
    end if;
  end loop;

  raise exception 'No allowed cadence window found';
end;
$$;

create or replace function public.cadence_start_for_lead(
  target_lead_id uuid,
  outbound_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_lead public.leads_pipeline%rowtype;
  target_config public.cadence_config%rowtype;
  first_step record;
  cycle_id uuid;
  scheduled_at timestamptz;
begin
  select * into target_lead from public.leads_pipeline where id = target_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if not target_lead.automation_contact_allowed or not target_lead.ai_enabled or target_lead.human_handoff
     or target_lead.status in ('fechado','perdido') then
    raise exception 'Lead is not eligible for cadence';
  end if;

  select * into target_config from public.cadence_config
  where active and auto_start_enabled order by updated_at desc limit 1;
  if not found then raise exception 'No active cadence configuration'; end if;

  if exists (select 1 from public.lead_cadences where lead_id = target_lead_id and status in ('waiting','active','paused')) then
    raise exception 'Lead already has an open cadence cycle';
  end if;

  select step.*, template.body into first_step
  from public.cadence_steps step
  join public.message_templates template on template.id = step.template_id
  where step.cadence_config_id = target_config.id and step.active and template.active and template.approved
  order by step.step_order limit 1;
  if not found then raise exception 'Cadence has no approved active steps'; end if;

  scheduled_at := public.cadence_next_allowed_at(
    outbound_at + make_interval(hours => case when first_step.interval_unit = 'hours' then first_step.interval_value else first_step.interval_value * 24 end),
    target_config.timezone, target_config.allowed_weekdays, target_config.window_start, target_config.window_end
  );

  insert into public.lead_cadences (lead_id, cadence_config_id, status, next_run_at, last_outbound_at)
  values (target_lead_id, target_config.id, 'waiting', scheduled_at, outbound_at)
  returning id into cycle_id;

  insert into public.cadence_attempts (lead_cadence_id, cadence_step_id, scheduled_for, template_snapshot)
  values (cycle_id, first_step.id, scheduled_at, first_step.body);

  update public.leads_pipeline set awaiting_response = true, cadence_status = 'waiting', last_outbound_at = outbound_at
  where id = target_lead_id;

  return jsonb_build_object('cycle_id', cycle_id, 'next_run_at', scheduled_at);
end;
$$;

create or replace function public.cadence_register_inbound(
  target_lead_id uuid,
  inbound_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare affected_cycles integer;
begin
  update public.leads_pipeline
  set last_inbound_at = inbound_at, awaiting_response = false,
      cadence_status = case when automation_contact_allowed then 'responded' else 'blocked' end
  where id = target_lead_id;
  if not found then raise exception 'Lead not found'; end if;

  update public.lead_cadences set status = 'responded', ended_at = inbound_at, last_inbound_at = inbound_at
  where lead_id = target_lead_id and status in ('waiting','active','paused');
  get diagnostics affected_cycles = row_count;

  update public.cadence_attempts attempt set status = 'cancelled', updated_at = inbound_at
  from public.lead_cadences cycle
  where attempt.lead_cadence_id = cycle.id and cycle.lead_id = target_lead_id
    and attempt.status in ('scheduled','claimed');

  return jsonb_build_object('cancelled_cycles', affected_cycles);
end;
$$;

create or replace function public.cadence_apply_opt_out(
  target_lead_id uuid,
  reason text,
  blocked_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.leads_pipeline set automation_contact_allowed = false, ai_enabled = false,
    awaiting_response = false, cadence_status = 'blocked', do_not_contact_at = blocked_at,
    do_not_contact_reason = nullif(trim(reason), '')
  where id = target_lead_id;
  if not found then raise exception 'Lead not found'; end if;
  update public.lead_cadences set status = 'blocked', ended_at = blocked_at
  where lead_id = target_lead_id and status in ('waiting','active','paused');
  update public.cadence_attempts attempt set status = 'cancelled', updated_at = blocked_at
  from public.lead_cadences cycle where attempt.lead_cadence_id = cycle.id and cycle.lead_id = target_lead_id
    and attempt.status in ('scheduled','claimed');
  return jsonb_build_object('blocked', true);
end;
$$;

create or replace function public.cadence_claim_due(worker_name text, batch_size integer default 20)
returns table (
  attempt_id uuid, cycle_id uuid, lead_id uuid, phone text, lead_name text,
  template_body text, idempotency_key uuid, technical_attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.cadence_attempts attempt set status = 'cancelled', updated_at = now()
  from public.lead_cadences cycle, public.leads_pipeline lead
  where attempt.lead_cadence_id = cycle.id and cycle.lead_id = lead.id
    and attempt.status = 'scheduled' and attempt.scheduled_for <= now()
    and (not lead.automation_contact_allowed or not lead.ai_enabled or lead.human_handoff
      or not lead.awaiting_response or lead.status in ('fechado','perdido') or cycle.status not in ('waiting','active'));

  return query
  with due as (
    select attempt.id
    from public.cadence_attempts attempt
    join public.lead_cadences cycle on cycle.id = attempt.lead_cadence_id
    join public.leads_pipeline lead on lead.id = cycle.lead_id
    join public.cadence_config config on config.id = cycle.cadence_config_id
    where attempt.status = 'scheduled' and attempt.scheduled_for <= now()
      and cycle.status in ('waiting','active') and config.active
      and lead.automation_contact_allowed and lead.ai_enabled and not lead.human_handoff
      and lead.awaiting_response and lead.status not in ('fechado','perdido')
    order by attempt.scheduled_for
    for update of attempt skip locked
    limit greatest(1, least(batch_size, 100))
  ), claimed as (
    update public.cadence_attempts attempt
    set status = 'claimed', claimed_at = now(), claimed_by = worker_name, updated_at = now()
    from due where attempt.id = due.id returning attempt.*
  )
  select claimed.id, cycle.id, lead.id, lead.phone, lead.name,
         claimed.template_snapshot, claimed.idempotency_key, claimed.technical_attempts
  from claimed
  join public.lead_cadences cycle on cycle.id = claimed.lead_cadence_id
  join public.leads_pipeline lead on lead.id = cycle.lead_id;
end;
$$;

create or replace function public.cadence_complete_attempt(
  target_attempt_id uuid,
  message_id text,
  completed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare current_attempt public.cadence_attempts%rowtype; current_cycle public.lead_cadences%rowtype;
  current_step public.cadence_steps%rowtype; next_step record; target_config public.cadence_config%rowtype;
  next_at timestamptz;
begin
  select * into current_attempt from public.cadence_attempts where id = target_attempt_id for update;
  if not found or current_attempt.status <> 'claimed' then raise exception 'Attempt is not claimed'; end if;
  select * into current_cycle from public.lead_cadences where id = current_attempt.lead_cadence_id for update;
  select * into current_step from public.cadence_steps where id = current_attempt.cadence_step_id;
  select * into target_config from public.cadence_config where id = current_cycle.cadence_config_id;

  update public.cadence_attempts set status = 'sent', sent_at = completed_at,
    evolution_message_id = message_id, updated_at = completed_at where id = target_attempt_id;

  select step.*, template.body into next_step from public.cadence_steps step
  join public.message_templates template on template.id = step.template_id
  where step.cadence_config_id = current_cycle.cadence_config_id and step.active
    and step.step_order > current_step.step_order and template.active and template.approved
  order by step.step_order limit 1;

  if found then
    next_at := public.cadence_next_allowed_at(
      completed_at + make_interval(hours => case when next_step.interval_unit = 'hours' then next_step.interval_value else next_step.interval_value * 24 end),
      target_config.timezone, target_config.allowed_weekdays, target_config.window_start, target_config.window_end
    );
    insert into public.cadence_attempts (lead_cadence_id, cadence_step_id, scheduled_for, template_snapshot)
    values (current_cycle.id, next_step.id, next_at, next_step.body);
    update public.lead_cadences set status = 'active', current_step = current_step.step_order,
      next_run_at = next_at, last_outbound_at = completed_at where id = current_cycle.id;
    update public.leads_pipeline set cadence_status = 'active', last_outbound_at = completed_at
      where id = current_cycle.lead_id;
    return jsonb_build_object('completed', false, 'next_run_at', next_at);
  end if;

  update public.lead_cadences set status = 'completed', current_step = current_step.step_order,
    next_run_at = null, ended_at = completed_at, last_outbound_at = completed_at where id = current_cycle.id;
  update public.leads_pipeline set cadence_status = 'completed', last_outbound_at = completed_at
    where id = current_cycle.lead_id;
  return jsonb_build_object('completed', true);
end;
$$;

create or replace function public.cadence_fail_attempt(
  target_attempt_id uuid,
  failure_message text,
  failed_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare attempts integer;
begin
  select technical_attempts + 1 into attempts from public.cadence_attempts
  where id = target_attempt_id and status = 'claimed' for update;
  if not found then raise exception 'Attempt is not claimed'; end if;
  update public.cadence_attempts set technical_attempts = attempts,
    status = case when attempts < 3 then 'scheduled' else 'error' end,
    scheduled_for = case when attempts < 3 then failed_at + make_interval(mins => attempts * 5) else scheduled_for end,
    claimed_at = null, claimed_by = null, error_message = left(failure_message, 2000), updated_at = failed_at
  where id = target_attempt_id;
  return jsonb_build_object('retry', attempts < 3, 'technical_attempts', attempts);
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'crm_user_profiles','campaigns','leads_pipeline','message_templates','cadence_config',
    'cadence_steps','lead_cadences','cadence_attempts'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

alter table public.crm_user_profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_ads enable row level security;
alter table public.leads_pipeline enable row level security;
alter table public.lead_touchpoints enable row level security;
alter table public.lead_stage_history enable row level security;
alter table public.message_templates enable row level security;
alter table public.cadence_config enable row level security;
alter table public.cadence_steps enable row level security;
alter table public.lead_cadences enable row level security;
alter table public.cadence_attempts enable row level security;
alter table public.crm_messages enable row level security;
alter table public.audit_log enable row level security;
alter table public.conversion_outbox enable row level security;
alter table public.integration_idempotency enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'campaigns','campaign_ads','message_templates','cadence_config','cadence_steps'
  ] loop
    execute format('drop policy if exists crm_authenticated_read on public.%I', table_name);
    execute format('create policy crm_authenticated_read on public.%I for select to authenticated using (true)', table_name);
  end loop;
end $$;

drop policy if exists lead_touchpoints_scoped_read on public.lead_touchpoints;
create policy lead_touchpoints_scoped_read on public.lead_touchpoints for select to authenticated
using (public.crm_can_access_lead(lead_id));
drop policy if exists lead_stage_history_scoped_read on public.lead_stage_history;
create policy lead_stage_history_scoped_read on public.lead_stage_history for select to authenticated
using (public.crm_can_access_lead(lead_id));
drop policy if exists lead_stage_history_scoped_insert on public.lead_stage_history;
create policy lead_stage_history_scoped_insert on public.lead_stage_history for insert to authenticated
with check (public.crm_can_access_lead(lead_id) and changed_by = auth.uid());
drop policy if exists lead_cadences_scoped_read on public.lead_cadences;
create policy lead_cadences_scoped_read on public.lead_cadences for select to authenticated
using (public.crm_can_access_lead(lead_id));
drop policy if exists cadence_attempts_scoped_read on public.cadence_attempts;
create policy cadence_attempts_scoped_read on public.cadence_attempts for select to authenticated
using (exists (
  select 1 from public.lead_cadences cycle
  where cycle.id = lead_cadence_id and public.crm_can_access_lead(cycle.lead_id)
));
drop policy if exists crm_messages_scoped_read on public.crm_messages;
create policy crm_messages_scoped_read on public.crm_messages for select to authenticated
using (public.crm_can_access_lead(lead_id));
drop policy if exists conversion_outbox_admin_read on public.conversion_outbox;
create policy conversion_outbox_admin_read on public.conversion_outbox for select to authenticated
using (public.crm_is_admin());
drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select to authenticated
using (public.crm_is_admin());

drop policy if exists crm_profiles_read on public.crm_user_profiles;
create policy crm_profiles_read on public.crm_user_profiles for select to authenticated using (true);
drop policy if exists crm_profiles_admin_write on public.crm_user_profiles;
create policy crm_profiles_admin_write on public.crm_user_profiles for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());

drop policy if exists leads_assigned_access on public.leads_pipeline;
create policy leads_assigned_access on public.leads_pipeline for all to authenticated
using (public.crm_is_admin() or assigned_user_id is null or assigned_user_id = auth.uid())
with check (public.crm_is_admin() or assigned_user_id is null or assigned_user_id = auth.uid());

drop policy if exists cadence_config_admin_write on public.cadence_config;
create policy cadence_config_admin_write on public.cadence_config for all to authenticated
using (public.crm_is_admin()) with check (public.crm_is_admin());
drop policy if exists cadence_steps_admin_write on public.cadence_steps;
create policy cadence_steps_admin_write on public.cadence_steps for all to authenticated
using (public.crm_is_admin()) with check (public.crm_is_admin());
drop policy if exists templates_admin_write on public.message_templates;
create policy templates_admin_write on public.message_templates for all to authenticated
using (public.crm_is_admin()) with check (public.crm_is_admin());

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

revoke all on function public.cadence_start_for_lead(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.cadence_register_inbound(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.cadence_apply_opt_out(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.cadence_claim_due(text, integer) from public, anon, authenticated;
revoke all on function public.cadence_complete_attempt(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.cadence_fail_attempt(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.cadence_start_for_lead(uuid, timestamptz) to service_role;
grant execute on function public.cadence_register_inbound(uuid, timestamptz) to service_role;
grant execute on function public.cadence_apply_opt_out(uuid, text, timestamptz) to service_role;
grant execute on function public.cadence_claim_due(text, integer) to service_role;
grant execute on function public.cadence_complete_attempt(uuid, text, timestamptz) to service_role;
grant execute on function public.cadence_fail_attempt(uuid, text, timestamptz) to service_role;

commit;
