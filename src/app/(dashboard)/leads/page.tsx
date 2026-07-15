'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarClock,
  CircleDollarSign,
  Download,
  GripVertical,
  Loader2,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type CommercialStage = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'negociacao' | 'fechado' | 'perdido';
type CadenceStatus = 'inactive' | 'waiting' | 'active' | 'responded' | 'completed' | 'paused' | 'cancelled' | 'blocked';

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  origem: string | null;
  value: number | null;
  created_at: string | null;
  stage_entered_at?: string | null;
  assigned_user_id?: string | null;
  utm_campaign?: string | null;
  intervencao_humana?: boolean | null;
  human_handoff?: boolean | null;
  ai_enabled?: boolean;
  cadence_status?: CadenceStatus;
  automation_contact_allowed?: boolean;
  do_not_contact_reason?: string | null;
};

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
  em_atendimento_ia: 'contato',
  atendimento_humano: 'contato',
  analise_fatura: 'qualificado',
  contrato_enviado: 'proposta',
};

const cadenceLabel: Record<CadenceStatus, string> = {
  inactive: 'Sem cadência', waiting: 'Aguardando', active: 'Em cadência', responded: 'Respondeu',
  completed: 'Concluída', paused: 'Pausada', cancelled: 'Cancelada', blocked: 'Bloqueada',
};

const emptyForm = { name: '', email: '', phone: '', origem: 'whatsapp', value: 0, status: 'novo' as CommercialStage };

function stageOf(lead: Lead): CommercialStage {
  const value = lead.status ?? 'novo';
  return stages.some((stage) => stage.id === value) ? value as CommercialStage : legacyStage[value] ?? 'novo';
}

