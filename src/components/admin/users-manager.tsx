'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, UserPlus } from 'lucide-react';

type ManagedUser = { user_id: string; display_name: string | null; role: 'admin' | 'atendente'; active: boolean; lead_count: number; email: string | null; invitation_pending: boolean; last_sign_in_at: string | null };

export function UsersManager() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', display_name: '', role: 'atendente' });

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch('/api/admin/users', { cache: 'no-store' });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setFeedback(payload.error ?? 'Falha ao carregar usuários.');
    setUsers(payload.users);
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function invite(event: React.FormEvent) {
    event.preventDefault(); setFeedback(null);
    const response = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const payload = await response.json();
    if (!response.ok) return setFeedback(payload.error ?? 'Falha ao enviar convite.');
    setFeedback('Convite enviado. O usuário definirá a própria senha pelo e-mail.');
    setForm({ email: '', display_name: '', role: 'atendente' });
    await load();
  }

  async function update(user: ManagedUser, change: Partial<ManagedUser>) {
    setFeedback(null);
    const next = { ...user, ...change };
    const response = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    const payload = await response.json();
    if (!response.ok) return setFeedback(payload.error ?? 'Alteração não realizada.');
    setUsers((current) => current.map((item) => item.user_id === user.user_id ? next : item));
    setFeedback('Acesso atualizado e registrado na auditoria.');
  }
  async function resend(user: ManagedUser) { if (!user.email) return; const response = await fetch('/api/admin/users', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.user_id, email: user.email }) }); const payload = await response.json(); setFeedback(response.ok ? 'Convite reenviado.' : payload.error ?? 'Não foi possível reenviar.'); }

  return <div className="space-y-6">
    <section className="panel">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold">Convidar usuário</h2><p className="text-sm text-slate-500">Nenhuma senha é criada ou exibida no CRM.</p></div><UserPlus className="text-amber-300" /></div>
      <form onSubmit={invite} className="grid gap-3 lg:grid-cols-[1fr_1fr_12rem_auto]">
        <label className="field">Nome<input className="control" required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></label>
        <label className="field">E-mail<input className="control" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className="field">Função<select className="control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="atendente">Atendente</option><option value="admin">Administrador</option></select></label>
        <button className="button-primary self-end" type="submit">Enviar convite</button>
      </form>
    </section>
    {feedback && <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{feedback}</div>}
    <section className="panel overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 className="font-bold">Equipe</h2><p className="text-xs text-slate-500">{users.length} perfis cadastrados</p></div><button className="button-secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Atualizar</button></div>
      {loading ? <p className="p-6 text-slate-500">Carregando equipe…</p> : users.length === 0 ? <p className="p-6 text-slate-500">Nenhum perfil encontrado.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-sm"><thead className="bg-slate-950/60 text-left text-xs uppercase text-slate-500"><tr><th className="p-4">Nome / e-mail</th><th>Função</th><th>Leads</th><th>Estado</th><th>Convite</th><th className="pr-4 text-right">Acesso</th></tr></thead><tbody>{users.map((user) => <tr key={user.user_id} className="border-t border-slate-800"><td className="p-4"><input className="control max-w-xs" value={user.display_name ?? ''} onChange={(e) => setUsers((current) => current.map((item) => item.user_id === user.user_id ? { ...item, display_name: e.target.value } : item))} onBlur={() => void update(user, { display_name: user.display_name })} /><p className="mt-1 text-xs text-slate-500">{user.email ?? 'E-mail indisponível'}</p></td><td><select className="control w-44" value={user.role} onChange={(e) => void update(user, { role: e.target.value as ManagedUser['role'] })}><option value="atendente">Atendente</option><option value="admin">Administrador</option></select></td><td>{user.lead_count}</td><td><span className={user.active ? 'text-emerald-400' : 'text-slate-500'}>{user.active ? 'Ativo' : 'Inativo'}</span></td><td>{user.invitation_pending ? <button className="text-amber-300 underline" onClick={() => void resend(user)}>Pendente · reenviar</button> : <span className="text-emerald-300">Aceito</span>}</td><td className="pr-4 text-right"><button className="button-secondary" onClick={() => void update(user, { active: !user.active })}>{user.active ? 'Desativar' : 'Reativar'}</button></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
