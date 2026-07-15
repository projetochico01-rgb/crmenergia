import { NextResponse } from "next/server";
import { fetchEvolutionChats } from "@/lib/evolution";

export async function GET() {
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
