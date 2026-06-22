import type { Business, BusinessListResponse } from "../types";

/**
 * Base URL of the server API. Configure via VITE_API_BASE_URL (e.g. the public
 * tunnel URL in production, or http://localhost:3005 in dev). Trailing slashes
 * are trimmed so we can safely append paths.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3005").replace(/\/+$/, "");

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${path}`);
  }
  return (await res.json()) as T;
}

/**
 * In-memory session cache. Lives only for the current page load (module state is
 * reset on a browser reload), so navigating around the app doesn't re-hit the
 * server every time, while a reload still pulls fresh data.
 */
let listCache: Business[] | null = null;
const byId = new Map<string, Business>();

function remember(list: Business[]): Business[] {
  listCache = list;
  for (const b of list) if (b?.id) byId.set(b.id, b);
  return list;
}

/** Synchronously returns cached data if present (used to seed UI without a spinner). */
export function getCachedBusinesses(): Business[] | null {
  return listCache;
}

export function getCachedBusiness(id: string): Business | null {
  return byId.get(id) ?? null;
}

export async function fetchBusinesses(signal?: AbortSignal, force = false): Promise<Business[]> {
  if (!force && listCache) return listCache;
  const data = await getJson<BusinessListResponse>("/api/businesses", { signal });
  return remember(data.businesses ?? []);
}

export async function fetchBusiness(id: string, signal?: AbortSignal, force = false): Promise<Business> {
  if (!force) {
    const cached = byId.get(id);
    if (cached) return cached;
  }
  // The list response already carries full business objects, so this rarely runs
  // when arriving from the list - it's the fallback for deep links / hard reloads.
  const business = await getJson<Business>(`/api/businesses/${encodeURIComponent(id)}`, { signal });
  if (business?.id) byId.set(business.id, business);
  return business;
}
