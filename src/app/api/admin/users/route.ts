import { NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const admin = getSupabaseAdmin();
  const [{ data: profiles, error }, { data: leads }, authUsers] = await Promise.all([
    admin.from('crm_user_profiles').select('*').order('display_name'),
    admin.from('leads_pipeline').select('assigned_user_id'),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const counts = new Map<string, number>();
  for (const lead of leads ?? []) if (lead.assigned_user_id) counts.set(lead.assigned_user_id, (counts.get(lead.assigned_user_id) ?? 0) + 1);
  const authMap = new Map((authUsers.data.users ?? []).map((user) => [user.id, user]));
  return NextResponse.json({ users: (profiles ?? []).map((profile) => { const authUser = authMap.get(profile.user_id); return { ...profile, lead_count: counts.get(profile.user_id) ?? 0, email: authUser?.email ?? null, invitation_pending: !authUser?.last_sign_in_at, last_sign_in_at: authUser?.last_sign_in_at ?? null }; }) });
}

export async function POST(request: Request) {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const body = await request.json() as { email?: string; display_name?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  const displayName = body.display_name?.trim();
  const role = body.role === 'admin' ? 'admin' : 'atendente';
  if (!email || !displayName) return NextResponse.json({ error: 'Informe nome e e-mail.' }, { status: 400 });

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { name: displayName } });
  if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'Não foi possível criar o convite.' }, { status: 400 });
  const { error: profileError } = await admin.from('crm_user_profiles').upsert({ user_id: data.user.id, display_name: displayName, role, active: true });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'user_invited', entity_type: 'crm_user_profile', entity_id: data.user.id, before_data: null, after_data: { email, display_name: displayName, role } });
  return NextResponse.json({ ok: true, user_id: data.user.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const body = await request.json() as { user_id?: string; display_name?: string; role?: string; active?: boolean };
  if (!body.user_id || !body.display_name || !['admin', 'atendente'].includes(body.role ?? '')) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { data: before } = await admin.from('crm_user_profiles').select('*').eq('user_id', body.user_id).maybeSingle();
  if (!before) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  if (before.role === 'admin' && before.active && (body.role !== 'admin' || body.active === false)) {
    const { count } = await admin.from('crm_user_profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin').eq('active', true);
    if ((count ?? 0) <= 1) return NextResponse.json({ error: 'O último administrador ativo não pode ser desativado ou rebaixado.' }, { status: 409 });
  }
  const update = { display_name: body.display_name.trim(), role: body.role as 'admin' | 'atendente', active: body.active !== false };
  const { error } = await admin.from('crm_user_profiles').update(update).eq('user_id', body.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'user_updated', entity_type: 'crm_user_profile', entity_id: body.user_id, before_data: before, after_data: update });
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  const context = await requireAdminContext(); if ('response' in context) return context.response;
  const body = await request.json() as { email?: string; user_id?: string };
  if (!body.email || !body.user_id) return NextResponse.json({ error: 'Convite inválido.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.resend({ type: 'signup', email: body.email });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await admin.from('audit_log').insert({ actor_user_id: context.user.id, actor_type: 'user', action: 'user_invite_resent', entity_type: 'crm_user_profile', entity_id: body.user_id, before_data: null, after_data: { email: body.email } });
  return NextResponse.json({ ok: true });
}
