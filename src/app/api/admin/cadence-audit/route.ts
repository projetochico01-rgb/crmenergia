import { NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const body = await request.json() as { config_id?: string; snapshot?: Record<string, unknown> };
  if (!body.config_id) return NextResponse.json({ error: 'Configuração inválida.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'cadence_configuration_saved', entity_type: 'cadence_config', entity_id: body.config_id, before_data: null, after_data: body.snapshot ?? {} });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
