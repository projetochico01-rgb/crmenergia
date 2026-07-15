import { NextResponse } from "next/server";
import { sendTextMessage } from "@/lib/evolution";
import { pauseAgent } from "@/lib/redis";
import { requireApiUser } from "@/lib/api-auth";

const HUMAN_HANDOFF_SECONDS = 18000;

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      telefone?: string;
      message?: string;
    };

    const telefone = body.telefone?.replace(/[^\d+]/g, "");
    const message = body.message?.trim();

    if (!telefone || !message) {
      return NextResponse.json(
        { error: "telefone and message are required." },
        { status: 400 },
      );
    }

    const evolutionResponse = await sendTextMessage(telefone, message);
    let redisWarning: string | null = null;

    try {
      await pauseAgent(telefone, HUMAN_HANDOFF_SECONDS);
    } catch (error) {
      redisWarning =
        error instanceof Error
          ? `Mensagem enviada, mas a IA nao foi pausada: ${error.message}`
          : "Mensagem enviada, mas a IA nao foi pausada.";
    }

    return NextResponse.json({
      ok: true,
      telefone,
      aiPausedForSeconds: redisWarning ? 0 : HUMAN_HANDOFF_SECONDS,
      evolutionStatus: evolutionResponse.status,
      warning: redisWarning,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send message." },
      { status: 500 },
    );
  }
}
