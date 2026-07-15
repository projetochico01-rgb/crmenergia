import { NextResponse } from "next/server";
import { fetchEvolutionMessages } from "@/lib/evolution";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = new URL(request.url);
    const remoteJid = searchParams.get("remoteJid");

    if (!remoteJid) {
      return NextResponse.json({ error: "remoteJid is required." }, { status: 400 });
    }

    const messages = await fetchEvolutionMessages(remoteJid);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch Evolution messages." },
      { status: 500 },
    );
  }
}
