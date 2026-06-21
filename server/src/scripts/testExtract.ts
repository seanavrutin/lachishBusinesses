import { readFile } from "node:fs/promises";
import { env } from "../config/env.js";
import { extractBusiness } from "../extraction/gemini.js";
import { geocode } from "../geocode/geocoder.js";
import { mimeForPath } from "../store/storage.js";

/**
 * Validates the extraction pipeline without WhatsApp.
 *
 *   npm run test:extract                       # uses the built-in sample post
 *   npm run test:extract -- --text="..."       # your own text
 *   npm run test:extract -- --image=./flyer.jpg
 *   npm run test:extract -- --save             # also write the result to Firestore
 */
const SAMPLE_TEXT = [
  "מאפיית הבוקר במושב נהורה!",
  "לחם מחמצת טרי, חלות לשבת ומאפים מתוקים.",
  "פתוח ימים א'-ה' 7:00-13:00 וגם 16:00-19:00, יום שישי 6:00-13:00.",
  "להזמנות: 050-1234567",
].join("\n");

function argValue(prefix: string): string | undefined {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main(): Promise<void> {
  const save = process.argv.slice(2).includes("--save");
  const imagePath = argValue("--image=");
  const text = argValue("--text=") ?? SAMPLE_TEXT;

  const images: { data: Buffer; mimeType: string }[] = [];
  if (imagePath) {
    images.push({ data: await readFile(imagePath), mimeType: mimeForPath(imagePath) });
  }

  console.log("\n--- INPUT ---");
  console.log(text);
  if (imagePath) console.log(`[image] ${imagePath}`);

  console.log("\nCalling Gemini (" + env.GEMINI_MODEL + ")...");
  const extraction = await extractBusiness({ text, images });
  console.log("\n--- EXTRACTION ---");
  console.log(JSON.stringify(extraction, null, 2));

  const geo = await geocode({
    moshav: extraction.location.moshav ?? undefined,
    address: extraction.location.address ?? undefined,
    raw: extraction.location.raw ?? undefined,
  });
  console.log("\n--- GEOCODE ---");
  console.log(JSON.stringify(geo, null, 2));

  if (save) {
    const { createBusiness } = await import("../store/businesses.repo.js");
    const id = await createBusiness({
      name: extraction.name ?? "(test)",
      categories: extraction.categories ?? [],
      description: extraction.description ?? undefined,
      openingHours: extraction.openingHoursRaw ?? undefined,
      phone: extraction.phone ?? undefined,
      location: {
        raw: extraction.location.raw ?? undefined,
        moshav: extraction.location.moshav ?? undefined,
        address: extraction.location.address ?? undefined,
        lat: geo.lat,
        lng: geo.lng,
        geohash: geo.geohash,
      },
      images: [],
      lastRawText: text,
      sourceGroupId: "test",
      lastSourceMessageId: `test-${Date.now()}`,
      lastPostedAt: new Date(),
      extractionConfidence: extraction.confidence,
      status: extraction.confidence < env.MIN_CONFIDENCE ? "needs_review" : "active",
    });
    console.log(`\nSaved business ${id} (visible at GET /api/businesses)`);
  } else {
    console.log("\n(dry run - nothing saved. Add --save to write it to Firestore.)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
