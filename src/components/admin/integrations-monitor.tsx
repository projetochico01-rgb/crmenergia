'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

type Payload = {
  checks: Array<{ name: string; status: 'online' | 'configured' | 'warning' | 'offline'; detail: string }>;
  recentIntake: Array<{ id: string; lead_id: string; source: string | null; occurred_at: string }>;
  recentErrors: Array<{ id: string; event_name: string; error_message: string | null; created_at: string }>;
  checkedAt: string;
};

const colors = { online: 'bg-emerald-400', configured: 'bg-blue-400', warning: 'bg-amber-400', offline: 'bg-rose-400' };

export function IntegrationsMonitor() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/integrations', { cache: 'no-store' });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) return setError(body.error ?? 'Falha no diagnóstico.');
    setError(null); setPayload(body);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  return <div className="space-y-6">
    <div className="flex items-center justify-between"><p className="text-xs text-slate-500">{payload ? `Última verificação: ${new Date(payload.checkedAt).toLocaleString('pt-BR')}` : 'Aguardando diagnóstico'}</p><button className="button-secondary" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Verificar agora</button></div>
    {error && <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{payload?.checks.map((check) => <article className="panel" key={check.name}><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${colors[check.status]}`} /><h2 className="font-bold">{check.name}</h2></div><p className="mt-3 text-sm text-slate-400">{check.detail}</p><p className="mt-3 text-[10px] font-bold uppercase text-slate-600">{check.status}</p></article>)}</div>
    <div className="grid gap-5 xl:grid-cols-2"><section className="panel"><h2 className="font-bold">Últimas entradas de leads</h2><div className="mt-3 divide-y divide-slate-800">{payload?.recentIntake.map((item) => <div className="py-3 text-sm" key={item.id}><p>{item.source ?? 'Origem não informada'}</p><p className="text-xs text-slate-500">{new Date(item.occurred_at).toLocaleString('pt-BR')} · lead {item.lead_id.slice(0, 8)}</p></div>)}{payload?.recentIntake.length === 0 && <p className="py-4 text-sm text-slate-500">Nenhuma entrada registrada.</p>}</div></section><section className="panel"><h2 className="font-bold">Erros de conversão</h2><div className="mt-3 divide-y divide-slate-800">{payload?.recentErrors.map((item) => <div className="py-3 text-sm" key={item.id}><p>{item.event_name}</p><p className="text-xs text-rose-300">{item.error_message ?? 'Erro não detalhado'}</p></div>)}{payload?.recentErrors.length === 0 && <p className="py-4 text-sm text-slate-500">Nenhum erro recente.</p>}</div></section></div>
    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100"><strong>Proteção ativa:</strong> este monitor somente consulta o estado. Ele não ativa workflows, não envia WhatsApp e não dispara eventos à Meta.</div>
  </div>;
}
