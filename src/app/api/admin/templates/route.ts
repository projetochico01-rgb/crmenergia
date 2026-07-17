import { NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function POST(request: Request) {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const body = await request.json() as { name?: string; body?: string; approved?: boolean; base_id?: string };
  if (!body.name?.trim() || !body.body?.trim()) return NextResponse.json({ error: 'Informe nome e mensagem.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  let version = 1;
  if (body.base_id) {
    const { data: base } = await admin.from('message_templates').select('name, version').eq('id', body.base_id).maybeSingle();
    if (base) {
      const { data: latest } = await admin.from('message_templates').select('version').eq('name', base.name).order('version', { ascending: false }).limit(1).maybeSingle();
      version = (latest?.version ?? base.version) + 1;
    }
  }
  const row = { name: body.name.trim(), body: body.body.trim(), version, approved: body.approved === true, active: true, created_by: context.user.id };
  const { data, error } = await admin.from('message_templates').insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: version > 1 ? 'template_version_created' : 'template_created', entity_type: 'message_template', entity_id: data.id, before_data: null, after_data: data });
  return NextResponse.json({ template: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const body = await request.json() as { id?: string; approved?: boolean; active?: boolean };
  if (!body.id) return NextResponse.json({ error: 'Template inválido.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: before } = await admin.from('message_templates').select('*').eq('id', body.id).maybeSingle();
  const update = { approved: body.approved ?? before?.approved ?? false, active: body.active ?? before?.active ?? true };
  const { error } = await admin.from('message_templates').update(update).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'template_state_updated', entity_type: 'message_template', entity_id: body.id, before_data: before, after_data: update });
  return NextResponse.json({ ok: true });
}
