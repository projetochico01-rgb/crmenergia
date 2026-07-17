import { NextResponse } from "next/server";
import { sendTextMessage } from "@/lib/evolution";
import { pauseAgent } from "@/lib/redis";
import { createAuthServerClient, getAuthenticatedUser } from "@/lib/supabase-auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const HUMAN_HANDOFF_SECONDS = 18000;

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const body = (await request.json()) as {
      telefone?: string;
      message?: string;
    };

    const telefone = body.telefone?.replace(/[^\d+]/g, "");
    const message = body.message?.trim();

    if (!telefone || !message) {
      return NextResponse.json(
        { error: "telefone and message are required." },
        { status: 400 },
      );
    }

    const digits = telefone.replace(/\D/g, "");
    const phoneCandidates = [telefone, digits, `+${digits}`];
    const authClient = await createAuthServerClient();
    const { data: lead } = await authClient.from("leads_pipeline").select("id,ai_enabled,human_handoff,cadence_status").in("phone", phoneCandidates).limit(1).maybeSingle();
    if (!lead) return NextResponse.json({ error: "Crie ou vincule um lead acessível antes de enviar a mensagem." }, { status: 403 });

    const evolutionResponse = await sendTextMessage(telefone, message);
    let redisWarning: string | null = null;

    try {
      await pauseAgent(telefone, HUMAN_HANDOFF_SECONDS);
    } catch (error) {
      redisWarning =
        error instanceof Error
          ? `Mensagem enviada, mas a IA nao foi pausada: ${error.message}`
          : "Mensagem enviada, mas a IA nao foi pausada.";
    }

    const admin = getSupabaseAdmin();
    const responseData = evolutionResponse.data as { key?: { id?: string } } | undefined;
    await Promise.all([
        admin.from("leads_pipeline").update({ ai_enabled: false, human_handoff: true, intervencao_humana: true, cadence_status: lead.cadence_status === "active" || lead.cadence_status === "waiting" ? "paused" : lead.cadence_status, last_outbound_at: new Date().toISOString(), awaiting_response: true }).eq("id", lead.id),
        admin.from("crm_messages").upsert({ lead_id: lead.id, external_message_id: responseData?.key?.id ?? null, channel: "whatsapp", direction: "outbound", sender_type: "human", body: message, media_url: null, media_type: null, metadata: { evolution_status: evolutionResponse.status, actor_user_id: user.id } }, { onConflict: "channel,external_message_id", ignoreDuplicates: true }),
        admin.from("audit_log").insert({ actor_user_id: user.id, actor_type: "user", action: "manual_message_sent", entity_type: "lead", entity_id: lead.id, before_data: { ai_enabled: lead.ai_enabled, human_handoff: lead.human_handoff, cadence_status: lead.cadence_status }, after_data: { ai_enabled: false, human_handoff: true, cadence_status: lead.cadence_status === "active" || lead.cadence_status === "waiting" ? "paused" : lead.cadence_status } }),
    ]);

    return NextResponse.json({
      ok: true,
      telefone,
      aiPausedForSeconds: redisWarning ? 0 : HUMAN_HANDOFF_SECONDS,
      evolutionStatus: evolutionResponse.status,
      warning: redisWarning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send message." },
      { status: 500 },
    );
  }
}
