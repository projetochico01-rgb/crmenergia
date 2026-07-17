import { NextResponse } from 'next/server';
import { requireAdminContext } from '@/lib/admin-auth';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { evolution } from '@/lib/evolution';
import { getRedis } from '@/lib/redis';

type Check = { name: string; status: 'online' | 'configured' | 'warning' | 'offline'; detail: string };

export async function GET() {
  const context = await requireAdminContext();
  if ('response' in context) return context.response;
  const checks: Check[] = [];
  const admin = getSupabaseAdmin();
  const { error: dbError } = await admin.from('crm_user_profiles').select('user_id').limit(1);
  checks.push({ name: 'Supabase', status: dbError ? 'offline' : 'online', detail: dbError ? 'Banco indisponível.' : 'Banco e autenticação acessíveis.' });

  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE) {
    try { await evolution.get(`/instance/connectionState/${process.env.EVOLUTION_INSTANCE}`); checks.push({ name: 'Evolution API', status: 'online', detail: 'Instância respondeu ao diagnóstico. Nenhuma mensagem foi enviada.' }); }
    catch { checks.push({ name: 'Evolution API', status: 'warning', detail: 'Configurada, mas a instância não respondeu ao diagnóstico.' }); }
  } else checks.push({ name: 'Evolution API', status: 'offline', detail: 'Variáveis de ambiente incompletas.' });

  if (process.env.REDIS_URL) {
    try { await getRedis().ping(); checks.push({ name: 'Redis / controle da IA', status: 'online', detail: 'Controle de pausa acessível.' }); }
    catch { checks.push({ name: 'Redis / controle da IA', status: 'warning', detail: 'Configurado, mas não respondeu.' }); }
  } else if (process.env.AI_CONTROL_API_URL) checks.push({ name: 'Controle da IA', status: 'configured', detail: 'Ponte HTTP configurada.' });
  else checks.push({ name: 'Redis / controle da IA', status: 'offline', detail: 'Controle de pausa não configurado.' });

  checks.push({ name: 'n8n', status: 'configured', detail: 'Integração preparada. Workflows devem permanecer inativos durante os testes.' });
  checks.push({ name: 'Meta Conversions API', status: 'configured', detail: 'Somente preparação de eventos; envio real permanece desligado.' });
  const { data: recentIntake } = await admin.from('lead_touchpoints').select('id, lead_id, source, occurred_at').order('occurred_at', { ascending: false }).limit(10);
  const { data: recentErrors } = await admin.from('conversion_outbox').select('id, event_name, error_message, created_at').eq('status', 'error').order('created_at', { ascending: false }).limit(10);
  return NextResponse.json({ checks, recentIntake: recentIntake ?? [], recentErrors: recentErrors ?? [], checkedAt: new Date().toISOString() });
}
