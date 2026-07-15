import { NextResponse } from "next/server";
import { fetchEvolutionChats } from "@/lib/evolution";
import { requireApiUser } from "@/lib/api-auth";

export async function GET() {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;

  try {
    const chats = await fetchEvolutionChats();
    return NextResponse.json({ chats });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch Evolution chats." },
      { status: 500 },
    );
  }
}
