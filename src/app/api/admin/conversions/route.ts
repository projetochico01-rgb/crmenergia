import { NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { canQueueConversion } from '@/lib/crm-rules';

export async function POST(request: Request) {
  const context = await requireAdminContext(); if ('response' in context) return context.response;
  const body = await request.json() as { lead_id?: string; event_name?: string; value?: number; closed_at?: string };
  if (!body.lead_id || !['LeadQualified', 'Purchase'].includes(body.event_name ?? '')) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: lead } = await admin.from('leads_pipeline').select('*').eq('id', body.lead_id).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado.' }, { status: 404 });
  const { data: existing } = await admin.from('conversion_outbox').select('id, status').eq('lead_id', lead.id).eq('event_name', body.event_name!).neq('status', 'cancelled').maybeSingle();
  if (!canQueueConversion(lead.consent_status, existing?.status)) return NextResponse.json({ error: existing ? `Já existe um evento ${body.event_name} para este lead (${existing.status}).` : 'O lead não possui consentimento confirmado. O evento não foi criado.' }, { status: 409 });
  const payload = { event_source_url: null, event_time: body.closed_at ?? new Date().toISOString(), currency: 'BRL', value: Number(body.value ?? lead.closed_value ?? lead.value ?? 0), attribution: { fbc: lead.fbc ?? null, fbp: lead.fbp ?? null, fbclid: lead.fbclid ?? null, campaign: lead.first_campaign ?? null }, delivery_enabled: false };
  const { data, error } = await admin.from('conversion_outbox').insert({ lead_id: lead.id, event_name: body.event_name!, payload, status: 'pending', attempts: 0, sent_at: null, error_message: null }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'conversion_queued', entity_type: 'conversion_outbox', entity_id: data.id, before_data: null, after_data: { lead_id: lead.id, event_name: body.event_name, delivery_enabled: false } });
  return NextResponse.json({ event: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireAdminContext(); if ('response' in context) return context.response;
  const body = await request.json() as { id?: string };
  if (!body.id) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 });
  const admin = getSupabaseAdmin(); const { data: before } = await admin.from('conversion_outbox').select('*').eq('id', body.id).maybeSingle();
  if (!before || before.status !== 'error') return NextResponse.json({ error: 'Somente eventos com erro podem voltar para a fila.' }, { status: 409 });
  const { error } = await admin.from('conversion_outbox').update({ status: 'pending', error_message: null, available_at: new Date().toISOString() }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'conversion_requeued', entity_type: 'conversion_outbox', entity_id: body.id, before_data: before, after_data: { status: 'pending', delivery_enabled: false } });
  return NextResponse.json({ ok: true });
}
