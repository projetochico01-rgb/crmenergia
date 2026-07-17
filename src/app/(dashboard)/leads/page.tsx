'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Bot, CalendarClock, ChevronRight, CircleDollarSign, Download, GripVertical,
  History, Loader2, MessageCircle, MessageSquareText, Pencil, Phone, Plus, RefreshCw,
  RotateCcw, Search, ShieldAlert, Tag, UserCheck, UserRound, Users, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type {
  CadenceAttempt, CrmMessage, CrmUserProfile, LeadCadence, LeadsPipeline,
  LeadStageHistory, LeadTouchpoint,
} from '@/types/database';

type CommercialStage = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado' | 'perdido';
type DetailTab = 'resumo' | 'historico' | 'touchpoints' | 'cadencia' | 'conversa';

const stages: Array<{ id: CommercialStage; label: string; dot: string }> = [
  { id: 'novo', label: 'Novo', dot: 'bg-sky-400' },
  { id: 'contato', label: 'Contato', dot: 'bg-cyan-400' },
  { id: 'qualificado', label: 'Qualificado', dot: 'bg-violet-400' },
  { id: 'proposta', label: 'Proposta', dot: 'bg-indigo-400' },
  { id: 'negociacao', label: 'Negociação', dot: 'bg-amber-400' },
  { id: 'fechado', label: 'Fechado', dot: 'bg-emerald-400' },
  { id: 'perdido', label: 'Perdido', dot: 'bg-rose-400' },
];

const legacyStage: Record<string, CommercialStage> = {
  em_atendimento_ia: 'contato', atendimento_humano: 'contato', analise_fatura: 'qualificado', contrato_enviado: 'proposta',
};

const cadenceLabel = {
  inactive: 'Sem cadência', waiting: 'Aguardando', active: 'Em cadência', responded: 'Respondeu',
  completed: 'Concluída', paused: 'Pausada', cancelled: 'Cancelada', blocked: 'Bloqueada',
} as const;

const emptyForm = {
  name: '', email: '', phone: '', cidade: '', origem: 'whatsapp', observations: '', value: 0,
  closed_value: 0, status: 'novo' as CommercialStage, assigned_user_id: '',
};

type LeadForm = typeof emptyForm;
type Details = {
  stageHistory: LeadStageHistory[];
  touchpoints: LeadTouchpoint[];
  cadences: LeadCadence[];
  attempts: CadenceAttempt[];
  messages: CrmMessage[];
};

const emptyDetails: Details = { stageHistory: [], touchpoints: [], cadences: [], attempts: [], messages: [] };

function stageOf(lead: LeadsPipeline): CommercialStage {
  const value = lead.status ?? 'novo';
  return stages.some((stage) => stage.id === value) ? value as CommercialStage : legacyStage[value] ?? 'novo';
}

function formatMoney(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '-';
}

