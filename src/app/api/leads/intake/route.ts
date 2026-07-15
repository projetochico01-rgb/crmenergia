import { NextResponse } from "next/server";
import { hasBearerToken } from "@/lib/integration-auth";
import { hashIntakePayload, parseLeadIntake } from "@/lib/lead-intake";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasBearerToken(request, "LEADS_INTAKE_TOKEN")) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length > 200) {
    return NextResponse.json({ error: "Idempotency-Key obrigatoria." }, { status: 400 });
  }

  try {
    const supabaseServer = getSupabaseAdmin();
    const payload = parseLeadIntake(await request.json());
    const requestHash = hashIntakePayload(payload);

    const { data: previous } = await supabaseServer
      .from("integration_idempotency")
      .select("request_hash,response_status,response_body")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (previous) {
      if (previous.request_hash !== requestHash) {
        return NextResponse.json({ error: "Chave de idempotencia reutilizada com outro payload." }, { status: 409 });
      }
      return NextResponse.json(previous.response_body ?? {}, { status: previous.response_status ?? 200 });
    }

    const now = new Date().toISOString();
    const leadValues = {
      name: payload.name || "Lead sem nome",
      email: payload.email || null,
      phone: payload.phone,
      value: payload.value ?? null,
      status: "novo" as const,
      origem: payload.source || "api",
      utm_source: payload.source || null,
      utm_medium: payload.medium || null,
      utm_campaign: payload.campaign || null,
      first_source: payload.source || null,
      first_medium: payload.medium || null,
      first_campaign: payload.campaign || null,
      last_source: payload.source || null,
      last_medium: payload.medium || null,
      last_campaign: payload.campaign || null,
      meta_lead_id: payload.metaLeadId || null,
      fbclid: payload.fbclid || null,
      fbc: payload.fbc || null,
      fbp: payload.fbp || null,
      consent_status: payload.consent || "unknown",
      consent_at: payload.consent === "granted" ? now : null,
      user_agent: request.headers.get("user-agent"),
      updated_at: now,
    };

    const { data: existing } = await supabaseServer
      .from("leads_pipeline")
      .select("id,first_source,first_medium,first_campaign")
      .eq("phone", payload.phone)
      .maybeSingle();

    const { data: lead, error: leadError } = existing
      ? await supabaseServer.from("leads_pipeline").update({
          ...leadValues,
          first_source: existing.first_source || leadValues.first_source,
          first_medium: existing.first_medium || leadValues.first_medium,
          first_campaign: existing.first_campaign || leadValues.first_campaign,
        }).eq("id", existing.id).select("id,name,phone,status").single()
      : await supabaseServer.from("leads_pipeline").insert(leadValues).select("id,name,phone,status").single();

    if (leadError || !lead) throw leadError ?? new Error("Lead nao retornado.");

    const { error: touchpointError } = await supabaseServer.from("lead_touchpoints").insert({
      lead_id: lead.id,
      channel: payload.source || "api",
      direction: "inbound",
      source: payload.source || null,
      medium: payload.medium || null,
      campaign: payload.campaign || null,
      external_event_id: payload.externalEventId || idempotencyKey,
      payload: payload.metadata || {},
      occurred_at: now,
    });
    if (touchpointError && touchpointError.code !== "23505") throw touchpointError;

    const responseBody = { lead, created: !existing };
    await supabaseServer.from("integration_idempotency").insert({
      idempotency_key: idempotencyKey,
      request_hash: requestHash,
      response_status: existing ? 200 : 201,
      response_body: responseBody,
    });

    return NextResponse.json(responseBody, { status: existing ? 200 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar lead.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
