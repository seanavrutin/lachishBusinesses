import { Agent as HttpsAgent } from "node:https";
import { Agent as UndiciAgent } from "undici";
import { env } from "../config/env.js";

let httpsAgent: HttpsAgent | undefined;
let dispatcher: UndiciAgent | undefined;

/**
 * https.Agent used by the WhatsApp WebSocket. When WA_ALLOW_INSECURE_TLS is on we
 * skip cert verification so the socket survives a TLS-intercepting proxy/AV.
 */
export function insecureHttpsAgent(): HttpsAgent | undefined {
  if (!env.WA_ALLOW_INSECURE_TLS) return undefined;
  httpsAgent ??= new HttpsAgent({ rejectUnauthorized: false });
  return httpsAgent;
}

/**
 * undici dispatcher for media downloads. Baileys downloads media via native fetch,
 * which ignores plain https.Agents and only honors an undici-style dispatcher, so a
 * separate object is needed to skip cert verification on an intercepting network.
 */
export function insecureDispatcher(): UndiciAgent | undefined {
  if (!env.WA_ALLOW_INSECURE_TLS) return undefined;
  dispatcher ??= new UndiciAgent({ connect: { rejectUnauthorized: false } });
  return dispatcher;
}
