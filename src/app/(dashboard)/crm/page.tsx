"use client";

import { useEffect, useMemo, useState } from "react";
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

type ConversationRole = "user" | "assistant" | "system";

type Message = {
  id: string;
  telefone_cliente: string;
  papel: ConversationRole | "human";
  mensagem: string;
  criado_em: string;
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
};

const stages: Array<{ id: LeadPipelineStatus; label: string; tone: string }> = [
  { id: "novo", label: "Novo", tone: "bg-sky-500" },
  { id: "em_atendimento_ia", label: "IA atendendo", tone: "bg-cyan-400" },
  { id: "atendimento_humano", label: "Humano", tone: "bg-amber-400" },
  { id: "analise_fatura", label: "Analise fatura", tone: "bg-violet-400" },
  { id: "contrato_enviado", label: "Contrato", tone: "bg-indigo-400" },
  { id: "fechado", label: "Fechado", tone: "bg-emerald-400" },
  { id: "perdido", label: "Perdido", tone: "bg-rose-400" },
];

const leads: LeadsPipeline[] = [
  {
    id: "8ea8a444-37c1-4c5a-98b1-8844dce00111",
    name: "Marina Costa",
    value: 640,
    status: "novo",
    deadline: "2026-06-08",
    created_at: "2026-06-06T12:21:00Z",
    observations: "Lead veio da landing page de economia solar. Pediu simulacao residencial.",
    phone: "5511991110001",
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "solar_junho",
    os: "Android",
    navegador: "Chrome",
    dispositivo: "mobile",
    intervencao_humana: false,
    email: "marina@exemplo.com",
    cidade: "Sao Paulo",
    origem: "Landing Page",
    score: 87,
  },
  {
    id: "8ea8a444-37c1-4c5a-98b1-8844dce00222",
    name: "Roberto Lima",
    value: 1120,
    status: "em_atendimento_ia",
    deadline: "2026-06-09",
    created_at: "2026-06-06T13:05:00Z",
    observations: "Cliente comercial, conta alta, pediu retorno ainda hoje.",
    phone: "5511982220002",
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "whatsapp_direto",
    os: "iOS",
    navegador: "Safari",
    dispositivo: "mobile",
    intervencao_humana: false,
    email: "roberto@empresa.com",
    cidade: "Guarulhos",
    origem: "WhatsApp",
    score: 92,
  },
  {
    id: "8ea8a444-37c1-4c5a-98b1-8844dce00333",
    name: "Ana Paula Reis",
    value: 430,
    status: "atendimento_humano",
    deadline: "2026-06-07",
    created_at: "2026-06-06T14:18:00Z",
    observations: "Solicitou explicacao sobre contrato e prazo de instalacao.",
    phone: "5511973330003",
    utm_source: "organico",
    utm_medium: "direto",
    utm_campaign: "nenhuma",
    os: "Windows",
    navegador: "Edge",
    dispositivo: "desktop",
    intervencao_humana: true,
    email: "ana.reis@exemplo.com",
    cidade: "Santo Andre",
    origem: "Site",
    score: 73,
  },
  {
    id: "8ea8a444-37c1-4c5a-98b1-8844dce00444",
    name: "Casa Verde Energia",
    value: 1880,
    status: "contrato_enviado",
    deadline: "2026-06-10",
    created_at: "2026-06-05T19:40:00Z",
    observations: "Decisor pediu contrato para revisao com socio.",
    phone: "5511964440004",
    utm_source: "linkedin",
    utm_medium: "social",
    utm_campaign: "b2b_solar",
    os: "macOS",
    navegador: "Chrome",
    dispositivo: "desktop",
    intervencao_humana: true,
    email: "contato@casaverde.com",
    cidade: "Campinas",
    origem: "Indicacao",
    score: 95,
  },
];

const fallbackContacts: Contact[] = leads.map((lead) => ({
  telefone: lead.phone ?? "",
  remoteJid: `${lead.phone ?? ""}@s.whatsapp.net`,
  nome_perfil: lead.name,
  lastMessageAt: lead.created_at ?? new Date().toISOString(),
  aiPaused: Boolean(lead.intervencao_humana),
}));

