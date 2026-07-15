import "server-only";

import { NextResponse } from "next/server";
import { hasBearerToken } from "@/lib/integration-auth";

export function cadenceUnauthorized(request: Request) {
  if (hasBearerToken(request, "N8N_CADENCE_TOKEN")) return null;
  return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
}

export function cadenceError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha na operacao de cadencia.";
  return NextResponse.json({ error: message }, { status: 400 });
}
