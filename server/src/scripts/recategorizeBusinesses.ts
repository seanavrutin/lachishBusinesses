/**
 * One-off cleanup: re-classifies every existing business into 1-2 consistent
 * categories using Gemini against a controlled vocabulary, collapsing a sprawling
 * set of ad-hoc tags into a small, shared one.
 *
 * The vocabulary is built from the categories you already use a lot (>= --min uses)
 * plus the curated seed list - one-off oddities are intentionally left OUT so the
 * model is pushed to map them onto a canonical category.
 *
 *   npm run recategorize                 # dry run: shows proposed changes, writes nothing
 *   npm run recategorize -- --apply      # actually update Firestore
 *   npm run recategorize -- --apply --min=3 --top=30
 *
 * Only the `categories` field is touched.
 */
import { listBusinesses, listCategoryCounts, updateBusiness } from "../store/businesses.repo.js";
import {
  SEED_CATEGORIES,
  canonicalizeCategories,
  normalizeCategory,
} from "../extraction/categories.js";
import { categorizeBusiness } from "../extraction/gemini.js";
import { logger } from "../utils/logger.js";

function numArg(prefix: string, fallback: number): number {
  const hit = process.argv.slice(2).find((a) => a.startsWith(prefix));
  const n = hit ? Number(hit.slice(prefix.length)) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Controlled vocabulary: frequently-used existing categories + curated seeds. */
async function buildVocabulary(minUses: number, topN: number): Promise<string[]> {
  const counts = await listCategoryCounts();
  const frequent = [...counts.entries()]
    .filter(([, n]) => n >= minUses)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([c]) => c);

  // De-dupe by normalized form, keeping the first (most common) spelling.
  const byNorm = new Map<string, string>();
  for (const c of [...frequent, ...SEED_CATEGORIES]) {
    const norm = normalizeCategory(c);
    if (norm && !byNorm.has(norm)) byNorm.set(norm, c.trim());
  }
  return [...byNorm.values()];
}

function sameCategories(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const na = a.map(normalizeCategory).sort();
  const nb = b.map(normalizeCategory).sort();
  return na.every((v, i) => v === nb[i]);
}

async function main(): Promise<void> {
  const apply = process.argv.slice(2).includes("--apply");
  const minUses = numArg("--min=", 2);
  const topN = numArg("--top=", 25);
  const delayMs = numArg("--delay=", 250);

  const vocabulary = await buildVocabulary(minUses, topN);
  const businesses = await listBusinesses({});
  logger.info(
    { count: businesses.length, vocabularySize: vocabulary.length, minUses, topN, apply },
    apply ? "Re-categorizing businesses (APPLY)" : "Re-categorizing businesses (dry run)",
  );
  console.log("\nVocabulary:\n  " + vocabulary.join(" | ") + "\n");

  let changed = 0;
  let unchanged = 0;
  let failed = 0;

  for (const b of businesses) {
    try {
      const suggested = await categorizeBusiness({
        name: b.name,
        description: b.description,
        text: b.lastRawText,
        current: b.categories,
        vocabulary,
      });
      const next = canonicalizeCategories(suggested, vocabulary);

      if (next.length === 0) {
        // Model gave us nothing usable; leave the record untouched.
        unchanged += 1;
        logger.warn({ id: b.id, name: b.name, current: b.categories }, "No categories suggested; kept as-is");
      } else if (sameCategories(next, b.categories ?? [])) {
        unchanged += 1;
      } else {
        changed += 1;
        console.log(`• ${b.name}: [${(b.categories ?? []).join(", ")}] -> [${next.join(", ")}]`);
        if (apply) await updateBusiness(b.id!, { categories: next });
      }
    } catch (err) {
      failed += 1;
      logger.error({ id: b.id, name: b.name, err: String(err) }, "Re-categorize failed for business");
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  logger.info(
    { changed, unchanged, failed, applied: apply },
    apply ? "Re-categorize complete" : "Re-categorize dry run complete (use --apply to write)",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err: String(err) }, "Re-categorize failed");
    process.exit(1);
  });
