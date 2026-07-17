import { NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const body = await request.json() as { name?: string; source?: string; medium?: string; external_id?: string };
  if (!body.name?.trim()) return NextResponse.json({ error: 'Informe o nome da campanha.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const row = { provider: 'meta', name: body.name.trim(), source: body.source?.trim() || 'facebook', medium: body.medium?.trim() || 'paid_social', external_id: body.external_id?.trim() || null, active: true, metadata: {} };
  const { data, error } = await admin.from('campaigns').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'campaign_created', entity_type: 'campaign', entity_id: data.id, before_data: null, after_data: data });
  return NextResponse.json({ campaign: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const body = await request.json() as { id?: string; active?: boolean; name?: string };
  if (!body.id) return NextResponse.json({ error: 'Campanha inválida.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: before } = await admin.from('campaigns').select('*').eq('id', body.id).maybeSingle();
  const update = { active: body.active ?? before?.active ?? true, name: body.name?.trim() || before?.name || 'Campanha' };
  const { error } = await admin.from('campaigns').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'campaign_updated', entity_type: 'campaign', entity_id: body.id, before_data: before, after_data: update });
  return NextResponse.json({ ok: true });
}
