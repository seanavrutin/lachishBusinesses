import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { extractBusiness } from "../extraction/gemini.js";
import type { BusinessExtraction } from "../extraction/schema.js";
import { geocode } from "../geocode/geocoder.js";
import {
  createBusiness,
  getBusiness,
  updateBusiness,
} from "../store/businesses.repo.js";
import { fetchProcessable, updateRawMessage } from "../store/rawMessages.repo.js";
import { downloadImage, mimeForPath } from "../store/storage.js";
import type { Business, RawMessage, RecentPost } from "../types/index.js";
import { findMatch } from "./dedupe.js";

const MAX_RECENT_POSTS = 5;

let running = false;

export function startWorker(): void {
  if (running) return;
  running = true;
  logger.info(
    { intervalMs: env.WORKER_POLL_INTERVAL_MS, batch: env.WORKER_BATCH_SIZE },
    "Extraction worker started",
  );
  void tick();
}

async function tick(): Promise<void> {
  try {
    const pending = await fetchProcessable(env.WORKER_BATCH_SIZE);
    for (const message of pending) {
      await processOne(message);
    }
  } catch (err) {
    logger.error({ err: String(err) }, "Worker tick failed");
  } finally {
    setTimeout(() => void tick(), env.WORKER_POLL_INTERVAL_MS);
  }
}

function backoffMs(attempts: number): number {
  // 30s, 60s, 120s, 240s, ... capped at 30 min.
  return Math.min(30_000 * 2 ** (attempts - 1), 30 * 60_000);
}

async function processOne(message: RawMessage): Promise<void> {
  const id = message.id!;
  await updateRawMessage(id, { status: "processing" });

  try {
    logger.debug(
      {
        id,
        groupId: message.groupId,
        text: message.text,
        imagePaths: message.imagePaths,
        waTimestamp: message.waTimestamp,
        postedAt: new Date(message.waTimestamp).toISOString(),
      },
      "Processing raw message",
    );

    const images: { data: Buffer; mimeType: string }[] = [];
    for (const path of message.imagePaths ?? []) {
      const data = await downloadImage(path);
      images.push({ data, mimeType: mimeForPath(path) });
    }

    const extraction = await extractBusiness({ text: message.text, images });

    if (!extraction.isBusiness || !extraction.name) {
      await updateRawMessage(id, { status: "done", error: "not a business listing" });
      logger.info({ id }, "Message skipped (not a business)");
      return;
    }

    const moshav = extraction.location.moshav ?? undefined;
    const geo = await geocode({
      moshav,
      address: extraction.location.address ?? undefined,
      raw: extraction.location.raw ?? undefined,
    });

    const match = await findMatch(extraction, moshav);
    logger.debug(
      { id, geo, matchId: match?.id, matchName: match?.name, openingHours: extraction.openingHoursRaw },
      "Resolved geocode + dedupe",
    );
    const businessId = match
      ? await applyUpdate(match.id!, extraction, geo, message)
      : await createNew(extraction, geo, message);

    await updateRawMessage(id, { status: "done", businessId, error: undefined });
    logger.info({ id, businessId, updated: !!match }, "Processed business");
  } catch (err) {
    const attempts = (message.attempts ?? 0) + 1;
    const errorText = err instanceof Error ? err.message : String(err);
    if (attempts >= env.WORKER_MAX_ATTEMPTS) {
      await updateRawMessage(id, { status: "failed", attempts, error: errorText });
      logger.error({ id, attempts, err: errorText }, "Message failed permanently");
    } else {
      await updateRawMessage(id, {
        status: "pending",
        attempts,
        nextAttemptAt: Date.now() + backoffMs(attempts),
        error: errorText,
      });
      logger.warn({ id, attempts, err: errorText }, "Message will be retried");
    }
  }
}

function toMillis(value: FirebaseFirestore.Timestamp | Date | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as FirebaseFirestore.Timestamp).toMillis === "function") {
    return (value as FirebaseFirestore.Timestamp).toMillis();
  }
  return 0;
}

