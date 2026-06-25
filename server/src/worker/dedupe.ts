import { listForDedupe, type DedupeCandidate } from "../store/businesses.repo.js";
import type { BusinessExtraction } from "../extraction/schema.js";

export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalizeName(value).split(" ").filter(Boolean));
}

/**
 * Conservative fuzzy name match: every word of the shorter name appears in the
 * longer one, or the two share a high proportion of words. A "distinctive"
 * shared token (3+ chars) is required so businesses aren't merged on generic
 * words alone (e.g. "מאפיה", "חנות"). Errs toward NOT merging.
 */
function isFuzzyNameMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;

  const [small, large] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  let shared = 0;
  let hasDistinctiveShared = false;
  for (const token of small) {
    if (large.has(token)) {
      shared++;
      if (token.length >= 3) hasDistinctiveShared = true;
    }
  }
  if (!hasDistinctiveShared) return false;

  // Subset (all words of the shorter name present) or >=70% word overlap.
  return shared === small.size || shared / small.size >= 0.7;
}

function sameMoshav(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeName(a) === normalizeName(b);
}

function toMillis(value: FirebaseFirestore.Timestamp | Date | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof (value as FirebaseFirestore.Timestamp).toMillis === "function") {
    return (value as FirebaseFirestore.Timestamp).toMillis();
  }
  return 0;
}

/** When several names match, prefer the same moshav, then the most recent. */
function pickBest(matches: DedupeCandidate[], moshav?: string): DedupeCandidate {
  if (moshav) {
    const inMoshav = matches.find((m) => sameMoshav(m.location?.moshav, moshav));
    if (inMoshav) return inMoshav;
  }
  // reduce (no seed) returns a definite element; callers always pass a non-empty array.
  return matches.reduce((best, current) =>
    toMillis(current.lastPostedAt ?? current.lastUpdatedAt) >
    toMillis(best.lastPostedAt ?? best.lastUpdatedAt)
      ? current
      : best,
  );
}

/**
 * Finds an existing business that matches the extraction by name across the whole
 * directory (moshav is only a tie-breaker, never a gate). Exact normalized-name
 * matches win; otherwise a conservative fuzzy match is attempted. No phone match.
 */
export async function findMatch(
  extraction: BusinessExtraction,
  moshav?: string,
): Promise<DedupeCandidate | null> {
  if (!extraction.name) return null;

  const candidates = await listForDedupe();
  if (candidates.length === 0) return null;

  const target = normalizeName(extraction.name);

  const exact = candidates.filter((c) => normalizeName(c.name) === target);
  if (exact.length > 0) return pickBest(exact, moshav);

  const fuzzy = candidates.filter((c) => isFuzzyNameMatch(c.name, extraction.name!));
  if (fuzzy.length > 0) return pickBest(fuzzy, moshav);

  return null;
}
