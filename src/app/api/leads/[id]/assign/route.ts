import { NextResponse } from "next/server";
import { createAuthServerClient, getAuthenticatedUser } from "@/lib/supabase-auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { canAssignLead } from "@/lib/crm-rules";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: RouteContext<"/api/leads/[id]/assign">) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { assignedUserId?: string | null } | null;
  if (!body || !("assignedUserId" in body)) {
    return NextResponse.json({ error: "Responsavel invalido." }, { status: 400 });
  }

  const assignedUserId = body.assignedUserId || null;
  const authClient = await createAuthServerClient();
  const [{ data: before, error: beforeError }, { data: profile }] = await Promise.all([
    authClient.from("leads_pipeline").select("id,name,assigned_user_id").eq("id", id).single(),
    authClient.from("crm_user_profiles").select("role,active").eq("user_id", user.id).maybeSingle(),
  ]);

  if (beforeError || !before) {
    return NextResponse.json({ error: "Lead nao encontrado ou sem permissao." }, { status: 404 });
  }
  if (!profile?.active || !canAssignLead(profile.role, user.id, before.assigned_user_id ?? null, assignedUserId)) {
    return NextResponse.json({ error: "Transferência não permitida para este perfil." }, { status: 403 });
  }

  if (assignedUserId) {
    const { data: target } = await authClient
      .from("crm_user_profiles")
      .select("user_id,active")
      .eq("user_id", assignedUserId)
      .eq("active", true)
      .maybeSingle();
    if (!target) return NextResponse.json({ error: "Responsavel inativo ou inexistente." }, { status: 400 });
  }

  const { data: updated, error: updateError } = await authClient
    .from("leads_pipeline")
    .update({ assigned_user_id: assignedUserId })
    .eq("id", id)
    .select("id,name,assigned_user_id")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Transferencia nao permitida." }, { status: 403 });
  }

  const admin = getSupabaseAdmin();
  const { error: auditError } = await admin.from("audit_log").insert({
    actor_user_id: user.id,
    actor_type: "user",
    action: before.assigned_user_id ? (assignedUserId ? "lead_transferred" : "lead_released") : "lead_assigned",
    entity_type: "lead",
    entity_id: id,
    before_data: { assigned_user_id: before.assigned_user_id },
    after_data: { assigned_user_id: assignedUserId },
  });

  return NextResponse.json({ lead: updated, warning: auditError ? "Responsavel alterado, mas a auditoria falhou." : null });
}
