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

function upsertCache(business: Business): void {
  if (business?.id) byId.set(business.id, business);
  if (listCache) {
    const i = listCache.findIndex((b) => b.id === business.id);
    if (i >= 0) listCache[i] = business;
    else listCache = [business, ...listCache];
  }
}

function removeFromCache(id: string): void {
  byId.delete(id);
  if (listCache) listCache = listCache.filter((b) => b.id !== id);
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

// ---- Admin (edit/delete) ----

const ADMIN_TOKEN_KEY = "lachish_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    /* ignore storage errors (private mode, disabled storage, ...) */
  }
}

function adminHeaders(): Record<string, string> {
  const token = getAdminToken();
  return token ? { "x-admin-token": token } : {};
}

async function writeError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "טוקן ניהול שגוי או חסר";
  if (res.status === 503) return "מצב ניהול מושבת בשרת";
  try {
    const data = (await res.json()) as { error?: string };
    return data?.error || `${fallback} (${res.status})`;
  } catch {
    return `${fallback} (${res.status})`;
  }
}

/** Checks a candidate admin token against the server. */
export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/admin/verify`, {
      headers: { "x-admin-token": token },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function updateBusiness(id: string, patch: Partial<Business>): Promise<Business> {
  const res = await fetch(`${API_BASE}/api/businesses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...adminHeaders() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await writeError(res, "השמירה נכשלה"));
  const business = (await res.json()) as Business;
  upsertCache(business);
  return business;
}

export async function deleteBusiness(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/businesses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error(await writeError(res, "המחיקה נכשלה"));
  removeFromCache(id);
}
