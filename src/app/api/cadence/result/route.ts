import { NextResponse } from "next/server";
import { cadenceError, cadenceUnauthorized } from "@/lib/cadence-api";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const unauthorized = cadenceUnauthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json() as { attemptId?: string; success?: boolean; messageId?: string; error?: string; occurredAt?: string };
    if (!body.attemptId || typeof body.success !== "boolean") {
      return NextResponse.json({ error: "attemptId e success sao obrigatorios." }, { status: 400 });
    }
    const admin = getSupabaseAdmin();
    const occurredAt = body.occurredAt ?? new Date().toISOString();
    const result = body.success
      ? await admin.rpc("cadence_complete_attempt", {
          target_attempt_id: body.attemptId,
          message_id: body.messageId ?? "",
          completed_at: occurredAt,
        })
      : await admin.rpc("cadence_fail_attempt", {
          target_attempt_id: body.attemptId,
          failure_message: body.error ?? "Falha nao especificada pelo worker",
          failed_at: occurredAt,
        });
    if (result.error) throw result.error;
    return NextResponse.json(result.data);
  } catch (error) {
    return cadenceError(error);
  }
}
