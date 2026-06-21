import { findByMoshav } from "../store/businesses.repo.js";
import type { Business } from "../types/index.js";
import type { BusinessExtraction } from "../extraction/schema.js";

export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? digits.slice(-9) : null;
}

/**
 * Finds an existing business that matches the extraction, scoped to the same moshav
 * when known. Matches on normalized name, with phone as a fallback signal.
 */
export async function findMatch(
  extraction: BusinessExtraction,
  moshav?: string,
): Promise<Business | null> {
  if (!extraction.name) return null;

  const candidates = moshav ? await findByMoshav(moshav) : [];
  if (candidates.length === 0) return null;

  const targetName = normalizeName(extraction.name);
  const targetPhone = normalizePhone(extraction.phone);

  for (const candidate of candidates) {
    if (normalizeName(candidate.name) === targetName) return candidate;
  }

  if (targetPhone) {
    for (const candidate of candidates) {
      if (normalizePhone(candidate.phone) === targetPhone) return candidate;
    }
  }

  return null;
}
