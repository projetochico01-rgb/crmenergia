import "server-only";

import Redis from "ioredis";
import * as httpControl from "./ai-control";

const redisUrl = process.env.REDIS_URL;
const useHttpBridge = Boolean(process.env.AI_CONTROL_API_URL);

let redisClient: Redis | null = null;

export function getRedis() {
  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured.");
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 0,
      enableOfflineQueue: false,
      enableReadyCheck: true,
    });
  }

  return redisClient;
}

export function getPauseKey(telefone: string) {
  return `pause_agent_${telefone}`;
}

export async function getPauseTtl(telefone: string): Promise<number> {
  if (useHttpBridge) {
    return httpControl.getPauseTtl(telefone);
  }
  const redis = getRedis();
  return redis.ttl(getPauseKey(telefone));
}

export async function pauseAgent(telefone: string, seconds: number): Promise<void> {
  if (useHttpBridge) {
    await httpControl.pauseAgent(telefone, seconds);
    return;
  }
  const redis = getRedis();
  await redis.set(getPauseKey(telefone), "true", "EX", seconds);
}

export async function wakeAgent(telefone: string): Promise<void> {
  if (useHttpBridge) {
    await httpControl.wakeAgent(telefone);
    return;
  }
  const redis = getRedis();
  await redis.del(getPauseKey(telefone));
}
