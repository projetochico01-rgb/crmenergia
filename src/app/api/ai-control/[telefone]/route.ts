import { NextResponse } from "next/server";
import { getPauseKey, getPauseTtl, pauseAgent, wakeAgent } from "@/lib/redis";

type RouteContext = {
  params: Promise<{
    telefone: string;
  }>;
};

function sanitizeTelefone(value: string) {
  return decodeURIComponent(value).replace(/[^\d+]/g, "");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { telefone: rawTelefone } = await context.params;
    const telefone = sanitizeTelefone(rawTelefone);
    const ttl = await getPauseTtl(telefone);

    return NextResponse.json({
      telefone,
      key: getPauseKey(telefone),
      paused: ttl > 0,
      ttl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read AI status." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { telefone: rawTelefone } = await context.params;
    const telefone = sanitizeTelefone(rawTelefone);
    const body = (await request.json().catch(() => ({}))) as { seconds?: number };
    const seconds = Number(body.seconds ?? 18000);

    if (!Number.isFinite(seconds) || seconds <= 0) {
      return NextResponse.json({ error: "seconds must be a positive number." }, { status: 400 });
    }

    await pauseAgent(telefone, seconds);

    return NextResponse.json({
      telefone,
      key: getPauseKey(telefone),
      paused: true,
      ttl: seconds,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to pause AI." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { telefone: rawTelefone } = await context.params;
    const telefone = sanitizeTelefone(rawTelefone);
    await wakeAgent(telefone);

    return NextResponse.json({
      telefone,
      key: getPauseKey(telefone),
      paused: false,
      ttl: -2,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to wake AI." },
      { status: 500 },
    );
  }
}
