"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CalendarClock,
  Check,
  Clock3,
  Cpu,
  Gauge,
  Laptop,
  MessageCircle,
  MousePointer2,
  Pause,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  WifiOff,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadPipelineStatus, LeadsPipeline } from "@/types/database";
import { supabase } from "@/lib/supabase";

type ConversationRole = "user" | "assistant" | "system";

type Message = {
  id: string;
  telefone_cliente: string;
  papel: ConversationRole | "human";
  mensagem: string;
  criado_em: string;
  messageType?: string;
  status?: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
};

type Contact = {
  telefone: string;
  remoteJid: string;
  nome_perfil: string;
  lastMessageAt: string;
  aiPaused: boolean;
  lastMessage?: string;
  profilePicUrl?: string | null;
  unreadCount?: number;
};

type EvolutionChat = {
  id: string;
  remoteJid: string;
  displayJid: string;
  name: string;
  profilePicUrl: string | null;
  updatedAt: string | null;
  unreadCount: number;
  lastMessage: string;
  fromMe: boolean;
};

type EvolutionMessage = {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  pushName: string | null;
  text: string;
  messageType: string;
  createdAt: string | null;
  status: string;
  mediaUrl: string | null;
  mediaMimeType: string | null;
};
type ControlHistory = { id: number; action: string; actor_name: string; created_at: string };

const stages: Array<{ id: LeadPipelineStatus; label: string; tone: string }> = [
  { id: "novo", label: "Novo", tone: "bg-sky-500" },
  { id: "contato", label: "Contato", tone: "bg-cyan-400" },
  { id: "qualificado", label: "Qualificado", tone: "bg-violet-400" },
  { id: "proposta", label: "Proposta", tone: "bg-indigo-400" },
  { id: "negociacao", label: "Negociação", tone: "bg-amber-400" },
  { id: "fechado", label: "Fechado", tone: "bg-emerald-400" },
  { id: "perdido", label: "Perdido", tone: "bg-rose-400" },
];

const legacyStages: Record<string, LeadPipelineStatus> = {
  em_atendimento_ia: "contato", atendimento_humano: "contato",
  analise_fatura: "qualificado", contrato_enviado: "proposta",
};

function commercialStage(status: LeadPipelineStatus | null) {
  return legacyStages[status ?? "novo"] ?? status ?? "novo";
}

const emptyLead: LeadsPipeline = {
  id: "", name: "Nenhum lead selecionado", value: null, status: "novo", deadline: null,
  created_at: null, observations: null, phone: null, utm_source: null, utm_medium: null,
  utm_campaign: null, os: null, navegador: null, dispositivo: null, intervencao_humana: false,
  email: null, cidade: null, origem: null, score: null,
};

const pauseOptions = [
  { label: "1h", seconds: 3600 },
  { label: "5h", seconds: 18000 },
  { label: "12h", seconds: 43200 },
  { label: "24h", seconds: 86400 },
  { label: "Indeterminado", seconds: 315360000 },
];

