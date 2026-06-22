/**
 * Re-runs geocoding for every existing business and updates its stored
 * coordinates in place. Use after correcting the gazetteer so already-saved
 * records move to the right spot on the map. Only location.lat/lng/geohash are
 * touched (lastUpdatedAt is intentionally left alone).
 *
 *   npm run regeocode
 */
import { listBusinesses } from "../store/businesses.repo.js";
import { db } from "../store/firestore.js";
import { geocode } from "../geocode/geocoder.js";
import { logger } from "../utils/logger.js";

async function main(): Promise<void> {
  const businesses = await listBusinesses({});
  logger.info({ count: businesses.length }, "Re-geocoding businesses");

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const b of businesses) {
    const geo = await geocode({
      moshav: b.location?.moshav,
      address: b.location?.address,
      raw: b.location?.raw,
    });

    if (geo.lat == null || geo.lng == null) {
      skipped += 1;
      logger.warn({ id: b.id, name: b.name, moshav: b.location?.moshav }, "No geocode result; skipped");
      continue;
    }

    const same =
      b.location?.lat != null &&
      b.location?.lng != null &&
      Math.abs(b.location.lat - geo.lat) < 1e-5 &&
      Math.abs(b.location.lng - geo.lng) < 1e-5;
    if (same) {
      unchanged += 1;
      continue;
    }

    await db()
      .collection("businesses")
      .doc(b.id!)
      .update({ "location.lat": geo.lat, "location.lng": geo.lng, "location.geohash": geo.geohash });
    updated += 1;
    logger.info(
      {
        id: b.id,
        name: b.name,
        moshav: b.location?.moshav,
        from: { lat: b.location?.lat, lng: b.location?.lng },
        to: { lat: geo.lat, lng: geo.lng },
      },
      "Updated coordinates",
    );
  }

  logger.info({ updated, unchanged, skipped }, "Re-geocode complete");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err: String(err) }, "Re-geocode failed");
    process.exit(1);
  });
