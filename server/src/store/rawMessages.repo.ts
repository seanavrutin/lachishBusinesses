import { db, FieldValue } from "./firestore.js";
import type { RawMessage } from "../types/index.js";

const COLLECTION = "raw_messages";

function col() {
  return db().collection(COLLECTION);
}

export async function rawMessageExists(id: string): Promise<boolean> {
  const doc = await col().doc(id).get();
  return doc.exists;
}

export async function saveRawMessage(
  id: string,
  data: Omit<RawMessage, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  await col()
    .doc(id)
    .set(
      {
        ...data,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

/**
 * Fetch a batch of messages that are ready to process. Uses a single equality
 * filter (no composite index needed); the retry backoff window is applied in memory.
 */
export async function fetchProcessable(limit: number): Promise<RawMessage[]> {
  const now = Date.now();
  const snap = await col().where("status", "==", "pending").limit(limit * 3).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as RawMessage) }));
  return all
    .filter((m) => !m.nextAttemptAt || m.nextAttemptAt <= now)
    .sort((a, b) => a.waTimestamp - b.waTimestamp)
    .slice(0, limit);
}

/** All raw messages already attributed to a given business (any status). */
export async function findByBusinessId(businessId: string): Promise<RawMessage[]> {
  const snap = await col().where("businessId", "==", businessId).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as RawMessage) }));
}

export async function updateRawMessage(
  id: string,
  patch: Partial<RawMessage>,
): Promise<void> {
  await col()
    .doc(id)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
