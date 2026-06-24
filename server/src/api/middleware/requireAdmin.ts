import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";

/** Constant-time string compare that doesn't leak length via early return. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Gates write endpoints behind the shared ADMIN_TOKEN. The UI sends it as the
 * `x-admin-token` header. If ADMIN_TOKEN is unset, writes are disabled entirely.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!env.ADMIN_TOKEN) {
    res.status(503).json({ error: "admin disabled" });
    return;
  }
  const header = req.header("x-admin-token") ?? "";
  if (!header || !safeEqual(header, env.ADMIN_TOKEN)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
