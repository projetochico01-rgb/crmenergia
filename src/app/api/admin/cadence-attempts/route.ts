import { NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function PATCH(request: Request) {
  const context = await requireAdminContext(); if ('response' in context) return context.response;
  const body = await request.json() as { id?: string };
  if (!body.id) return NextResponse.json({ error: 'Tentativa inválida.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: before } = await admin.from('cadence_attempts').select('*').eq('id', body.id).maybeSingle();
  if (!before || before.status !== 'error') return NextResponse.json({ error: 'Somente tentativas com erro podem ser reprocessadas.' }, { status: 409 });
  const update = { status: 'scheduled' as const, scheduled_for: new Date().toISOString(), claimed_at: null, claimed_by: null, error_message: null };
  const { error } = await admin.from('cadence_attempts').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'cadence_attempt_requeued', entity_type: 'cadence_attempt', entity_id: body.id, before_data: before, after_data: { ...update, workflow_active: false } });
  return NextResponse.json({ ok: true });
}
