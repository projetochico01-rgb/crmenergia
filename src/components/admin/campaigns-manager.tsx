'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Campaign, CampaignAd, LeadsPipeline } from '@/types/database';

type CampaignSummary = Campaign & { ads: CampaignAd[]; leads: LeadsPipeline[] };

export function CampaignsManager({ initialCampaigns, ads, leads }: { initialCampaigns: Campaign[]; ads: CampaignAd[]; leads: LeadsPipeline[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [period, setPeriod] = useState('all');
  const [adFilter, setAdFilter] = useState('all');
  const [referenceNow] = useState(() => Date.now());
  const [form, setForm] = useState({ name: '', source: 'facebook', medium: 'paid_social', external_id: '' });

  const summaries = useMemo<CampaignSummary[]>(() => {
    const cutoff = period === 'all' ? 0 : referenceNow - Number(period) * 86_400_000;
    return campaigns.map((campaign) => ({
      ...campaign,
      ads: ads.filter((ad) => ad.campaign_id === campaign.id),
      leads: leads.filter((lead) => {
        const matchesCampaign = lead.campaign_id === campaign.id || (!lead.campaign_id && lead.first_campaign === campaign.name);
        const matchesPeriod = !cutoff || new Date(lead.created_at ?? 0).getTime() >= cutoff;
        const matchesAd = adFilter === 'all' || lead.ad_id === adFilter;
        return matchesCampaign && matchesPeriod && matchesAd;
      }),
    })).filter((campaign) => adFilter === 'all' || campaign.ads.some((ad) => ad.id === adFilter));
  }, [adFilter, ads, campaigns, leads, period, referenceNow]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/admin/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const payload = await response.json();
    if (!response.ok) return setFeedback(payload.error);
    setCampaigns((current) => [payload.campaign, ...current]);
    setForm({ name: '', source: 'facebook', medium: 'paid_social', external_id: '' });
    setFeedback('Campanha cadastrada.');
  }

  async function toggle(campaign: Campaign) {
    const response = await fetch('/api/admin/campaigns', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: campaign.id, active: !campaign.active }) });
    const payload = await response.json();
    if (!response.ok) return setFeedback(payload.error);
    setCampaigns((current) => current.map((item) => item.id === campaign.id ? { ...item, active: !item.active } : item));
  }

  return <div className="space-y-6">
    <div className="panel grid gap-3 md:grid-cols-2">
      <label className="field">Período<select className="control" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">Todo o período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label>
      <label className="field">Anúncio<select className="control" value={adFilter} onChange={(event) => setAdFilter(event.target.value)}><option value="all">Todos os anúncios</option>{ads.map((ad) => <option key={ad.id} value={ad.id}>{ad.name ?? ad.external_ad_id ?? 'Anúncio sem nome'}</option>)}</select></label>
    </div>
    <form className="panel grid gap-3 lg:grid-cols-[1fr_12rem_12rem_1fr_auto]" onSubmit={create}>
      <label className="field">Campanha<input required className="control" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label className="field">Origem<input className="control" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} /></label>
      <label className="field">Meio<input className="control" value={form.medium} onChange={(event) => setForm({ ...form, medium: event.target.value })} /></label>
      <label className="field">ID externo<input className="control" value={form.external_id} onChange={(event) => setForm({ ...form, external_id: event.target.value })} /></label>
      <button className="button-primary self-end">Cadastrar</button>
    </form>
    {feedback && <p role="status" className="text-sm text-amber-300">{feedback}</p>}
    <div className="grid gap-4 xl:grid-cols-2">{summaries.map((campaign) => {
      const qualified = campaign.leads.filter((lead) => ['qualificado', 'proposta', 'negociacao', 'fechado'].includes(lead.status ?? '')).length;
      const closed = campaign.leads.filter((lead) => lead.status === 'fechado');
      const lost = campaign.leads.filter((lead) => lead.status === 'perdido').length;
      const value = closed.reduce((sum, lead) => sum + Number(lead.closed_value ?? lead.value ?? 0), 0);
      return <article key={campaign.id} className="panel"><div className="flex items-start justify-between"><div><h2 className="font-bold">{campaign.name}</h2><p className="text-xs text-slate-500">{campaign.source ?? '—'} · {campaign.medium ?? '—'} · {campaign.ads.length} anúncios</p></div><button className="button-secondary" onClick={() => void toggle(campaign)}>{campaign.active ? 'Ativa' : 'Inativa'}</button></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5"><Metric label="Leads" value={campaign.leads.length} /><Metric label="Qualificados" value={qualified} /><Metric label="Fechados" value={closed.length} /><Metric label="Perdidos" value={lost} /><Metric label="Conversão" value={`${campaign.leads.length ? Math.round((closed.length / campaign.leads.length) * 100) : 0}%`} /></div>{campaign.ads.length > 0 && <details className="mt-4 rounded-xl bg-slate-950 p-3 text-xs text-slate-400"><summary className="cursor-pointer text-amber-300">Ver conjuntos e anúncios</summary><div className="mt-2 space-y-1">{campaign.ads.map((ad) => <p key={ad.id}>{ad.name ?? 'Anúncio sem nome'} · conjunto {ad.external_adset_id ?? 'não informado'} · anúncio {ad.external_ad_id ?? 'não informado'}</p>)}</div></details>}<div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4"><span className="text-sm text-emerald-300">R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span><Link className="text-sm font-semibold text-amber-300 hover:underline" href={`/leads?campaign=${encodeURIComponent(campaign.id)}`}>Ver leads</Link></div></article>;
    })}</div>
    {summaries.length === 0 && <div className="panel text-center text-slate-500">Nenhuma campanha corresponde aos filtros.</div>}
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-slate-950/70 p-3"><p className="text-[10px] uppercase text-slate-500">{label}</p><p className="mt-1 font-bold">{value}</p></div>; }
