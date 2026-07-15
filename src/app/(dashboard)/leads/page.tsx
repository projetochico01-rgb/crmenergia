'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  DollarSign,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type LeadStatus =
  | 'novo'
  | 'em_atendimento_ia'
  | 'atendimento_humano'
  | 'analise_fatura'
  | 'contrato_enviado'
  | 'fechado'
  | 'perdido';

type Lead = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus | null;
  origem: string | null;
  value: number | null;
  created_at: string | null;
};

const statusConfig: Record<LeadStatus, { label: string; className: string }> = {
  novo: { label: 'Novo', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  em_atendimento_ia: { label: 'Em Atendimento IA', className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  atendimento_humano: { label: 'Atendimento Humano', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  analise_fatura: { label: 'Analise Fatura', className: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  contrato_enviado: { label: 'Contrato Enviado', className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  fechado: { label: 'Fechado', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  perdido: { label: 'Perdido', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  status: 'novo' as LeadStatus,
  source: 'whatsapp',
  value: 0,
};

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' '),
  };
}

function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString('pt-BR') : '-';
}

function buildPipelinePayload(formData: typeof emptyForm) {
  return {
    name: `${formData.first_name} ${formData.last_name}`.trim(),
    email: formData.email || null,
    phone: formData.phone || null,
    status: formData.status,
    origem: formData.source || 'whatsapp',
    value: Number(formData.value) || 0,
    utm_source: formData.source || 'whatsapp',
    utm_medium: 'crm_manual',
    utm_campaign: 'cadastro_manual',
    intervencao_humana: true,
  };
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from('leads_pipeline')
        .select('id,name,email,phone,status,origem,value,created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads((data ?? []) as Lead[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel carregar leads.';
      setErrorMessage(message);
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchLeads();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchLeads]);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;

    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
    } else {
      document.body.style.overflow = originalStyle;
      document.body.style.paddingRight = '0px';
    }

    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.paddingRight = '0px';
    };
  }, [isModalOpen]);

  const filteredLeads = useMemo(
    () =>
      leads.filter((lead) =>
        `${lead.name} ${lead.email ?? ''} ${lead.phone ?? ''} ${lead.origem ?? ''}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      ),
    [leads, searchQuery],
  );

  function handleOpenModal(lead?: Lead) {
    if (lead) {
      const nameParts = splitName(lead.name);
      setEditingLead(lead);
      setFormData({
        first_name: nameParts.first_name,
        last_name: nameParts.last_name,
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        status: lead.status ?? 'novo',
        source: lead.origem ?? 'whatsapp',
        value: Number(lead.value ?? 0),
      });
    } else {
      setEditingLead(null);
      setFormData(emptyForm);
    }

    setErrorMessage(null);
    setIsModalOpen(true);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload = buildPipelinePayload(formData);

      if (!payload.name) {
        throw new Error('Informe ao menos o nome do lead.');
      }

      if (editingLead) {
        const { error } = await supabase
          .from('leads_pipeline')
          .update(payload)
          .eq('id', editingLead.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('leads_pipeline').insert([payload]);
        if (error) throw error;
      }

      await fetchLeads();
      setIsModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel salvar o lead.';
      setErrorMessage(message);
      console.error('Error saving lead:', error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;

    try {
      const { error } = await supabase.from('leads_pipeline').delete().eq('id', id);
      if (error) throw error;
      setLeads((current) => current.filter((lead) => lead.id !== id));
      if (editingLead?.id === id) setIsModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nao foi possivel excluir o lead.';
      setErrorMessage(message);
      console.error('Error deleting lead:', error);
    }
  }

  function handleExportCSV() {
    if (leads.length === 0) return;

    const headers = ['Nome', 'Email', 'Telefone', 'Status', 'Origem', 'Valor', 'Data'];
    const csvRows = [
      headers.join(';'),
      ...leads.map((lead) =>
        [
          lead.name.replace(/;/g, ' '),
          lead.email ?? '',
          lead.phone ?? '',
          lead.status ? statusConfig[lead.status]?.label ?? lead.status : '',
          (lead.origem ?? '').replace(/;/g, ' '),
          String(lead.value ?? 0).replace('.', ','),
          formatDate(lead.created_at),
        ].join(';'),
      ),
    ];

    const blob = new Blob([`\uFEFF${csvRows.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `leads-atrioz-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Gestao de Leads
          </h1>
          <p className="text-slate-400 text-sm">Leads gravados diretamente na tabela leads_pipeline.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-800 transition-all text-sm active:scale-95"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95 font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome, email, telefone ou origem..."
            className="w-full bg-slate-950 border border-slate-800 text-white pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl hover:text-white transition-all text-sm w-full md:w-auto justify-center">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          <button
            onClick={fetchLeads}
            className="p-2 bg-slate-950 border border-slate-800 text-slate-400 rounded-xl hover:text-white transition-all"
          >
            <RefreshCw className={cn('w-5 h-5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lead</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Origem</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                    <p className="text-slate-500 text-sm font-medium">Carregando leads...</p>
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <Users className="w-12 h-12 text-slate-800 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">Nenhum lead encontrado</p>
                    <p className="text-slate-600 text-sm">Tente mudar os filtros ou cadastrar um novo lead.</p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const nameParts = splitName(lead.name);
                  return (
                    <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="p-4" onClick={() => handleOpenModal(lead)}>
                        <div className="flex items-center gap-3 cursor-pointer">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 flex items-center justify-center text-slate-400 group-hover:text-blue-400 transition-all font-bold uppercase tracking-tighter">
                            {nameParts.first_name[0]}
                            {nameParts.last_name[0] ?? ''}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                              {lead.name}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Mail className="w-3 h-3" />
                                {lead.email ?? '-'}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Phone className="w-3 h-3" />
                                {lead.phone ?? '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            'text-[10px] font-bold px-2 py-1 rounded-lg border',
                            lead.status
                              ? statusConfig[lead.status]?.className
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/20',
                          )}
                        >
                          {lead.status ? statusConfig[lead.status]?.label ?? lead.status : '-'}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-slate-400 font-medium">{lead.origem ?? '-'}</td>
                      <td className="p-4">
                        <div className="text-sm font-bold text-emerald-400">
                          R$ {Number(lead.value ?? 0).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(lead.created_at)}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenModal(lead)}
                            className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                            title="Editar lead"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(lead.id)}
                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                            title="Excluir lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md z-[100]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[#0f172a] border border-slate-700 rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh] z-[101]"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-950">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{editingLead ? 'Editar Lead' : 'Novo Lead'}</h2>
                    <p className="text-xs text-slate-500">Salvando em leads_pipeline.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <form onSubmit={handleSave} className="p-6 space-y-4">
                  {errorMessage && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Nome">
                      <input
                        required
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                        placeholder="Ex: Jorge"
                        value={formData.first_name}
                        onChange={(event) => setFormData({ ...formData, first_name: event.target.value })}
                      />
                    </Field>
                    <Field label="Sobrenome">
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                        placeholder="Ex: Cardoso"
                        value={formData.last_name}
                        onChange={(event) => setFormData({ ...formData, last_name: event.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label="Email">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                      <input
                        type="email"
                        className="w-full bg-slate-950 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                        placeholder="jorge@email.com"
                        value={formData.email}
                        onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                      />
                    </div>
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Telefone">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                          placeholder="47984595965"
                          value={formData.phone}
                          onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
                        />
                      </div>
                    </Field>
                    <Field label="Valor (R$)">
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                        <input
                          type="number"
                          className="w-full bg-slate-950 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                          placeholder="650"
                          value={formData.value}
                          onChange={(event) => setFormData({ ...formData, value: Number(event.target.value) })}
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Status">
                      <select
                        className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm appearance-none cursor-pointer"
                        value={formData.status}
                        onChange={(event) => setFormData({ ...formData, status: event.target.value as LeadStatus })}
                      >
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <option key={key} value={key}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Origem">
                      <input
                        type="text"
                        className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-sm"
                        placeholder="whatsapp"
                        value={formData.source}
                        onChange={(event) => setFormData({ ...formData, source: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all font-bold text-sm"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-[2] px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      {editingLead ? 'Salvar Alteracoes' : 'Criar Lead'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">{label}</label>
      {children}
    </div>
  );
}
