'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Clock3, Loader2, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

type Template = { id: string; name: string; body: string; approved: boolean; active: boolean; version: number };
type Step = { id?: string; interval_value: number; interval_unit: 'hours' | 'days'; template_id: string; active: boolean };
type Config = { id?: string; name: string; active: boolean; auto_start_enabled: boolean; timezone: string; allowed_weekdays: number[]; window_start: string; window_end: string };
type Cycle = { id: string; lead_id: string; status: string; current_step: number; next_run_at: string | null; updated_at: string };
type Attempt = { id: string; lead_cadence_id: string; status: string; scheduled_for: string; technical_attempts: number; error_message: string | null };
type ConfigAudit = { id: number; actor_user_id: string | null; created_at: string; after_data: unknown };
type LeadOption = { id: string; name: string };

const weekdays = [{ id: 1, label: 'Seg' }, { id: 2, label: 'Ter' }, { id: 3, label: 'Qua' }, { id: 4, label: 'Qui' }, { id: 5, label: 'Sex' }, { id: 6, label: 'Sáb' }, { id: 0, label: 'Dom' }];
const initialConfig: Config = { name: 'Cadência global BeHub', active: false, auto_start_enabled: false, timezone: 'America/Sao_Paulo', allowed_weekdays: [1, 2, 3, 4, 5], window_start: '08:00', window_end: '18:00' };