function postFromMessage(message: RawMessage): RecentPost {
  return {
    text: message.text || undefined,
    images: message.imagePaths ?? [],
    postedAt: new Date(message.waTimestamp),
    sourceMessageId: message.id,
  };
}

/**
 * Recover a single history entry from a legacy business that predates recentPosts,
 * so the first update after this change doesn't lose the previously stored post.
 */
function seedFromLegacy(existing: Business | null): RecentPost[] {
  if (!existing || existing.recentPosts?.length) return existing?.recentPosts ?? [];
  if (!existing.lastRawText && !(existing.images?.length)) return [];
  return [
    {
      text: existing.lastRawText || undefined,
      images: existing.images ?? [],
      postedAt: existing.lastPostedAt ?? existing.lastUpdatedAt ?? new Date(0),
      sourceMessageId: existing.lastSourceMessageId,
    },
  ];
}

/** Prepends the new post, de-dupes by source message, and keeps the newest few. */
function mergeRecentPosts(existing: RecentPost[], post: RecentPost): RecentPost[] {
  const deduped = existing.filter(
    (p) => !post.sourceMessageId || p.sourceMessageId !== post.sourceMessageId,
  );
  return [post, ...deduped]
    .sort((a, b) => toMillis(b.postedAt) - toMillis(a.postedAt))
    .slice(0, MAX_RECENT_POSTS);
}

function buildLocation(extraction: BusinessExtraction, geo: Awaited<ReturnType<typeof geocode>>) {
  return {
    raw: extraction.location.raw ?? undefined,
    moshav: extraction.location.moshav ?? undefined,
    address: extraction.location.address ?? undefined,
    lat: geo.lat,
    lng: geo.lng,
    geohash: geo.geohash,
  };
}

async function createNew(
  extraction: BusinessExtraction,
  geo: Awaited<ReturnType<typeof geocode>>,
  message: RawMessage,
): Promise<string> {
  const data: Omit<Business, "id" | "firstSeenAt" | "lastUpdatedAt"> = {
    name: extraction.name!,
    categories: extraction.categories ?? [],
    description: extraction.description ?? undefined,
    openingHours: extraction.openingHoursRaw ?? undefined,
    phone: extraction.phone ?? undefined,
    location: buildLocation(extraction, geo),
    images: message.imagePaths ?? [],
    lastRawText: message.text || undefined,
    recentPosts: [postFromMessage(message)],
    sourceGroupId: message.groupId,
    lastSourceMessageId: message.id,
    lastPostedAt: new Date(message.waTimestamp),
    extractionConfidence: extraction.confidence,
    status: extraction.confidence < env.MIN_CONFIDENCE ? "needs_review" : "active",
  };
  logger.debug({ data }, "Creating new business");
  return createBusiness(data);
}

async function applyUpdate(
  businessId: string,
  extraction: BusinessExtraction,
  geo: Awaited<ReturnType<typeof geocode>>,
  message: RawMessage,
): Promise<string> {
  const existing = await getBusiness(businessId);

  const patch: Partial<Business> = {
    name: extraction.name!,
    categories: extraction.categories?.length ? extraction.categories : existing?.categories ?? [],
    location: buildLocation(extraction, geo),
    lastSourceMessageId: message.id,
    lastPostedAt: new Date(message.waTimestamp),
    extractionConfidence: extraction.confidence,
    status: extraction.confidence < env.MIN_CONFIDENCE ? "needs_review" : "active",
  };
  // Replace the stored image(s) with the latest post's, only if it had any.
  if ((message.imagePaths ?? []).length > 0) patch.images = message.imagePaths;
  // Keep the latest post's raw text, if present.
  if (message.text) patch.lastRawText = message.text;
  patch.recentPosts = mergeRecentPosts(seedFromLegacy(existing), postFromMessage(message));
  if (extraction.description) patch.description = extraction.description;
  if (extraction.openingHoursRaw) patch.openingHours = extraction.openingHoursRaw;
  if (extraction.phone) patch.phone = extraction.phone;

  logger.debug({ businessId, patch }, "Updating existing business");
  await updateBusiness(businessId, patch);
  return businessId;
}
