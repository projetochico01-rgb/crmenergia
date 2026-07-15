import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase-auth-server";

export async function requireApiUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  return null;
}