function elapsed(value: string | null | undefined) {
  if (!value) return 'agora';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 24) return `${hours}h nesta etapa`;
  return `${Math.floor(hours / 24)}d nesta etapa`;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const normalized = digits.startsWith('55') ? digits : `55${digits}`;
  if (normalized.length < 12 || normalized.length > 13) throw new Error('Informe um telefone brasileiro válido.');
  return `+${normalized}`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadsPipeline[]>([]);
  const [profiles, setProfiles] = useState<CrmUserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentRole, setCurrentRole] = useState<'admin' | 'atendente'>('atendente');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<CommercialStage | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [owner, setOwner] = useState('all');
  const [campaign, setCampaign] = useState('all');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyForm);
  const [detailTab, setDetailTab] = useState<DetailTab>('resumo');
  const [details, setDetails] = useState<Details>(emptyDetails);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const selected = useMemo(() => leads.find((lead) => lead.id === selectedId) ?? null, [leads, selectedId]);
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.user_id, profile])), [profiles]);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true); setFeedback(null);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? '';
    setCurrentUserId(userId);
    const [leadResult, profileResult] = await Promise.all([
      supabase.from('leads_pipeline').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_user_profiles').select('*').eq('active', true).order('display_name'),
    ]);
    if (leadResult.error) setFeedback(leadResult.error.message); else setLeads(leadResult.data ?? []);
    if (profileResult.error) setFeedback((current) => current ?? profileResult.error.message);
    else {
      const nextProfiles = profileResult.data ?? [];
      setProfiles(nextProfiles);
      setCurrentRole(nextProfiles.find((profile) => profile.user_id === userId)?.role ?? 'atendente');
    }
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void fetchWorkspace(), 0); return () => window.clearTimeout(timer); }, [fetchWorkspace]);
  useEffect(() => { const timer = window.setTimeout(() => { const params = new URLSearchParams(window.location.search); const campaignId = params.get('campaign'); const newPhone = params.get('newPhone'); if (campaignId) setCampaign(campaignId); if (newPhone) { setForm({ ...emptyForm, phone: newPhone, origem: 'whatsapp' }); setCreating(true); } }, 0); return () => window.clearTimeout(timer); }, []);

  const fetchDetails = useCallback(async (leadId: string) => {
    setDetailsLoading(true); setDetails(emptyDetails);
    const [historyResult, touchpointResult, cadenceResult, messageResult] = await Promise.all([
      supabase.from('lead_stage_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }),
      supabase.from('lead_touchpoints').select('*').eq('lead_id', leadId).order('occurred_at', { ascending: false }),
      supabase.from('lead_cadences').select('*').eq('lead_id', leadId).order('started_at', { ascending: false }),
      supabase.from('crm_messages').select('*').eq('lead_id', leadId).order('sent_at', { ascending: false }).limit(100),
    ]);
    const cadences = cadenceResult.data ?? [];
    let attempts: CadenceAttempt[] = [];
    if (cadences.length) {
      const attemptResult = await supabase.from('cadence_attempts').select('*').in('lead_cadence_id', cadences.map((item) => item.id)).order('scheduled_for', { ascending: false });
      attempts = attemptResult.data ?? [];
      if (attemptResult.error) setFeedback(attemptResult.error.message);
    }
    const firstError = historyResult.error ?? touchpointResult.error ?? cadenceResult.error ?? messageResult.error;
    if (firstError) setFeedback(firstError.message);
    setDetails({ stageHistory: historyResult.data ?? [], touchpoints: touchpointResult.data ?? [], cadences, attempts, messages: messageResult.data ?? [] });
    setDetailsLoading(false);
  }, []);

  function openLead(id: string) {
    setSelectedId(id); setDetailTab('resumo'); setEditing(false); void fetchDetails(id);
  }

  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.origem).filter(Boolean))) as string[], [leads]);
  const visible = useMemo(() => leads.filter((lead) => {
    const haystack = `${lead.name} ${lead.phone ?? ''} ${lead.email ?? ''} ${lead.utm_campaign ?? ''}`.toLowerCase();
    const ownerMatches = owner === 'all' || (owner === 'free' ? !lead.assigned_user_id : lead.assigned_user_id === owner);
    return haystack.includes(search.toLowerCase()) && (source === 'all' || lead.origem === source) && ownerMatches && (campaign === 'all' || lead.campaign_id === campaign);
  }), [campaign, leads, owner, search, source]);

  async function moveLead(leadId: string, nextStage: CommercialStage) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || stageOf(lead) === nextStage) return;
    if ((nextStage === 'fechado' || nextStage === 'perdido') && !window.confirm(`Confirmar mudança de ${lead.name} para ${stages.find((item) => item.id === nextStage)?.label}?`)) return;
    const previous = stageOf(lead); const enteredAt = new Date().toISOString();
    setLeads((current) => current.map((item) => item.id === leadId ? { ...item, status: nextStage, stage_entered_at: enteredAt } : item));
    const { error: updateError } = await supabase.from('leads_pipeline').update({ status: nextStage, stage_entered_at: enteredAt }).eq('id', leadId);
    if (!updateError) {
      const { error: historyError } = await supabase.from('lead_stage_history').insert({ lead_id: leadId, from_stage: previous, to_stage: nextStage, changed_by: currentUserId, reason: 'kanban' });
      if (historyError) setFeedback(`Etapa alterada, mas o histórico falhou: ${historyError.message}`);
      else if (selectedId === leadId) void fetchDetails(leadId);
      return;
    }
    setLeads((current) => current.map((item) => item.id === leadId ? lead : item));
    setFeedback(`Não foi possível mover ${lead.name}. O cartão voltou para a etapa anterior. ${updateError.message}`);
  }

  async function assignLead(leadId: string, assignedUserId: string | null) {
    setSaving(true); setFeedback(null);
    try {
      const response = await fetch(`/api/leads/${leadId}/assign`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedUserId }) });
      const payload = await response.json() as { lead?: { assigned_user_id: string | null }; error?: string; warning?: string | null };
      if (!response.ok || !payload.lead) throw new Error(payload.error ?? 'Falha ao atribuir lead.');
      setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, assigned_user_id: payload.lead!.assigned_user_id } : lead));
      setFeedback(payload.warning ?? (assignedUserId ? 'Responsável atualizado.' : 'Lead devolvido para a fila livre.'));
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Falha ao atribuir lead.'); }
    finally { setSaving(false); }
  }

  function beginEdit(lead: LeadsPipeline) {
    setForm({
      name: lead.name, email: lead.email ?? '', phone: lead.phone ?? '', cidade: lead.cidade ?? '', origem: lead.origem ?? 'whatsapp',
      observations: lead.observations ?? '', value: Number(lead.value ?? 0), closed_value: Number(lead.closed_value ?? 0),
      status: stageOf(lead), assigned_user_id: lead.assigned_user_id ?? '',
    });
    setEditing(true);
  }

  async function saveLead(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setFeedback(null);
    try {
      const values = {
        name: form.name.trim(), email: form.email.trim().toLowerCase() || null, phone: normalizePhone(form.phone), cidade: form.cidade.trim() || null,
        origem: form.origem.trim() || 'crm', observations: form.observations.trim() || null, value: Number(form.value) || 0,
        closed_value: Number(form.closed_value) || null, status: form.status,
      };
      if (creating) {
        const { error } = await supabase.from('leads_pipeline').insert({ ...values, utm_source: values.origem, utm_medium: 'crm_manual', utm_campaign: 'cadastro_manual', human_handoff: true, ai_enabled: false, intervencao_humana: true, assigned_user_id: form.assigned_user_id || null });
        if (error) throw error;
        setCreating(false);
      } else if (selected) {
        const previousStage = stageOf(selected);
        const stageChanged = previousStage !== form.status;
        const { error } = await supabase.from('leads_pipeline').update({ ...values, stage_entered_at: stageChanged ? new Date().toISOString() : selected.stage_entered_at }).eq('id', selected.id);
        if (error) throw error;
        if (stageChanged) await supabase.from('lead_stage_history').insert({ lead_id: selected.id, from_stage: previousStage, to_stage: form.status, changed_by: currentUserId, reason: 'edicao_manual' });
        if ((selected.assigned_user_id ?? '') !== form.assigned_user_id) await assignLead(selected.id, form.assigned_user_id || null);
        setEditing(false);
      }
      setForm(emptyForm); await fetchWorkspace();
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Não foi possível salvar o lead.'); }
    finally { setSaving(false); }
  }

  function exportCsv() {
    const header = ['Nome', 'Telefone', 'Email', 'Etapa', 'Origem', 'Campanha', 'Responsável', 'Valor'];
    const rows = visible.map((lead) => [lead.name, lead.phone ?? '', lead.email ?? '', stageOf(lead), lead.origem ?? '', lead.utm_campaign ?? '', profileMap.get(lead.assigned_user_id ?? '')?.display_name ?? 'Fila livre', lead.value ?? 0]);
    const safe = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
    const blob = new Blob([`\uFEFF${[header, ...rows].map((row) => row.map(safe).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `leads-behub-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="space-y-5">
    <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-400"><Users className="h-4 w-4" /> Pipeline comercial</div><h1 className="text-3xl font-bold text-white">Leads em movimento</h1><p className="mt-1 text-sm text-slate-400">Funil, responsável, IA, handoff e cadência em estados independentes.</p></div>
      <div className="flex flex-wrap gap-2"><button onClick={exportCsv} className="button-secondary"><Download className="h-4 w-4" /> Exportar</button><button onClick={() => { setForm(emptyForm); setCreating(true); }} className="button-primary"><Plus className="h-4 w-4" /> Novo lead</button></div>
    </header>

    <section className="grid gap-3 md:grid-cols-3"><Metric label="Leads no funil" value={visible.length.toString()} icon={Users} /><Metric label="Valor potencial" value={formatMoney(visible.reduce((sum, lead) => sum + Number(lead.value ?? 0), 0))} icon={CircleDollarSign} /><Metric label="Não incomodar" value={visible.filter((lead) => lead.automation_contact_allowed === false).length.toString()} icon={ShieldAlert} danger /></section>

    <section className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 lg:grid-cols-[minmax(220px,1fr)_170px_190px_190px_auto]">
      <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, telefone, email ou campanha" className="control pl-10" /></label>
      <select value={source} onChange={(event) => setSource(event.target.value)} className="control"><option value="all">Todas as origens</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select value={owner} onChange={(event) => setOwner(event.target.value)} className="control"><option value="all">Todos os responsáveis</option><option value="free">Fila livre</option>{profiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.display_name || 'Sem nome'}</option>)}</select>
      <select value={campaign} onChange={(event) => setCampaign(event.target.value)} className="control"><option value="all">Todas as campanhas</option>{Array.from(new Map(leads.filter((lead) => lead.campaign_id).map((lead) => [lead.campaign_id!, lead.first_campaign || lead.utm_campaign || lead.campaign_id!])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
      <button onClick={() => void fetchWorkspace()} className="button-secondary justify-center"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Atualizar</button>
    </section>

    {feedback && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{feedback}</div>}

    <section className="overflow-x-auto pb-3 custom-scrollbar"><div className="flex min-w-max gap-3">{stages.map((stage) => {
      const cards = visible.filter((lead) => stageOf(lead) === stage.id); const total = cards.reduce((sum, lead) => sum + Number(lead.value ?? 0), 0);
      return <div key={stage.id} onDragOver={(event) => { event.preventDefault(); setDropStage(stage.id); }} onDragLeave={() => setDropStage(null)} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('text/lead-id') || draggedId; setDropStage(null); setDraggedId(null); if (id) void moveLead(id, stage.id); }} className={cn('w-80 rounded-2xl border bg-slate-950/70 p-3 transition', dropStage === stage.id ? 'border-amber-400/70 bg-amber-400/5' : 'border-slate-800')}>
        <div className="mb-3"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={cn('h-2.5 w-2.5 rounded-full', stage.dot)} /><h2 className="font-semibold text-white">{stage.label}</h2></div><span className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-slate-400">{cards.length}</span></div><p className="mt-1 text-xs text-slate-600">{formatMoney(total)}</p></div>
        <div className="min-h-32 space-y-2">{loading ? <Loading /> : cards.length === 0 ? <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-600">Solte um lead aqui</div> : cards.map((lead) => <LeadCard key={lead.id} lead={lead} ownerName={profileMap.get(lead.assigned_user_id ?? '')?.display_name ?? 'Fila livre'} onOpen={() => openLead(lead.id)} onStage={(next) => void moveLead(lead.id, next)} onDragStart={(event) => { setDraggedId(lead.id); event.dataTransfer.setData('text/lead-id', lead.id); }} />)}</div>
      </div>;
    })}</div></section>

    {(selected || creating) && <Modal onClose={() => { setSelectedId(null); setCreating(false); setEditing(false); }} title={creating ? 'Novo lead' : selected?.name ?? ''} eyebrow={creating ? 'Cadastro manual' : 'Central do lead'} wide={!creating}>
      {creating || (editing && selected) ? <LeadFormView form={form} setForm={setForm} profiles={profiles} saving={saving} onSubmit={saveLead} onCancel={creating ? undefined : () => setEditing(false)} /> : selected && <LeadWorkspace lead={selected} profiles={profiles} currentUserId={currentUserId} currentRole={currentRole} details={details} loading={detailsLoading} tab={detailTab} setTab={setDetailTab} onEdit={() => beginEdit(selected)} onAssign={(userId) => void assignLead(selected.id, userId)} />}
    </Modal>}
  </div>;
}

function LeadCard({ lead, ownerName, onOpen, onStage, onDragStart }: { lead: LeadsPipeline; ownerName: string; onOpen: () => void; onStage: (stage: CommercialStage) => void; onDragStart: (event: React.DragEvent<HTMLDivElement>) => void }) {
  const blocked = lead.automation_contact_allowed === false; const handoff = lead.human_handoff ?? lead.intervencao_humana ?? false; const cadence = lead.cadence_status ?? 'inactive';
  return <div draggable onDragStart={onDragStart} className={cn('rounded-xl border p-3 shadow-lg transition', blocked ? 'border-rose-500/60 bg-rose-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600')}>
    <button onClick={onOpen} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-white">{lead.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" /> {lead.phone ?? 'Sem telefone'}</p></div><GripVertical className="h-5 w-5 shrink-0 cursor-grab text-slate-600" /></div>
      <div className="mt-3 flex flex-wrap gap-1.5"><Badge icon={Bot} label={handoff ? 'Humano' : lead.ai_enabled === false ? 'IA pausada' : 'IA ativa'} tone={handoff ? 'amber' : 'emerald'} /><Badge icon={MessageSquareText} label={cadenceLabel[cadence]} tone={cadence === 'active' || cadence === 'waiting' ? 'cyan' : 'slate'} />{blocked && <Badge icon={ShieldAlert} label="Não incomodar" tone="rose" />}</div>
      <div className="mt-3 border-t border-slate-800 pt-3"><p className="truncate text-[10px] uppercase text-slate-600">{lead.utm_campaign || lead.origem || 'Sem campanha'}</p><div className="mt-1 flex justify-between gap-2 text-xs"><span className="truncate text-slate-400">{ownerName}</span><strong className="text-emerald-300">{formatMoney(lead.value)}</strong></div><p className="mt-1 text-[11px] text-slate-500">{elapsed(lead.stage_entered_at ?? lead.created_at)}</p></div>
    </button>
    <select aria-label={`Mover ${lead.name}`} value={stageOf(lead)} onChange={(event) => onStage(event.target.value as CommercialStage)} className="control mt-3 h-9 text-xs md:hidden">{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select>
  </div>;
}

function LeadWorkspace({ lead, profiles, currentUserId, currentRole, details, loading, tab, setTab, onEdit, onAssign }: { lead: LeadsPipeline; profiles: CrmUserProfile[]; currentUserId: string; currentRole: 'admin' | 'atendente'; details: Details; loading: boolean; tab: DetailTab; setTab: (tab: DetailTab) => void; onEdit: () => void; onAssign: (userId: string | null) => void }) {
  const blocked = lead.automation_contact_allowed === false;
  const tabs: Array<{ id: DetailTab; label: string; icon: typeof Activity }> = [{ id: 'resumo', label: 'Resumo', icon: Activity }, { id: 'historico', label: 'Funil', icon: History }, { id: 'touchpoints', label: 'Entradas', icon: Tag }, { id: 'cadencia', label: 'Cadência', icon: RotateCcw }, { id: 'conversa', label: 'Conversa', icon: MessageCircle }];
  return <div className="space-y-4 p-5">
    {blocked && <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-100"><div className="flex items-center gap-2 font-bold"><ShieldAlert className="h-5 w-5" /> Este lead pediu para não ser incomodado</div><p className="mt-1 text-rose-200/80">IA e cadência bloqueadas. A resposta manual permanece disponível com aviso.</p><p className="mt-2 text-xs">{lead.do_not_contact_reason || 'Motivo não informado'} · {formatDate(lead.do_not_contact_at)}</p></div>}
    <div className="flex flex-wrap items-center gap-2"><button onClick={onEdit} className="button-secondary"><Pencil className="h-4 w-4" /> Editar</button>{!lead.assigned_user_id && <button onClick={() => onAssign(currentUserId)} className="button-primary"><UserCheck className="h-4 w-4" /> Assumir lead</button>}{lead.assigned_user_id && (currentRole === 'admin' || lead.assigned_user_id === currentUserId) && <button onClick={() => onAssign(null)} className="button-secondary"><RotateCcw className="h-4 w-4" /> Fila livre</button>}{currentRole === 'admin' && <select value={lead.assigned_user_id ?? ''} onChange={(event) => onAssign(event.target.value || null)} className="control max-w-60"><option value="">Fila livre</option>{profiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.display_name}</option>)}</select>}</div>
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-1">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={cn('flex min-w-max items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold', tab === item.id ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800')}><item.icon className="h-4 w-4" />{item.label}</button>)}</div>
    {loading ? <Loading /> : tab === 'resumo' ? <Summary lead={lead} profiles={profiles} /> : tab === 'historico' ? <StageTimeline items={details.stageHistory} profiles={profiles} /> : tab === 'touchpoints' ? <Touchpoints items={details.touchpoints} /> : tab === 'cadencia' ? <CadenceTimeline cycles={details.cadences} attempts={details.attempts} /> : <Conversation items={details.messages} />}
  </div>;
}

function Summary({ lead, profiles }: { lead: LeadsPipeline; profiles: CrmUserProfile[] }) {
  const owner = profiles.find((profile) => profile.user_id === lead.assigned_user_id);
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3"><Detail label="Telefone" value={lead.phone} icon={Phone} /><Detail label="Email" value={lead.email} icon={UserRound} /><Detail label="Cidade" value={lead.cidade} icon={Tag} /><Detail label="Responsável" value={owner?.display_name ?? 'Fila livre'} icon={UserCheck} /><Detail label="Valor potencial" value={formatMoney(lead.value)} icon={CircleDollarSign} /><Detail label="Tempo na etapa" value={elapsed(lead.stage_entered_at ?? lead.created_at)} icon={CalendarClock} /></div>
    <section className="panel"><h3 className="panel-title">Controles independentes</h3><div className="mt-3 flex flex-wrap gap-2"><Badge icon={Bot} label={lead.human_handoff ? 'Atendimento humano' : lead.ai_enabled === false ? 'IA pausada' : 'IA ativa'} tone={lead.human_handoff ? 'amber' : 'emerald'} /><Badge icon={MessageSquareText} label={cadenceLabel[lead.cadence_status ?? 'inactive']} tone="cyan" /><Badge icon={ChevronRight} label={stages.find((item) => item.id === stageOf(lead))?.label ?? 'Novo'} tone="slate" /></div></section>
    <section className="panel"><h3 className="panel-title">Atribuição</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><KeyValue label="Primeiro contato" value={[lead.first_source, lead.first_medium, lead.first_campaign].filter(Boolean).join(' · ') || '-'} /><KeyValue label="Contato mais recente" value={[lead.last_source, lead.last_medium, lead.last_campaign].filter(Boolean).join(' · ') || '-'} /><KeyValue label="Meta Lead ID" value={lead.meta_lead_id || '-'} /><KeyValue label="UTMs" value={[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' · ') || '-'} /><KeyValue label="fbclid" value={lead.fbclid || '-'} /><KeyValue label="Consentimento" value={`${lead.consent_status ?? 'unknown'}${lead.consent_at ? ` · ${formatDate(lead.consent_at)}` : ''}`} /></div></section>
    <section className="panel"><h3 className="panel-title">Observações</h3><p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{lead.observations || 'Nenhuma observação cadastrada.'}</p></section>
  </div>;
}

function StageTimeline({ items, profiles }: { items: LeadStageHistory[]; profiles: CrmUserProfile[] }) { const [reason, setReason] = useState('all'); const reasons = [...new Set(items.map((item) => item.reason ?? 'alteração'))]; const filtered = reason === 'all' ? items : items.filter((item) => (item.reason ?? 'alteração') === reason); return <div className="space-y-4">{items.length > 0 && <label className="field max-w-xs">Tipo de alteração<select className="control" value={reason} onChange={(event) => setReason(event.target.value)}><option value="all">Todos os eventos</option>{reasons.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}<TimelineEmpty empty={!filtered.length} label="Nenhuma mudança de etapa registrada.">{filtered.map((item) => <TimelineRow key={item.id} title={`${stageLabel(item.from_stage)} → ${stageLabel(item.to_stage)}`} subtitle={`${profiles.find((profile) => profile.user_id === item.changed_by)?.display_name ?? 'Sistema'} · ${item.reason ?? 'alteração'}`} date={item.created_at} />)}</TimelineEmpty></div>; }
function Touchpoints({ items }: { items: LeadTouchpoint[] }) { return <TimelineEmpty empty={!items.length} label="Nenhuma entrada registrada.">{items.map((item, index) => <TimelineRow key={item.id} title={`${index === items.length - 1 ? 'Primeira entrada' : 'Reincidência'} · ${item.channel}`} subtitle={[item.source, item.medium, item.campaign].filter(Boolean).join(' · ') || item.direction} date={item.occurred_at} />)}</TimelineEmpty>; }
function CadenceTimeline({ cycles, attempts }: { cycles: LeadCadence[]; attempts: CadenceAttempt[] }) { return <TimelineEmpty empty={!cycles.length} label="Nenhum ciclo de cadência registrado.">{cycles.map((cycle) => <section key={cycle.id} className="panel"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-white">Ciclo {cycle.status}</h3><p className="text-xs text-slate-500">Iniciado por Diana · {formatDate(cycle.started_at)}</p></div><Badge icon={RotateCcw} label={cadenceLabel[cycle.status]} tone={cycle.status === 'active' || cycle.status === 'waiting' ? 'cyan' : 'slate'} /></div><div className="mt-3 space-y-2">{attempts.filter((attempt) => attempt.lead_cadence_id === cycle.id).map((attempt) => <div key={attempt.id} className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="flex justify-between gap-3 text-xs"><strong className="text-slate-200">{attempt.status}</strong><span className="text-slate-500">{formatDate(attempt.sent_at ?? attempt.scheduled_for)}</span></div><p className="mt-2 text-sm text-slate-400">{attempt.template_snapshot}</p>{attempt.error_message && <p className="mt-2 text-xs text-rose-300">{attempt.error_message} · tentativa {attempt.technical_attempts}/3</p>}</div>)}</div></section>)}</TimelineEmpty>; }
function Conversation({ items }: { items: CrmMessage[] }) { return <TimelineEmpty empty={!items.length} label="As mensagens sincronizadas aparecerão aqui."><div className="space-y-2">{[...items].reverse().map((item) => <div key={item.id} className={cn('max-w-[85%] rounded-xl px-3 py-2 text-sm', item.direction === 'outbound' ? 'ml-auto bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-100')}><p>{item.body || `[${item.media_type ?? 'mídia'}]`}</p><p className={cn('mt-1 text-[10px]', item.direction === 'outbound' ? 'text-slate-700' : 'text-slate-500')}>{item.sender_type} · {formatDate(item.sent_at)}</p></div>)}</div></TimelineEmpty>; }

function LeadFormView({ form, setForm, profiles, saving, onSubmit, onCancel }: { form: LeadForm; setForm: (form: LeadForm) => void; profiles: CrmUserProfile[]; saving: boolean; onSubmit: (event: React.FormEvent) => void; onCancel?: () => void }) { return <form onSubmit={onSubmit} className="grid gap-4 p-5 md:grid-cols-2"><Input label="Nome" required value={form.name} onChange={(name) => setForm({ ...form, name })} /><Input label="Telefone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} /><Input label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} /><Input label="Cidade" value={form.cidade} onChange={(cidade) => setForm({ ...form, cidade })} /><Input label="Origem" value={form.origem} onChange={(origem) => setForm({ ...form, origem })} /><Input label="Valor potencial" type="number" value={String(form.value)} onChange={(value) => setForm({ ...form, value: Number(value) })} /><Input label="Valor fechado" type="number" value={String(form.closed_value)} onChange={(value) => setForm({ ...form, closed_value: Number(value) })} /><SelectField label="Etapa" value={form.status} onChange={(status) => setForm({ ...form, status: status as CommercialStage })} options={stages.map((stage) => ({ value: stage.id, label: stage.label }))} /><SelectField label="Responsável" value={form.assigned_user_id} onChange={(assigned_user_id) => setForm({ ...form, assigned_user_id })} options={[{ value: '', label: 'Fila livre' }, ...profiles.map((profile) => ({ value: profile.user_id, label: profile.display_name || 'Sem nome' }))]} /><label className="field md:col-span-2">Observações<textarea value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} className="control mt-1 min-h-28 py-3 normal-case" /></label><div className="flex gap-2 md:col-span-2">{onCancel && <button type="button" onClick={onCancel} className="button-secondary flex-1 justify-center">Cancelar</button>}<button disabled={saving} className="button-primary flex-1 justify-center">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar lead</button></div></form>; }

function Modal({ onClose, title, eyebrow, wide, children }: { onClose: () => void; title: string; eyebrow: string; wide?: boolean; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"><div className={cn('max-h-[94vh] w-full overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl', wide ? 'max-w-5xl' : 'max-w-xl')}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 p-5 backdrop-blur"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-400">{eyebrow}</p><h2 className="mt-1 text-xl font-bold text-white">{title}</h2></div><button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div>{children}</div></div>; }
function Badge({ icon: Icon, label, tone }: { icon: typeof Bot; label: string; tone: 'amber' | 'emerald' | 'cyan' | 'rose' | 'slate' }) { const colors = { amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200', emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200', rose: 'border-rose-400/30 bg-rose-400/10 text-rose-200', slate: 'border-slate-700 bg-slate-950 text-slate-400' }; return <span className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium', colors[tone])}><Icon className="h-3 w-3" />{label}</span>; }
function Metric({ label, value, icon: Icon, danger }: { label: string; value: string; icon: typeof Users; danger?: boolean }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className={cn('mt-2 text-2xl font-bold', danger ? 'text-rose-300' : 'text-white')}>{value}</p></div><Icon className={cn('h-6 w-6', danger ? 'text-rose-400' : 'text-amber-400')} /></div></div>; }
function Input({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="field">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="control mt-1 normal-case" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="field">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="control mt-1 normal-case">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Detail({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon: typeof Phone }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><p className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4" />{label}</p><p className="mt-2 truncate text-sm font-medium text-white">{value || '-'}</p></div>; }
function KeyValue({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p><p className="mt-1 break-all text-sm text-slate-300">{value}</p></div>; }
function TimelineRow({ title, subtitle, date }: { title: string; subtitle: string; date: string }) { return <div className="flex gap-3 border-l border-slate-700 pb-5 pl-4 last:pb-0"><span className="-ml-[21px] mt-1 h-2.5 w-2.5 rounded-full bg-amber-400" /><div className="min-w-0"><p className="font-medium text-white">{title}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p><p className="mt-1 text-[10px] text-slate-600">{formatDate(date)}</p></div></div>; }
function TimelineEmpty({ empty, label, children }: { empty: boolean; label: string; children: React.ReactNode }) { return empty ? <div className="rounded-xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-500">{label}</div> : <div className="space-y-3">{children}</div>; }
function Loading() { return <div className="flex h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-amber-400" /></div>; }
function stageLabel(value: string | null) { return stages.find((stage) => stage.id === value)?.label ?? value ?? 'Entrada'; }
