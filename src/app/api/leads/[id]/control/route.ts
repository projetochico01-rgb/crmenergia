import { NextResponse } from 'next/server';
import { createAuthServerClient, getAuthenticatedUser } from '@/lib/supabase-auth-server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { pauseAgent, wakeAgent } from '@/lib/redis';

type Action = 'handoff' | 'return_to_ai' | 'opt_out' | 'clear_opt_out';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(); if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const { id } = await context.params; const supabase = await createAuthServerClient();
  const { data: lead } = await supabase.from('leads_pipeline').select('id').eq('id', id).maybeSingle();
  if (!lead) return NextResponse.json({ error: 'Lead indisponível.' }, { status: 404 });
  const admin = getSupabaseAdmin();
  const { data: logs } = await admin.from('audit_log').select('id,actor_user_id,action,after_data,created_at').eq('entity_type', 'lead').eq('entity_id', id).in('action', ['human_handoff_started', 'returned_to_ai', 'opt_out_applied', 'opt_out_cleared']).order('created_at', { ascending: false }).limit(10);
  const actorIds = [...new Set((logs ?? []).map((log) => log.actor_user_id).filter(Boolean))] as string[];
  const { data: profiles } = actorIds.length ? await admin.from('crm_user_profiles').select('user_id,display_name').in('user_id', actorIds) : { data: [] };
  const names = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.display_name]));
  return NextResponse.json({ history: (logs ?? []).map((log) => ({ ...log, actor_name: log.actor_user_id ? names.get(log.actor_user_id) ?? 'Usuário' : 'Sistema' })) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthenticatedUser(); if (!user) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  const { id } = await context.params; const body = await request.json() as { action?: Action; reason?: string };
  const supabase = await createAuthServerClient();
  const [{ data: profile }, { data: before }] = await Promise.all([supabase.from('crm_user_profiles').select('role, active').eq('user_id', user.id).maybeSingle(), supabase.from('leads_pipeline').select('*').eq('id', id).maybeSingle()]);
  if (!profile?.active || !before) return NextResponse.json({ error: 'Lead indisponível.' }, { status: 404 });
  let update: Record<string, unknown>; let action: string;
  if (body.action === 'handoff') { update = { human_handoff: true, intervencao_humana: true, ai_enabled: false, cadence_status: before.cadence_status === 'active' || before.cadence_status === 'waiting' ? 'paused' : before.cadence_status }; action = 'human_handoff_started'; }
  else if (body.action === 'return_to_ai') { if (before.automation_contact_allowed === false) return NextResponse.json({ error: 'Opt-out ativo: não é permitido devolver este contato para a IA.' }, { status: 409 }); update = { human_handoff: false, intervencao_humana: false, ai_enabled: true }; action = 'returned_to_ai'; }
  else if (body.action === 'opt_out') { if (!body.reason?.trim()) return NextResponse.json({ error: 'Informe o motivo do opt-out.' }, { status: 400 }); update = { automation_contact_allowed: false, do_not_contact_at: new Date().toISOString(), do_not_contact_reason: body.reason.trim(), ai_enabled: false, human_handoff: true, intervencao_humana: true, cadence_status: 'blocked' }; action = 'opt_out_applied'; }
  else if (body.action === 'clear_opt_out') { if (profile.role !== 'admin') return NextResponse.json({ error: 'Somente administradores podem corrigir um opt-out.' }, { status: 403 }); if (!body.reason?.trim()) return NextResponse.json({ error: 'Informe a justificativa da correção.' }, { status: 400 }); update = { automation_contact_allowed: true, do_not_contact_at: null, do_not_contact_reason: null, ai_enabled: false, human_handoff: true, intervencao_humana: true, cadence_status: 'inactive' }; action = 'opt_out_cleared'; }
  else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
  const { data: lead, error } = await supabase.from('leads_pipeline').update(update).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const phone = before.phone?.replace(/\D/g, '');
  if (phone) {
    try {
      if (body.action === 'handoff' || body.action === 'opt_out' || body.action === 'clear_opt_out') await pauseAgent(phone, 315360000);
      if (body.action === 'return_to_ai') await wakeAgent(phone);
    } catch {
      // Supabase remains the source of truth; the UI reports Redis separately.
    }
  }
  const admin = getSupabaseAdmin(); await admin.from('audit_log').insert({ actor_user_id: user.id, actor_type: 'user', action, entity_type: 'lead', entity_id: id, before_data: before, after_data: { ...update, reason: body.reason ?? null } });
  return NextResponse.json({ lead });
}
