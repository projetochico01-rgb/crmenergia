import { NextResponse } from "next/server";
import { cadenceError, cadenceUnauthorized } from "@/lib/cadence-api";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = cadenceUnauthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json() as { leadId?: string; outboundAt?: string };
    if (!body.leadId) return NextResponse.json({ error: "leadId obrigatorio." }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().rpc("cadence_start_for_lead", {
      target_lead_id: body.leadId,
      outbound_at: body.outboundAt ?? new Date().toISOString(),
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return cadenceError(error);
  }
}
