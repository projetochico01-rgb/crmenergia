import "server-only";

import { timingSafeEqual } from "node:crypto";

export function hasBearerToken(request: Request, environmentVariable: string) {
  const configured = process.env[environmentVariable];
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (!configured || configured.length < 24 || configured.length !== supplied.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(configured), Buffer.from(supplied));
}
