'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, CircleDollarSign, Filter, Handshake, Loader2, RefreshCw, ShieldAlert, Target, TrendingUp, UserCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CrmUserProfile, LeadsPipeline } from '@/types/database';

type Lead = LeadsPipeline;
type Period = '7' | '30' | '90' | 'all';

const stageOrder = ['novo', 'contato', 'qualificado', 'proposta', 'negociacao', 'fechado', 'perdido'] as const;
const stageNames: Record<string, string> = {
  novo: 'Novo', contato: 'Contato', qualificado: 'Qualificado', proposta: 'Proposta',
  negociacao: 'Negociação', fechado: 'Fechado', perdido: 'Perdido',
  em_atendimento_ia: 'Contato', atendimento_humano: 'Contato', analise_fatura: 'Qualificado', contrato_enviado: 'Proposta',
};
const normalizeStage: Record<string, string> = {
  em_atendimento_ia: 'contato', atendimento_humano: 'contato', analise_fatura: 'qualificado', contrato_enviado: 'proposta',
};

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function relativeTime(value: string | null | undefined, referenceNow: number) {
  if (!value) return 'sem data';
  const minutes = Math.max(0, Math.floor((referenceNow - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)}h`;
  return `há ${Math.floor(minutes / 1440)}d`;
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<CrmUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30');
  const [source, setSource] = useState('all');
  const [campaign, setCampaign] = useState('all');
  const [owner, setOwner] = useState('all');
  const [referenceNow, setReferenceNow] = useState(0);

  const load = useCallback(async () => {
    setReferenceNow(new Date().getTime());
    setLoading(true);
    setError(null);
    const [{ data, error: queryError }, { data: profileData }] = await Promise.all([
      supabase.from('leads_pipeline').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_user_profiles').select('*').eq('active', true).order('display_name'),
    ]);
    if (queryError) setError(queryError.message);
    else setLeads((data ?? []) as Lead[]);
    setProfiles((profileData ?? []) as CrmUserProfile[]);
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const sourceOptions = useMemo(() => [...new Set(leads.map((lead) => lead.origem || lead.last_source || lead.utm_source).filter(Boolean))] as string[], [leads]);
  const campaignOptions = useMemo(() => [...new Set(leads.map((lead) => lead.last_campaign || lead.utm_campaign).filter(Boolean))] as string[], [leads]);
  const ownerOptions = useMemo(() => [...new Set(leads.map((lead) => lead.assigned_user_id).filter(Boolean))] as string[], [leads]);

  const filtered = useMemo(() => {
    const cutoff = period === 'all' ? 0 : referenceNow - Number(period) * 86_400_000;
    return leads.filter((lead) => {
      const created = lead.created_at ? new Date(lead.created_at).getTime() : 0;
      const leadSource = lead.origem || lead.last_source || lead.utm_source || 'sem origem';
      const leadCampaign = lead.last_campaign || lead.utm_campaign || 'sem campanha';
      const leadOwner = lead.assigned_user_id || 'livre';
      return (!cutoff || created >= cutoff) && (source === 'all' || leadSource === source)
        && (campaign === 'all' || leadCampaign === campaign) && (owner === 'all' || leadOwner === owner);
    });
  }, [leads, period, source, campaign, owner, referenceNow]);

  const metrics = useMemo(() => {
    const stage = (lead: Lead) => normalizeStage[lead.status ?? 'novo'] ?? lead.status ?? 'novo';
    const qualified = filtered.filter((lead) => ['qualificado', 'proposta', 'negociacao', 'fechado'].includes(stage(lead))).length;
    const won = filtered.filter((lead) => stage(lead) === 'fechado');
    const lost = filtered.filter((lead) => stage(lead) === 'perdido').length;
    const potential = filtered.filter((lead) => !['fechado', 'perdido'].includes(stage(lead))).reduce((sum, lead) => sum + Number(lead.value ?? 0), 0);
    const closed = won.reduce((sum, lead) => sum + Number(lead.closed_value ?? lead.value ?? 0), 0);
    return { total: filtered.length, qualified, won: won.length, lost, potential, closed, conversion: filtered.length ? (won.length / filtered.length) * 100 : 0 };
  }, [filtered]);

  const stageData = useMemo(() => stageOrder.map((id) => ({
    id, label: stageNames[id], value: filtered.filter((lead) => (normalizeStage[lead.status ?? 'novo'] ?? lead.status ?? 'novo') === id).length,
  })), [filtered]);
  const maxStage = Math.max(1, ...stageData.map((item) => item.value));

  const origins = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach((lead) => { const key = lead.origem || lead.last_source || lead.utm_source || 'Sem origem'; counts.set(key, (counts.get(key) ?? 0) + 1); });
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [filtered]);

  const cards = [
    { label: 'Leads', value: String(metrics.total), icon: Users, color: 'text-sky-400', bg: 'bg-sky-400/10' },
    { label: 'Qualificados', value: String(metrics.qualified), icon: Target, color: 'text-violet-400', bg: 'bg-violet-400/10' },
    { label: 'Fechados', value: String(metrics.won), icon: Handshake, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Conversão', value: `${metrics.conversion.toFixed(1)}%`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Potencial', value: money(metrics.potential), icon: CircleDollarSign, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    { label: 'Valor fechado', value: money(metrics.closed), icon: UserCheck, color: 'text-lime-400', bg: 'bg-lime-400/10' },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">BeHub Energia</p><h1 className="mt-2 text-3xl font-bold text-white">Dashboard comercial</h1><p className="mt-1 text-sm text-slate-400">Indicadores calculados diretamente do pipeline real.</p></div>
        <button onClick={() => void load()} className="flex items-center gap-2 self-start rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar</button>
      </header>

      <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-slate-400"><span className="mb-2 flex items-center gap-1"><Filter className="h-3.5 w-3.5" /> Período</span><select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Todo o período</option></select></label>
        <FilterSelect label="Origem" value={source} onChange={setSource} options={sourceOptions} all="Todas as origens" />
        <FilterSelect label="Campanha" value={campaign} onChange={setCampaign} options={campaignOptions} all="Todas as campanhas" />
        <FilterSelect label="Responsável" value={owner} onChange={setOwner} options={['livre', ...ownerOptions]} all="Todos os responsáveis" format={(value) => value === 'livre' ? 'Fila livre' : profiles.find((profile) => profile.user_id === value)?.display_name ?? 'Usuário inativo'} />
      </section>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}
      {loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-amber-400" /></div> : <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className={`inline-flex rounded-xl p-2.5 ${card.bg}`}><card.icon className={`h-5 w-5 ${card.color}`} /></div><p className="mt-4 text-sm text-slate-400">{card.label}</p><p className="mt-1 text-2xl font-bold text-white">{card.value}</p></div>)}</section>
        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.8fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><div className="mb-5 flex items-center justify-between"><h2 className="font-bold text-white">Funil comercial</h2><span className="text-xs text-slate-500">{metrics.lost} perdidos</span></div><div className="space-y-4">{stageData.map((item) => <div key={item.id}><div className="mb-1.5 flex justify-between text-sm"><span className="text-slate-300">{item.label}</span><strong className="text-white">{item.value}</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-sky-400" style={{ width: `${(item.value / maxStage) * 100}%` }} /></div></div>)}</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="mb-5 font-bold text-white">Leads por origem</h2>{origins.length ? <div className="space-y-4">{origins.map(([name, value]) => <div key={name} className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-sky-400/10 p-2 text-center text-sm font-bold text-sky-400">{value}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{name}</p><p className="text-xs text-slate-500">{metrics.total ? ((value / metrics.total) * 100).toFixed(1) : 0}% do período</p></div></div>)}</div> : <p className="text-sm text-slate-500">Nenhuma origem no período.</p>}</div>
        </section>
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"><h2 className="mb-5 font-bold text-white">Atividade recente</h2><div className="grid gap-3 md:grid-cols-2">{filtered.slice(0, 8).map((lead) => <div key={lead.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 font-bold text-amber-400">{lead.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{lead.name}</p><p className="truncate text-xs text-slate-500">{stageNames[lead.status ?? 'novo'] ?? lead.status} · {lead.utm_campaign || lead.origem || 'sem campanha'} · {relativeTime(lead.updated_at || lead.created_at, referenceNow)}</p></div>{lead.automation_contact_allowed === false ? <ShieldAlert className="ml-auto h-4 w-4 shrink-0 text-red-400" /> : lead.ai_enabled ? <Bot className="ml-auto h-4 w-4 shrink-0 text-cyan-400" /> : null}</div>)}</div>{!filtered.length && <p className="text-sm text-slate-500">Nenhum lead encontrado com estes filtros.</p>}</section>
      </>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, all, format = (item) => item }: { label: string; value: string; onChange: (value: string) => void; options: string[]; all: string; format?: (value: string) => string }) {
  return <label className="text-xs font-semibold text-slate-400"><span className="mb-2 block">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="all">{all}</option>{options.map((option) => <option key={option} value={option}>{format(option)}</option>)}</select></label>;
}
