import "server-only";

import axios from "axios";

const baseURL = process.env.EVOLUTION_API_URL;
const apiKey = process.env.EVOLUTION_API_KEY;
const instance = process.env.EVOLUTION_INSTANCE;

if (!baseURL || !apiKey || !instance) {
  console.warn("Evolution API environment variables are not fully configured.");
}

export const evolution = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    apikey: apiKey,
  },
});

export async function sendTextMessage(telefone: string, text: string) {
  if (!instance) {
    throw new Error("EVOLUTION_INSTANCE is not configured.");
  }

  return evolution.post(`/message/sendText/${instance}`, {
    number: telefone,
    text,
  });
}

type EvolutionMessagePayload = Record<string, unknown> & {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; url?: string; mimetype?: string };
  videoMessage?: { caption?: string; url?: string; mimetype?: string };
  audioMessage?: { seconds?: number; url?: string; mimetype?: string };
  documentMessage?: { title?: string; fileName?: string; caption?: string; url?: string; mimetype?: string };
  stickerMessage?: Record<string, unknown>;
  templateMessage?: {
    hydratedTemplate?: { hydratedContentText?: string };
    interactiveMessageTemplate?: { body?: { text?: string } };
  };
};

type EvolutionMessageRecord = {
  id?: string;
  key?: {
    id?: string;
    fromMe?: boolean;
    remoteJid?: string;
    remoteJidAlt?: string;
  };
  pushName?: string | null;
  messageType?: string;
  message?: EvolutionMessagePayload;
  messageTimestamp?: number;
  status?: string;
};

type EvolutionChatRecord = {
  id?: string | null;
  remoteJid: string;
  pushName?: string | null;
  profilePicUrl?: string | null;
  updatedAt?: string | null;
  lastMessage?: EvolutionMessageRecord | null;
  unreadCount?: number | null;
  isSaved?: boolean;
};

function getTextFromMessage(message?: EvolutionMessagePayload, type?: string) {
  if (!message) return type ? `[${type}]` : "";

  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    message.documentMessage?.title ??
    message.documentMessage?.fileName ??
    message.templateMessage?.hydratedTemplate?.hydratedContentText ??
    message.templateMessage?.interactiveMessageTemplate?.body?.text ??
    (message.audioMessage ? `[audio ${message.audioMessage.seconds ?? ""}s]` : undefined) ??
    (message.stickerMessage ? "[figurinha]" : undefined) ??
    (type ? `[${type}]` : "")
  );
}

function timestampToIso(timestamp?: number) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

export async function fetchEvolutionChats() {
  if (!instance) {
    throw new Error("EVOLUTION_INSTANCE is not configured.");
  }

  const { data } = await evolution.post<EvolutionChatRecord[] | { value?: EvolutionChatRecord[] }>(
    `/chat/findChats/${instance}`,
    {},
  );

  const records = Array.isArray(data) ? data : data.value ?? [];

  return records
    .filter((chat) => chat.remoteJid && !chat.remoteJid.endsWith("@g.us"))
    .map((chat) => {
      const displayJid = chat.lastMessage?.key?.remoteJidAlt ?? chat.remoteJid;
      const lastPushName = chat.lastMessage?.key?.fromMe ? null : chat.lastMessage?.pushName;

      return {
        id: chat.id ?? chat.remoteJid,
        remoteJid: chat.remoteJid,
        displayJid,
        name: chat.pushName || lastPushName || displayJid.split("@")[0] || chat.remoteJid,
        profilePicUrl: chat.profilePicUrl ?? null,
        updatedAt: chat.updatedAt ?? timestampToIso(chat.lastMessage?.messageTimestamp),
        unreadCount: chat.unreadCount ?? 0,
        lastMessage: getTextFromMessage(chat.lastMessage?.message, chat.lastMessage?.messageType),
        fromMe: Boolean(chat.lastMessage?.key?.fromMe),
        isSaved: Boolean(chat.isSaved),
      };
    })
    .sort((a, b) => {
      const left = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const right = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return right - left;
    });
}

export async function fetchEvolutionMessages(remoteJid: string, limit = 40) {
  if (!instance) {
    throw new Error("EVOLUTION_INSTANCE is not configured.");
  }

  const { data } = await evolution.post<{
    messages?: { records?: EvolutionMessageRecord[] };
  }>(`/chat/findMessages/${instance}`, {
    where: {
      key: {
        remoteJid,
      },
    },
    limit: Math.min(Math.max(limit, 20), 200),
  });

  return (data.messages?.records ?? [])
    .map((message) => ({
      id: message.id ?? message.key?.id ?? crypto.randomUUID(),
      remoteJid: message.key?.remoteJid ?? remoteJid,
      fromMe: Boolean(message.key?.fromMe),
      pushName: message.pushName ?? null,
      text: getTextFromMessage(message.message, message.messageType),
      messageType: message.messageType ?? "unknown",
      status: message.status ?? (message.key?.fromMe ? "sent" : "received"),
      mediaUrl: message.message?.imageMessage?.url ?? message.message?.videoMessage?.url ?? message.message?.audioMessage?.url ?? message.message?.documentMessage?.url ?? null,
      mediaMimeType: message.message?.imageMessage?.mimetype ?? message.message?.videoMessage?.mimetype ?? message.message?.audioMessage?.mimetype ?? message.message?.documentMessage?.mimetype ?? null,
      createdAt: timestampToIso(message.messageTimestamp),
    }))
    .sort((a, b) => {
      const left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return left - right;
    });
}
