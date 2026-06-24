import { db, FieldValue } from "./firestore.js";
import type { Business } from "../types/index.js";

const COLLECTION = "businesses";

function col() {
  return db().collection(COLLECTION);
}

export async function createBusiness(
  data: Omit<Business, "id" | "firstSeenAt" | "lastUpdatedAt">,
): Promise<string> {
  const ref = await col().add({
    ...data,
    firstSeenAt: FieldValue.serverTimestamp(),
    lastUpdatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateBusiness(
  id: string,
  patch: Partial<Business>,
): Promise<void> {
  await col()
    .doc(id)
    .set({ ...patch, lastUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function getBusiness(id: string): Promise<Business | null> {
  const doc = await col().doc(id).get();
  return doc.exists ? ({ id: doc.id, ...(doc.data() as Business) }) : null;
}

export async function findByMoshav(moshav: string): Promise<Business[]> {
  const snap = await col().where("location.moshav", "==", moshav).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Business) }));
}

/** Distinct categories currently in use, mapped to how many businesses use each. */
export async function listCategoryCounts(): Promise<Map<string, number>> {
  // Only pull the `categories` field to keep this cheap even as the collection grows.
  const snap = await col().select("categories").get();
  const counts = new Map<string, number>();
  for (const doc of snap.docs) {
    const cats = (doc.data().categories as string[] | undefined) ?? [];
    for (const c of cats) {
      const tag = c?.trim();
      if (tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

export interface BusinessFilter {
  category?: string;
  moshav?: string;
  q?: string;
}

/**
 * Lists businesses. Only a single equality filter is pushed to Firestore (moshav,
 * else category) to avoid composite indexes; remaining filters are applied in memory.
 */
export async function listBusinesses(filter: BusinessFilter): Promise<Business[]> {
  let query: FirebaseFirestore.Query = col();
  let categoryFilteredInQuery = false;

  if (filter.moshav) {
    query = query.where("location.moshav", "==", filter.moshav);
  } else if (filter.category) {
    query = query.where("categories", "array-contains", filter.category);
    categoryFilteredInQuery = true;
  }

  const snap = await query.get();
  let results = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Business) }));

  if (filter.category && !categoryFilteredInQuery) {
    results = results.filter((b) => b.categories?.includes(filter.category!));
  }

  if (filter.q) {
    const needle = filter.q.toLowerCase();
    results = results.filter((b) =>
      [b.name, b.description, b.location?.raw, b.location?.moshav, ...(b.categories ?? [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }

  return results;
}
