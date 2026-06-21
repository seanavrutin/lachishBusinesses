import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { ingestMessage } from "./ingest.js";
import { insecureHttpsAgent } from "./tls.js";
import { isGroupJid, resolveTargetJid } from "./groupFilter.js";
import {
  getWhatsAppState,
  setConnection,
  setGroups,
  setLastError,
  setQr,
  setResolvedTargetJid,
  type GroupSummary,
} from "./state.js";

let sock: WASocket | null = null;

export function getSocket(): WASocket | null {
  return sock;
}

export async function startWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(env.WA_AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  // On TLS-intercepting networks, allow the WhatsApp socket (only) to skip cert
  // verification. Firebase/Gemini calls still use Node's normal TLS verification.
  const insecureAgent = insecureHttpsAgent();
  if (insecureAgent) {
    logger.warn(
      "WA_ALLOW_INSECURE_TLS is on: skipping TLS verification for the WhatsApp connection only. Use only on a trusted network.",
    );
  }

  // Baileys is very chatty during initial sync; route its internal logs through a
  // child logger with its own (quieter) level.
  const waLogger = logger.child({ module: "baileys" }, { level: env.BAILEYS_LOG_LEVEL });

  sock = makeWASocket({
    version,
    auth: state,
    logger: waLogger,
    // Read-only usage: we never send messages.
    markOnlineOnConnect: false,
    // Only request the full archive when explicitly asked; otherwise WhatsApp
    // sends a limited "recent" set we can optionally backfill (bounded by age).
    syncFullHistory: env.WA_SYNC_FULL_HISTORY,
    agent: insecureAgent,
    fetchAgent: insecureAgent,
  });

  sock.ev.on("creds.update", saveCreds);

  // Honor TARGET_GROUP_ID immediately; name-based resolution fills in after group fetch.
  currentTargetJid = resolveTargetJid([]);
  setResolvedTargetJid(currentTargetJid);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrcodeTerminal.generate(qr, { small: true });
      try {
        setQr(await QRCode.toDataURL(qr));
      } catch {
        setQr(null);
      }
      logger.info("Scan the QR above (or GET /api/whatsapp/qr) to link the device");
    }

    if (connection) setConnection(connection);

    if (connection === "open") {
      setQr(null);
      setLastError(null);
      logger.info("WhatsApp connection open");
      await refreshGroups();
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
        ?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const errMessage = lastDisconnect?.error?.message ?? null;
      setLastError(errMessage);
      logger.warn({ statusCode, loggedOut, err: errMessage }, "WhatsApp connection closed");

      if (loggedOut) {
        logger.error(
          "Device logged out. Delete the auth directory and re-link by scanning the QR again.",
        );
        return;
      }
      // Reconnect with a small delay/backoff.
      setTimeout(() => {
        startWhatsApp().catch((err) => logger.error({ err: String(err) }, "Reconnect failed"));
      }, 3000);
    }
  });

  // When new groups are created/joined, merge them in from the event payload
  // (no API call) so newly created groups appear without restarting or rate-limiting.
  sock.ev.on("groups.upsert", (groupsMeta) => {
    mergeGroups(groupsMeta.map((g) => ({ jid: g.id, subject: g.subject ?? "" })));
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const targetJid = resolveTargetJid([]) ?? currentTargetJid;
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (!isGroupJid(jid)) continue;
      if (targetJid && jid !== targetJid) continue;
      if (!targetJid) continue; // no target configured yet
      logger.info(
        { id: msg.key.id, fromMe: !!msg.key.fromMe },
        "Target group message received",
      );
      try {
        await ingestMessage(sock!, msg);
      } catch (err) {
        logger.error({ err: String(err), id: msg.key.id }, "Failed to ingest message");
      }
    }
  });

  if (env.INGEST_HISTORY) {
    const cutoffMs = Date.now() - env.HISTORY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    logger.info(
      { maxAgeDays: env.HISTORY_MAX_AGE_DAYS, fullHistory: env.WA_SYNC_FULL_HISTORY },
      "History backfill enabled (recent messages only)",
    );
    sock.ev.on("messaging-history.set", async ({ messages }) => {
      const targetJid = currentTargetJid ?? resolveTargetJid([]);
      let inTarget = 0;
      let ingested = 0;
      for (const msg of messages) {
        const jid = msg.key.remoteJid;
        if (!isGroupJid(jid) || !targetJid || jid !== targetJid) continue;
        inTarget += 1;
        const ts =
          (typeof msg.messageTimestamp === "number"
            ? msg.messageTimestamp
            : Number(msg.messageTimestamp)) * 1000;
        // Skip anything older than the configured window.
        if (ts && ts < cutoffMs) continue;
        try {
          await ingestMessage(sock!, msg);
          ingested += 1;
        } catch (err) {
          logger.error({ err: String(err), id: msg.key.id }, "Failed to ingest history message");
        }
      }
      logger.info(
        { batch: messages.length, targetJid, inTarget, ingested },
        "Processed history batch",
      );
    });
  }
}

let currentTargetJid: string | null = null;
let hasLoggedTarget = false;

/** Stores the group list, re-resolves the target, and logs only when it changes. */
function applyGroups(groups: GroupSummary[]): void {
  setGroups(groups);

  const resolved = resolveTargetJid(groups);
  const changed = resolved !== currentTargetJid;
  currentTargetJid = resolved;
  setResolvedTargetJid(resolved);

  if (!changed && hasLoggedTarget) return;
  hasLoggedTarget = true;

  if (resolved) {
    const match = groups.find((g) => g.jid === resolved);
    logger.info({ jid: resolved, subject: match?.subject }, "Monitoring target group");
  } else {
    logger.warn(
      "No target group resolved. Set TARGET_GROUP_ID in .env to one of the groups below:",
    );
    for (const g of groups) {
      logger.info({ jid: g.jid, subject: g.subject }, "  group");
    }
  }
}

/** Merges newly seen groups into the known list (used by the groups.upsert event). */
function mergeGroups(incoming: GroupSummary[]): void {
  const byJid = new Map<string, GroupSummary>();
  for (const g of getWhatsAppState().groups) byJid.set(g.jid, g);
  for (const g of incoming) byJid.set(g.jid, g);
  applyGroups([...byJid.values()]);
}

async function refreshGroups(): Promise<void> {
  if (!sock) return;
  try {
    const participating = await sock.groupFetchAllParticipating();
    const groups = Object.values(participating).map((g) => ({
      jid: g.id,
      subject: g.subject ?? "",
    }));
    applyGroups(groups);
  } catch (err) {
    logger.error({ err: String(err) }, "Failed to fetch participating groups");
  }
}
