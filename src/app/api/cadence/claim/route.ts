import { NextResponse } from "next/server";
import { cadenceError, cadenceUnauthorized } from "@/lib/cadence-api";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = cadenceUnauthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json() as { worker?: string; limit?: number };
    const limit = Math.max(1, Math.min(Number(body.limit) || 20, 100));
    const { data, error } = await getSupabaseAdmin().rpc("cadence_claim_due", {
      worker_name: body.worker?.trim() || "n8n-diana-cadence",
      batch_size: limit,
    });
    if (error) throw error;
    return NextResponse.json({ attempts: data ?? [] });
  } catch (error) {
    return cadenceError(error);
  }
}
