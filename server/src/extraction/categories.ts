import { logger } from "../utils/logger.js";
import { listCategoryCounts } from "../store/businesses.repo.js";

/** Hard cap on how many categories a single business may keep. */
export const MAX_CATEGORIES = 2;

/**
 * Curated canonical categories. They seed the "known categories" list so early /
 * sparse data still converges on consistent tags, and their wording is chosen to
 * match the client's icon keyword rules (see client/src/lib/categories.ts).
 * Existing categories from the DB always take priority over these.
 */
export const SEED_CATEGORIES: string[] = [
  "מאפייה",
  "מסעדה",
  "בית קפה",
  "יקב",
  "מכולת",
  "חנות",
  "חקלאות",
  "משק חקלאי",
  "מספרה",
  "קוסמטיקה",
  "בריאות",
  "קליניקה",
  "אינסטלציה",
  "חשמל",
  "שיפוצים",
  "גן ילדים",
  "אופנה",
  "תכשיטים",
  "ספורט",
  "יוגה",
  "אמנות",
  "צילום",
  "חיות מחמד",
  "רכב",
];

const REFRESH_MS = 60_000;
let known: string[] | null = null;
let knownNorm = new Set<string>();
let lastRefresh = 0;

/** Normalized key for comparing categories (drops niqqud, quotes, case, extra spaces). */
export function normalizeCategory(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/["'’`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function setKnown(list: string[]): string[] {
  const byNorm = new Map<string, string>();
  for (const c of list) {
    const tag = (c ?? "").trim();
    if (!tag) continue;
    const norm = normalizeCategory(tag);
    if (norm && !byNorm.has(norm)) byNorm.set(norm, tag);
  }
  known = [...byNorm.values()];
  knownNorm = new Set(byNorm.keys());
  return known;
}

/**
 * The categories the model should prefer to reuse: those already used in the DB
 * (most common first) followed by the curated seeds. Cached briefly so we don't
 * query Firestore for every message.
 */
export async function getKnownCategories(force = false): Promise<string[]> {
  if (!force && known && Date.now() - lastRefresh < REFRESH_MS) return known;
  let used: string[] = [];
  try {
    const counts = await listCategoryCounts();
    used = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  } catch (err) {
    logger.warn({ err: String(err) }, "Failed to load existing categories; using seeds only");
  }
  lastRefresh = Date.now();
  return setKnown([...used, ...SEED_CATEGORIES]);
}

/**
 * Records categories we just assigned so later messages in the same run can reuse
 * them, even before the cache refreshes from Firestore.
 */
export function rememberCategories(cats: string[]): void {
  if (!known) return;
  for (const c of cats) {
    const tag = (c ?? "").trim();
    const norm = normalizeCategory(tag);
    if (norm && !knownNorm.has(norm)) {
      known.push(tag);
      knownNorm.add(norm);
    }
  }
}

/**
 * Cleans the model's raw categories: dedupes (by normalized form), snaps each one
 * to an existing spelling when it matches a known category, and caps the count.
 */
export function canonicalizeCategories(
  raw: string[],
  knownList: string[],
  max = MAX_CATEGORIES,
): string[] {
  const byNorm = new Map<string, string>();
  for (const k of knownList) {
    const norm = normalizeCategory(k ?? "");
    if (norm && !byNorm.has(norm)) byNorm.set(norm, (k ?? "").trim());
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw ?? []) {
    const trimmed = (r ?? "").trim();
    const norm = normalizeCategory(trimmed);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(byNorm.get(norm) ?? trimmed);
    if (out.length >= max) break;
  }
  return out;
}