function formatMoney(value: number | null) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function elapsed(value: string | null | undefined) {
  if (!value) return 'agora';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 24) return `${hours}h nesta etapa`;
  return `${Math.floor(hours / 24)}d nesta etapa`;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<CommercialStage | null>(null);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    const { data, error } = await supabase.from('leads_pipeline').select('*').order('created_at', { ascending: false });
    if (error) setFeedback(error.message);
    else setLeads((data ?? []) as Lead[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchLeads(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchLeads]);

  const sources = useMemo(() => Array.from(new Set(leads.map((lead) => lead.origem).filter(Boolean))) as string[], [leads]);
  const visible = useMemo(() => leads.filter((lead) => {
    const haystack = `${lead.name} ${lead.phone ?? ''} ${lead.email ?? ''} ${lead.utm_campaign ?? ''}`.toLowerCase();
    return haystack.includes(search.toLowerCase()) && (source === 'all' || lead.origem === source);
  }), [leads, search, source]);

  async function moveLead(leadId: string, nextStage: CommercialStage) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || stageOf(lead) === nextStage) return;
    const previous = stageOf(lead);
    const enteredAt = new Date().toISOString();
    setLeads((current) => current.map((item) => item.id === leadId ? { ...item, status: nextStage, stage_entered_at: enteredAt } : item));
    setFeedback(null);

    const { error: updateError } = await supabase.from('leads_pipeline').update({ status: nextStage, stage_entered_at: enteredAt }).eq('id', leadId);
    if (!updateError) {
      const { data: auth } = await supabase.auth.getUser();
      const { error: historyError } = await supabase.from('lead_stage_history').insert({
        lead_id: leadId, from_stage: previous, to_stage: nextStage, changed_by: auth.user?.id ?? null, reason: 'kanban_drag_drop',
      });
      if (!historyError) return;
      setFeedback(`Etapa alterada, mas o histórico não foi gravado: ${historyError.message}`);
      return;
    }

    setLeads((current) => current.map((item) => item.id === leadId ? lead : item));
    setFeedback(`Não foi possível mover ${lead.name}. O cartão voltou para ${stages.find((item) => item.id === previous)?.label}. ${updateError.message}`);
  }

  async function createLead(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('leads_pipeline').insert({
      name: form.name.trim(), email: form.email || null, phone: form.phone || null, origem: form.origem,
      value: Number(form.value) || 0, status: form.status, utm_source: form.origem, utm_medium: 'crm_manual',
      utm_campaign: 'cadastro_manual', intervencao_humana: true,
    });
    setSaving(false);
    if (error) return setFeedback(error.message);
    setCreating(false);
    setForm(emptyForm);
    await fetchLeads();
  }

  function exportCsv() {
    const header = ['Nome', 'Telefone', 'Email', 'Etapa', 'Origem', 'Campanha', 'Valor'];
    const rows = visible.map((lead) => [lead.name, lead.phone ?? '', lead.email ?? '', stageOf(lead), lead.origem ?? '', lead.utm_campaign ?? '', lead.value ?? 0]);
    const safe = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
    const blob = new Blob([`\uFEFF${[header, ...rows].map((row) => row.map(safe).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `leads-behub-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-amber-400"><Users className="h-4 w-4" /> Pipeline comercial</div>
          <h1 className="text-3xl font-bold text-white">Leads em movimento</h1>
          <p className="mt-1 text-sm text-slate-400">Arraste os cartões entre as etapas. IA, atendimento humano e cadência são controles separados.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:border-slate-500"><Download className="h-4 w-4" /> Exportar</button>
          <button onClick={() => setCreating(true)} className="flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300"><Plus className="h-4 w-4" /> Novo lead</button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Metric label="Leads no funil" value={visible.length.toString()} icon={Users} />
        <Metric label="Valor potencial" value={formatMoney(visible.reduce((sum, lead) => sum + Number(lead.value ?? 0), 0))} icon={CircleDollarSign} />
        <Metric label="Não incomodar" value={visible.filter((lead) => lead.automation_contact_allowed === false).length.toString()} icon={ShieldAlert} danger />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 md:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, telefone, email ou campanha" className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-3 text-sm text-white outline-none focus:border-amber-400" /></label>
        <select value={source} onChange={(event) => setSource(event.target.value)} className="h-11 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none"><option value="all">Todas as origens</option>{sources.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <button onClick={() => void fetchLeads()} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-300"><RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} /> Atualizar</button>
      </section>

      {feedback && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{feedback}</div>}

      <section className="overflow-x-auto pb-3 custom-scrollbar">
        <div className="flex min-w-max gap-3">
          {stages.map((stage) => {
            const cards = visible.filter((lead) => stageOf(lead) === stage.id);
            return (
              <div key={stage.id} onDragOver={(event) => { event.preventDefault(); setDropStage(stage.id); }} onDragLeave={() => setDropStage(null)} onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData('text/lead-id') || draggedId; setDropStage(null); setDraggedId(null); if (id) void moveLead(id, stage.id); }} className={cn('w-80 rounded-2xl border bg-slate-950/70 p-3 transition', dropStage === stage.id ? 'border-amber-400/70 bg-amber-400/5' : 'border-slate-800')}>
                <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={cn('h-2.5 w-2.5 rounded-full', stage.dot)} /><h2 className="font-semibold text-white">{stage.label}</h2></div><span className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-slate-400">{cards.length}</span></div>
                <div className="min-h-32 space-y-2">
                  {loading ? <div className="flex h-28 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-amber-400" /></div> : cards.length === 0 ? <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-600">Solte um lead aqui</div> : cards.map((lead) => <LeadCard key={lead.id} lead={lead} onOpen={() => setSelected(lead)} onDragStart={(event) => { setDraggedId(lead.id); event.dataTransfer.setData('text/lead-id', lead.id); event.dataTransfer.effectAllowed = 'move'; }} />)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(selected || creating) && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 p-5"><div><p className="text-xs uppercase tracking-[0.2em] text-amber-400">{creating ? 'Cadastro manual' : 'Detalhes do lead'}</p><h2 className="mt-1 text-xl font-bold text-white">{creating ? 'Novo lead' : selected?.name}</h2></div><button onClick={() => { setSelected(null); setCreating(false); }} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X className="h-5 w-5" /></button></div>{creating ? <form onSubmit={createLead} className="grid gap-4 p-5 md:grid-cols-2"><Input label="Nome" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><Input label="Telefone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><Input label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><Input label="Origem" value={form.origem} onChange={(value) => setForm({ ...form, origem: value })} /><Input label="Valor" type="number" value={String(form.value)} onChange={(value) => setForm({ ...form, value: Number(value) })} /><label className="space-y-1 text-xs font-semibold uppercase text-slate-500">Etapa<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CommercialStage })} className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm normal-case text-white">{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select></label><button disabled={saving} className="md:col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-400 font-bold text-slate-950 disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar lead</button></form> : selected && <LeadDetails lead={selected} />}</div></div>}
    </div>
  );
}

function LeadCard({ lead, onOpen, onDragStart }: { lead: Lead; onOpen: () => void; onDragStart: (event: React.DragEvent<HTMLDivElement>) => void }) {
  const blocked = lead.automation_contact_allowed === false;
  const handoff = lead.human_handoff ?? lead.intervencao_humana ?? false;
  const cadence = lead.cadence_status ?? 'inactive';
  return <div draggable onDragStart={onDragStart} onClick={onOpen} className={cn('cursor-grab rounded-xl border p-3 shadow-lg transition active:cursor-grabbing', blocked ? 'border-rose-500/60 bg-rose-500/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600')}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-white">{lead.name}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Phone className="h-3 w-3" /> {lead.phone ?? 'Sem telefone'}</p></div><GripVertical className="h-5 w-5 shrink-0 text-slate-600" /></div><div className="mt-3 flex flex-wrap gap-1.5"><Badge icon={Bot} label={handoff ? 'Humano' : lead.ai_enabled === false ? 'IA pausada' : 'IA ativa'} tone={handoff ? 'amber' : 'emerald'} /><Badge icon={MessageSquareText} label={cadenceLabel[cadence]} tone={cadence === 'active' || cadence === 'waiting' ? 'cyan' : 'slate'} />{blocked && <Badge icon={ShieldAlert} label="Não incomodar" tone="rose" />}</div><div className="mt-3 flex items-end justify-between border-t border-slate-800 pt-3"><div><p className="text-[10px] uppercase text-slate-600">{lead.utm_campaign || lead.origem || 'Sem campanha'}</p><p className="mt-1 text-xs text-slate-400">{elapsed(lead.stage_entered_at ?? lead.created_at)}</p></div><p className="text-sm font-bold text-emerald-300">{formatMoney(lead.value)}</p></div></div>;
}

function Badge({ icon: Icon, label, tone }: { icon: typeof Bot; label: string; tone: 'amber' | 'emerald' | 'cyan' | 'rose' | 'slate' }) { const colors = { amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200', emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200', cyan: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-200', rose: 'border-rose-400/30 bg-rose-400/10 text-rose-200', slate: 'border-slate-700 bg-slate-950 text-slate-400' }; return <span className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium', colors[tone])}><Icon className="h-3 w-3" />{label}</span>; }
function Metric({ label, value, icon: Icon, danger }: { label: string; value: string; icon: typeof Users; danger?: boolean }) { return <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className={cn('mt-2 text-2xl font-bold', danger ? 'text-rose-300' : 'text-white')}>{value}</p></div><Icon className={cn('h-6 w-6', danger ? 'text-rose-400' : 'text-amber-400')} /></div></div>; }
function Input({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="space-y-1 text-xs font-semibold uppercase text-slate-500">{label}<input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm normal-case text-white outline-none focus:border-amber-400" /></label>; }
function LeadDetails({ lead }: { lead: Lead }) { const blocked = lead.automation_contact_allowed === false; return <div className="space-y-4 p-5">{blocked && <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 p-4 text-sm text-rose-100"><div className="flex items-center gap-2 font-bold"><ShieldAlert className="h-5 w-5" /> Este lead pediu para não ser incomodado</div><p className="mt-2 text-rose-200/80">IA e cadência bloqueadas. Mensagens manuais continuam disponíveis com este alerta visível.</p>{lead.do_not_contact_reason && <p className="mt-2 text-xs">Motivo: {lead.do_not_contact_reason}</p>}</div>}<div className="grid gap-3 md:grid-cols-2"><Detail label="Telefone" value={lead.phone} icon={Phone} /><Detail label="Email" value={lead.email} icon={UserRound} /><Detail label="Campanha" value={lead.utm_campaign} icon={MessageSquareText} /><Detail label="Tempo na etapa" value={elapsed(lead.stage_entered_at ?? lead.created_at)} icon={CalendarClock} /></div><div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Controles independentes</p><div className="mt-3 flex flex-wrap gap-2"><Badge icon={Bot} label={lead.human_handoff ? 'Atendimento humano' : lead.ai_enabled === false ? 'IA pausada' : 'IA ativa'} tone={lead.human_handoff ? 'amber' : 'emerald'} /><Badge icon={MessageSquareText} label={cadenceLabel[lead.cadence_status ?? 'inactive']} tone="cyan" /></div></div></div>; }
function Detail({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon: typeof Phone }) { return <div className="rounded-xl border border-slate-800 bg-slate-900 p-3"><p className="flex items-center gap-2 text-xs text-slate-500"><Icon className="h-4 w-4" />{label}</p><p className="mt-2 truncate text-sm font-medium text-white">{value || '-'}</p></div>; }
