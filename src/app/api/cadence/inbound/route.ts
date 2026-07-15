import { NextResponse } from "next/server";
import { cadenceError, cadenceUnauthorized } from "@/lib/cadence-api";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = cadenceUnauthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json() as { leadId?: string; inboundAt?: string; optOut?: boolean; reason?: string };
    if (!body.leadId) return NextResponse.json({ error: "leadId obrigatorio." }, { status: 400 });
    const admin = getSupabaseAdmin();
    const { data, error } = body.optOut
      ? await admin.rpc("cadence_apply_opt_out", {
          target_lead_id: body.leadId,
          reason: body.reason ?? "Solicitou para nao receber novas mensagens",
          blocked_at: body.inboundAt ?? new Date().toISOString(),
        })
      : await admin.rpc("cadence_register_inbound", {
          target_lead_id: body.leadId,
          inbound_at: body.inboundAt ?? new Date().toISOString(),
        });
    if (error) throw error;
    return NextResponse.json({ result: data, leadId: body.leadId, blocked: Boolean(body.optOut) });
  } catch (error) {
    return cadenceError(error);
  }
}