const fallbackMessages: Message[] = [
  {
    id: "m1",
    telefone_cliente: "5511991110001",
    papel: "user",
    mensagem: "Oi, queria saber se energia solar funciona para casa pequena.",
    criado_em: "2026-06-06T12:22:00Z",
  },
  {
    id: "m2",
    telefone_cliente: "5511991110001",
    papel: "assistant",
    mensagem: "Funciona sim. Me diga sua media de conta de luz para eu estimar a economia.",
    criado_em: "2026-06-06T12:22:20Z",
  },
  {
    id: "m3",
    telefone_cliente: "5511991110001",
    papel: "user",
    mensagem: "Pago perto de 640 reais por mes.",
    criado_em: "2026-06-06T12:24:00Z",
  },
  {
    id: "m4",
    telefone_cliente: "5511973330003",
    papel: "human",
    mensagem: "Ana, vou assumir por aqui e te explicar os proximos passos do contrato.",
    criado_em: "2026-06-06T14:21:00Z",
  },
];

const pauseOptions = [
  { label: "1h", seconds: 3600 },
  { label: "5h", seconds: 18000 },
  { label: "12h", seconds: 43200 },
  { label: "24h", seconds: 86400 },
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
  const [contacts, setContacts] = useState<Contact[]>(fallbackContacts);
  const [chatMessages, setChatMessages] = useState<Message[]>(fallbackMessages);
  const [selectedPhone, setSelectedPhone] = useState(fallbackContacts[0].telefone);
  const [selectedRemoteJid, setSelectedRemoteJid] = useState(fallbackContacts[0].remoteJid);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [pauseSeconds, setPauseSeconds] = useState(18000);
  const [apiFeedback, setApiFeedback] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

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
          `/api/evolution/messages?remoteJid=${encodeURIComponent(selectedRemoteJid)}`,
        );
        const payload = (await response.json()) as { messages?: EvolutionMessage[]; error?: string };
        if (!response.ok) throw new Error(payload.error);

        const nextMessages = (payload.messages ?? []).map((message) => ({
          id: message.id,
          telefone_cliente: selectedPhone,
          papel: message.fromMe ? ("human" as const) : ("user" as const),
          mensagem: message.text || `[${message.messageType}]`,
          criado_em: message.createdAt ?? new Date().toISOString(),
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
  }, [selectedPhone, selectedRemoteJid]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.phone === selectedPhone) ?? leads[0],
    [selectedPhone],
  );
  const selectedContact = contacts.find((contact) => contact.telefone === selectedPhone);

  const selectedMessages = chatMessages.filter((message) => message.telefone_cliente === selectedPhone);
  const filteredContacts = contacts.filter((contact) =>
    `${contact.nome_perfil} ${contact.telefone}`.toLowerCase().includes(query.toLowerCase()),
  );

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
      setApiFeedback(`IA pausada por ${Math.round(pauseSeconds / 3600)}h.`);
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
        },
      ]);
      setDraft("");
      setApiFeedback(payload.warning ?? "Mensagem enviada. Trava de 5h aplicada no Redis.");
    } catch (error) {
      setApiFeedback(error instanceof Error ? error.message : "Falha ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-112px)] min-h-[760px] flex-col gap-4 overflow-hidden">
      <header className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
            <ShieldCheck className="h-4 w-4" />
            BeHub Omnichannel
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">Pipeline e controle da IA</h1>
          <p className="text-sm text-slate-400">
            Layout estatico preparado para Supabase, Redis e Evolution API via rotas server-side.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-right">
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
            const stageLeads = leads.filter((lead) => lead.status === stage.id);
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
                          const phone = lead.phone ?? "";
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

      <section className="grid min-h-0 flex-1 grid-cols-[280px_minmax(420px,1fr)_330px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        <aside className="flex min-h-0 flex-col border-r border-slate-800">
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
              {selectedLead.intervencao_humana ? <WifiOff className="h-4 w-4 text-rose-300" /> : <Bot className="h-4 w-4 text-emerald-300" />}
              {selectedLead.intervencao_humana ? "Atendimento humano" : "IA monitorando"}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 custom-scrollbar">
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
                      <p className="text-sm leading-6">{message.mensagem}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-800 p-3">
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
                disabled={isSending || !draft.trim()}
                className="flex h-12 items-center gap-2 rounded-lg bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar
              </button>
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-slate-800 p-4 custom-scrollbar">
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
                  TTL exibira cronometro real quando conectado ao GET da rota.
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

              {apiFeedback && (
                <p className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs text-slate-300">
                  {apiFeedback}
                </p>
              )}
            </section>

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
