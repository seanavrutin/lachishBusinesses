/**
 * Rebuilds the `recentPosts` history for every existing business from the
 * `raw_messages` already stored for it. Use this once after deploying the
 * recent-posts feature so businesses show their real post history instead of
 * just the latest post. Safe to re-run; it overwrites recentPosts each time.
 *
 *   npm run backfill:posts
 */
import { listBusinesses, updateBusiness } from "../store/businesses.repo.js";
import { findByBusinessId } from "../store/rawMessages.repo.js";
import type { RecentPost } from "../types/index.js";
import { logger } from "../utils/logger.js";

const MAX_RECENT_POSTS = 5;

async function main(): Promise<void> {
  const businesses = await listBusinesses({});
  logger.info({ count: businesses.length }, "Backfilling recent posts");

  let updated = 0;
  let empty = 0;

  for (const b of businesses) {
    const messages = await findByBusinessId(b.id!);
    const recentPosts: RecentPost[] = messages
      .filter((m) => (m.text && m.text.trim()) || (m.imagePaths ?? []).length > 0)
      .sort((a, b2) => b2.waTimestamp - a.waTimestamp)
      .slice(0, MAX_RECENT_POSTS)
      .map((m) => ({
        text: m.text || undefined,
        images: m.imagePaths ?? [],
        postedAt: new Date(m.waTimestamp),
        sourceMessageId: m.id,
      }));

    if (recentPosts.length === 0) {
      empty += 1;
      logger.warn({ id: b.id, name: b.name }, "No source messages found; left unchanged");
      continue;
    }

    await updateBusiness(b.id!, { recentPosts });
    updated += 1;
    logger.info({ id: b.id, name: b.name, posts: recentPosts.length }, "Backfilled recent posts");
  }

  logger.info({ updated, empty }, "Backfill complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err: String(err) }, "Backfill failed");
    process.exit(1);
  });