export default function CadenceSettingsPage() {
  const [config, setConfig] = useState<Config>(initialConfig);
  const [steps, setSteps] = useState<Step[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [attemptFilter, setAttemptFilter] = useState('all');
  const [configHistory, setConfigHistory] = useState<ConfigAudit[]>([]);
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [attemptLead, setAttemptLead] = useState('all');
  const [attemptPeriod, setAttemptPeriod] = useState('all');
  const [referenceNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true); setFeedback(null);
    const [configResult, templateResult, cyclesResult, attemptsResult, historyResult, leadsResult] = await Promise.all([
      supabase.from('cadence_config').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('message_templates').select('id,name,body,approved,active,version').eq('approved', true).eq('active', true).order('name'),
      supabase.from('lead_cadences').select('id,lead_id,status,current_step,next_run_at,updated_at').order('updated_at', { ascending: false }).limit(200),
      supabase.from('cadence_attempts').select('id,lead_cadence_id,status,scheduled_for,technical_attempts,error_message').order('scheduled_for', { ascending: false }).limit(300),
      supabase.from('audit_log').select('id,actor_user_id,created_at,after_data').eq('action', 'cadence_configuration_saved').order('created_at', { ascending: false }).limit(30),
      supabase.from('leads_pipeline').select('id,name').order('name'),
    ]);
    if (configResult.error) { setFeedback(`A migration de cadência ainda não está disponível: ${configResult.error.message}`); setLoading(false); return; }
    setTemplates((templateResult.data ?? []) as Template[]);
    setCycles((cyclesResult.data ?? []) as Cycle[]);
    setAttempts((attemptsResult.data ?? []) as Attempt[]);
    setConfigHistory((historyResult.data ?? []) as ConfigAudit[]);
    setLeadOptions((leadsResult.data ?? []) as LeadOption[]);
    if (configResult.data) {
      const row = configResult.data;
      setConfig({ id: row.id, name: row.name, active: row.active, auto_start_enabled: row.auto_start_enabled, timezone: row.timezone, allowed_weekdays: row.allowed_weekdays, window_start: row.window_start.slice(0, 5), window_end: row.window_end.slice(0, 5) });
      const result = await supabase.from('cadence_steps').select('id,interval_value,interval_unit,template_id,active').eq('cadence_config_id', row.id).order('step_order');
      if (result.error) setFeedback(result.error.message); else setSteps((result.data ?? []) as Step[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const preview = useMemo(() => steps.filter((step) => step.active).reduce<Array<{ index: number; hours: number; template: string }>>((items, step) => {
    const previousHours = items.at(-1)?.hours ?? 0;
    const hours = previousHours + (step.interval_unit === 'days' ? step.interval_value * 24 : step.interval_value);
    return [...items, { index: items.length + 1, hours, template: templates.find((item) => item.id === step.template_id)?.name ?? 'Selecione um template' }];
  }, []), [steps, templates]);
  const filteredAttempts = useMemo(() => { const cutoff = attemptPeriod === 'all' ? 0 : referenceNow - Number(attemptPeriod) * 86_400_000; return attempts.filter((attempt) => { const cycle = cycles.find((item) => item.id === attempt.lead_cadence_id); return (attemptFilter === 'all' || attempt.status === attemptFilter) && (attemptLead === 'all' || cycle?.lead_id === attemptLead) && (!cutoff || new Date(attempt.scheduled_for).getTime() >= cutoff); }); }, [attemptFilter, attemptLead, attemptPeriod, attempts, cycles, referenceNow]);
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= steps.length) return; setSteps((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  function toggleDay(day: number) { setConfig((current) => ({ ...current, allowed_weekdays: current.allowed_weekdays.includes(day) ? current.allowed_weekdays.filter((item) => item !== day) : [...current.allowed_weekdays, day] })); }
  async function requeueAttempt(attempt: Attempt) { const response = await fetch('/api/admin/cadence-attempts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: attempt.id }) }); const payload = await response.json(); if (!response.ok) return setFeedback(payload.error ?? 'Tentativa não reprocessada.'); setAttempts((current) => current.map((item) => item.id === attempt.id ? { ...item, status: 'scheduled', scheduled_for: new Date().toISOString(), error_message: null } : item)); setFeedback('Tentativa reagendada internamente. O workflow continua inativo.'); }

  async function save() {
    if (!config.allowed_weekdays.length) return setFeedback('Escolha pelo menos um dia permitido.');
    if (steps.some((step) => !step.template_id || step.interval_value < 1)) return setFeedback('Todas as etapas precisam de intervalo e template aprovado.');
    setSaving(true); setFeedback(null);
    const { data: auth } = await supabase.auth.getUser();
    const values = { name: config.name, active: false, auto_start_enabled: false, timezone: config.timezone, allowed_weekdays: config.allowed_weekdays, window_start: config.window_start, window_end: config.window_end, updated_by: auth.user?.id ?? null };
    const result = config.id ? await supabase.from('cadence_config').update(values).eq('id', config.id).select('id').single() : await supabase.from('cadence_config').insert({ ...values, created_by: auth.user?.id ?? null }).select('id').single();
    if (result.error) { setSaving(false); return setFeedback(result.error.message); }
    const configId = result.data.id;
    const removed = await supabase.from('cadence_steps').delete().eq('cadence_config_id', configId);
    if (removed.error) { setSaving(false); return setFeedback(removed.error.message); }
    if (steps.length) {
      const inserted = await supabase.from('cadence_steps').insert(steps.map((step, index) => ({ cadence_config_id: configId, step_order: index + 1, interval_value: step.interval_value, interval_unit: step.interval_unit, template_id: step.template_id, active: step.active })));
      if (inserted.error) { setSaving(false); return setFeedback(inserted.error.message); }
    }
    setConfig((current) => ({ ...current, id: configId })); setSaving(false); setFeedback('Configuração salva. Os workflows continuam inativos.');
    await fetch('/api/admin/cadence-audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config_id: configId, snapshot: { ...values, steps: steps.map((step, index) => ({ ...step, step_order: index + 1 })) } }) });
  }

  return <div className="space-y-5"><header><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-400"><CalendarDays className="h-4 w-4" /> Automação de follow-up</div><h1 className="mt-2 text-3xl font-bold text-white">Cadência global</h1><p className="mt-1 text-sm text-slate-400">A Diana é a única origem autorizada a iniciar um ciclo. Salvar não ativa automações.</p></header>
    {feedback && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{feedback}</div>}
    {loading ? <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-amber-400" /></div> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]"><main className="space-y-5"><section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold text-white">Controle global</h2><p className="text-xs text-slate-500">As duas chaves precisam estar ligadas para novos ciclos.</p></div><div className="flex gap-2"><Toggle label="Ativa" checked={config.active} onChange={(active) => setConfig({ ...config, active })} /><Toggle label="Início automático" checked={config.auto_start_enabled} onChange={(auto_start_enabled) => setConfig({ ...config, auto_start_enabled })} /></div></div><div className="mt-5 grid gap-4 md:grid-cols-3"><Field label="Timezone"><Control value={config.timezone} onChange={(timezone) => setConfig({ ...config, timezone })} /></Field><Field label="Horário inicial"><Control type="time" value={config.window_start} onChange={(window_start) => setConfig({ ...config, window_start })} /></Field><Field label="Horário final"><Control type="time" value={config.window_end} onChange={(window_end) => setConfig({ ...config, window_end })} /></Field></div><div className="mt-4"><p className="mb-2 text-xs font-semibold uppercase text-slate-500">Dias permitidos</p><div className="flex flex-wrap gap-2">{weekdays.map((day) => <button key={day.id} onClick={() => toggleDay(day.id)} className={cn('h-10 min-w-12 rounded-xl border px-3 text-sm font-semibold', config.allowed_weekdays.includes(day.id) ? 'border-amber-400 bg-amber-400 text-slate-950' : 'border-slate-800 bg-slate-950 text-slate-400')}>{day.label}</button>)}</div></div></section>
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Etapas da sequência</h2><p className="text-xs text-slate-500">Somente templates aprovados podem ser escolhidos.</p></div><button onClick={() => setSteps((current) => [...current, { interval_value: 1, interval_unit: 'hours', template_id: templates[0]?.id ?? '', active: true }])} className="flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-sm font-bold text-slate-950"><Plus className="h-4 w-4" /> Etapa</button></div><div className="mt-4 space-y-3">{steps.length === 0 ? <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">Nenhuma etapa configurada.</div> : steps.map((step, index) => <div key={`${step.id ?? 'new'}-${index}`} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 md:grid-cols-[40px_90px_110px_minmax(180px,1fr)_120px]"><span className="self-center font-bold text-amber-400">#{index + 1}</span><input type="number" min={1} value={step.interval_value} onChange={(event) => setSteps((current) => current.map((item, i) => i === index ? { ...item, interval_value: Math.max(1, Number(event.target.value)) } : item))} className="control" /><select value={step.interval_unit} onChange={(event) => setSteps((current) => current.map((item, i) => i === index ? { ...item, interval_unit: event.target.value as Step['interval_unit'] } : item))} className="control"><option value="hours">Horas</option><option value="days">Dias</option></select><select value={step.template_id} onChange={(event) => setSteps((current) => current.map((item, i) => i === index ? { ...item, template_id: event.target.value } : item))} className="control"><option value="">Selecione</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name} · v{template.version}</option>)}</select><div className="flex gap-1"><IconButton onClick={() => move(index, -1)} icon={ArrowUp} /><IconButton onClick={() => move(index, 1)} icon={ArrowDown} /><IconButton onClick={() => setSteps((current) => current.filter((_, i) => i !== index))} icon={Trash2} danger /></div></div>)}</div></section><button onClick={() => void save()} disabled={saving} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 font-bold text-slate-950 disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar configuração</button></main>
      <aside className="space-y-4"><section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-cyan-300" /><h2 className="font-semibold text-white">Preview</h2></div><div className="mt-4 space-y-3">{preview.length ? preview.map((item) => <div key={item.index} className="rounded-xl border border-slate-800 bg-slate-950 p-3"><p className="text-xs font-semibold text-cyan-300">Follow-up {item.index} · após {item.hours < 24 ? `${item.hours}h` : `${Math.round(item.hours / 24)}d`}</p><p className="mt-1 text-sm text-white">{item.template}</p></div>) : <p className="text-sm text-slate-500">Adicione etapas para visualizar.</p>}</div></section><section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5"><div className="flex items-center gap-2 text-emerald-200"><ShieldCheck className="h-5 w-5" /><h2 className="font-semibold">Guardas obrigatórias</h2></div><ul className="mt-3 space-y-2 text-xs leading-5 text-slate-400"><li>• Resposta cancela pendências.</li><li>• Opt-out bloqueia IA e cadência.</li><li>• Atendimento humano não recebe follow-up.</li><li>• Fechado e perdido não recebem automação.</li></ul></section></aside></div>}
    <section className="panel"><div><h2 className="font-semibold">Monitor da cadência</h2><p className="text-xs text-slate-500">Alterações na sequência afetam somente novos agendamentos. Workflows continuam inativos.</p></div><div className="mt-4 grid gap-3 md:grid-cols-3"><select className="control" value={attemptFilter} onChange={(event) => setAttemptFilter(event.target.value)}><option value="all">Todas as tentativas</option><option value="scheduled">Próximas</option><option value="sent">Enviadas</option><option value="cancelled">Canceladas</option><option value="error">Com erro</option></select><select className="control" value={attemptLead} onChange={(event) => setAttemptLead(event.target.value)}><option value="all">Todos os leads</option>{leadOptions.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select><select className="control" value={attemptPeriod} onChange={(event) => setAttemptPeriod(event.target.value)}><option value="all">Todo o período</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{['waiting','active','paused','blocked'].map((status) => <div key={status} className="rounded-xl bg-slate-950 p-3"><p className="text-[10px] uppercase text-slate-500">{status}</p><p className="mt-1 text-xl font-bold">{cycles.filter((cycle) => cycle.status === status).length}</p></div>)}</div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="text-left text-xs uppercase text-slate-500"><tr><th className="pb-3">Agendamento</th><th>Estado</th><th>Etapa</th><th>Tentativas técnicas</th><th>Último erro</th></tr></thead><tbody>{filteredAttempts.slice(0, 50).map((attempt) => <tr key={attempt.id} className="border-t border-slate-800"><td className="py-3">{new Date(attempt.scheduled_for).toLocaleString('pt-BR')}</td><td>{attempt.status}</td><td>{cycles.find((cycle) => cycle.id === attempt.lead_cadence_id)?.current_step ?? '—'}</td><td>{attempt.technical_attempts}/3</td><td className="max-w-xs truncate text-rose-300">{attempt.error_message ?? '—'}</td></tr>)}</tbody></table>{filteredAttempts.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhuma tentativa corresponde aos filtros.</p>}</div></section>
    {attempts.some((attempt) => attempt.status === 'error') && <section className="panel"><h2 className="font-semibold">Erros disponíveis para reprocessamento</h2><div className="mt-3 grid gap-2">{attempts.filter((attempt) => attempt.status === 'error').map((attempt) => <div key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950 p-3"><div><p className="text-sm text-rose-200">{attempt.error_message ?? 'Erro não detalhado'}</p><p className="text-xs text-slate-500">{new Date(attempt.scheduled_for).toLocaleString('pt-BR')} · {attempt.technical_attempts}/3 tentativas</p></div><button className="button-secondary" onClick={() => void requeueAttempt(attempt)}>Reprocessar com segurança</button></div>)}</div></section>}
    <section className="panel"><h2 className="font-semibold">Histórico da configuração</h2><p className="text-xs text-slate-500">Cada salvamento cria um registro de auditoria imutável.</p><div className="mt-3 divide-y divide-slate-800">{configHistory.map((item) => <details key={item.id} className="py-3"><summary className="cursor-pointer text-sm text-slate-300">Alteração em {new Date(item.created_at).toLocaleString('pt-BR')}</summary><pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-500">{JSON.stringify(item.after_data, null, 2)}</pre></details>)}{configHistory.length === 0 && <p className="py-4 text-sm text-slate-500">O histórico começará no próximo salvamento.</p>}</div></section>
    <style jsx>{`.control{height:44px;width:100%;border-radius:12px;border:1px solid rgb(30 41 59);background:rgb(2 6 23);padding:0 12px;color:white;font-size:14px;outline:none}.control:focus{border-color:rgb(251 191 36)}`}</style></div>;
}

function Toggle({ label, checked }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <button type="button" disabled title="Ativação depende de autorização separada" className={cn('cursor-not-allowed rounded-xl border px-3 py-2 text-xs font-semibold opacity-70', checked ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-500')}>{label}: {checked ? 'Sim' : 'Não'} · bloqueado</button>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-2 text-xs font-semibold uppercase text-slate-500">{label}{children}</label>; }
function Control({ value, onChange, type = 'text' }: { value: string; onChange: (value: string) => void; type?: string }) { return <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="control" />; }
function IconButton({ onClick, icon: Icon, danger }: { onClick: () => void; icon: typeof ArrowUp; danger?: boolean }) { return <button onClick={onClick} className={cn('flex h-10 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400', danger && 'text-rose-300')}><Icon className="h-4 w-4" /></button>; }
