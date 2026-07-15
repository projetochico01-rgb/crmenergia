import { createHash } from "node:crypto";

export type LeadIntakePayload = {
  name?: string;
  email?: string;
  phone: string;
  source?: string;
  medium?: string;
  campaign?: string;
  metaLeadId?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  consent?: "unknown" | "granted" | "denied";
  externalEventId?: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

export function normalizeBrazilianPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) throw new Error("Telefone obrigatorio.");

  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  if (withCountry.length < 12 || withCountry.length > 13) {
    throw new Error("Telefone brasileiro invalido.");
  }

  return `+${withCountry}`;
}

export function hashIntakePayload(payload: LeadIntakePayload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function parseLeadIntake(value: unknown): LeadIntakePayload {
  if (!value || typeof value !== "object") throw new Error("Payload JSON invalido.");
  const body = value as Record<string, unknown>;
  if (typeof body.phone !== "string") throw new Error("Telefone obrigatorio.");

  const consent = body.consent;
  if (consent !== undefined && !["unknown", "granted", "denied"].includes(String(consent))) {
    throw new Error("Consentimento invalido.");
  }

  return {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    email: typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined,
    phone: normalizeBrazilianPhone(body.phone),
    source: typeof body.source === "string" ? body.source.trim() : "api",
    medium: typeof body.medium === "string" ? body.medium.trim() : undefined,
    campaign: typeof body.campaign === "string" ? body.campaign.trim() : undefined,
    metaLeadId: typeof body.metaLeadId === "string" ? body.metaLeadId : undefined,
    fbclid: typeof body.fbclid === "string" ? body.fbclid : undefined,
    fbc: typeof body.fbc === "string" ? body.fbc : undefined,
    fbp: typeof body.fbp === "string" ? body.fbp : undefined,
    consent: consent as LeadIntakePayload["consent"],
    externalEventId: typeof body.externalEventId === "string" ? body.externalEventId : undefined,
    value: typeof body.value === "number" && Number.isFinite(body.value) ? body.value : undefined,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata as Record<string, unknown> : {},
  };
}
