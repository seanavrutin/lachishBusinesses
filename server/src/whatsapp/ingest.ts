import {
  downloadMediaMessage,
  type WAMessage,
  type WASocket,
} from "@whiskeysockets/baileys";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { uploadImage } from "../store/storage.js";
import { rawMessageExists, saveRawMessage } from "../store/rawMessages.repo.js";
import { insecureDispatcher } from "./tls.js";

type DownloadOptions = NonNullable<Parameters<typeof downloadMediaMessage>[2]>;

/** Pulls any human-readable text out of the various WhatsApp message shapes. */
export function extractText(message: WAMessage["message"]): string {
  if (!message) return "";
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    ""
  ).trim();
}

function hasImage(message: WAMessage["message"]): boolean {
  return !!message?.imageMessage;
}

/** Boom errors from Baileys carry the CDN HTTP status under output.statusCode. */
function statusOf(err: unknown): number | undefined {
  return (err as { output?: { statusCode?: number } })?.output?.statusCode;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function downloadImageBuffer(sock: WASocket, msg: WAMessage): Promise<Buffer> {
  // Media is fetched via native fetch, which (a) only honors an undici dispatcher - so on an
  // intercepting network we pass one that skips TLS verification - and (b) sends no User-Agent
  // by default, which some CDN edges reject with 403; set a browser UA to avoid that.
  const dispatcher = insecureDispatcher();
  const downloadOptions = {
    options: {
      ...(dispatcher ? { dispatcher } : {}),
      headers: { "User-Agent": BROWSER_UA },
    },
  } as unknown as DownloadOptions;
  return (await downloadMediaMessage(
    msg,
    "buffer",
    downloadOptions,
    { logger, reuploadRequest: sock.updateMediaMessage },
  )) as Buffer;
}

async function downloadAndStoreImage(sock: WASocket, msg: WAMessage): Promise<string[]> {
  if (!hasImage(msg.message)) return [];
  const mimeType = msg.message?.imageMessage?.mimetype ?? "image/jpeg";
  try {
    const buffer = await downloadImageBuffer(sock, msg);
    return [await uploadImage(buffer, mimeType)];
  } catch (err) {
    // Baileys only auto-reuploads on 404/410. A 403 (rejected auth on a fresh URL) is
    // not retried, so request a fresh re-upload from the sender device and try once more.
    logger.warn(
      { err: String(err), statusCode: statusOf(err) },
      "Image download failed; requesting media re-upload and retrying",
    );
    try {
      const refreshed = await sock.updateMediaMessage(msg);
      const buffer = await downloadImageBuffer(sock, refreshed);
      return [await uploadImage(buffer, mimeType)];
    } catch (retryErr) {
      const cause = retryErr instanceof Error && retryErr.cause ? String(retryErr.cause) : undefined;
      logger.error(
        { err: String(retryErr), cause, statusCode: statusOf(retryErr) },
        "Failed to download/store image (after re-upload retry)",
      );
      return [];
    }
  }
}

/**
 * Persists an incoming group message as a `raw_messages` doc (status=pending).
 * Ingestion is intentionally minimal so nothing is lost; extraction happens later.
 */
export async function ingestMessage(sock: WASocket, msg: WAMessage): Promise<void> {
  const groupId = msg.key.remoteJid;
  const id = msg.key.id;
  if (!groupId || !id) return;
  if (msg.key.fromMe && !env.INGEST_FROM_ME) return;

  // Skip if we've already stored this message (e.g. history + live overlap).
  if (await rawMessageExists(id)) return;

  const text = extractText(msg.message);
  const imagePaths = await downloadAndStoreImage(sock, msg);

  // Nothing usable to extract from.
  if (!text && imagePaths.length === 0) return;

  const waTimestamp =
    (typeof msg.messageTimestamp === "number"
      ? msg.messageTimestamp
      : Number(msg.messageTimestamp)) * 1000 || Date.now();

  await saveRawMessage(id, {
    groupId,
    sender: msg.key.participant ?? undefined,
    text,
    imagePaths,
    waTimestamp,
    status: "pending",
    attempts: 0,
  });

  logger.info({ id, hasText: !!text, images: imagePaths.length }, "Ingested group message");
}