function formatMoney(value: number | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatTime(value: string | null) {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleLabel(role: Message["papel"]) {
  if (role === "assistant") return "IA";
  if (role === "human") return "Humano";
  if (role === "system") return "Sistema";
  return "Cliente";
}

export default function CRMPage() {
  const [leads, setLeads] = useState<LeadsPipeline[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [selectedPhone, setSelectedPhone] = useState("");
  const [selectedRemoteJid, setSelectedRemoteJid] = useState("");
  const [query, setQuery] = useState("");
  const [conversationFilter, setConversationFilter] = useState<"all" | "unread" | "ai" | "human" | "optout">("all");
  const [draft, setDraft] = useState("");
  const [pauseSeconds, setPauseSeconds] = useState(18000);
  const [apiFeedback, setApiFeedback] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messageLimit, setMessageLimit] = useState(40);
  const [aiTtl, setAiTtl] = useState<number | null>(null);
  const [controlHistory, setControlHistory] = useState<ControlHistory[]>([]);

  useEffect(() => {
    let isActive = true;
    async function loadLeads() {
      const { data, error } = await supabase.from("leads_pipeline").select("*").order("updated_at", { ascending: false });
      if (!isActive) return;
      if (error) {
        setApiFeedback(`Falha ao carregar leads: ${error.message}`);
        return;
      }
      const realLeads = (data ?? []) as LeadsPipeline[];
      setLeads(realLeads);
      if (!selectedPhone && realLeads[0]?.phone) {
        const phone = realLeads[0].phone.replace(/\D/g, "");
        setSelectedPhone(phone);
        setSelectedRemoteJid(`${phone}@s.whatsapp.net`);
      }
    }
    void loadLeads();
    return () => { isActive = false; };
  }, [selectedPhone]);

  useEffect(() => {
    let isActive = true;

    async function loadChats() {
      setIsLoadingChats(true);
      try {
        const response = await fetch("/api/evolution/chats");
        const payload = (await response.json()) as { chats?: EvolutionChat[]; error?: string };
        if (!response.ok) throw new Error(payload.error);

        const nextContacts = (payload.chats ?? []).map((chat) => {
          const phone = chat.displayJid.split("@")[0] || chat.remoteJid.split("@")[0] || chat.remoteJid;
          return {
            telefone: phone,
            remoteJid: chat.remoteJid,
            nome_perfil: chat.name || phone,
            lastMessageAt: chat.updatedAt ?? new Date().toISOString(),
            aiPaused: false,
            lastMessage: chat.lastMessage,
            profilePicUrl: chat.profilePicUrl,
            unreadCount: chat.unreadCount,
          };
        });

        if (!isActive || nextContacts.length === 0) return;

        setContacts(nextContacts);
        setSelectedPhone(nextContacts[0].telefone);
        setSelectedRemoteJid(nextContacts[0].remoteJid);
      } catch (error) {
        setApiFeedback(error instanceof Error ? error.message : "Falha ao carregar chats da Evolution.");
      } finally {
        if (isActive) setIsLoadingChats(false);
      }
    }

    void loadChats();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadMessages() {
      if (!selectedRemoteJid) return;
      setIsLoadingMessages(true);
      try {
        const response = await fetch(
          `/api/evolution/messages?remoteJid=${encodeURIComponent(selectedRemoteJid)}&limit=${messageLimit}`,
        );
        const payload = (await response.json()) as { messages?: EvolutionMessage[]; error?: string };
        if (!response.ok) throw new Error(payload.error);

        const nextMessages = (payload.messages ?? []).map((message) => ({
          id: message.id,
          telefone_cliente: selectedPhone,
          papel: message.fromMe ? ("human" as const) : ("user" as const),
          mensagem: message.text || `[${message.messageType}]`,
          criado_em: message.createdAt ?? new Date().toISOString(),
          messageType: message.messageType,
          status: message.status,
          mediaUrl: message.mediaUrl,
          mediaMimeType: message.mediaMimeType,
        }));

        if (isActive) setChatMessages(nextMessages);
      } catch (error) {
        setApiFeedback(error instanceof Error ? error.message : "Falha ao carregar mensagens da Evolution.");
      } finally {
        if (isActive) setIsLoadingMessages(false);
      }
    }

    void loadMessages();

    return () => {
      isActive = false;
    };
  }, [messageLimit, selectedPhone, selectedRemoteJid]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.phone?.replace(/\D/g, "") === selectedPhone.replace(/\D/g, "")) ?? emptyLead,
    [leads, selectedPhone],
  );
  const selectedContact = contacts.find((contact) => contact.telefone === selectedPhone);

  const selectedMessages = chatMessages.filter((message) => message.telefone_cliente === selectedPhone);
  const leadForPhone = (phone: string) => leads.find((lead) => lead.phone?.replace(/\D/g, "") === phone.replace(/\D/g, ""));
  const filteredContacts = contacts.filter((contact) => {
    const lead = leadForPhone(contact.telefone);
    const matchesText = `${contact.nome_perfil} ${contact.telefone}`.toLowerCase().includes(query.toLowerCase());
    const matchesFilter = conversationFilter === "all" ||
      (conversationFilter === "unread" && Boolean(contact.unreadCount)) ||
      (conversationFilter === "ai" && lead?.ai_enabled !== false && !lead?.human_handoff) ||
      (conversationFilter === "human" && Boolean(lead?.human_handoff || lead?.intervencao_humana)) ||
      (conversationFilter === "optout" && lead?.automation_contact_allowed === false);
    return matchesText && matchesFilter;
  });

  useEffect(() => {
    if (!selectedPhone) return;
    let active = true;
    fetch(`/api/ai-control/${encodeURIComponent(selectedPhone)}`).then(async (response) => {
      const payload = await response.json();
      if (active && response.ok) setAiTtl(payload.ttl);
    }).catch(() => { if (active) setAiTtl(null); });
    return () => { active = false; };
  }, [selectedPhone, apiFeedback]);

  useEffect(() => {
    if (!selectedLead.id) { const timer = window.setTimeout(() => setControlHistory([]), 0); return () => window.clearTimeout(timer); }
    let active = true;
    fetch(`/api/leads/${selectedLead.id}/control`).then(async (response) => { const payload = await response.json(); if (active && response.ok) setControlHistory(payload.history ?? []); }).catch(() => { if (active) setControlHistory([]); });
    return () => { active = false; };
  }, [selectedLead.id, apiFeedback]);

  async function controlLead(action: "handoff" | "return_to_ai" | "opt_out" | "clear_opt_out") {
    if (!selectedLead.id) return;
    let reason: string | undefined;
    if (action === "opt_out") reason = window.prompt("Motivo do pedido para não incomodar:") ?? undefined;
    if (action === "clear_opt_out") reason = window.prompt("Justificativa administrativa para corrigir o opt-out:") ?? undefined;
    if ((action === "opt_out" || action === "clear_opt_out") && !reason?.trim()) return;
    const response = await fetch(`/api/leads/${selectedLead.id}/control`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
    const payload = await response.json();
    if (!response.ok) return setApiFeedback(payload.error ?? "Ação não realizada.");
    setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? payload.lead : lead));
    setApiFeedback("Estado do atendimento atualizado e auditado.");
  }

  async function pauseIa() {
    setApiFeedback("Enviando pausa para o Redis...");
    try {
      const response = await fetch(`/api/ai-control/${encodeURIComponent(selectedPhone)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: pauseSeconds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      await supabase.from("leads_pipeline").update({ ai_enabled: false }).eq("id", selectedLead.id);
      setApiFeedback(`IA pausada por ${Math.round(pauseSeconds / 3600)}h.`);
      setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, ai_enabled: false } : lead));
    } catch (error) {
      setApiFeedback(error instanceof Error ? error.message : "Falha ao pausar IA.");
    }
  }

  async function wakeIa() {
    setApiFeedback("Removendo trava do Redis...");
    try {
      const response = await fetch(`/api/ai-control/${encodeURIComponent(selectedPhone)}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      if (!selectedLead.human_handoff && selectedLead.automation_contact_allowed !== false) {
        await supabase.from("leads_pipeline").update({ ai_enabled: true }).eq("id", selectedLead.id);
        setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, ai_enabled: true } : lead));
      }
      setApiFeedback("IA reativada para este telefone.");
    } catch (error) {
      setApiFeedback(error instanceof Error ? error.message : "Falha ao reativar IA.");
    }
  }

  async function sendMessage() {
    if (!draft.trim()) return;
    setIsSending(true);
    setApiFeedback("Enviando mensagem e pausando IA por 5h...");
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefone: selectedPhone, message: draft }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setChatMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          telefone_cliente: selectedPhone,
          papel: "human",
          mensagem: draft,
          criado_em: new Date().toISOString(),
          messageType: "conversation",
          status: "sent",
        },
      ]);
      setDraft("");
      setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, ai_enabled: false, human_handoff: true, intervencao_humana: true, cadence_status: lead.cadence_status === "active" || lead.cadence_status === "waiting" ? "paused" : lead.cadence_status } : lead));
      setApiFeedback(payload.warning ?? "Mensagem enviada. Trava de 5h aplicada no Redis.");
    } catch (error) {
      setApiFeedback(error instanceof Error ? error.message : "Falha ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-112px)] flex-col gap-4 xl:h-[calc(100vh-112px)] xl:min-h-[760px] xl:overflow-hidden">
      <header className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
            <ShieldCheck className="h-4 w-4" />
            BeHub Omnichannel
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">Pipeline e controle da IA</h1>
          <p className="text-sm text-slate-400">
            Conversas reais da Evolution vinculadas aos leads do Supabase pelo telefone.
          </p>
        </div>

        <div className="grid w-full grid-cols-3 gap-2 text-right lg:w-auto">
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2">
            <p className="text-[10px] uppercase text-slate-500">Leads</p>
            <p className="text-lg font-semibold text-white">{leads.length}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2">
            <p className="text-[10px] uppercase text-slate-500">Humano</p>
            <p className="text-lg font-semibold text-amber-300">
              {leads.filter((lead) => lead.intervencao_humana).length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-2">
            <p className="text-[10px] uppercase text-slate-500">Ticket</p>
            <p className="text-lg font-semibold text-emerald-300">
              {formatMoney(leads.reduce((sum, lead) => sum + Number(lead.value ?? 0), 0))}
            </p>
          </div>
        </div>
      </header>

      <section className="min-h-[210px] overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70 p-3 custom-scrollbar">
        <div className="flex h-full min-w-max gap-3">
          {stages.map((stage) => {
            const stageLeads = leads.filter((lead) => commercialStage(lead.status) === stage.id);
            return (
              <div key={stage.id} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", stage.tone)} />
                    <h2 className="text-sm font-semibold text-slate-100">{stage.label}</h2>
                  </div>
                  <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs text-slate-400">
                    {stageLeads.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stageLeads.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-600">
                      Sem leads
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => {
                          const phone = lead.phone?.replace(/\D/g, "") ?? "";
                          setSelectedPhone(phone);
                          setSelectedRemoteJid(`${phone}@s.whatsapp.net`);
                        }}
                        className={cn(
                          "w-full rounded-lg border p-3 text-left transition",
                          selectedLead.id === lead.id
                            ? "border-cyan-400/60 bg-cyan-400/10"
                            : "border-slate-800 bg-slate-900 hover:border-slate-600",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{lead.name}</p>
                            <p className="mt-1 text-xs text-slate-500">{lead.phone}</p>
                          </div>
                          <span className="rounded-md bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                            {formatMoney(lead.value)}
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-1 text-[10px] text-slate-400">
                          <span className="rounded bg-slate-950 px-2 py-1">{lead.utm_source}</span>
                          <span className="rounded bg-slate-950 px-2 py-1">{lead.navegador}</span>
                          <span className="rounded bg-slate-950 px-2 py-1">{lead.dispositivo}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950 xl:grid-cols-[280px_minmax(420px,1fr)_330px]">
        <aside className="flex min-h-[360px] flex-col border-b border-slate-800 xl:min-h-0 xl:border-b-0 xl:border-r">
          <div className="border-b border-slate-800 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900 pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-500"
                placeholder="Buscar contato"
              />
            </div>
            <select className="control mt-2" value={conversationFilter} onChange={(event) => setConversationFilter(event.target.value as typeof conversationFilter)} aria-label="Filtrar conversas">
              <option value="all">Todas as conversas</option><option value="unread">Não lidas</option><option value="ai">IA ativa</option><option value="human">Atendimento humano</option><option value="optout">Opt-out</option>
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            {isLoadingChats && filteredContacts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Carregando conversas...
              </div>
            ) : filteredContacts.map((contact) => (
              <button
                key={contact.remoteJid}
                onClick={() => {
                  setSelectedPhone(contact.telefone);
                  setSelectedRemoteJid(contact.remoteJid);
                }}
                className={cn(
                  "w-full border-b border-slate-900 px-3 py-3 text-left transition",
                  selectedPhone === contact.telefone ? "bg-slate-900" : "hover:bg-slate-900/70",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                      {contact.profilePicUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={contact.profilePicUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : (
                        <UserRound className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{contact.nome_perfil}</p>
                      <p className="truncate text-xs text-slate-500">{contact.telefone}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      contact.aiPaused ? "bg-rose-400" : "bg-emerald-400",
                    )}
                    title={contact.aiPaused ? "IA pausada" : "IA ativa"}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="truncate pr-2">
                    {contact.lastMessage ? `${contact.unreadCount ? `(${contact.unreadCount}) ` : ""}${contact.lastMessage}` : contact.aiPaused ? "IA pausada" : "IA ativa"}
                  </span>
                  <span>{formatTime(contact.lastMessageAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white">{selectedContact?.nome_perfil ?? selectedLead.name}</h2>
                <p className="text-xs text-slate-500">{selectedContact?.telefone ?? selectedLead.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-300">
              {selectedLead.human_handoff || selectedLead.intervencao_humana ? <WifiOff className="h-4 w-4 text-rose-300" /> : <Bot className="h-4 w-4 text-emerald-300" />}
              {selectedLead.automation_contact_allowed === false ? "Opt-out" : selectedLead.human_handoff || selectedLead.intervencao_humana ? "Atendimento humano" : "IA monitorando"}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 custom-scrollbar">
            {selectedMessages.length >= 40 && messageLimit < 200 && <button className="button-secondary mx-auto" onClick={() => setMessageLimit((current) => Math.min(current + 40, 200))}>Carregar mensagens anteriores</button>}
            {isLoadingMessages ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Carregando mensagens...
              </div>
            ) : selectedMessages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Sem mensagens para esta conversa.
              </div>
            ) : (
              selectedMessages.map((message) => {
                const isCustomer = message.papel === "user";
                const isHuman = message.papel === "human";
                return (
                  <div
                    key={message.id}
                    className={cn("flex", isCustomer ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[72%] rounded-lg border px-4 py-3",
                        isCustomer && "border-slate-800 bg-slate-900 text-slate-100",
                        message.papel === "assistant" && "border-cyan-400/20 bg-cyan-400/10 text-cyan-50",
                        isHuman && "border-amber-400/20 bg-amber-400/10 text-amber-50",
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-4 text-[10px] uppercase tracking-wider text-slate-500">
                        <span>{roleLabel(message.papel)}</span>
                        <span>{formatTime(message.criado_em)}</span>
                      </div>
                      {message.messageType && !['conversation', 'extendedTextMessage'].includes(message.messageType) && <div className="mb-2 rounded-md border border-current/20 px-2 py-1 text-xs">{mediaLabel(message.messageType)}</div>}
                      {message.mediaUrl && <MessageMedia url={message.mediaUrl} mimeType={message.mediaMimeType} />}
                      <p className="text-sm leading-6">{message.mensagem}</p>
                      {!isCustomer && <p className="mt-1 text-right text-[10px] opacity-60">{message.status === 'error' ? 'Falha no envio' : message.status === 'read' ? 'Lida' : message.status === 'delivered' ? 'Entregue' : 'Enviada'}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-800 p-3">
            {!selectedLead.id && selectedPhone && <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100"><span>Esta conversa ainda não está vinculada a um lead.</span><Link className="font-bold underline" href={`/leads?newPhone=${encodeURIComponent(selectedPhone)}`}>Criar cadastro</Link></div>}
            {selectedLead.automation_contact_allowed === false && (
              <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                Este contato pediu para não receber automações. Mensagem manual continua permitida com atenção.
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                className="min-h-12 flex-1 resize-none rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500"
                placeholder="Digite como humano. Ao enviar, a IA pausa por 5h."
              />
              <button
                onClick={sendMessage}
                disabled={isSending || !draft.trim() || !selectedPhone}
                className="flex h-12 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-t border-slate-800 p-4 custom-scrollbar xl:border-l xl:border-t-0">
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-cyan-300" />
                  <h3 className="text-sm font-semibold text-white">Controle da IA</h3>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-[10px] font-semibold uppercase",
                    selectedLead.intervencao_humana
                      ? "bg-rose-400/10 text-rose-300"
                      : "bg-emerald-400/10 text-emerald-300",
                  )}
                >
                  {selectedLead.intervencao_humana ? "Pausada" : "Ativa"}
                </span>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Chave Redis</span>
                  <Clock3 className="h-4 w-4" />
                </div>
                <p className="mt-1 truncate font-mono text-xs text-slate-200">
                  pause_agent_{selectedPhone}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {aiTtl === null ? "Estado Redis indisponível" : aiTtl > 0 ? aiTtl > 315000000 ? "Pausa por tempo indeterminado" : `Pausa restante: ${Math.ceil(aiTtl / 60)} min` : "Sem pausa temporária no Redis"}
                </p>
              </div>

              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={pauseSeconds}
                  onChange={(event) => setPauseSeconds(Number(event.target.value))}
                  className="h-10 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-500"
                >
                  {pauseOptions.map((option) => (
                    <option key={option.seconds} value={option.seconds}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={pauseIa}
                  className="flex h-10 items-center gap-2 rounded-lg bg-amber-400 px-3 text-sm font-semibold text-slate-950 hover:bg-amber-300"
                >
                  <Pause className="h-4 w-4" />
                  Pausar IA
                </button>
              </div>

              <button
                onClick={wakeIa}
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20"
              >
                <Zap className="h-4 w-4" />
                Acordar IA
              </button>

              <div className="mt-3 grid gap-2">
                <button onClick={() => void controlLead("handoff")} className="button-secondary">Transferir para humano</button>
                <button onClick={() => void controlLead("return_to_ai")} className="button-secondary" disabled={selectedLead.automation_contact_allowed === false}>Devolver para IA</button>
                {selectedLead.automation_contact_allowed === false ? <button onClick={() => void controlLead("clear_opt_out")} className="button-secondary text-rose-200">Corrigir opt-out (admin)</button> : <button onClick={() => void controlLead("opt_out")} className="button-secondary text-rose-200">Registrar pedido para não incomodar</button>}
              </div>
              {controlHistory.length > 0 && <details className="mt-3 rounded-lg bg-slate-950 p-3 text-xs"><summary className="cursor-pointer text-amber-300">Histórico de controle</summary><div className="mt-2 space-y-2">{controlHistory.map((item) => <p key={item.id} className="text-slate-400">{item.action.replaceAll('_', ' ')} · {item.actor_name} · {new Date(item.created_at).toLocaleString('pt-BR')}</p>)}</div></details>}

              {apiFeedback && (
                <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300">
                  {apiFeedback}
                </p>
              )}
            </section>

            {selectedLead.automation_contact_allowed === false && <section className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4"><h3 className="font-semibold text-rose-200">Bloqueio permanente de automações</h3><p className="mt-2 text-xs text-rose-100">{selectedLead.do_not_contact_reason ?? "Motivo não informado"}</p><p className="mt-1 text-xs text-slate-500">{selectedLead.do_not_contact_at ? new Date(selectedLead.do_not_contact_at).toLocaleString("pt-BR") : "Data não informada"}</p></section>}

            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold text-white">Dados do lead</h3>
              </div>
              <dl className="space-y-2 text-sm">
                {[
                  ["Nome", selectedLead.name],
                  ["Telefone", selectedLead.phone],
                  ["Email", selectedLead.email],
                  ["Cidade", selectedLead.cidade],
                  ["Origem", selectedLead.origem],
                  ["Valor da conta", formatMoney(selectedLead.value)],
                  ["Score", selectedLead.score?.toString()],
                  ["Deadline", selectedLead.deadline],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="truncate text-xs font-medium text-slate-200">{value ?? "-"}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <MousePointer2 className="h-4 w-4 text-emerald-300" />
                <h3 className="text-sm font-semibold text-white">Metadados da landing</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Meta icon={Gauge} label="utm_source" value={selectedLead.utm_source} />
                <Meta icon={Gauge} label="utm_medium" value={selectedLead.utm_medium} />
                <Meta icon={Gauge} label="campaign" value={selectedLead.utm_campaign} />
                <Meta icon={Laptop} label="OS" value={selectedLead.os} />
                <Meta icon={Smartphone} label="Device" value={selectedLead.dispositivo} />
                <Meta icon={CalendarClock} label="Criado" value={formatTime(selectedLead.created_at)} />
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-300" />
                <h3 className="text-sm font-semibold text-white">Observacoes</h3>
              </div>
              <p className="text-sm leading-6 text-slate-300">{selectedLead.observations}</p>
              {selectedLead.intervencao_humana && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                  <Check className="h-4 w-4" />
                  Intervencao humana marcada no Supabase.
                </div>
              )}
            </section>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
      <div className="mb-1 flex items-center gap-1 text-[10px] uppercase text-slate-500">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="truncate font-medium text-slate-200">{value ?? "-"}</p>
    </div>
  );
}

function mediaLabel(type: string) {
  if (type.toLowerCase().includes('audio')) return '🎧 Mensagem de áudio';
  if (type.toLowerCase().includes('image')) return '🖼️ Imagem';
  if (type.toLowerCase().includes('document')) return '📄 Documento';
  if (type.toLowerCase().includes('video')) return '🎬 Vídeo';
  return `Anexo · ${type}`;
}

function MessageMedia({ url, mimeType }: { url: string; mimeType?: string | null }) {
  if (mimeType?.startsWith('image/')) return <img src={url} alt="Imagem recebida na conversa" className="mb-2 max-h-64 rounded-lg object-contain" />; // eslint-disable-line @next/next/no-img-element
  if (mimeType?.startsWith('audio/')) return <audio className="mb-2 max-w-full" controls src={url}>Seu navegador não reproduz este áudio.</audio>;
  if (mimeType?.startsWith('video/')) return <video className="mb-2 max-h-64 max-w-full rounded-lg" controls src={url}>Seu navegador não reproduz este vídeo.</video>;
  return <a href={url} target="_blank" rel="noreferrer" className="mb-2 block text-xs font-semibold underline">Abrir documento</a>;
}
